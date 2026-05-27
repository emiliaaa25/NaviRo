"""Activities, peers, forum — shared DB helpers for api_server and assistant."""
from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional, Tuple

try:
    from actions.db import db
except ImportError:  
    from db import db

COHORT_SEPT_2026 = "Sept 2026 arrivals"


def _activity_row(row) -> Dict[str, Any]:
    _id, name, typ, target, link, description, keywords, meeting_location, schedule, created_at = row
    if isinstance(target, str):
        try:
            target = json.loads(target)
        except Exception:
            target = []
    return {
        "id": _id,
        "name": name,
        "type": typ,
        "target": target or [],
        "link": link,
        "description": description or "",
        "keywords": keywords or "",
        "meeting_location": meeting_location or "",
        "schedule": schedule or "",
        "created_at": created_at.isoformat() if created_at else None,
    }


def _tokenize(text: str) -> set:
    return {w for w in re.split(r"\W+", (text or "").lower()) if len(w) > 2}


def _user_profile_bits(user_id: int) -> Tuple[Optional[str], Optional[str], Optional[str], List[str]]:
    country = program = citizenship = None
    milestones: List[str] = []
    try:
        with db.get_cursor() as cur:
            cur.execute(
                """SELECT COALESCE(sp.country_of_origin, q.country_of_origin),
                          COALESCE(sp.study_program, q.study_program),
                          q.citizenship_type,
                          q.languages_spoken
                   FROM users u
                   LEFT JOIN student_profiles sp ON sp.user_id = u.id
                   LEFT JOIN quest_relocation_profiles q ON q.user_id = u.id
                   WHERE u.id = %s""",
                (user_id,),
            )
            row = cur.fetchone()
            if row:
                country, program, citizenship = row[0], row[1], row[2]
            cur.execute(
                """SELECT milestone_name FROM quest_progress
                   WHERE user_id = %s AND status IN ('In Progress', 'Locked', 'Complete')
                   ORDER BY updated_at DESC LIMIT 5""",
                (user_id,),
            )
            milestones = [r[0] for r in cur.fetchall() if r[0]]
    except Exception as exc:
        print(f"[social_helpers] profile bits: {exc}")
    return country, program, citizenship, milestones


def _user_activity_prefs(user_id: int) -> Tuple[str, str]:
    interests, preferred_types = "", ""
    try:
        with db.get_cursor() as cur:
            cur.execute(
                "SELECT interests, preferred_types FROM user_activity_preferences WHERE user_id = %s",
                (user_id,),
            )
            row = cur.fetchone()
            if row:
                interests, preferred_types = row[0] or "", row[1] or ""
    except Exception:
        pass
    return interests, preferred_types


def score_activity_for_user(row_dict: Dict[str, Any], user_id: int) -> float:
    country, program, citizenship, milestones = _user_profile_bits(user_id)
    interests, preferred_types = _user_activity_prefs(user_id)
    score = 0.0
    blob = " ".join(
        [
            row_dict.get("name") or "",
            row_dict.get("description") or "",
            row_dict.get("keywords") or "",
            row_dict.get("type") or "",
            " ".join(row_dict.get("target") or []),
        ]
    ).lower()
    if country and country.lower() in blob:
        score += 2
    if program and program.lower() in blob:
        score += 2
    if citizenship and citizenship.lower() in blob:
        score += 1
    for m in milestones:
        if m and m.lower() in blob:
            score += 1.5
    for w in _tokenize(interests + " " + preferred_types + " " + (program or "")):
        if w in blob:
            score += 0.4
    targets = [t.lower() for t in (row_dict.get("target") or [])]
    if citizenship == "EU" and any("eu" in t for t in targets):
        score += 1
    if citizenship and citizenship != "EU" and any("non-eu" in t for t in targets):
        score += 1
    if any("new arrival" in t for t in targets):
        score += 0.5
    return score


