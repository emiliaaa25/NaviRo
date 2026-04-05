import json
from pathlib import Path

from flask import Flask, request, session, Response, jsonify, stream_with_context
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from openai import AzureOpenAI

from actions.config import Config
from actions.utils import store_conversation

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


CITATION_MAPPING = _load_citation_mapping()


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

        normalized.append({"role": role, "content": content})

    return normalized


def _build_input_messages(messages):
    merged = list(messages or [])
    if Config.SYSTEM_PROMPT:
        merged = [{"role": "system", "content": Config.SYSTEM_PROMPT}] + merged
    return _normalize_input_messages(merged)


def _extract_citation_filenames(response):
    """Extract unique source filenames from file citation annotations."""
    filenames = []
    seen = set()

    # New Responses API shape: response.output[*].content[*].annotations[*]
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

    # Fallback for potential alternate response shapes.
    if not filenames:
        for citation in getattr(response, "citations", []) or []:
            filename = None
            if isinstance(citation, dict):
                filename = citation.get("filename")
            else:
                filename = getattr(citation, "filename", None)

            if filename and filename not in seen:
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


def _agent_response_text(messages):
    response = client.responses.create(
        input=_build_input_messages(messages),
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

    # Return only mapped source URLs; skip citations with no mapping.
    citation_filenames = _extract_citation_filenames(response)
    citations = _map_citation_urls(citation_filenames)
    print(f"Extracted filenames: {citation_filenames}. Mapped URLs: {citations}")

    return {"text": text, "citations": citations}


# ── HTTP route (kept for non-socket clients) ────────────────────────────────


@app.route("/send_message", methods=["POST"])
def send_message():
    try:
        body = request.json
        content = body.get("message")
        sender_id = body.get("sender", "")
        history = body.get("history", [])
        messages = history + [{"role": "user", "content": content}]
        stream_text = ""

        def generate():
            nonlocal stream_text
            stream_text = _agent_response_text(messages)
            if stream_text:
                yield stream_text

            store_conversation(sender_id, content, stream_text)
            print(
                f"Stored conversation for user_id={sender_id}: {content} -> {stream_text}"
            )

        return Response(stream_with_context(generate()), content_type="text/plain")

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Socket.IO route (used by React) ─────────────────────────────────────────


@socketio.on("user_uttered")
def handle_user_uttered(data):
    content = data.get("message")
    sender_id = data.get("sender", "")
    history = data.get("history", [])
    messages = history + [{"role": "user", "content": content}]
    stream_text = ""

    try:
        # Get the full result dictionary
        result = _agent_response_text(messages)
        stream_text = result.get("text", "")
        citations = result.get("citations", [])

        if stream_text:
            # Emit BOTH text and citations to React
            emit(
                "bot_uttered",
                {
                    "text": stream_text,
                    "metadata": {
                        "citations": citations  # This allows React to render the links
                    },
                },
            )

    except Exception as e:
        emit("bot_uttered", {"text": f"Error: {str(e)}"})

    emit("bot_done")
    store_conversation(sender_id, content, stream_text)


# ── Health check ─────────────────────────────────────────────────────────────


@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "OK"}), 200


if __name__ == "__main__":
    socketio.run(app, debug=True, host="0.0.0.0", allow_unsafe_werkzeug=True)