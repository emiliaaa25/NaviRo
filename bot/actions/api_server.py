from flask import Flask, request, jsonify
from flask_cors import CORS
from functools import wraps
from db import db
from auth import AuthManager
from social_helpers import (
    COHORT_SEPT_2026,
    create_peer_match,
    fetch_activities_filtered,
    fetch_peer_chat_messages,
    fetch_recommended_activities,
    find_peer_candidates,
    forum_create_answer,
    forum_create_question,
    forum_get_question,
    forum_list_questions,
    forum_vote_answer,
    forum_vote_question,
    get_peer_connections,
    post_peer_chat_message,
    upsert_activity_preferences,
)
from voice_processor import VoiceProcessor
import os
import tempfile

app = Flask(__name__)
CORS(app)

# Middleware to verify token
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'success': False, 'message': 'Token is missing'}), 401
        
        try:
            token = token.split(' ')[1]  # Remove "Bearer " prefix
        except IndexError:
            return jsonify({'success': False, 'message': 'Invalid token format'}), 401
        
        payload = AuthManager.verify_token(token)
        if not payload:
            return jsonify({'success': False, 'message': 'Invalid or expired token'}), 401
        
        request.user_id = payload['user_id']
        request.username = payload['username']
        return f(*args, **kwargs)
    
    return decorated

# ============ AUTHENTICATION ROUTES ============

@app.route('/auth/register', methods=['POST'])
def register():
    """Register a new user"""
    try:
        data = request.get_json()
        
        # Validate input
        required_fields = ['username', 'email', 'password', 'full_name']
        if not all(field in data for field in required_fields):
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400
        
        result = AuthManager.register_user(
            username=data['username'],
            email=data['email'],
            password=data['password'],
            full_name=data['full_name']
        )
        
        if result['success']:
            return jsonify(result), 201
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

@app.route('/auth/login', methods=['POST'])
def login():
    """Login user"""
    try:
        data = request.get_json()
        
        if not data.get('username') or not data.get('password'):
            return jsonify({'success': False, 'message': 'Missing username or password'}), 400
        
        result = AuthManager.login_user(
            username=data['username'],
            password=data['password']
        )
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 401
            
    except Exception as e:
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

@app.route('/auth/verify', methods=['GET'])
@token_required
def verify_token():
    """Verify token validity"""
    return jsonify({
        'success': True,
        'user_id': request.user_id,
        'username': request.username
    }), 200

# ============ USER PROFILE ROUTES ============

