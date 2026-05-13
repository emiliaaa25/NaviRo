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

            # Quest catalog table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS quests (
                    id SERIAL PRIMARY KEY,
                    slug VARCHAR(120) UNIQUE NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    journey_type VARCHAR(80) DEFAULT 'Relocation',
                    target_audience VARCHAR(120),
                    start_deadline DATE,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Quest steps table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS quest_steps (
                    id SERIAL PRIMARY KEY,
                    quest_id INTEGER NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
                    step_order INTEGER NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    deadline_label VARCHAR(80),
                    deadline_date DATE,
                    resource_label VARCHAR(255),
                    resource_url VARCHAR(500),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(quest_id, step_order)
                )
            """)

            # Quest checklist items table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS quest_checklist_items (
                    id SERIAL PRIMARY KEY,
                    step_id INTEGER NOT NULL REFERENCES quest_steps(id) ON DELETE CASCADE,
                    item_order INTEGER NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    details TEXT,
                    requires_scan BOOLEAN DEFAULT FALSE,
                    resource_label VARCHAR(255),
                    resource_url VARCHAR(500),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(step_id, item_order)
                )
            """)

            # Quest progress table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS quest_user_progress (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    quest_id INTEGER NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
                    current_step_order INTEGER DEFAULT 1,
                    completion_percentage INTEGER DEFAULT 0,
                    status VARCHAR(50) DEFAULT 'In Progress',
                    next_deadline_label VARCHAR(80),
                    next_step_title VARCHAR(255),
                    completed_steps JSONB DEFAULT '[]'::jsonb,
                    completed_checklist JSONB DEFAULT '[]'::jsonb,
                    last_milestone_hint TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, quest_id)
                )
            """)

            self._seed_default_quest_data(cur)

            print("Database initialized successfully")

    def _seed_default_quest_data(self, cur):
        """Seed the default relocation quest and its steps if they do not exist."""
        cur.execute(
            """
            INSERT INTO quests (slug, title, description, journey_type, target_audience, start_deadline, is_active)
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                TRUE
            )
            ON CONFLICT (slug) DO NOTHING
            """,
            (
                "eu-student-admission-september-2026",
                "EU Student Admission (September 2026)",
                "Linear, step-by-step quest covering admission, visa, housing, and pre-arrival milestones.",
                "Admission",
                "EU students",
                "2026-09-01",
            ),
        )

        cur.execute(
            "SELECT id FROM quests WHERE slug = %s",
            ("eu-student-admission-september-2026",),
        )
        quest_row = cur.fetchone()
        if not quest_row:
            return

        quest_id = quest_row[0]

        steps = [
            (
                1,
                "Submit Application",
                "Register on the UAIC portal, upload documents, and pay the application fee.",
                "March 31",
                "2026-03-31",
                "UAIC Admissions and Programs",
                "https://www.uaic.ro/en/admission/",
            ),
            (
                2,
                "Wait & Track",
                "Monitor your email and reply quickly if the admission office requests more information.",
                "May 15",
                "2026-05-15",
                "UAIC International Relations Department",
                "https://www.uaic.ro/en/international/departamentul-de-relatii-internationale/",
            ),
            (
                3,
                "Receive Offer",
                "Accept or reject the offer and confirm enrollment once the result arrives.",
                "June 1",
                "2026-06-01",
                "UAIC Admissions and Programs",
                "https://www.uaic.ro/en/admission/",
            ),
            (
                4,
                "Housing Application",
                "Apply for dorm housing early and keep a private housing backup ready.",
                "July 1",
                "2026-07-01",
                "UAIC Student Housing Services",
                "https://www.uaic.ro/en/student-services/accommodation",
            ),
            (
                5,
                "Pre-Arrival",
                "Book transport, prepare your bank account plan, and get your arrival essentials ready.",
                "August 15",
                "2026-08-15",
                "Romanian Immigration Office (IGI)",
                "https://igi.mai.gov.ro/",
            ),
        ]

        for step_order, title, description, deadline_label, deadline_date, resource_label, resource_url in steps:
            cur.execute(
                """
                INSERT INTO quest_steps (
                    quest_id,
                    step_order,
                    title,
                    description,
                    deadline_label,
                    deadline_date,
                    resource_label,
                    resource_url
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (quest_id, step_order) DO NOTHING
                """,
                (
                    quest_id,
                    step_order,
                    title,
                    description,
                    deadline_label,
                    deadline_date,
                    resource_label,
                    resource_url,
                ),
            )

        cur.execute(
            "SELECT id, step_order FROM quest_steps WHERE quest_id = %s ORDER BY step_order",
            (quest_id,),
        )
        step_rows = cur.fetchall()
        step_map = {row[1]: row[0] for row in step_rows}

        checklist_items = {
            1: [
                (1, "Register on the UAIC admission portal", "Use your official profile and keep credentials saved."),
                (2, "Upload all required scans", "Prepare passport, diploma, transcripts, and photos before submission."),
                (3, "Pay the application fee", "Keep the payment receipt for your records."),
            ],
            2: [
                (1, "Check email daily", "Admission teams often send follow-up questions fast."),
                (2, "Reply with missing documents", "Send any requested files before the deadline window closes."),
            ],
            3: [
                (1, "Review the offer letter", "Confirm the study program and any conditions attached to the offer."),
                (2, "Accept or decline formally", "Use the official channel, not just email confirmation."),
            ],
            4: [
                (1, "Apply for dormitory housing", "Submit your request early to improve allocation chances."),
                (2, "Prepare a private housing backup", "Keep a second option ready in case dorm places run out."),
                (3, "Save the housing confirmation", "You will need it for the next onboarding steps."),
            ],
            5: [
                (1, "Book transport to Iasi", "Compare train, bus, and flight options before prices rise."),
                (2, "Plan banking setup", "Decide what you need to open a local account after arrival."),
                (3, "Pre-order a SIM card", "Make sure you have connectivity from day one."),
            ],
        }

        for step_order, items in checklist_items.items():
            step_id = step_map.get(step_order)
            if not step_id:
                continue

            for item_order, title, details in items:
                cur.execute(
                    """
                    INSERT INTO quest_checklist_items (
                        step_id,
                        item_order,
                        title,
                        details
                    )
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (step_id, item_order) DO NOTHING
                    """,
                    (step_id, item_order, title, details),
                )

# Initialize database instance
db = Database()
