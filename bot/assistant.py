import json

from flask import Flask, request, session, Response, jsonify, stream_with_context
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from openai import AzureOpenAI

from actions.config import Config
from actions.utils import store_conversation

app = Flask(__name__)
app.secret_key = 'your_secret_key'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_SECURE'] = True

client = AzureOpenAI(
    api_key=Config.AZURE_API_KEY,
    api_version=Config.AZURE_API_VERSION,
    azure_endpoint=Config.AZURE_PROJECT_ENDPOINT,
)

CORS(app, supports_credentials=True, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")


def _build_input_messages(messages):
    if Config.SYSTEM_PROMPT:
        return [{"role": "system", "content": Config.SYSTEM_PROMPT}] + messages
    return messages


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
    return getattr(response, "output_text", "") or ""


# ── HTTP route (kept for non-socket clients) ────────────────────────────────

@app.route('/send_message', methods=['POST'])
def send_message():
    try:
        body = request.json
        content = body.get('message')
        sender_id = body.get('sender', '')
        history = body.get('history', [])
        messages = history + [{"role": "user", "content": content}]
        stream_text = ''

        def generate():
            nonlocal stream_text
            stream_text = _agent_response_text(messages)
            if stream_text:
                yield stream_text

            store_conversation(sender_id, content, stream_text)
            print(f"Stored conversation for user_id={sender_id}: {content} -> {stream_text}")

        return Response(stream_with_context(generate()), content_type='text/plain')

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Socket.IO route (used by React) ─────────────────────────────────────────

@socketio.on('user_uttered')
def handle_user_uttered(data):
    content = data.get('message')
    sender_id = data.get('sender', '')
    history = data.get('history', [])
    messages = history + [{"role": "user", "content": content}]
    stream_text = ''

    try:
        stream_text = _agent_response_text(messages)
        if stream_text:
            emit('bot_uttered', {'text': stream_text})
    except Exception as e:
        emit('bot_uttered', {'text': f'Error: {str(e)}'})

    emit('bot_done')
    store_conversation(sender_id, content, stream_text)
    print(f"Stored conversation for user_id={sender_id}: {content} -> {stream_text}")


# ── Health check ─────────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "OK"}), 200


if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0')