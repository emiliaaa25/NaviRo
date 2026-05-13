import json
import os
from contextlib import contextmanager
from pathlib import Path

import psycopg2
from psycopg2 import sql

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

            cur.execute("""
                CREATE TABLE IF NOT EXISTS activities (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    type VARCHAR(50) NOT NULL,
                    target JSONB NOT NULL DEFAULT '[]'::jsonb,
                    link VARCHAR(500) NOT NULL UNIQUE,
                    description TEXT,
                    keywords TEXT,
                    meeting_location VARCHAR(50),
                    schedule VARCHAR(50),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS user_activity_preferences (
                    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                    interests TEXT,
                    preferred_types TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cur.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'public' AND table_name = 'quest_relocation_profiles'
                          AND column_name = 'languages_spoken'
                    ) THEN
                        ALTER TABLE quest_relocation_profiles
                        ADD COLUMN languages_spoken VARCHAR(255);
                    END IF;
                END $$;
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS peer_connections (
                    id SERIAL PRIMARY KEY,
                    user_a_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    user_b_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    status VARCHAR(40) DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (user_a_id, user_b_id),
                    CHECK (user_a_id < user_b_id)
                )
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS peer_chat_messages (
                    id BIGSERIAL PRIMARY KEY,
                    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    body TEXT NOT NULL,
                    room_type VARCHAR(20) NOT NULL,
                    peer_connection_id INTEGER REFERENCES peer_connections(id) ON DELETE CASCADE,
                    cohort_key VARCHAR(120),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)

            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_peer_chat_conn
                ON peer_chat_messages (peer_connection_id, created_at DESC)
                WHERE peer_connection_id IS NOT NULL
            """)

            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_peer_chat_cohort
                ON peer_chat_messages (cohort_key, created_at DESC)
                WHERE cohort_key IS NOT NULL
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS forum_questions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    title VARCHAR(255) NOT NULL,
                    body TEXT NOT NULL,
                    tags VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS forum_answers (
                    id SERIAL PRIMARY KEY,
                    question_id INTEGER NOT NULL REFERENCES forum_questions(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    body TEXT NOT NULL,
                    is_accepted BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS forum_question_votes (
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    question_id INTEGER NOT NULL REFERENCES forum_questions(id) ON DELETE CASCADE,
                    vote SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
                    PRIMARY KEY (user_id, question_id)
                )
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS forum_answer_votes (
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    answer_id INTEGER NOT NULL REFERENCES forum_answers(id) ON DELETE CASCADE,
                    vote SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
                    PRIMARY KEY (user_id, answer_id)
                )
            """)

            self._seed_activities_from_json(cur)

            print("Database initialized successfully")

    def ensure_demo_forum_if_empty(self):
        """Insert demo Q&A when forum is empty (e.g. first user registered after API boot)."""
        with self.get_cursor() as cur:
            self._seed_demo_forum_if_empty(cur)

    def _seed_activities_from_json(self, cur):
        """Insert activities from verified_links.json (activities array)."""
        here = Path(__file__).resolve().parent
        candidates = [
            here / "verified_links.json",
            here.parent / "verified_links.json",
        ]
        path = next((p for p in candidates if p.exists()), None)
        if not path:
            print(
                "[db] Activities seed skipped: verified_links.json not found. "
                f"Tried: {', '.join(str(p) for p in candidates)}"
            )
            return
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            print(f"Could not read activities seed file: {exc}")
            return
        items = raw.get("activities") or []
        if not items:
            return
        for act in items:
            name = (act.get("name") or "").strip()
            link = (act.get("link") or "").strip()
            if not name or not link:
                continue
            target = act.get("target") or []
            if not isinstance(target, list):
                target = []
            cur.execute(
                """
                INSERT INTO activities
                    (name, type, target, link, description, keywords, meeting_location, schedule)
                VALUES (%s, %s, %s::jsonb, %s, %s, %s, %s, %s)
                ON CONFLICT (link) DO UPDATE SET
                    name = EXCLUDED.name,
                    type = EXCLUDED.type,
                    target = EXCLUDED.target,
                    description = EXCLUDED.description,
                    keywords = EXCLUDED.keywords,
                    meeting_location = EXCLUDED.meeting_location,
                    schedule = EXCLUDED.schedule
                """,
                (
                    name,
                    (act.get("type") or "Club").strip(),
                    json.dumps(target),
                    link,
                    act.get("description") or "",
                    act.get("keywords") or "",
                    act.get("meeting_location") or "",
                    act.get("schedule") or "",
                ),
            )

    def _seed_demo_forum_if_empty(self, cur):
        """Add sample Q&A when forum is empty so the UI is not blank (first user only)."""
        cur.execute("SELECT COUNT(*) FROM forum_questions")
        count = cur.fetchone()
        if count and count[0] > 0:
            return
        cur.execute("SELECT id FROM users ORDER BY id ASC LIMIT 1")
        row = cur.fetchone()
        if not row:
            print("[db] Forum demo seed skipped: no users in database yet")
            return
        uid = row[0]
        demos = [
            (
                "How did you find housing in Iași?",
                "I'm arriving in September and overwhelmed by listings. Which areas do international students recommend?",
                "housing",
            ),
            (
                "What documents for IGI registration?",
                "Non-EU student: what did you bring to your first immigration appointment?",
                "igi visa",
            ),
            (
                "Cheap mobile plans for students?",
                "Looking for a SIM with good data — what worked for you in Romania?",
                "sim phone",
            ),
        ]
        for title, body, tags in demos:
            cur.execute(
                """
                INSERT INTO forum_questions (user_id, title, body, tags)
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (uid, title[:255], body, tags[:255]),
            )
            qrow = cur.fetchone()
            if not qrow:
                continue
            qid = qrow[0]
            cur.execute(
                """
                INSERT INTO forum_answers (question_id, user_id, body)
                VALUES (%s, %s, %s)
                """,
                (
                    qid,
                    uid,
                    "Starter reply from NaviRo demo content — add your own experience below.",
                ),
            )
        print(f"[db] Seeded {len(demos)} demo forum questions (user_id={uid})")

# Initialize database instance
db = Database()
