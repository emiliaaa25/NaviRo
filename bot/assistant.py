import json
from pathlib import Path
import sys
import os
import tempfile

from flask import Flask, request, session, Response, jsonify, stream_with_context
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from openai import AzureOpenAI

from actions.config import Config
from actions.db import db
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


def _load_citation_mapping():
    """Load filename -> URL citation mapping from mapping.json."""
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


CITATION_MAPPING = _load_citation_mapping()

# One-time seed of verified links on app startup
_seed_verified_links_from_json()

QUEST_MILESTONES = [
    "Initial Profiling",
    "Admission & Docs",
    "Visa",
    "Iași Arrival",
]

# ── RAG: Verified Links Database ────────────────────────────────────────────


# Load verified links into memory (lazy load on first use)
VERIFIED_LINKS_CACHE = None


def _get_verified_links():
    """Get verified links from cache or load from DB."""
    global VERIFIED_LINKS_CACHE
    if VERIFIED_LINKS_CACHE is None:
        VERIFIED_LINKS_CACHE = _load_verified_links_from_db()
    return VERIFIED_LINKS_CACHE


def _similarity_score(query, text):
    """Simple keyword-based similarity score between query and text."""
    if not query or not text:
        return 0.0
    
    query_words = set(query.lower().split())
    text_words = set(text.lower().split())
    
    if not query_words or not text_words:
        return 0.0
    
    intersection = query_words & text_words
    union = query_words | text_words
    
    return len(intersection) / len(union)


def _find_relevant_links(user_message, category=None, top_k=3):
    """
    Find relevant verified links using similarity search against keywords/description.
    
    Args:
        user_message: User's question or context
        category: Optional filter (e.g., 'MAE', 'IGI', 'OFFICIAL')
        top_k: Number of top results to return
    
    Returns:
        List of relevant link dicts sorted by relevance
    """
    print(f"[RAG] Starting link discovery for message: {user_message[:80]}...")
    links = _get_verified_links()
    print(f"[RAG] Loaded {len(links)} verified links from cache")
    
    if not links:
        print(f"[RAG] No verified links available")
        return []
    
    # Filter by category if specified
    if category:
        links = [l for l in links if l["category"] == category]
        print(f"[RAG] Filtered to {len(links)} links in category '{category}'")
    
    # Score each link
    scored_links = []
    for link in links:
        # Combine keywords and description for similarity search
        search_text = f"{link.get('keywords', '')} {link.get('description', '')}"
        score = _similarity_score(user_message, search_text)
        
        if score > 0:  # Only include if there's some relevance
            scored_links.append((score, link))
    
    # Sort by score descending and return top_k
    scored_links.sort(key=lambda x: x[0], reverse=True)
    top_results = [link for score, link in scored_links[:top_k]]
    print(f"[RAG] Found {len(top_results)} relevant links: {[l['title'] for l in top_results]}")
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

    # RAG: Find relevant verified links and add constraint prompt
    if user_message:
        print(f"[INJECT] Performing RAG search...")
        relevant_links = _find_relevant_links(user_message, top_k=3)
        if relevant_links:
            link_constraint = _build_link_constraint_prompt(relevant_links)
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


def _map_citation_urls(filenames):
    """Map citation filenames to URLs and drop unmapped entries."""
    urls = []
    seen = set()

    for filename in filenames:
        url = CITATION_MAPPING.get(filename)
        if url and url not in seen:
            seen.add(url)
            urls.append(url)

    return urls


def _agent_response_text(messages, user_id=None):
    print(f"[AZURE] Calling Azure OpenAI for user_id={user_id}")
    input_messages = _build_input_messages(messages, user_id=user_id)
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

    # Extract the text
    text = getattr(response, "output_text", "") or ""
    print(f"[AZURE] Received response for user_id={user_id}, text_length={len(text)}")

    # Return only mapped source URLs; skip citations with no mapping.
    citation_filenames = _extract_citation_filenames(response)
    citations = _map_citation_urls(citation_filenames)
    print(f"[AZURE] Extracted filenames: {citation_filenames}. Mapped URLs: {citations}")

    return {"text": text, "citations": citations}


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