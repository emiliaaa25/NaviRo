from db import db

def migrate():
    with db.get_cursor() as cur:
        # If academic_year already exists as integer, change it to text
        cur.execute("""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'student_profiles'
                    AND column_name = 'academic_year'
                    AND data_type = 'integer'
                ) THEN
                    ALTER TABLE student_profiles
                        ALTER COLUMN academic_year TYPE VARCHAR(20) USING academic_year::text;
                END IF;
            END$$;
        """)

        cur.execute("""
            ALTER TABLE student_profiles
                ADD COLUMN IF NOT EXISTS student_type       VARCHAR(20),
                ADD COLUMN IF NOT EXISTS target_university  VARCHAR(20),
                ADD COLUMN IF NOT EXISTS target_faculty     TEXT,
                ADD COLUMN IF NOT EXISTS target_faculty_id  VARCHAR(60),
                ADD COLUMN IF NOT EXISTS home_university    TEXT,
                ADD COLUMN IF NOT EXISTS home_faculty       TEXT;
        """)

        cur.execute("""
            ALTER TABLE student_profiles
                ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20);
        """)

    print("Migration complete.")

if __name__ == "__main__":
    migrate()