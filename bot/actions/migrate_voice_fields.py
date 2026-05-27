"""Database migration: Add voice chat fields to conversations table"""

import psycopg2
from psycopg2 import sql
import os
from contextlib import contextmanager


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
            print(f"\n💡 Troubleshooting:")
            print(f"   Host: {self.host}")
            print(f"   Port: {self.port}")
            print(f"   Database: {self.database}")
            print(f"   User: {self.user}")
            print(f"\n✓ Running in Docker? Use:")
            print(f"   docker-compose exec api python migrate_voice_fields.py")
            print(f"\n✓ Local development? Set environment variables:")
            print(f"   export DB_HOST=localhost")
            print(f"   python migrate_voice_fields.py")
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


def migrate_add_voice_fields():
    """Add voice chat fields to conversations table"""
    db = Database()
    
    migrations = [
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'conversations'
                  AND column_name = 'transcription'
            ) THEN
                ALTER TABLE conversations
                ADD COLUMN transcription TEXT;
            END IF;
        END
        $$;
        """,
        
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'conversations'
                  AND column_name = 'voice_url'
            ) THEN
                ALTER TABLE conversations
                ADD COLUMN voice_url VARCHAR(500);
            END IF;
        END
        $$;
        """,
        
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'conversations'
                  AND column_name = 'voice_response_url'
            ) THEN
                ALTER TABLE conversations
                ADD COLUMN voice_response_url VARCHAR(500);
            END IF;
        END
        $$;
        """,
        
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'conversations'
                  AND column_name = 'language'
            ) THEN
                ALTER TABLE conversations
                ADD COLUMN language VARCHAR(10) DEFAULT 'en';
            END IF;
        END
        $$;
        """,
        
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'conversations'
                  AND column_name = 'is_voice_message'
            ) THEN
                ALTER TABLE conversations
                ADD COLUMN is_voice_message BOOLEAN DEFAULT FALSE;
            END IF;
        END
        $$;
        """,
        
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'conversations'
                  AND column_name = 'tts_enabled'
            ) THEN
                ALTER TABLE conversations
                ADD COLUMN tts_enabled BOOLEAN DEFAULT TRUE;
            END IF;
        END
        $$;
        """,
    ]
    
    try:
        with db.get_cursor() as cur:
            for migration_sql in migrations:
                print(f"Running migration: {migration_sql[:100]}...")
                cur.execute(migration_sql)
                print("✓ Migration completed successfully")
        
        print("\n✓ All database migrations completed successfully!")
        return True
        
    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        return False


if __name__ == "__main__":
    migrate_add_voice_fields()
