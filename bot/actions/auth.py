import jwt
import hashlib
import secrets
from datetime import datetime, timedelta
from functools import wraps
from typing import Optional, Dict, Any
import os
from db import db

SECRET_KEY = os.getenv('SECRET_KEY', 'your-secret-key-change-in-production')
TOKEN_EXPIRATION = int(os.getenv('TOKEN_EXPIRATION', 86400))  # 24 hours in seconds

class AuthManager:
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash password using PBKDF2"""
        salt = secrets.token_hex(32)
        pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
        return f"{salt}${pwd_hash.hex()}"

    @staticmethod
    def verify_password(password: str, password_hash: str) -> bool:
        """Verify password against hash"""
        try:
            salt, pwd_hash = password_hash.split('$')
            new_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
            return new_hash.hex() == pwd_hash
        except Exception as e:
            print(f"Password verification error: {e}")
            return False

    @staticmethod
    def generate_token(user_id: int, username: str) -> str:
        """Generate JWT token"""
        payload = {
            'user_id': user_id,
            'username': username,
            'iat': datetime.utcnow(),
            'exp': datetime.utcnow() + timedelta(seconds=TOKEN_EXPIRATION)
        }
        return jwt.encode(payload, SECRET_KEY, algorithm='HS256')

    @staticmethod
    def verify_token(token: str) -> Optional[Dict[str, Any]]:
        """Verify JWT token"""
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            return payload
        except jwt.ExpiredSignatureError:
            print("Token expired")
            return None
        except jwt.InvalidTokenError:
            print("Invalid token")
            return None

    @staticmethod
    def register_user(username: str, email: str, password: str, full_name: str) -> Dict[str, Any]:
        """Register new user"""
        try:
            password_hash = AuthManager.hash_password(password)
            
            with db.get_cursor() as cur:
                # Insert user
                cur.execute(
                    """INSERT INTO users (username, email, password_hash) 
                       VALUES (%s, %s, %s) RETURNING id, username, email""",
                    (username, email, password_hash)
                )
                user = cur.fetchone()
                user_id = user[0]

                # Create student profile
                cur.execute(
                    """INSERT INTO student_profiles (user_id, full_name) 
                       VALUES (%s, %s) RETURNING id""",
                    (user_id, full_name)
                )

                return {
                    'success': True,
                    'user_id': user_id,
                    'username': user[1],
                    'email': user[2],
                    'message': 'User registered successfully'
                }
        except Exception as e:
            return {
                'success': False,
                'message': f'Registration failed: {str(e)}'
            }

    @staticmethod
    def login_user(username: str, password: str) -> Dict[str, Any]:
        """Authenticate user"""
        try:
            with db.get_cursor() as cur:
                cur.execute(
                    "SELECT id, username, email, password_hash FROM users WHERE username = %s",
                    (username,)
                )
                user = cur.fetchone()

            if not user:
                return {'success': False, 'message': 'User not found'}

            user_id, username, email, password_hash = user
            
            if not AuthManager.verify_password(password, password_hash):
                return {'success': False, 'message': 'Invalid password'}

            token = AuthManager.generate_token(user_id, username)
            return {
                'success': True,
                'user_id': user_id,
                'username': username,
                'email': email,
                'token': token,
                'message': 'Login successful'
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'Login failed: {str(e)}'
            }

    @staticmethod
    def get_user_profile(user_id: int) -> Optional[Dict[str, Any]]:
        """Get user profile with projects"""
        try:
            with db.get_cursor() as cur:
                # Get user info
                cur.execute(
                    """SELECT u.id, u.username, u.email, sp.full_name, sp.academic_year, 
                              sp.faculty, sp.specialization, sp.bio, sp.profile_picture_url
                       FROM users u 
                       LEFT JOIN student_profiles sp ON u.id = sp.user_id 
                       WHERE u.id = %s""",
                    (user_id,)
                )
                user_data = cur.fetchone()

                if not user_data:
                    return None

                # Get projects
                cur.execute(
                    """SELECT id, title, description, status, progress_percentage, category, created_at
                       FROM projects WHERE student_id = (SELECT id FROM student_profiles WHERE user_id = %s)
                       ORDER BY created_at DESC""",
                    (user_id,)
                )
                projects = cur.fetchall()

                return {
                    'id': user_data[0],
                    'username': user_data[1],
                    'email': user_data[2],
                    'full_name': user_data[3],
                    'academic_year': user_data[4],
                    'faculty': user_data[5],
                    'specialization': user_data[6],
                    'bio': user_data[7],
                    'profile_picture_url': user_data[8],
                    'projects': [
                        {
                            'id': p[0],
                            'title': p[1],
                            'description': p[2],
                            'status': p[3],
                            'progress_percentage': p[4],
                            'category': p[5],
                            'created_at': str(p[6])
                        } for p in projects
                    ]
                }
        except Exception as e:
            print(f"Error getting user profile: {e}")
            return None

    @staticmethod
    def update_user_profile(user_id: int, **kwargs) -> Dict[str, Any]:
        """Update user profile"""
        try:
            allowed_fields = {'full_name', 'academic_year', 'faculty', 'specialization', 'bio', 'profile_picture_url'}
            fields_to_update = {k: v for k, v in kwargs.items() if k in allowed_fields}

            if not fields_to_update:
                return {'success': False, 'message': 'No valid fields to update'}

            with db.get_cursor() as cur:
                set_clause = ', '.join([f"{k} = %s" for k in fields_to_update.keys()])
                cur.execute(
                    f"""UPDATE student_profiles SET {set_clause} 
                       WHERE user_id = %s RETURNING id""",
                    list(fields_to_update.values()) + [user_id]
                )

            return {
                'success': True,
                'message': 'Profile updated successfully'
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'Profile update failed: {str(e)}'
            }

    @staticmethod
    def add_project(user_id: int, title: str, description: str, category: str = None) -> Dict[str, Any]:
        """Add a new project for student"""
        try:
            with db.get_cursor() as cur:
                # Get student_id from user_id
                cur.execute(
                    "SELECT id FROM student_profiles WHERE user_id = %s",
                    (user_id,)
                )
                result = cur.fetchone()

                if not result:
                    return {'success': False, 'message': 'Student profile not found'}

                student_id = result[0]

                # Insert project
                cur.execute(
                    """INSERT INTO projects (student_id, title, description, category) 
                       VALUES (%s, %s, %s, %s) RETURNING id""",
                    (student_id, title, description, category)
                )

            return {
                'success': True,
                'message': 'Project added successfully'
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'Failed to add project: {str(e)}'
            }

    @staticmethod
    def update_project(project_id: int, **kwargs) -> Dict[str, Any]:
        """Update project details"""
        try:
            allowed_fields = {'title', 'description', 'status', 'progress_percentage', 'category'}
            fields_to_update = {k: v for k, v in kwargs.items() if k in allowed_fields}

            if not fields_to_update:
                return {'success': False, 'message': 'No valid fields to update'}

            with db.get_cursor() as cur:
                set_clause = ', '.join([f"{k} = %s" for k in fields_to_update.keys()])
                cur.execute(
                    f"""UPDATE projects SET {set_clause}, updated_at = CURRENT_TIMESTAMP 
                       WHERE id = %s""",
                    list(fields_to_update.values()) + [project_id]
                )

            return {
                'success': True,
                'message': 'Project updated successfully'
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'Failed to update project: {str(e)}'
            }

    # ============ IASI-QUEST SPECIFIC METHODS ============

    @staticmethod
    def generate_quest_token(user_id: int) -> Dict[str, Any]:
        """Generate a quest token for resuming user's relocation journey"""
        try:
            quest_token = secrets.token_urlsafe(32)
            expires_at = datetime.utcnow() + timedelta(days=365)  # 1 year expiration

            with db.get_cursor() as cur:
                # Delete old tokens for this user
                cur.execute("DELETE FROM quest_tokens WHERE user_id = %s", (user_id,))
                
                # Create new quest token
                cur.execute(
                    """INSERT INTO quest_tokens (user_id, quest_token, expires_at) 
                       VALUES (%s, %s, %s) RETURNING quest_token""",
                    (user_id, quest_token, expires_at)
                )

            return {
                'success': True,
                'quest_token': quest_token,
                'message': 'Quest token generated successfully'
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'Failed to generate quest token: {str(e)}'
            }

    @staticmethod
    def retrieve_quest_by_token(quest_token: str) -> Optional[Dict[str, Any]]:
        """Retrieve user's quest progress using quest token (Digital Shadow)"""
        try:
            with db.get_cursor() as cur:
                # Get user_id from quest token
                cur.execute(
                    """SELECT user_id, expires_at FROM quest_tokens 
                       WHERE quest_token = %s AND expires_at > CURRENT_TIMESTAMP""",
                    (quest_token,)
                )
                result = cur.fetchone()

                if not result:
                    return None

                user_id, _ = result

                # Update last_accessed
                cur.execute(
                    """UPDATE quest_tokens SET last_accessed = CURRENT_TIMESTAMP 
                       WHERE quest_token = %s""",
                    (quest_token,)
                )

                # Get relocation profile
                cur.execute(
                    """SELECT country_of_origin, citizenship_type, study_program, 
                              target_university, target_faculty, visa_status, housing_status, 
                              arrival_date, birth_date, phone
                       FROM quest_relocation_profiles WHERE user_id = %s""",
                    (user_id,)
                )
                profile = cur.fetchone()

                # Get quest progress
                cur.execute(
                    """SELECT milestone_name, status, completion_date, notes
                       FROM quest_progress WHERE user_id = %s ORDER BY created_at""",
                    (user_id,)
                )
                milestones = cur.fetchall()

                if not profile:
                    return {'user_id': user_id, 'profile': None, 'milestones': []}

                return {
                    'user_id': user_id,
                    'profile': {
                        'country_of_origin': profile[0],
                        'citizenship_type': profile[1],
                        'study_program': profile[2],
                        'target_university': profile[3],
                        'target_faculty': profile[4],
                        'visa_status': profile[5],
                        'housing_status': profile[6],
                        'arrival_date': str(profile[7]) if profile[7] else None,
                        'birth_date': str(profile[8]) if profile[8] else None,
                        'phone': profile[9]
                    },
                    'milestones': [
                        {
                            'name': m[0],
                            'status': m[1],
                            'completion_date': str(m[2]) if m[2] else None,
                            'notes': m[3]
                        } for m in milestones
                    ]
                }
        except Exception as e:
            print(f"Error retrieving quest: {e}")
            return None

    @staticmethod
    def create_relocation_profile(user_id: int, country_of_origin: str, citizenship_type: str,
                                  study_program: str = None, target_university: str = None,
                                  target_faculty: str = None, birth_date: str = None,
                                  phone: str = None) -> Dict[str, Any]:
        """Create initial relocation profile (handles nationality-based branching)"""
        try:
            with db.get_cursor() as cur:
                cur.execute(
                    """INSERT INTO quest_relocation_profiles 
                       (user_id, country_of_origin, citizenship_type, study_program, 
                        target_university, target_faculty, birth_date, phone) 
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                       ON CONFLICT (user_id) DO UPDATE SET
                       country_of_origin = EXCLUDED.country_of_origin,
                       citizenship_type = EXCLUDED.citizenship_type,
                       study_program = EXCLUDED.study_program,
                       target_university = EXCLUDED.target_university,
                       target_faculty = EXCLUDED.target_faculty
                       RETURNING id""",
                    (user_id, country_of_origin, citizenship_type, study_program,
                     target_university, target_faculty, birth_date, phone)
                )

                # Initialize first milestone (Admission)
                cur.execute(
                    """INSERT INTO quest_progress (user_id, milestone_name, status)
                       VALUES (%s, 'Admission', 'In Progress')
                       ON CONFLICT DO NOTHING""",
                    (user_id,)
                )

            return {
                'success': True,
                'message': 'Relocation profile created successfully',
                'citizenship_type': citizenship_type
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'Failed to create relocation profile: {str(e)}'
            }

    @staticmethod
    def get_quest_progress(user_id: int) -> Optional[Dict[str, Any]]:
        """Get user's quest progress with all milestones and status"""
        try:
            with db.get_cursor() as cur:
                # Get relocation profile
                cur.execute(
                    """SELECT country_of_origin, citizenship_type, study_program, 
                              target_university, visa_status, housing_status, arrival_date
                       FROM quest_relocation_profiles WHERE user_id = %s""",
                    (user_id,)
                )
                profile = cur.fetchone()

                if not profile:
                    return None

                # Get milestones
                cur.execute(
                    """SELECT milestone_name, status, completion_date, notes
                       FROM quest_progress WHERE user_id = %s ORDER BY created_at""",
                    (user_id,)
                )
                milestones = cur.fetchall()

                # Default milestones if not in DB
                default_milestones = ['Admission', 'Visa', 'Housing', 'Health Registration', 'Integration']
                milestone_dict = {m[0]: m for m in milestones}

                milestones_progress = []
                for ms_name in default_milestones:
                    if ms_name in milestone_dict:
                        m = milestone_dict[ms_name]
                        milestones_progress.append({
                            'name': m[0],
                            'status': m[1],
                            'completion_date': str(m[2]) if m[2] else None,
                            'notes': m[3]
                        })
                    else:
                        # Create default milestone
                        status = 'Locked' if ms_name != 'Admission' else 'In Progress'
                        milestones_progress.append({
                            'name': ms_name,
                            'status': status,
                            'completion_date': None,
                            'notes': None
                        })

                return {
                    'country_of_origin': profile[0],
                    'citizenship_type': profile[1],
                    'study_program': profile[2],
                    'target_university': profile[3],
                    'visa_status': profile[4],
                    'housing_status': profile[5],
                    'arrival_date': str(profile[6]) if profile[6] else None,
                    'milestones': milestones_progress
                }
        except Exception as e:
            print(f"Error getting quest progress: {e}")
            return None

    @staticmethod
    def update_quest_milestone(user_id: int, milestone_name: str, status: str,
                               notes: str = None) -> Dict[str, Any]:
        """Update milestone status in the quest"""
        try:
            with db.get_cursor() as cur:
                completion_date = datetime.utcnow() if status == 'Complete' else None
                
                cur.execute(
                    """INSERT INTO quest_progress (user_id, milestone_name, status, completion_date, notes)
                       VALUES (%s, %s, %s, %s, %s)
                       ON CONFLICT (user_id, milestone_name) DO UPDATE SET
                       status = EXCLUDED.status,
                       completion_date = EXCLUDED.completion_date,
                       notes = EXCLUDED.notes,
                       updated_at = CURRENT_TIMESTAMP""",
                    (user_id, milestone_name, status, completion_date, notes)
                )

            return {
                'success': True,
                'message': f'Milestone {milestone_name} updated to {status}'
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'Failed to update milestone: {str(e)}'
            }

    @staticmethod
    def get_full_quest_profile(user_id: int) -> Optional[Dict[str, Any]]:
        """Get complete digital shadow - everything needed to resume the journey"""
        try:
            with db.get_cursor() as cur:
                # Get user info
                cur.execute(
                    """SELECT u.username, u.email, sp.full_name
                       FROM users u 
                       LEFT JOIN student_profiles sp ON u.id = sp.user_id 
                       WHERE u.id = %s""",
                    (user_id,)
                )
                user_data = cur.fetchone()

                if not user_data:
                    return None

                # Get full quest profile
                quest_progress = AuthManager.get_quest_progress(user_id)

                return {
                    'username': user_data[0],
                    'email': user_data[1],
                    'full_name': user_data[2],
                    'quest': quest_progress
                }
        except Exception as e:
            print(f"Error getting full quest profile: {e}")
            return None

