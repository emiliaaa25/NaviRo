import psycopg2
from psycopg2 import sql
import os
from contextlib import contextmanager

class Database:
    def __init__(self, host=None, database=None, user=None, password=None):
        self.host = host or os.getenv('DB_HOST', 'db')
        self.database = database or os.getenv('DB_NAME', 'iasi_quest_db')
        self.user = user or os.getenv('DB_USER', 'postgres')
        self.password = password or os.getenv('DB_PASSWORD', 'postgres')
        self.port = os.getenv('DB_PORT', '5432')

    def get_connection(self):
        try:
            conn = psycopg2.connect(
                host=self.host,
                database=self.database,
                user=self.user,
                password=self.password,
                port=self.port
            )
            return conn
        except psycopg2.Error as e:
            print(f"Database connection error: {e}")
            raise

    @contextmanager
    def get_cursor(self):
        conn = self.get_connection()
        cur = conn.cursor()
        try:
            yield cur
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cur.close()
            conn.close()

    def init_db(self):
        """Initialize database tables"""
        with self.get_cursor() as cur:
            # Users table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(80) UNIQUE NOT NULL,
                    email VARCHAR(120) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Student profiles table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS student_profiles (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    full_name VARCHAR(120) NOT NULL,
                    academic_year INTEGER,
                    faculty VARCHAR(120),
                    specialization VARCHAR(120),
                    bio TEXT,
                    profile_picture_url VARCHAR(255),
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Quest relocation profiles table (IASI-Quest specific)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS quest_relocation_profiles (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    country_of_origin VARCHAR(120) NOT NULL,
                    citizenship_type VARCHAR(50) NOT NULL,
                    study_program VARCHAR(255),
                    target_university VARCHAR(255),
                    target_faculty VARCHAR(255),
                    visa_status VARCHAR(50) DEFAULT 'Not Started',
                    housing_status VARCHAR(50) DEFAULT 'Not Started',
                    arrival_date DATE,
                    birth_date DATE,
                    phone VARCHAR(20),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Quest tokens table (Digital Shadow persistence)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS quest_tokens (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    quest_token VARCHAR(255) UNIQUE NOT NULL,
                    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Quest progress/milestones table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS quest_progress (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    milestone_name VARCHAR(255) NOT NULL,
                    status VARCHAR(50) DEFAULT 'Locked',
                    completion_date TIMESTAMP,
                    notes TEXT,
                    documents_uploaded JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, milestone_name)
                )
            """)

            # Projects table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS projects (
                    id SERIAL PRIMARY KEY,
                    student_id INTEGER NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    status VARCHAR(50) DEFAULT 'In Progress',
                    progress_percentage INTEGER DEFAULT 0,
                    category VARCHAR(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Verified links table (for RAG: MAE, IGI, official resources)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS verified_links (
                    id SERIAL PRIMARY KEY,
                    category VARCHAR(50) NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    url VARCHAR(500) NOT NULL UNIQUE,
                    description TEXT,
                    keywords TEXT,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            print("Database initialized successfully")

# Initialize database instance
db = Database()
