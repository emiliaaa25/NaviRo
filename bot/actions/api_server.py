from flask import Flask, request, jsonify
from flask_cors import CORS
from functools import wraps
from db import db
from auth import AuthManager
import os

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
            phone=data.get('phone')
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