@app.route('/profile', methods=['GET'])
@token_required
def get_profile():
    """Get user profile"""
    try:
        profile = AuthManager.get_user_profile(request.user_id)
        
        if not profile:
            return jsonify({'success': False, 'message': 'Profile not found'}), 404
        
        return jsonify({'success': True, 'profile': profile}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

@app.route('/profile', methods=['PUT'])
@token_required
def update_profile():
    """Update user profile"""
    try:
        data = request.get_json()
        result = AuthManager.update_user_profile(request.user_id, **data)
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

# ============ PROJECTS ROUTES ============

@app.route('/projects', methods=['POST'])
@token_required
def create_project():
    """Create a new project"""
    try:
        data = request.get_json()
        
        required_fields = ['title', 'description']
        if not all(field in data for field in required_fields):
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400
        
        result = AuthManager.add_project(
            user_id=request.user_id,
            title=data['title'],
            description=data['description'],
            category=data.get('category')
        )
        
        if result['success']:
            return jsonify(result), 201
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

@app.route('/projects/<int:project_id>', methods=['PUT'])
@token_required
def update_project(project_id):
    """Update project details"""
    try:
        data = request.get_json()
        result = AuthManager.update_project(project_id, **data)
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500


@app.route('/conversations', methods=['GET'])
@token_required
def get_conversations():
    """Get stored conversation sessions for the authenticated user."""
    try:
        limit = request.args.get('limit', default=20, type=int)
        limit = max(1, min(limit, 100))

        with db.get_cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS conversations (
                    id BIGSERIAL PRIMARY KEY,
                    user_id TEXT,
                    session_id TEXT,
                    user_message TEXT NOT NULL,
                    bot_response TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )

            cur.execute(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = 'conversations'
                          AND column_name = 'session_id'
                    ) THEN
                        ALTER TABLE conversations
                        ADD COLUMN session_id TEXT;
                    END IF;
                END
                $$;
                """
            )

            cur.execute(
                """
                SELECT id, session_id, user_message, bot_response, created_at
                FROM conversations
                WHERE user_id = %s
                ORDER BY created_at ASC, id ASC
                """,
                (str(request.user_id),),
            )
            rows = cur.fetchall()

        session_map = {}
        ordered_sessions = []

        for row_id, session_id, user_message, bot_response, created_at in rows:
            normalized_session_id = session_id or 'legacy'

            if normalized_session_id not in session_map:
                session_map[normalized_session_id] = {
                    'id': normalized_session_id,
                    'title': user_message[:42] if user_message else 'New chat',
                    'preview': '',
                    'updatedAt': created_at.isoformat() if created_at else None,
                    'messages': [],
                }
                ordered_sessions.append(session_map[normalized_session_id])

            session_entry = session_map[normalized_session_id]
            session_entry['messages'].append({'text': user_message, 'sender': 'user'})
            session_entry['messages'].append({'text': bot_response, 'sender': 'bot'})
            session_entry['preview'] = bot_response[:120] if bot_response else session_entry['preview']
            session_entry['updatedAt'] = created_at.isoformat() if created_at else session_entry['updatedAt']

        for session_entry in ordered_sessions:
            first_user_message = next(
                (message['text'] for message in session_entry['messages'] if message.get('sender') == 'user' and message.get('text')),
                None,
            )
            if first_user_message:
                session_entry['title'] = first_user_message[:42]
            if session_entry['messages'] and not session_entry['preview']:
                session_entry['preview'] = session_entry['messages'][-1]['text'][:120]

        conversations = list(reversed(ordered_sessions[-limit:]))

        return jsonify({'success': True, 'sessions': conversations}), 200

    except Exception as e:
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

# ============ HEALTH CHECK ============

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok'}), 200

# ============ IASI-QUEST ROUTES (Digital Shadow / Relocation Management) ============

@app.route('/quest/token', methods=['POST'])
@token_required
def generate_quest_token():
    """Generate quest token for user (allows saving progress across sessions)"""
    try:
        result = AuthManager.generate_quest_token(request.user_id)
        
        if result['success']:
            return jsonify(result), 201
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

@app.route('/quest/resume', methods=['POST'])
def resume_quest():
    """Resume user's quest journey using quest token"""
    try:
        data = request.get_json()
        quest_token = data.get('quest_token')
        
        if not quest_token:
            return jsonify({'success': False, 'message': 'Quest token is required'}), 400
        
        quest_data = AuthManager.retrieve_quest_by_token(quest_token)
        
        if not quest_data:
            return jsonify({'success': False, 'message': 'Invalid or expired quest token'}), 401
        
        # Get full profile data
        full_profile = AuthManager.get_full_quest_profile(quest_data['user_id'])
        
        return jsonify({
            'success': True,
            'message': 'Quest resumed successfully',
            'token': quest_token,
            'quest_token': quest_token,
            'user_id': quest_data['user_id'],
            'profile': full_profile
        }), 200
            
    except Exception as e:
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

@app.route('/quest/profile', methods=['POST'])
@token_required
def create_relocation_profile():
    """Create initial relocation profile (handles nationality-based branching)"""
    try:
        data = request.get_json()
        
        required_fields = ['country_of_origin', 'citizenship_type']
        if not all(field in data for field in required_fields):
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400
        
        result = AuthManager.create_relocation_profile(
            user_id=request.user_id,
            country_of_origin=data['country_of_origin'],
            citizenship_type=data['citizenship_type'],
            study_program=data.get('study_program'),
            target_university=data.get('target_university'),
            target_faculty=data.get('target_faculty'),
            birth_date=data.get('birth_date'),
            phone=data.get('phone'),
            languages_spoken=data.get('languages_spoken'),
        )
        
        if result['success']:
            return jsonify(result), 201
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

@app.route('/quest/progress', methods=['GET'])
@token_required
def get_quest_progress():
    """Get user's quest progress and milestones"""
    try:
        progress = AuthManager.get_quest_progress(request.user_id)
        
        if not progress:
            return jsonify({'success': False, 'message': 'No quest profile found'}), 404
        
        return jsonify({
            'success': True,
            'progress': progress
        }), 200
            
    except Exception as e:
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

@app.route('/quest/milestone/<milestone_name>', methods=['PUT'])
@token_required
def update_quest_milestone(milestone_name):
    """Update milestone status in user's quest"""
    try:
        data = request.get_json()
        status = data.get('status')
        notes = data.get('notes')
        
        if not status:
            return jsonify({'success': False, 'message': 'Status is required'}), 400
        
        result = AuthManager.update_quest_milestone(
            user_id=request.user_id,
            milestone_name=milestone_name,
            status=status,
            notes=notes
        )
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

@app.route('/quest/shadow', methods=['GET'])
@token_required
def get_digital_shadow():
    """Get full digital shadow - complete profile for quest continuation"""
    try:
        shadow = AuthManager.get_full_quest_profile(request.user_id)
        
        if not shadow:
            return jsonify({'success': False, 'message': 'Shadow profile not found'}), 404
        
        return jsonify({
            'success': True,
            'shadow': shadow
        }), 200
            
    except Exception as e:
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500


# ============ ACTIVITIES & PEERS & FORUM ============


@app.route('/activities/filter', methods=['GET'])
def activities_filter():
    """Public list with optional filters (discovery)."""
    try:
        q = request.args.get('q')
        typ = request.args.get('type')
        target = request.args.get('target')
        meeting_location = request.args.get('meeting_location')
        schedule = request.args.get('schedule')
        limit = request.args.get('limit', default=40, type=int)
        offset = request.args.get('offset', default=0, type=int)
        items = fetch_activities_filtered(
            q=q,
            typ=typ,
            target=target,
            meeting_location=meeting_location,
            schedule=schedule,
            limit=limit,
            offset=offset,
        )
        return jsonify({'success': True, 'activities': items}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/activities/recommended', methods=['GET'])
@token_required
def activities_recommended():
    try:
        limit = request.args.get('limit', default=12, type=int)
        items = fetch_recommended_activities(request.user_id, limit=limit)
        return jsonify({'success': True, 'activities': items}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/profile/activity-preferences', methods=['POST'])
@token_required
def save_activity_preferences():
    try:
        data = request.get_json() or {}
        ok = upsert_activity_preferences(
            request.user_id,
            interests=str(data.get('interests') or ''),
            preferred_types=str(data.get('preferred_types') or ''),
        )
        if not ok:
            return jsonify({'success': False, 'message': 'Could not save preferences'}), 400
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/peers/find', methods=['GET'])
@token_required
def peers_find():
    try:
        country = request.args.get('country')
        program = request.args.get('program')
        language = request.args.get('language')
        limit = request.args.get('limit', default=30, type=int)
        peers = find_peer_candidates(
            request.user_id,
            country=country,
            program=program,
            language=language,
            limit=limit,
        )
        return jsonify({'success': True, 'peers': peers}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/peers/connections', methods=['GET'])
@token_required
def peers_connections():
    try:
        conns = get_peer_connections(request.user_id)
        return jsonify({'success': True, 'connections': conns}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/peers/match', methods=['POST'])
@token_required
def peers_match():
    try:
        data = request.get_json() or {}
        mode = (data.get('mode') or 'manual').lower()
        peer_user_id = data.get('peer_user_id')
        if peer_user_id is not None:
            peer_user_id = int(peer_user_id)
        result = create_peer_match(request.user_id, peer_user_id, mode)
        if not result:
            return jsonify({'success': False, 'message': 'No match available'}), 400
        return jsonify({'success': True, 'connection': result}), 201
    except ValueError:
        return jsonify({'success': False, 'message': 'Invalid peer id'}), 400
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/peers/chat', methods=['GET'])
@token_required
def peers_chat_get():
    try:
        room = (request.args.get('room') or 'buddy').lower()
        connection_id = request.args.get('connection_id', type=int)
        cohort_key = request.args.get('cohort_key') or COHORT_SEPT_2026
        limit = request.args.get('limit', default=80, type=int)
        messages = fetch_peer_chat_messages(
            request.user_id,
            room_type=room,
            connection_id=connection_id,
            cohort_key=cohort_key if room == 'cohort' else None,
            limit=limit,
        )
        return jsonify({'success': True, 'messages': messages, 'cohort_default': COHORT_SEPT_2026}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/peers/chat', methods=['POST'])
@token_required
def peers_chat_post():
    try:
        data = request.get_json() or {}
        room = (data.get('room') or 'buddy').lower()
        body = data.get('message') or data.get('body') or ''
        connection_id = data.get('connection_id')
        cohort_key = data.get('cohort_key')
        if connection_id is not None:
            connection_id = int(connection_id)
        ok = post_peer_chat_message(
            request.user_id,
            room_type=room,
            body=body,
            connection_id=connection_id,
            cohort_key=cohort_key,
        )
        if not ok:
            return jsonify({'success': False, 'message': 'Message rejected'}), 400
        return jsonify({'success': True}), 201
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/forum/questions', methods=['GET'])
def forum_questions_list():
    try:
        limit = request.args.get('limit', default=40, type=int)
        items = forum_list_questions(limit=limit)
        return jsonify({'success': True, 'questions': items}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/forum/questions', methods=['POST'])
@token_required
def forum_questions_create():
    try:
        data = request.get_json() or {}
        title = (data.get('title') or '').strip()
        body = (data.get('body') or '').strip()
        tags = (data.get('tags') or '').strip()
        qid = forum_create_question(request.user_id, title, body, tags)
        if not qid:
            return jsonify({'success': False, 'message': 'Invalid question'}), 400
        return jsonify({'success': True, 'question_id': qid}), 201
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/forum/questions/<int:question_id>', methods=['GET'])
def forum_question_detail(question_id):
    try:
        qd = forum_get_question(question_id)
        if not qd:
            return jsonify({'success': False, 'message': 'Not found'}), 404
        return jsonify({'success': True, 'question': qd}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/forum/answers', methods=['POST'])
@token_required
def forum_answers_create():
    try:
        data = request.get_json() or {}
        question_id = int(data.get('question_id'))
        body = data.get('body') or ''
        aid = forum_create_answer(request.user_id, question_id, body)
        if not aid:
            return jsonify({'success': False, 'message': 'Could not post answer'}), 400
        return jsonify({'success': True, 'answer_id': aid}), 201
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/forum/questions/<int:question_id>/vote', methods=['POST'])
@token_required
def forum_question_vote(question_id):
    try:
        data = request.get_json() or {}
        vote = int(data.get('vote', 0))
        if not forum_vote_question(request.user_id, question_id, vote):
            return jsonify({'success': False, 'message': 'Vote failed'}), 400
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/forum/answers/<int:answer_id>/vote', methods=['POST'])
@token_required
def forum_answer_vote(answer_id):
    try:
        data = request.get_json() or {}
        vote = int(data.get('vote', 0))
        if not forum_vote_answer(request.user_id, answer_id, vote):
            return jsonify({'success': False, 'message': 'Vote failed'}), 400
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ============ VOICE CHAT ROUTES ============

@app.route('/chat/transcribe', methods=['POST'])
@token_required
def transcribe_audio():
    """
    Transcribe audio file to text.
    
    Expected request:
    - audio: audio file (webm, wav, ogg, etc.)
    - language: language code (en-US, ro-RO, etc.) - optional, will be detected
    """
    try:
        # Check if audio file is present
        if 'audio' not in request.files:
            return jsonify({
                'success': False,
                'message': 'No audio file provided'
            }), 400
        
        audio_file = request.files['audio']
        if audio_file.filename == '':
            return jsonify({
                'success': False,
                'message': 'Empty audio file'
            }), 400
        
        # Get language preference (optional)
        language = request.form.get('language', 'en-US')
        if language not in ['en-US', 'ro-RO', 'en', 'ro']:
            language = 'en-US'
        
        # Save temporary file for processing
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.webm')
        temp_path = temp_file.name
        audio_file.save(temp_path)
        
        try:
            # Transcribe audio
            result = VoiceProcessor.transcribe_audio(temp_path, language)
            
            if result['success']:
                return jsonify({
                    'success': True,
                    'transcript': result['transcript'],
                    'confidence': result['confidence'],
                    'detected_language': result['detected_language'],
                    'user_id': request.user_id
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'message': result['error'],
                    'detected_language': language
                }), 400
                
        finally:
            # Clean up temporary file
            import os
            if os.path.exists(temp_path):
                os.remove(temp_path)
    
    except Exception as e:
        print(f"Error in transcribe_audio: {e}")
        return jsonify({
            'success': False,
            'message': f'Server error: {str(e)}'
        }), 500


@app.route('/chat/tts', methods=['POST'])
@token_required
def generate_speech():
    """
    Generate speech audio from text.
    
    Expected request JSON:
    - text: Text to convert to speech
    - language: Language code (en, ro) - optional
    """
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({
                'success': False,
                'message': 'No text provided'
            }), 400
        
        text = data['text'].strip()
        if not text:
            return jsonify({
                'success': False,
                'message': 'Empty text'
            }), 400
        
        language = data.get('language', 'en')
        if language not in ['en', 'ro']:
            language = 'en'
        
        # Generate speech
        result = VoiceProcessor.text_to_speech(text, language)
        
        if result['success'] and result['file_path']:
            # Return the audio file
            from flask import send_file
            return send_file(
                result['file_path'],
                mimetype='audio/mp3',
                as_attachment=False,
                download_name='response.mp3'
            )
        else:
            return jsonify({
                'success': False,
                'message': result['error'] or 'Failed to generate speech'
            }), 500
            
    except Exception as e:
        print(f"Error in generate_speech: {e}")
        return jsonify({
            'success': False,
            'message': f'Server error: {str(e)}'
        }), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'message': 'Endpoint not found'}), 404

if __name__ == '__main__':
    # Initialize database
    db.init_db()
    
    # Run Flask app
    host = os.getenv('FLASK_HOST', '0.0.0.0')
    port = int(os.getenv('FLASK_PORT', 5056))
    app.run(host=host, port=port, debug=True)