def fetch_activities_filtered(
    q: Optional[str] = None,
    typ: Optional[str] = None,
    target: Optional[str] = None,
    meeting_location: Optional[str] = None,
    schedule: Optional[str] = None,
    limit: int = 40,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    clauses = ["1=1"]
    params: List[Any] = []

    if typ:
        clauses.append("LOWER(type) = LOWER(%s)")
        params.append(typ.strip())
    if meeting_location:
        clauses.append("LOWER(meeting_location) = LOWER(%s)")
        params.append(meeting_location.strip())
    if schedule:
        clauses.append("LOWER(schedule) = LOWER(%s)")
        params.append(schedule.strip())
    if target:
        clauses.append("target::text ILIKE %s")
        params.append(f"%{target.strip()}%")
    if q:
        clauses.append(
            "(name ILIKE %s OR description ILIKE %s OR keywords ILIKE %s OR type ILIKE %s)"
        )
        needle = f"%{q.strip()}%"
        params.extend([needle, needle, needle, needle])

    where_sql = " AND ".join(clauses)
    params.extend([limit, offset])

    sql = f"""
        SELECT id, name, type, target, link, description, keywords, meeting_location, schedule, created_at
        FROM activities
        WHERE {where_sql}
        ORDER BY name ASC
        LIMIT %s OFFSET %s
    """
    out: List[Dict[str, Any]] = []
    try:
        with db.get_cursor() as cur:
            cur.execute(sql, tuple(params))
            for row in cur.fetchall():
                out.append(_activity_row(row))
    except Exception as exc:
        print(f"[social_helpers] fetch_activities_filtered: {exc}")
    return out


def fetch_recommended_activities(user_id: int, limit: int = 12) -> List[Dict[str, Any]]:
    limit = max(1, min(limit, 50))
    try:
        with db.get_cursor() as cur:
            cur.execute(
                """
                SELECT id, name, type, target, link, description, keywords, meeting_location, schedule, created_at
                FROM activities
                ORDER BY id ASC
                LIMIT 400
                """
            )
            rows = cur.fetchall()
    except Exception as exc:
        print(f"[social_helpers] fetch_recommended: {exc}")
        return []

    scored: List[Tuple[float, Dict[str, Any]]] = []
    for row in rows:
        d = _activity_row(row)
        scored.append((score_activity_for_user(d, user_id), d))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [d for _, d in scored[:limit]]


def upsert_activity_preferences(user_id: int, interests: str = "", preferred_types: str = "") -> bool:
    try:
        with db.get_cursor() as cur:
            cur.execute(
                """
                INSERT INTO user_activity_preferences (user_id, interests, preferred_types)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id) DO UPDATE SET
                    interests = EXCLUDED.interests,
                    preferred_types = EXCLUDED.preferred_types,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (user_id, interests or "", preferred_types or ""),
            )
        return True
    except Exception as exc:
        print(f"[social_helpers] upsert_activity_preferences: {exc}")
        return False


def ordered_pair(a: int, b: int) -> Tuple[int, int]:
    if a == b:
        raise ValueError("Cannot pair user with themselves")
    return (min(a, b), max(a, b))


def find_peer_candidates(
    user_id: int,
    country: Optional[str] = None,
    program: Optional[str] = None,
    language: Optional[str] = None,
    limit: int = 30,
) -> List[Dict[str, Any]]:
    limit = max(1, min(limit, 80))
    params: List[Any] = [user_id]

    has_filters = bool(
        (country and country.strip())
        or (program and program.strip())
        or (language and language.strip())
    )

    
    clauses = ["u.id <> %s"]
    if has_filters:
        clauses.append("(sp.country_of_origin IS NOT NULL OR q.country_of_origin IS NOT NULL OR sp.study_program IS NOT NULL OR q.study_program IS NOT NULL OR q.languages_spoken IS NOT NULL)")

    if country and country.strip():
        clauses.append("COALESCE(sp.country_of_origin, q.country_of_origin) ILIKE %s")
        params.append(f"%{country.strip()}%")
    if program and program.strip():
        clauses.append(
            "(COALESCE(sp.study_program, q.study_program) ILIKE %s OR sp.specialization ILIKE %s OR sp.faculty ILIKE %s)"
        )
        needle = f"%{program.strip()}%"
        params.extend([needle, needle, needle])
    if language and language.strip():
        clauses.append("q.languages_spoken ILIKE %s")
        params.append(f"%{language.strip()}%")

    where_sql = " AND ".join(clauses)
    params.append(limit)

    sql = f"""
        SELECT u.id, u.username,
             COALESCE(sp.country_of_origin, q.country_of_origin, '') AS country_of_origin,
             COALESCE(sp.study_program, q.study_program, '') AS study_program,
               COALESCE(q.languages_spoken, '') AS languages_spoken,
               COALESCE(q.citizenship_type, '') AS citizenship_type
        FROM users u
        INNER JOIN student_profiles sp ON sp.user_id = u.id
        LEFT JOIN quest_relocation_profiles q ON q.user_id = u.id
        WHERE {where_sql}
        ORDER BY u.username ASC
        LIMIT %s
    """
    out: List[Dict[str, Any]] = []
    try:
        with db.get_cursor() as cur:
            cur.execute(sql, tuple(params))
            for row in cur.fetchall():
                out.append(
                    {
                        "user_id": row[0],
                        "username": row[1],
                        "country_of_origin": row[2] or None,
                        "study_program": row[3] or None,
                        "languages_spoken": row[4] or None,
                        "citizenship_type": row[5] or None,
                    }
                )
    except Exception as exc:
        print(f"[social_helpers] find_peer_candidates: {exc}")
    return out


def get_peer_connections(user_id: int) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    try:
        with db.get_cursor() as cur:
            cur.execute(
                """
                SELECT c.id, c.user_a_id, c.user_b_id, c.status, c.created_at
                FROM peer_connections c
                WHERE c.user_a_id = %s OR c.user_b_id = %s
                ORDER BY c.created_at DESC
                """,
                (user_id, user_id),
            )
            rows = cur.fetchall()
            for conn_id, ua, ub, status, created_at in rows:
                peer_id = ub if ua == user_id else ua
                cur.execute("SELECT username FROM users WHERE id = %s", (peer_id,))
                pr = cur.fetchone()
                peer_username = pr[0] if pr else ""
                out.append(
                    {
                        "connection_id": conn_id,
                        "peer_user_id": peer_id,
                        "peer_username": peer_username,
                        "status": status,
                        "created_at": created_at.isoformat() if created_at else None,
                    }
                )
    except Exception as exc:
        print(f"[social_helpers] get_peer_connections: {exc}")
    return out


def _connection_belongs_to_user(connection_id: int, user_id: int) -> bool:
    with db.get_cursor() as cur:
        cur.execute(
            """
            SELECT 1 FROM peer_connections
            WHERE id = %s AND (user_a_id = %s OR user_b_id = %s)
            """,
            (connection_id, user_id, user_id),
        )
        return cur.fetchone() is not None


def create_peer_match(requester_id: int, peer_user_id: Optional[int], mode: str) -> Optional[Dict[str, Any]]:
    mode = (mode or "manual").lower()
    target_peer = peer_user_id
    if mode == "auto":
        candidates = find_peer_candidates(requester_id, limit=50)
        existing = {c["peer_user_id"] for c in get_peer_connections(requester_id)}
        for c in candidates:
            if c["user_id"] not in existing:
                target_peer = c["user_id"]
                break
        if not target_peer:
            return None
    if not target_peer or target_peer == requester_id:
        return None

    ua, ub = ordered_pair(requester_id, int(target_peer))
    try:
        with db.get_cursor() as cur:
            cur.execute(
                """
                INSERT INTO peer_connections (user_a_id, user_b_id, status)
                VALUES (%s, %s, 'active')
                ON CONFLICT (user_a_id, user_b_id) DO UPDATE SET status = 'active'
                RETURNING id
                """,
                (ua, ub),
            )
            row = cur.fetchone()
            if not row:
                return None
            conn_id = row[0]
        for c in get_peer_connections(requester_id):
            if c["connection_id"] == conn_id:
                return c
    except Exception as exc:
        print(f"[social_helpers] create_peer_match: {exc}")
    return None


def fetch_peer_chat_messages(
    user_id: int,
    room_type: str,
    connection_id: Optional[int] = None,
    cohort_key: Optional[str] = None,
    limit: int = 80,
) -> List[Dict[str, Any]]:
    limit = max(1, min(limit, 200))
    out: List[Dict[str, Any]] = []
    try:
        with db.get_cursor() as cur:
            if room_type == "buddy":
                if not connection_id or not _connection_belongs_to_user(connection_id, user_id):
                    return []
                cur.execute(
                    """
                    SELECT m.id, m.sender_id, u.username, m.body, m.created_at
                    FROM peer_chat_messages m
                    JOIN users u ON u.id = m.sender_id
                    WHERE m.room_type = 'buddy' AND m.peer_connection_id = %s
                    ORDER BY m.created_at ASC
                    LIMIT %s
                    """,
                    (connection_id, limit),
                )
            elif room_type == "cohort":
                key = cohort_key or COHORT_SEPT_2026
                cur.execute(
                    """
                    SELECT m.id, m.sender_id, u.username, m.body, m.created_at
                    FROM peer_chat_messages m
                    JOIN users u ON u.id = m.sender_id
                    WHERE m.room_type = 'cohort' AND m.cohort_key = %s
                    ORDER BY m.created_at ASC
                    LIMIT %s
                    """,
                    (key, limit),
                )
            else:
                return []

            for mid, sid, uname, body, created_at in cur.fetchall():
                out.append(
                    {
                        "id": mid,
                        "sender_id": sid,
                        "sender_username": uname,
                        "body": body,
                        "created_at": created_at.isoformat() if created_at else None,
                    }
                )
    except Exception as exc:
        print(f"[social_helpers] fetch_peer_chat_messages: {exc}")
    return out


def post_peer_chat_message(
    user_id: int,
    room_type: str,
    body: str,
    connection_id: Optional[int] = None,
    cohort_key: Optional[str] = None,
) -> bool:
    text = (body or "").strip()
    if not text:
        return False
    try:
        with db.get_cursor() as cur:
            if room_type == "buddy":
                if not connection_id or not _connection_belongs_to_user(connection_id, user_id):
                    return False
                cur.execute(
                    """
                    INSERT INTO peer_chat_messages (sender_id, body, room_type, peer_connection_id, cohort_key)
                    VALUES (%s, %s, 'buddy', %s, NULL)
                    """,
                    (user_id, text, connection_id),
                )
            elif room_type == "cohort":
                key = cohort_key or COHORT_SEPT_2026
                cur.execute(
                    """
                    INSERT INTO peer_chat_messages (sender_id, body, room_type, peer_connection_id, cohort_key)
                    VALUES (%s, %s, 'cohort', NULL, %s)
                    """,
                    (user_id, text, key),
                )
            else:
                return False
        return True
    except Exception as exc:
        print(f"[social_helpers] post_peer_chat_message: {exc}")
        return False


def forum_list_questions(limit: int = 40) -> List[Dict[str, Any]]:
    limit = max(1, min(limit, 100))
    try:
        db.ensure_demo_forum_if_empty()
    except Exception as exc:
        print(f"[social_helpers] ensure_demo_forum_if_empty: {exc}")
    out: List[Dict[str, Any]] = []
    try:
        with db.get_cursor() as cur:
            cur.execute(
                """
                SELECT q.id, q.user_id, u.username, q.title, q.body, q.tags, q.created_at,
                       COALESCE((
                           SELECT SUM(v.vote) FROM forum_question_votes v WHERE v.question_id = q.id
                       ), 0) AS score
                FROM forum_questions q
                JOIN users u ON u.id = q.user_id
                ORDER BY score DESC, q.created_at DESC
                LIMIT %s
                """,
                (limit,),
            )
            for row in cur.fetchall():
                out.append(
                    {
                        "id": row[0],
                        "user_id": row[1],
                        "username": row[2],
                        "title": row[3],
                        "body": row[4],
                        "tags": row[5],
                        "created_at": row[6].isoformat() if row[6] else None,
                        "score": int(row[7] or 0),
                    }
                )
    except Exception as exc:
        print(f"[social_helpers] forum_list_questions: {exc}")
    return out


def forum_get_question(question_id: int) -> Optional[Dict[str, Any]]:
    try:
        with db.get_cursor() as cur:
            cur.execute(
                """
                SELECT q.id, q.user_id, u.username, q.title, q.body, q.tags, q.created_at,
                       COALESCE((SELECT SUM(v.vote) FROM forum_question_votes v WHERE v.question_id = q.id), 0)
                FROM forum_questions q
                JOIN users u ON u.id = q.user_id
                WHERE q.id = %s
                """,
                (question_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            qd = {
                "id": row[0],
                "user_id": row[1],
                "username": row[2],
                "title": row[3],
                "body": row[4],
                "tags": row[5],
                "created_at": row[6].isoformat() if row[6] else None,
                "score": int(row[7] or 0),
            }
            cur.execute(
                """
                SELECT a.id, a.user_id, ua.username, a.body, a.is_accepted, a.created_at,
                       COALESCE((SELECT SUM(v.vote) FROM forum_answer_votes v WHERE v.answer_id = a.id), 0)
                FROM forum_answers a
                JOIN users ua ON ua.id = a.user_id
                WHERE a.question_id = %s
                ORDER BY a.created_at ASC
                """,
                (question_id,),
            )
            answers = []
            for ar in cur.fetchall():
                answers.append(
                    {
                        "id": ar[0],
                        "user_id": ar[1],
                        "username": ar[2],
                        "body": ar[3],
                        "is_accepted": bool(ar[4]),
                        "created_at": ar[5].isoformat() if ar[5] else None,
                        "score": int(ar[6] or 0),
                    }
                )
            qd["answers"] = answers
            return qd
    except Exception as exc:
        print(f"[social_helpers] forum_get_question: {exc}")
        return None


def forum_create_question(user_id: int, title: str, body: str, tags: str = "") -> Optional[int]:
    title = (title or "").strip()
    body = (body or "").strip()
    if not title or not body:
        return None
    try:
        with db.get_cursor() as cur:
            cur.execute(
                """
                INSERT INTO forum_questions (user_id, title, body, tags)
                VALUES (%s, %s, %s, %s) RETURNING id
                """,
                (user_id, title[:255], body, (tags or "")[:255]),
            )
            row = cur.fetchone()
            return int(row[0]) if row else None
    except Exception as exc:
        print(f"[social_helpers] forum_create_question: {exc}")
        return None


def forum_create_answer(user_id: int, question_id: int, body: str) -> Optional[int]:
    body = (body or "").strip()
    if not body:
        return None
    try:
        with db.get_cursor() as cur:
            cur.execute("SELECT 1 FROM forum_questions WHERE id = %s", (question_id,))
            if not cur.fetchone():
                return None
            cur.execute(
                """
                INSERT INTO forum_answers (question_id, user_id, body)
                VALUES (%s, %s, %s) RETURNING id
                """,
                (question_id, user_id, body),
            )
            row = cur.fetchone()
            return int(row[0]) if row else None
    except Exception as exc:
        print(f"[social_helpers] forum_create_answer: {exc}")
        return None


def forum_vote_question(user_id: int, question_id: int, vote: int) -> bool:
    if vote not in (-1, 1):
        return False
    try:
        with db.get_cursor() as cur:
            cur.execute("SELECT 1 FROM forum_questions WHERE id = %s", (question_id,))
            if not cur.fetchone():
                return False
            cur.execute(
                """
                INSERT INTO forum_question_votes (user_id, question_id, vote)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id, question_id) DO UPDATE SET vote = EXCLUDED.vote
                """,
                (user_id, question_id, vote),
            )
        return True
    except Exception as exc:
        print(f"[social_helpers] forum_vote_question: {exc}")
        return False


def forum_vote_answer(user_id: int, answer_id: int, vote: int) -> bool:
    if vote not in (-1, 1):
        return False
    try:
        with db.get_cursor() as cur:
            cur.execute("SELECT 1 FROM forum_answers WHERE id = %s", (answer_id,))
            if not cur.fetchone():
                return False
            cur.execute(
                """
                INSERT INTO forum_answer_votes (user_id, answer_id, vote)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id, answer_id) DO UPDATE SET vote = EXCLUDED.vote
                """,
                (user_id, answer_id, vote),
            )
        return True
    except Exception as exc:
        print(f"[social_helpers] forum_vote_answer: {exc}")
        return False


def load_activities_for_assistant(limit: int = 80) -> List[Dict[str, Any]]:
    limit = max(1, min(limit, 300))
    try:
        with db.get_cursor() as cur:
            cur.execute(
                """
                SELECT id, name, type, target, link, description, keywords, meeting_location, schedule, created_at
                FROM activities ORDER BY id ASC LIMIT %s
                """,
                (limit,),
            )
            return [_activity_row(r) for r in cur.fetchall()]
    except Exception as exc:
        print(f"[social_helpers] load_activities_for_assistant: {exc}")
        return []


def suggest_peers_summary_for_assistant(user_id: int) -> str:
    country, program, _, _ = _user_profile_bits(user_id)
    if not country and not program:
        return ""
    peers = find_peer_candidates(user_id, country=country, program=program, limit=20)
    if not peers:
        return ""
    n = len(peers)
    return (
        f"There are about **{n}** students in NaviRo with a similar country/program profile. "
        "Invite the user to open **Buddy Finder** to browse or request a match — do not share usernames in chat."
    )
