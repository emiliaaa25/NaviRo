import json
from pathlib import Path
import sys
import os
import re
import tempfile
from urllib.parse import urlparse

from flask import Flask, request, session, Response, jsonify, stream_with_context
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from openai import AzureOpenAI

from actions.config import Config
from actions.db import db
from actions.social_helpers import (
    fetch_recommended_activities,
    suggest_peers_summary_for_assistant,
)
from actions.utils import store_conversation
from actions.voice_processor import VoiceProcessor

# Force unbuffered output so logs appear immediately
sys.stdout = sys.stderr

app = Flask(__name__)
app.secret_key = "your_secret_key"
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "None"
app.config["SESSION_COOKIE_SECURE"] = True

client = AzureOpenAI(
    api_key=Config.AZURE_API_KEY,
    api_version=Config.AZURE_API_VERSION,
    azure_endpoint=Config.AZURE_PROJECT_ENDPOINT,
)

CORS(app, supports_credentials=True, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")


def _load_verified_links_from_db():
    """Load all active verified links from the database."""
    try:
        with db.get_cursor() as cur:
            cur.execute(
                """SELECT category, title, url, description, keywords
                   FROM verified_links
                   WHERE is_active = TRUE
                   ORDER BY category, title"""
            )
            rows = cur.fetchall()
            links = []
            for row in rows:
                links.append({
                    "category": row[0],
                    "title": row[1],
                    "url": row[2],
                    "description": row[3],
                    "keywords": row[4] or ""
                })
            return links
    except Exception as e:
        print(f"Error loading verified links from DB: {e}")
        return []


def _load_verified_links_from_json():
    """Load verified links from verified_links.json as the canonical source."""
    seed_path = Path(__file__).with_name("verified_links.json")
    if not seed_path.exists():
        return []

    try:
        with seed_path.open("r", encoding="utf-8") as file:
            data = json.load(file)
            links = data.get("links", [])
            if isinstance(links, list):
                return links
    except Exception as e:
        print(f"Error loading verified links from JSON: {e}")
    return []
def _load_citation_mapping():
    """Load filename -> URL citation mapping from mapping.json as a fallback."""
    mapping_path = Path(__file__).with_name("mapping.json")
    if not mapping_path.exists():
        return {}

    try:
        with mapping_path.open("r", encoding="utf-8") as file:
            data = json.load(file)
            return data if isinstance(data, dict) else {}
    except Exception as e:
        print(f"Error loading citation mapping: {e}")
        return {}


CITATION_MAPPING = _load_citation_mapping()


def _seed_verified_links_from_json():
    """One-time seed verified links from JSON file into database."""
    seed_path = Path(__file__).with_name("verified_links.json")
    if not seed_path.exists():
        print(f"No verified_links.json found at {seed_path}")
        return

    try:
        with seed_path.open("r", encoding="utf-8") as file:
            data = json.load(file)
            links = data.get("links", [])

        with db.get_cursor() as cur:
            for link in links:
                cur.execute(
                    """INSERT INTO verified_links
                       (category, title, url, description, keywords, is_active)
                       VALUES (%s, %s, %s, %s, %s, TRUE)
                       ON CONFLICT (url) DO NOTHING""",
                    (
                        link.get("category"),
                        link.get("title"),
                        link.get("url"),
                        link.get("description"),
                        link.get("keywords")
                    )
                )
        print(f"Seeded {len(links)} verified links from JSON")
    except Exception as e:
        print(f"Error seeding verified links from JSON: {e}")

# Ensure DB schema (activities, forum, peers) exists before seeding links
try:
    db.init_db()
except Exception as _init_err:
    print(f"[assistant] db.init_db(): {_init_err}")

# One-time seed of verified links on app startup
_seed_verified_links_from_json()

QUEST_MILESTONES = [
    "Initial Profiling",
    "Admission & Docs",
    "Visa",
    "Iași Arrival",
]

QUEST_STEP_SEQUENCE = [
    "Submit Application",
    "Wait & Track",
    "Receive Offer",
    "Housing Application",
    "Pre-Arrival",
]

QUEST_STEP_KEYWORDS = {
    "Submit Application": ["submit application", "application", "portal", "documents", "fee", "upload"],
    "Wait & Track": ["wait", "track", "email", "follow up", "update", "status"],
    "Receive Offer": ["offer", "accept", "reject", "enrollment", "confirm", "admission result"],
    "Housing Application": ["housing", "dorm", "accommodation", "room", "rent", "backup housing"],
    "Pre-Arrival": ["pre-arrival", "flight", "transport", "bank", "sim", "arrival", "departure"],
}


def _detect_quest_step_focus(user_message):
    message = (user_message or "").lower()
    if not message:
        return None

    for step_name, keywords in QUEST_STEP_KEYWORDS.items():
        for keyword in keywords:
            if re.search(rf"\b{re.escape(keyword)}\b", message):
                return step_name
    return None


def _detect_rag_category(user_message):
    message = (user_message or "").lower()
    if not message:
        return None

    healthcare_terms = (
        "healthcare",
        "health care",
        "medical",
        "medicine",
        "doctor",
        "clinic",
        "hospital",
        "insurance",
        "ehic",
        "cnas",
        "emergency",
        "pharmacy",
    )

    if any(term in message for term in healthcare_terms):
        return "HEALTHCARE"

    return None


def _detect_student_preferences(user_message):
    """
    Detect student's preferred university and program from their message.
    Returns dict with 'university' and 'program' keys.
    """
    msg_lower = (user_message or "").lower()
    
    preferences = {
        'university': None,  # UAIC, TUIASI, UMF, or None
        'program': None      # LIBERAL_ARTS, ENGINEERING, MEDICINE, or None
    }
    
    # Detect university preference
    if any(term in msg_lower for term in ("medicine", "medical", "pharmacy", "dental", "umf", "grigore popa")):
        preferences['university'] = 'UMF'
        preferences['program'] = 'MEDICINE'
    elif any(term in msg_lower for term in ("engineering", "engineer", "technical", "tuiasi", "computer science", "software", "it program")):
        preferences['university'] = 'TUIASI'
        preferences['program'] = 'ENGINEERING'
    elif any(term in msg_lower for term in ("uaic", "literature", "history", "philosophy", "languages", "liberal arts", "social sciences", "humanities")):
        preferences['university'] = 'UAIC'
        preferences['program'] = 'LIBERAL_ARTS'
    
    return preferences


def _save_student_preferences(user_id, preferences):
    """
    Save detected student preferences to quest_relocation_profiles.
    Creates profile if not exists, updates if exists.
    """
    if not user_id or (not preferences.get('university') and not preferences.get('program')):
        return
    
    try:
        with db.get_cursor() as cur:
            # Check if profile exists
            cur.execute("SELECT id FROM quest_relocation_profiles WHERE user_id = %s", (user_id,))
            exists = cur.fetchone()
            
            if exists:
                # Update existing profile
                updates = []
                params = []
                if preferences.get('university'):
                    updates.append("target_university = %s")
                    params.append(preferences['university'])
                if preferences.get('program'):
                    updates.append("study_program = %s")
                    params.append(preferences['program'])
                
                if updates:
                    updates.append("updated_at = CURRENT_TIMESTAMP")
                    params.append(user_id)
                    query = f"UPDATE quest_relocation_profiles SET {', '.join(updates)} WHERE user_id = %s"
                    cur.execute(query, params)
                    print(f"[PROFILE] Updated student preferences: {preferences}")
            else:
                # Create new profile with defaults
                cur.execute("""
                    INSERT INTO quest_relocation_profiles 
                    (user_id, country_of_origin, citizenship_type, target_university, study_program)
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    user_id, 
                    'Unknown',  # Will be detected later
                    'Unknown',  # Will be detected later
                    preferences.get('university'),
                    preferences.get('program')
                ))
                print(f"[PROFILE] Created new student profile with preferences: {preferences}")
    except Exception as e:
        print(f"[PROFILE] Error saving preferences: {e}")

# ── RAG: Verified Links Database ────────────────────────────────────────────


# Load verified links into memory (lazy load on first use)
VERIFIED_LINKS_CACHE = None

QUERY_SYNONYMS = {
    "medicina": ["medicine", "medical", "umf", "grigore", "popa"],
    "medicala": ["medicine", "medical", "umf", "grigore", "popa"],
    "farmacie": ["pharmacy", "medical", "umf", "grigore", "popa"],
    "stomatologie": ["dental", "medicine", "umf", "grigore", "popa"],
    "universitatea de medicina": ["grigore", "popa", "umf"],
    "umf": ["grigore", "popa", "medicine", "medical"],
    "grigore": ["grigore", "popa", "medicine", "medical"],
    "popa": ["grigore", "popa", "medicine", "medical"],
}


def _get_verified_links():
    """Get verified links from cache or load from canonical JSON + DB fallback."""
    global VERIFIED_LINKS_CACHE
    if VERIFIED_LINKS_CACHE is None:
        json_links = _load_verified_links_from_json()
        db_links = _load_verified_links_from_db()

        merged = []
        seen_urls = set()
        seen_titles = set()

        for link in json_links + db_links:
            url = (link.get("url") or "").strip().lower()
            title = (link.get("title") or "").strip().lower()
            if not url or url in seen_urls:
                continue
            if title and title in seen_titles:
                continue
            seen_urls.add(url)
            if title:
                seen_titles.add(title)
            merged.append(link)

        VERIFIED_LINKS_CACHE = merged
    return VERIFIED_LINKS_CACHE


def _slugify_citation_name(value):
    text = (value or "").lower()
    text = re.sub(r"\.[a-z0-9]+$", "", text)
    text = text.replace("_", " ").replace("-", " ")
    text = re.sub(r"[^a-z0-9ăâîșț ]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _verified_link_search_blob(link):
    return " ".join(
        [
            link.get("title", ""),
            link.get("description", ""),
            link.get("keywords", ""),
            link.get("url", ""),
        ]
    ).lower()


def _resolve_verified_link_for_citation(filename):
    """Match a citation filename to the closest verified link URL."""
    if not filename:
        return None

    citation_slug = _slugify_citation_name(filename)
    if not citation_slug:
        return None

    links = _get_verified_links()
    best_url = None
    best_score = 0.0

    for link in links:
        blob = _verified_link_search_blob(link)
        score = _similarity_score(citation_slug, blob)

        title = (link.get("title") or "").lower()
        url = (link.get("url") or "").lower()
        keywords = (link.get("keywords") or "").lower()

        if citation_slug in title or citation_slug in url or citation_slug in keywords:
            score += 0.75

        if score > best_score:
            best_score = score
            best_url = link.get("url")

    return best_url if best_score >= 0.2 else None
    


def _similarity_score(query, text):
    """Simple keyword-based similarity score between query and text."""
    if not query or not text:
        return 0.0
    
    normalized_query = query.lower()
    for source_term, expansions in QUERY_SYNONYMS.items():
        if source_term in normalized_query:
            normalized_query += " " + " ".join(expansions)

    query_words = set(re.findall(r"[a-z0-9ăâîșț]+", normalized_query))
    text_words = set(re.findall(r"[a-z0-9ăâîșț]+", text.lower()))
    
    if not query_words or not text_words:
        return 0.0
    
    intersection = query_words & text_words
    union = query_words | text_words
    
    return len(intersection) / len(union)


def _find_relevant_links(user_message, category=None, top_k=3, user_id=None):
    """
    Find relevant verified links using similarity search against keywords/description.
    Boosts links from the detected query category and student's preferred university/program.
    
    Args:
        user_message: User's question or context
        category: Optional filter (e.g., 'MAE', 'IGI', 'OFFICIAL')
        top_k: Number of top results to return
        user_id: User ID for retrieving stored preferences
    
    Returns:
        List of relevant link dicts sorted by relevance
    """
    print(f"[RAG] Starting link discovery for message: {user_message[:80]}...")
    links = _get_verified_links()
    print(f"[RAG] Loaded {len(links)} verified links from cache")
    
    if not links:
        print(f"[RAG] No verified links available")
        return []
    
    # Detect student's current preferences from message
    student_prefs = _detect_student_preferences(user_message)
    print(f"[RAG] Detected student preferences: university={student_prefs['university']}, program={student_prefs['program']}")
    
    # Try to load stored preferences from DB if user_id provided
    stored_university = None
    stored_program = None
    if user_id:
        try:
            with db.get_cursor() as cur:
                cur.execute("""
                    SELECT target_university, study_program 
                    FROM quest_relocation_profiles 
                    WHERE user_id = %s
                """, (user_id,))
                row = cur.fetchone()
                if row:
                    stored_university = row[0]
                    stored_program = row[1]
                    print(f"[RAG] Loaded stored preferences: university={stored_university}, program={stored_program}")
        except Exception as e:
            print(f"[RAG] Could not load stored preferences: {e}")
    
    # Merge current detection with stored preferences (current takes precedence)
    student_university = student_prefs['university'] or stored_university
    student_program = student_prefs['program'] or stored_program
    
    # Filter by category if specified
    if category:
        links = [l for l in links if l["category"] == category]
        print(f"[RAG] Filtered to {len(links)} links in category '{category}'")
    
    # Detect query category to boost relevant sources
    msg_lower = (user_message or "").lower()
    detected_category = None
    
    healthcare_terms = r"\b(health|medical|doctor|hospital|pharmacy|emergency|healthcare|clinic|medicine|dental|urgent)\b"
    housing_terms = r"\b(housing|accommodation|dormitor|rent|apartment|lodge|student house|dorm)\b"
    visa_terms = r"\b(visa|permit|residence|immigration|document|igi|mae|travel|border)\b"
    
    if re.search(healthcare_terms, msg_lower):
        detected_category = "HEALTHCARE"
    elif re.search(housing_terms, msg_lower):
        detected_category = "ACCOMMODATION"
    elif re.search(visa_terms, msg_lower):
        detected_category = "VISA"
    
    # Score each link
    scored_links = []
    for link in links:
        # Combine keywords and description for similarity search
        search_text = f"{link.get('keywords', '')} {link.get('description', '')}"
        score = _similarity_score(user_message, search_text)

        # Boost if link is from the detected query category
        if detected_category and link.get("category") == detected_category:
            score += 0.4
        
        # Boost links from student's preferred university/program
        link_university = link.get("university", "GENERAL")
        link_program = link.get("program", "GENERAL")
        
        if student_university and link_university == student_university:
            score += 0.3
            print(f"[RAG] Boosted '{link.get('title')}' for preferred university {student_university}")
        
        if student_program and link_program == student_program:
            score += 0.25
            print(f"[RAG] Boosted '{link.get('title')}' for preferred program {student_program}")
        
        # Penalize links from non-preferred universities (if preference is set and link is university-specific)
        if student_university and link_university != "GENERAL" and link_university != student_university:
            score -= 0.15
        
        # Additional subject-specific boosting
        link_blob = f"{link.get('title', '')} {search_text}".lower()
        
        if detected_category == "HEALTHCARE":
            if any(term in link_blob for term in ("medical", "pharmacy", "healthcare", "hospital", "emergency", "health")):
                score += 0.25
            if any(term in link_blob for term in ("housing", "language", "airbnb", "culture")):
                score -= 0.2
        
        if detected_category == "ACCOMMODATION":
            if any(term in link_blob for term in ("housing", "dormitory", "accommodation", "dorm", "rent")):
                score += 0.25
            if any(term in link_blob for term in ("medical", "healthcare", "hospital")):
                score -= 0.2
        
        if detected_category == "VISA":
            if any(term in link_blob for term in ("visa", "immigration", "permit", "residence", "igi")):
                score += 0.25
            if any(term in link_blob for term in ("housing", "accommodation", "dormitory")):
                score -= 0.15
        
        if score > 0:  # Only include if there's some relevance
            scored_links.append((score, link))
    
    # Sort by score descending and return top_k
    scored_links.sort(key=lambda x: x[0], reverse=True)
    top_results = [link for score, link in scored_links[:top_k]]
    print(f"[RAG] Found {len(top_results)} relevant links (prioritized for {student_university or 'GENERAL'}/{student_program or 'GENERAL'}): {[l['title'] for l in top_results]}")
    return top_results


def _build_link_constraint_prompt(relevant_links):
    """
    Build a constraint prompt instructing the LLM to ONLY cite from verified links.
    
    Args:
        relevant_links: List of link dicts to include in constraint
    
    Returns:
        String prompt constraint
    """
    if not relevant_links:
        return ""
    
    links_text = "\n".join([
        f"- {link['title']}: {link['url']}"
        for link in relevant_links
    ])
    
    return f"""
**IMPORTANT: Verified Resources Only**
When answering about Erasmus/MAE, IGI insurance, visas, or international student procedures,
you MUST reference ONLY these verified official links:

{links_text}

Do NOT invent, hallucinate, or reference any other links. If the user's question doesn't match
these verified sources, acknowledge the limitation and redirect to official channels."""


def _build_activity_suggestions_prompt(user_id, user_message):
    """Personalized student-life activities when the user asks about lifestyle / integration."""
    if not user_id:
        return ""
    um = (user_message or "").lower()
    keys = (
        "sport", "club", "volunteer", "event", "social", "weekend", "activity", "culture",
        "gym", "music", "party", "student life", "integrat", "meet people", "bored", "things to do",
    )
    if not um or not any(k in um for k in keys):
        return ""
    try:
        picks = fetch_recommended_activities(int(user_id), limit=4)
    except Exception as exc:
        print(f"[assistant] activity suggestions: {exc}")
        return ""
    if not picks:
        return ""
    lines = []
    for a in picks:
        tgt = ", ".join(a.get("target") or [])
        lines.append(
            f"- **{a['name']}** ({a.get('type')}) — {a.get('schedule')}, {a.get('meeting_location')}. "
            f"Targets: {tgt}. Link: {a.get('link')}"
        )
    intro = (
        "From the NaviRo **Activities** catalogue (student life — not legal advice):\n"
    )
    return intro + "\n".join(lines)


def _build_peer_social_prompt(user_id, user_message):
    """Buddy / forum / cohort when the conversation is about peers or community."""
    if not user_id:
        return ""
    text = (user_message or "").lower()
    social_keys = (
        "buddy", "friend", "lonely", "meet people", "peer", "roommate", "housing tip",
        "forum", "other students", "cohort", "language exchange", "social", "connect with",
    )
    if not text or not any(k in text for k in social_keys):
        return ""
    extra = suggest_peers_summary_for_assistant(int(user_id))
    base = (
        "The user may benefit from **Buddy Finder**, **cohort group chat**, or the **peer Q&A forum** "
        "inside NaviRo. Suggest practical next steps; do not invent private contact details."
    )
    return base + ("\n\n" + extra if extra else "")


def _normalize_sender_id(sender_id):
    try:
        if sender_id is None or sender_id == "":
            return None
        return int(sender_id)
    except (TypeError, ValueError):
        return None


def _fetch_user_quest_context(user_id):
    if user_id is None:
        print(f"[CONTEXT] Skipping quest context: user_id is None")
        return None

    try:
        print(f"[CONTEXT] Fetching quest context for user_id={user_id}")
        with db.get_cursor() as cur:
            cur.execute(
                """SELECT country_of_origin, citizenship_type
                   FROM quest_relocation_profiles
                   WHERE user_id = %s""",
                (user_id,),
            )
            relocation_profile = cur.fetchone()
            print(f"[CONTEXT] Relocation profile query result: {relocation_profile}")

            cur.execute(
                """SELECT milestone_name, status
                   FROM quest_progress
                   WHERE user_id = %s
                   ORDER BY CASE
                       WHEN status = 'In Progress' THEN 0
                       WHEN status = 'Locked' THEN 1
                       WHEN status = 'Complete' THEN 2
                       ELSE 3
                   END, created_at DESC
                   LIMIT 1""",
                (user_id,),
            )
            progress_rows = cur.fetchall()

        if not relocation_profile and not progress_rows:
            print(f"[CONTEXT] No profile or progress found for user_id={user_id}")
            return None

        print(f"[CONTEXT] Progress rows: {progress_rows}")
        parts = []
        if relocation_profile:
            country_of_origin, citizenship_type = relocation_profile
            if citizenship_type and country_of_origin:
                parts.append(
                    f"The user is a {citizenship_type} student from {country_of_origin}."
                )
            elif citizenship_type:
                parts.append(f"The user is a {citizenship_type} student.")
            elif country_of_origin:
                parts.append(f"The user is a student from {country_of_origin}.")

        current_milestone_number = None
        current_milestone_name = None

        for index, milestone_name in enumerate(QUEST_MILESTONES, start=1):
            matching_row = next(
                (
                    row
                    for row in progress_rows
                    if row[0] == milestone_name and row[1] in {"In Progress", "Locked"}
                ),
                None,
            )
            if matching_row:
                current_milestone_number = index
                current_milestone_name = milestone_name
                break

        if current_milestone_number is None:
            completed_rows = [row for row in progress_rows if row[1] == "Complete"]
            if completed_rows:
                completed_names = [row[0] for row in completed_rows]
                for index, milestone_name in enumerate(QUEST_MILESTONES, start=1):
                    if milestone_name in completed_names:
                        current_milestone_number = min(index + 1, len(QUEST_MILESTONES))
                        current_milestone_name = QUEST_MILESTONES[current_milestone_number - 1]
                        break

        if current_milestone_number is not None and current_milestone_name:
            parts.append(
                f"The user is currently on Milestone {current_milestone_number}: {current_milestone_name}."
            )

        if not parts:
            print(f"[CONTEXT] No context parts built for user_id={user_id}")
            return None

        parts.append(
            "Tailor your advice to this context and keep legal, administrative, and relocation guidance aligned with the user's current progress."
        )
        context_str = " ".join(parts)
        print(f"[CONTEXT] Built quest context for user_id={user_id}: {context_str}")
        return context_str
    except Exception as e:
        print(f"[CONTEXT] Error fetching quest context for user_id={user_id}: {e}")
        return None


def _build_system_messages(user_id, user_message=None):
    """Build system messages including quest context and RAG-discovered verified links."""
    print(f"[INJECT] Building system messages for user_id={user_id}")
    system_messages = []

    if Config.SYSTEM_PROMPT:
        system_messages.append({"role": "system", "content": Config.SYSTEM_PROMPT})
        print(f"[INJECT] Added base system prompt")

    quest_context = _fetch_user_quest_context(user_id)
    if quest_context:
        system_messages.append({"role": "system", "content": quest_context})
        print(f"[INJECT] Added quest context system message")
    else:
        print(f"[INJECT] No quest context available for user_id={user_id}")

    peer_prompt = _build_peer_social_prompt(user_id, user_message)
    if peer_prompt:
        system_messages.append({"role": "system", "content": peer_prompt})

    activity_prompt = _build_activity_suggestions_prompt(user_id, user_message)
    if activity_prompt:
        system_messages.append({"role": "system", "content": activity_prompt})
    quest_step_focus = _detect_quest_step_focus(user_message)
    if quest_step_focus:
        system_messages.append(
            {
                "role": "system",
                "content": (
                    f"The user is asking about the quest step '{quest_step_focus}'. "
                    "Answer with the next concrete step, the immediate deadline or reminder, "
                    "and the checklist items that should be completed now. Keep the guidance linear and practical."
                ),
            }
        )
        print(f"[INJECT] Added quest step focus for '{quest_step_focus}'")

    # RAG: Find relevant verified links and add constraint prompt
    if user_message:
        print(f"[INJECT] Performing RAG search...")
        
        # Detect and save student preferences
        student_prefs = _detect_student_preferences(user_message)
        if student_prefs['university'] or student_prefs['program']:
            _save_student_preferences(user_id, student_prefs)
        
        rag_category = _detect_rag_category(user_message)
        # For healthcare queries, search broadly (not only HEALTHCARE category)
        if rag_category == "HEALTHCARE":
            relevant_links = _find_relevant_links(user_message, category=None, top_k=6, user_id=user_id)
        else:
            relevant_links = _find_relevant_links(
                user_message,
                category=rag_category,
                top_k=5 if rag_category == "HEALTHCARE" else 3,
                user_id=user_id
            )
        if relevant_links:
            link_constraint = _build_link_constraint_prompt(relevant_links)
            if rag_category == "HEALTHCARE":
                link_constraint += (
                    "\n\nFor healthcare questions, use only the healthcare links above. "
                    "Do not cite general university pages unless the user explicitly asks about a specific university medical service."
                )
            system_messages.append({"role": "system", "content": link_constraint})
            print(f"[INJECT] Added {len(relevant_links)} verified links constraint")
    else:
        print(f"[INJECT] No user message for RAG search")

    print(f"[INJECT] Total system messages: {len(system_messages)}")
    return system_messages


def _normalize_input_messages(messages):
    """Convert chat history to role/content messages and drop invalid entries."""
    normalized = []
    allowed_roles = {"system", "developer", "user", "assistant"}

    for msg in messages or []:
        if not isinstance(msg, dict):
            continue

        role = msg.get("role", "user")
        if role not in allowed_roles:
            role = "user"

        content = msg.get("content", "")
        if content is None:
            content = ""

        # Keep content as plain text for this API path.
        if isinstance(content, (dict, list)):
            try:
                content = json.dumps(content, ensure_ascii=False)
            except Exception:
                content = str(content)
        elif not isinstance(content, str):
            content = str(content)

        content = content.strip()

        if not content:
            continue

        normalized.append({"type": "message", "role": role, "content": content})

    return normalized


def _build_input_messages(messages, user_id=None):
    merged = list(messages or [])
    
    # Extract the latest user message for RAG search
    user_message = None
    for msg in reversed(merged):
        if isinstance(msg, dict) and msg.get("role") == "user":
            user_message = msg.get("content", "")
            break
    
    merged = _build_system_messages(user_id, user_message=user_message) + merged
    return _normalize_input_messages(merged)


def _extract_citation_filenames(response):
    """Extract unique source filenames from explicit file citation annotations."""
    filenames = []
    seen = set()

    # Prefer explicit file_citation annotations from the final output content.
    # Response-level citation collections can include loosely related retrieved docs.
    for output_item in getattr(response, "output", []) or []:
        for content_item in getattr(output_item, "content", []) or []:
            for annotation in getattr(content_item, "annotations", []) or []:
                annotation_type = getattr(annotation, "type", None)
                filename = getattr(annotation, "filename", None)
                if (
                    annotation_type == "file_citation"
                    and filename
                    and filename not in seen
                ):
                    seen.add(filename)
                    filenames.append(filename)

    return filenames


def _map_citation_urls(filenames, user_message=None):
    """Map citation filenames to verified-link URLs and drop unmapped entries."""
    urls = []
    seen = set()

    for filename in filenames:
        url = _resolve_verified_link_for_citation(filename)
        if not url:
            # fallback to raw mapping if present
            url = CITATION_MAPPING.get(filename)
        if url and url not in seen:
            seen.add(url)
            urls.append(url)

    if not urls:
        rag_category = _detect_rag_category(user_message)
        if rag_category == "HEALTHCARE":
            fallback_links = _find_relevant_links(user_message or "", category=None, top_k=5)
        else:
            fallback_links = _find_relevant_links(user_message or "", category=rag_category, top_k=3)
        for link in fallback_links:
            url = link.get("url")
            if url and url not in seen:
                seen.add(url)
                urls.append(url)

    return urls


def _filter_citations_for_query(citations, user_message):
    """Prefer verified links for any query domain.

    Behavior:
    - If any of the provided `citations` match known verified link URLs or hosts,
      return only those (deduplicated, preserving order).
    - Otherwise, return top verified links for the user query as fallback.
    """
    try:
        verified = _get_verified_links() or []
        verified_urls = { (l.get("url") or "").lower() for l in verified }
        verified_hosts = { urlparse((l.get("url") or "")).hostname for l in verified }
    except Exception:
        verified_urls = set()
        verified_hosts = set()

    filtered = []
    seen = set()

    for citation in citations or []:
        if not citation:
            continue
        try:
            c_url = citation.strip()
            c_host = urlparse(c_url).hostname or ""
        except Exception:
            c_url = citation
            c_host = ""

        key = (c_url or "").lower()
        if key in seen:
            continue

        # Keep citation if it's exactly a verified URL or its host is a verified host
        if key in verified_urls or (c_host and c_host in verified_hosts):
            seen.add(key)
            filtered.append(c_url)

    if filtered:
        return filtered

    # No verified matches — fall back to top verified links for the user query
    try:
        top_links = _find_relevant_links(user_message or "", category=None, top_k=3)
        fallback = []
        seen_fb = set()
        for link in top_links:
            url = link.get("url")
            if url and url.lower() not in seen_fb:
                seen_fb.add(url.lower())
                fallback.append(url)
        return fallback
    except Exception as _err:
        print(f"[RAG] Could not fetch fallback verified links: {_err}")
        return citations or []


def _agent_response_text(messages, user_id=None):
    print(f"[AZURE] Calling Azure OpenAI for user_id={user_id}")
    input_messages = _build_input_messages(messages, user_id=user_id)
    user_message = None
    for msg in reversed(messages or []):
        if isinstance(msg, dict) and msg.get("role") == "user":
            user_message = msg.get("content", "")
            break
    print(f"[AZURE] Total input messages: {len(input_messages)}")
    for i, msg in enumerate(input_messages):
        role = msg.get('role', 'unknown')
        content = msg.get('content', '')[:100]  # First 100 chars
        print(f"[AZURE]   Message {i}: role={role}, content_preview={content}...")
    
    response = client.responses.create(
        input=input_messages,
        extra_body={
            "agent_reference": {
                "name": Config.AZURE_AGENT_NAME,
                "version": Config.AZURE_AGENT_VERSION,
                "type": "agent_reference",
            }
        },
    )

    # DEBUG: Log complete response structure for v12 compatibility
    print(f"[AZURE] Response type: {type(response)}")
    print(f"[AZURE] Response dir: {[attr for attr in dir(response) if not attr.startswith('_')]}")
    print(f"[AZURE] Response object: {response}")
    
    # Try multiple ways to extract text for v12 compatibility
    text = ""
    if hasattr(response, "output_text"):
        text = response.output_text or ""
    elif hasattr(response, "output"):
        # v12 might return output as list or dict
        output = response.output
        if isinstance(output, list) and len(output) > 0:
            # Try to extract text from first output item
            first_item = output[0]
            if hasattr(first_item, "content"):
                content = first_item.content
                if isinstance(content, list) and len(content) > 0:
                    if hasattr(content[0], "text"):
                        text = content[0].text
                    elif isinstance(content[0], str):
                        text = content[0]
            elif isinstance(first_item, str):
                text = first_item
        elif isinstance(output, dict):
            text = output.get("text", "") or output.get("output", "")
        elif isinstance(output, str):
            text = output
    elif hasattr(response, "text"):
        text = response.text or ""
    
    print(f"[AZURE] Received response for user_id={user_id}, text_length={len(text)}")

    # Return only mapped source URLs; skip citations with no mapping.
    citation_filenames = _extract_citation_filenames(response)
    citations = _map_citation_urls(citation_filenames, user_message=user_message)
    citations = _filter_citations_for_query(citations, user_message)
    print(f"[AZURE] Extracted filenames: {citation_filenames}. Mapped URLs: {citations}")

    # Enrich citations with titles from verified links for frontend display
    enriched = []
    seen = set()
    links_index = { (l.get('url') or '').lower(): l for l in _get_verified_links() }
    for url in citations or []:
        if not url or url in seen:
            continue
        seen.add(url)
        key = (url or '').lower()
        title = None
        if key in links_index:
            title = links_index[key].get('title')
        if not title:
            try:
                host = urlparse(url).hostname or url
                title = host
            except Exception:
                title = url
        enriched.append({"url": url, "title": title})

    # Always include top verified links for the user query as sources (not just fallback)
    try:
        rag_category = _detect_rag_category(user_message)
        top_links = _find_relevant_links(user_message or "", category=rag_category, top_k=5)
        for link in top_links:
            url = link.get("url")
            if not url or url in seen:
                continue
            seen.add(url)
            enriched.append({"url": url, "title": link.get("title") or url})
    except Exception as _err:
        print(f"[RAG] Could not fetch top verified links: {_err}")

    return {"text": text, "citations": enriched}


# ── HTTP route (kept for non-socket clients) ────────────────────────────────


@app.route("/send_message", methods=["POST"])
def send_message():
    try:
        body = request.json
        content = body.get("message")
        sender_id = body.get("sender", "")
        session_id = body.get("session_id")
        language = body.get("language", "en")
        enable_tts = body.get("enable_tts", False)
        is_voice_message = body.get("is_voice_message", False)
        transcription = body.get("transcription")  # For voice messages
        voice_url = body.get("voice_url")  # URL to original voice recording
        
        user_id = _normalize_sender_id(sender_id)
        history = body.get("history", [])
        messages = history + [{"role": "user", "content": content}]
        stream_text = ""
        voice_response_url = None

        def generate():
            nonlocal stream_text, voice_response_url
            result = _agent_response_text(messages, user_id=user_id)
            stream_text = result.get("text", "")
            
            # Generate TTS if enabled
            if enable_tts and stream_text:
                tts_result = VoiceProcessor.text_to_speech(stream_text, language=language)
                if tts_result['success'] and tts_result['file_path']:
                    voice_response_url = f"/audio/{os.path.basename(tts_result['file_path'])}"
            
            if stream_text:
                yield stream_text

            # Store conversation with voice fields
            store_conversation(
                sender_id, 
                content, 
                stream_text, 
                session_id=session_id,
                transcription=transcription,
                voice_url=voice_url,
                voice_response_url=voice_response_url,
                language=language,
                is_voice_message=is_voice_message,
                tts_enabled=enable_tts
            )
            print(
                f"Stored conversation for user_id={sender_id}: {content} -> {stream_text}"
            )

        return Response(stream_with_context(generate()), content_type="text/plain")

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Socket.IO route (used by React) ─────────────────────────────────────────

# Catch-all handler to debug all socket events
@socketio.on("*")
def debug_event_handler(event, data):
    print(f"[DEBUG] Socket event received: {event}", flush=True)
    print(f"[DEBUG] Event data: {data}", flush=True)


@socketio.on("user_uttered")
def handle_user_uttered(data):
    print(f"\n{'='*80}")
    print(f"[SOCKET] Received user_uttered event")
    content = data.get("message")
    sender_id = data.get("sender", "")
    session_id = data.get("session_id")
    language = data.get("language", "en")
    enable_tts = data.get("enable_tts", False)
    is_voice_message = data.get("is_voice_message", False)
    transcription = data.get("transcription")  # For voice messages
    voice_url = data.get("voice_url")  # URL to original voice recording
    
    print(f"[SOCKET] Raw sender_id from client: {sender_id}")
    user_id = _normalize_sender_id(sender_id)
    print(f"[SOCKET] Normalized user_id: {user_id}")
    print(f"[SOCKET] Session id: {session_id}")
    print(f"[SOCKET] Language: {language}, TTS enabled: {enable_tts}, Voice message: {is_voice_message}")
    
    history = data.get("history", [])
    print(f"[SOCKET] Chat history length: {len(history)}")
    print(f"[SOCKET] User message: {content[:80]}...")
    messages = history + [{"role": "user", "content": content}]
    stream_text = ""
    voice_response_url = None

    try:
        # Get the full result dictionary
        print(f"[SOCKET] Starting context injection and Azure call...")
        result = _agent_response_text(messages, user_id=user_id)
        stream_text = result.get("text", "")
        citations = result.get("citations", [])
        print(f"[SOCKET] Received response: text_length={len(stream_text)}, citations_count={len(citations)}")

        # Generate TTS if enabled
        if enable_tts and stream_text:
            print(f"[SOCKET] Generating TTS for bot response...")
            tts_result = VoiceProcessor.text_to_speech(stream_text, language=language)
            if tts_result['success'] and tts_result['file_path']:
                voice_response_url = f"/audio/{os.path.basename(tts_result['file_path'])}"
                print(f"[SOCKET] TTS generated successfully: {voice_response_url}")
            else:
                print(f"[SOCKET] TTS generation failed: {tts_result.get('error')}")

        if stream_text:
            # Emit text and optional voice URL to React
            metadata = {
                "citations": citations,
                "language": language,
                "voice_response_url": voice_response_url
            }
            if is_voice_message:
                metadata["is_voice_response"] = True
            
            print(f"[SOCKET] Emitting bot_uttered event to client...")
            emit(
                "bot_uttered",
                {
                    "text": stream_text,
                    "metadata": metadata,
                },
            )
        else:
            print(f"[SOCKET] WARNING: Empty stream_text received")

    except Exception as e:
        print(f"[SOCKET] ERROR in user_uttered handler: {e}")
        import traceback
        traceback.print_exc()
        emit("bot_uttered", {"text": f"Error: {str(e)}"})

    print(f"[SOCKET] Emitting bot_done event")
    emit("bot_done")
    
    # Store conversation with voice fields
    print(f"[SOCKET] Storing conversation for sender_id={sender_id}")
    store_conversation(
        sender_id, 
        content, 
        stream_text, 
        session_id=session_id,
        transcription=transcription,
        voice_url=voice_url,
        voice_response_url=voice_response_url,
        language=language,
        is_voice_message=is_voice_message,
        tts_enabled=enable_tts
    )
    print(f"{'='*80}\n")


# ── Health check ─────────────────────────────────────────────────────────────


@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "OK"}), 200


if __name__ == "__main__":
    socketio.run(app, debug=True, host="0.0.0.0", allow_unsafe_werkzeug=True)