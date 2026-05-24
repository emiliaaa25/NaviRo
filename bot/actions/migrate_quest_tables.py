"""Database migration: add quest roadmap tables and seed the default quest."""

import os
from contextlib import contextmanager

import psycopg2


class Database:
    def __init__(self, host=None, database=None, user=None, password=None):
        default_host = os.getenv('DB_HOST', 'localhost')
        if os.getenv('RUNNING_IN_DOCKER') == 'true':
            default_host = 'db'

        self.host = host or default_host
        self.database = database or os.getenv('DB_NAME', 'iasi_quest_db')
        self.user = user or os.getenv('DB_USER', 'postgres')
        self.password = password or os.getenv('DB_PASSWORD', 'postgres')
        self.port = os.getenv('DB_PORT', '5432')

    def get_connection(self):
        return psycopg2.connect(
            host=self.host,
            database=self.database,
            user=self.user,
            password=self.password,
            port=self.port,
        )

    @contextmanager
    def get_cursor(self):
        conn = self.get_connection()
        cur = conn.cursor()
        try:
            yield cur
            conn.commit()
        except Exception as exc:
            conn.rollback()
            raise exc
        finally:
            cur.close()
            conn.close()


def migrate_quest_tables():
    db = Database()

    statements = [
        """
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
        """,
        """
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
        """,
        """
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
        """,
        """
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
        """,
    ]

    try:
        with db.get_cursor() as cur:
            for statement in statements:
                cur.execute(statement)

            quest_specs = [
                {
                    'slug': 'erasmus-mobility-september-2026',
                    'title': 'Erasmus Mobility (September 2026)',
                    'description': 'Step-by-step mobility roadmap for exchange students, from documents to arrival.',
                    'journey_type': 'Mobility',
                    'target_audience': 'Erasmus students',
                    'start_deadline': '2026-09-01',
                    'steps': [
                        (1, 'Send Erasmus file', 'Upload the Learning Agreement, nomination letter, and any faculty approval papers.', 'March 31', '2026-03-31', 'UAIC Erasmus Office', 'https://www.uaic.ro/en/international/mobility/erasmus/'),
                        (2, 'Answer the review request', 'Check your inbox and send any missing documents the office asks for.', 'May 15', '2026-05-15', 'UAIC International Relations Department', 'https://www.uaic.ro/en/international/departamentul-de-relatii-internationale/'),
                        (3, 'Confirm your exchange place', 'Accept the mobility place and lock in the courses you will take abroad.', 'June 1', '2026-06-01', 'UAIC Erasmus Office', 'https://www.uaic.ro/en/international/mobility/erasmus/'),
                        (4, 'Find temporary housing', 'Search for a short-term room or apartment close to campus.', 'July 1', '2026-07-01', 'UAIC Student Housing Services', 'https://www.uaic.ro/en/student-services/accommodation'),
                        (5, 'Prepare for departure', 'Organize travel, insurance, and the documents you need on arrival.', 'August 15', '2026-08-15', 'Romanian Immigration Office (IGI)', 'https://igi.mai.gov.ro/'),
                    ],
                    'checklist_items': {
                        1: [
                            (1, 'Get the required signatures', 'Make sure both your sending and host institutions have signed the files.'),
                            (2, 'Check course equivalence', 'Confirm the Learning Agreement matches your study plan.'),
                            (3, 'Save every document', 'Keep a copy of the full mobility file before you upload it.'),
                        ],
                        2: [
                            (1, 'Watch your email daily', 'Mobility offices often reply in batches, so don’t miss a request.'),
                            (2, 'Send corrections fast', 'Reply with the missing files before the deadline closes.'),
                        ],
                        3: [
                            (1, 'Check the semester dates', 'Make sure the mobility period matches your host faculty plan.'),
                            (2, 'Lock your course list', 'Finalize the classes you will attend during the exchange.'),
                        ],
                        4: [
                            (1, 'Book temporary housing', 'Choose accommodation that works for a short stay and budget.'),
                            (2, 'Save contact details', 'Keep the host office and housing contacts ready on your phone.'),
                        ],
                        5: [
                            (1, 'Prepare insurance and travel papers', 'Keep your entry documents and emergency info together.'),
                            (2, 'Plan your first week', 'Decide how you will get from arrival to campus and where to report first.'),
                        ],
                    },
                },
                {
                    'slug': 'eu-student-admission-september-2026',
                    'title': 'EU Student Admission (September 2026)',
                    'description': 'Practical admissions roadmap for UAIC students, from application to arrival.',
                    'journey_type': 'Admission',
                    'target_audience': 'UAIC students',
                    'start_deadline': '2026-09-01',
                    'steps': [
                        (1, 'Complete the application', 'Create your UAIC account, upload the requested documents, and pay the fee.', 'March 31', '2026-03-31', 'UAIC Admissions and Programs', 'https://www.uaic.ro/en/admission/'),
                        (2, 'Track the file review', 'Check email for missing documents or corrections and respond quickly.', 'May 15', '2026-05-15', 'UAIC International Relations Department', 'https://www.uaic.ro/en/international/departamentul-de-relatii-internationale/'),
                        (3, 'Confirm the admission offer', 'Accept the offer, then follow the enrollment instructions from the university.', 'June 1', '2026-06-01', 'UAIC Admissions and Programs', 'https://www.uaic.ro/en/admission/'),
                        (4, 'Apply for housing', 'Choose dorm housing or a backup apartment before places fill up.', 'July 1', '2026-07-01', 'UAIC Student Housing Services', 'https://www.uaic.ro/en/student-services/accommodation'),
                        (5, 'Get ready for arrival', 'Plan your transport, banking, and first-day documents before you travel.', 'August 15', '2026-08-15', 'Romanian Immigration Office (IGI)', 'https://igi.mai.gov.ro/'),
                    ],
                    'checklist_items': {
                        1: [
                            (1, 'Create the portal account', 'Use your official email and keep your login details saved.'),
                            (2, 'Upload the required scans', 'Prepare passport, diploma, transcripts, and photos before you start.'),
                            (3, 'Pay and save the receipt', 'Keep the payment proof with your application file.'),
                        ],
                        2: [
                            (1, 'Check email every day', 'The admissions team may ask for a correction or extra file.'),
                            (2, 'Send missing documents', 'Reply before the deadline window closes.'),
                        ],
                        3: [
                            (1, 'Review the offer letter', 'Confirm the program name and any conditions attached to the offer.'),
                            (2, 'Accept the place formally', 'Use the official channel, not only email.'),
                        ],
                        4: [
                            (1, 'Apply for dorm housing', 'Submit your request early to improve your chances.'),
                            (2, 'Keep a backup apartment', 'Have a second option ready in case the dorm is full.'),
                            (3, 'Save the confirmation', 'You may need it for enrollment or visa steps.'),
                        ],
                        5: [
                            (1, 'Book transport to Iași', 'Compare train, bus, and flight options before prices rise.'),
                            (2, 'Plan banking and money', 'Decide what you need to open a local account after arrival.'),
                            (3, 'Prepare a SIM card', 'Make sure you have phone and data access from day one.'),
                        ],
                    },
                },
                {
                    'slug': 'umf-health-sciences-september-2026',
                    'title': 'UMF Health Sciences Admission (September 2026)',
                    'description': 'Practical roadmap for medicine, dentistry, and pharmacy applicants at UMF.',
                    'journey_type': 'Admission',
                    'target_audience': 'UMF students',
                    'start_deadline': '2026-09-01',
                    'steps': [
                        (1, 'Send the UMF application', 'Prepare the faculty documents, language proof, and application forms.', 'March 31', '2026-03-31', 'UMF Admissions', 'https://www.umfiasi.ro/en/admission/'),
                        (2, 'Follow the faculty review', 'Watch for emails about interviews, tests, or missing files.', 'May 15', '2026-05-15', 'UMF International Relations', 'https://www.umfiasi.ro/en/international-relations/'),
                        (3, 'Confirm your faculty offer', 'Accept the place and check the registration conditions for your program.', 'June 1', '2026-06-01', 'UMF Admissions', 'https://www.umfiasi.ro/en/admission/'),
                        (4, 'Plan housing and schedule', 'Arrange housing near campus and look at practical or clinical timetable needs.', 'July 1', '2026-07-01', 'UMF Student Services', 'https://www.umfiasi.ro/en/student-life/accommodation/'),
                        (5, 'Prepare for registration day', 'Get your travel, insurance, and first-day registration documents ready.', 'August 15', '2026-08-15', 'Romanian Immigration Office (IGI)', 'https://igi.mai.gov.ro/'),
                    ],
                    'checklist_items': {
                        1: [
                            (1, 'Check the faculty requirements', 'Review the rules for medicine, dentistry, or pharmacy before you apply.'),
                            (2, 'Prepare language proof', 'Keep your certificate or equivalent file ready.'),
                            (3, 'Upload the full file', 'Send every document requested by the faculty portal.'),
                        ],
                        2: [
                            (1, 'Watch faculty communications', 'Some programs request an interview or extra proof.'),
                            (2, 'Send corrections early', 'Do not wait until the last day to fix missing files.'),
                        ],
                        3: [
                            (1, 'Review the offer conditions', 'Make sure the program and language track match your application.'),
                            (2, 'Confirm enrollment', 'Follow the official faculty process to accept the seat.'),
                        ],
                        4: [
                            (1, 'Arrange housing close to campus', 'Prioritise access to the medical campus or clinic sites.'),
                            (2, 'Check schedule constraints', 'Plan for labs, practicals, or rotations.'),
                        ],
                        5: [
                            (1, 'Prepare insurance and ID documents', 'Keep the papers needed on the first registration day.'),
                            (2, 'Set up local communication', 'Make sure you can receive faculty and hospital updates.'),
                        ],
                    },
                },
                {
                    'slug': 'tuiasi-technical-september-2026',
                    'title': 'TUIASI Technical Admission (September 2026)',
                    'description': 'Practical roadmap for engineering and technical applicants at TUIASI.',
                    'journey_type': 'Admission',
                    'target_audience': 'TUIASI students',
                    'start_deadline': '2026-09-01',
                    'steps': [
                        (1, 'Send the technical application', 'Gather the engineering documents, transcripts, and any portfolio files you need.', 'March 31', '2026-03-31', 'TUIASI Admissions', 'https://www.tuiasi.ro/en/admissions/'),
                        (2, 'Follow the validation stage', 'Watch for missing file requests or placement checks from the faculty.', 'May 15', '2026-05-15', 'TUIASI International Office', 'https://www.tuiasi.ro/en/international/'),
                        (3, 'Confirm your offer', 'Review the study program and accept the place in the correct faculty.', 'June 1', '2026-06-01', 'TUIASI Admissions', 'https://www.tuiasi.ro/en/admissions/'),
                        (4, 'Plan housing and lab access', 'Secure housing and check whether your faculty has lab or workshop needs.', 'July 1', '2026-07-01', 'TUIASI Student Housing', 'https://www.tuiasi.ro/en/student-life/accommodation/'),
                        (5, 'Prepare for the semester start', 'Get your travel, insurance, and study tools ready before arrival.', 'August 15', '2026-08-15', 'Romanian Immigration Office (IGI)', 'https://igi.mai.gov.ro/'),
                    ],
                    'checklist_items': {
                        1: [
                            (1, 'Confirm your faculty and program', 'Make sure the engineering track is correct before you submit.'),
                            (2, 'Upload academic evidence', 'Prepare transcripts, diplomas, and any portfolio files requested.'),
                            (3, 'Save the payment receipt', 'Keep the fee confirmation with your file.'),
                        ],
                        2: [
                            (1, 'Check faculty email updates', 'Technical faculties may ask for clarifications quickly.'),
                            (2, 'Send missing documents', 'Reply promptly if the admissions team asks for more files.'),
                        ],
                        3: [
                            (1, 'Verify the study program', 'Check the engineering track before you accept.'),
                            (2, 'Accept the offer formally', 'Use the official admissions flow to confirm your place.'),
                        ],
                        4: [
                            (1, 'Arrange housing near campus', 'Think about access to labs and workshop buildings.'),
                            (2, 'Plan equipment and laptop setup', 'Make sure you have the tools for the first classes.'),
                        ],
                        5: [
                            (1, 'Prepare travel and visa paperwork', 'Keep the entry documents ready for arrival.'),
                            (2, 'Set up contact channels', 'Use a reliable email and phone number for faculty notices.'),
                        ],
                    },
                },
            ]

            for spec in quest_specs:
                cur.execute(
                    """
                    INSERT INTO quests (slug, title, description, journey_type, target_audience, start_deadline, is_active)
                    VALUES (%s, %s, %s, %s, %s, %s, TRUE)
                    ON CONFLICT (slug) DO NOTHING
                    """,
                    (
                        spec['slug'],
                        spec['title'],
                        spec['description'],
                        spec['journey_type'],
                        spec['target_audience'],
                        spec['start_deadline'],
                    ),
                )

                cur.execute("SELECT id FROM quests WHERE slug = %s", (spec['slug'],))
                quest_row = cur.fetchone()
                if not quest_row:
                    raise RuntimeError(f"Quest {spec['slug']} could not be created")

                quest_id = quest_row[0]

                for step_order, title, description, deadline_label, deadline_date, resource_label, resource_url in spec['steps']:
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
                        (quest_id, step_order, title, description, deadline_label, deadline_date, resource_label, resource_url),
                    )

                cur.execute(
                    "SELECT id, step_order FROM quest_steps WHERE quest_id = %s ORDER BY step_order",
                    (quest_id,),
                )
                step_map = {row[1]: row[0] for row in cur.fetchall()}

                for step_order, items in spec['checklist_items'].items():
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

        print('Quest roadmap migration completed successfully')
        return True
    except Exception as exc:
        print(f'Quest roadmap migration failed: {exc}')
        return False


if __name__ == '__main__':
    migrate_quest_tables()
