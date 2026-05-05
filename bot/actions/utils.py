"""Conversation storage helpers for PostgreSQL."""

import psycopg2

from .config import Config


def _ensure_schema(cursor):
    """Create or repair the conversations table."""
    cursor.execute(
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

    cursor.execute(
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

    # Repair older schemas where id exists but has no default sequence.
    cursor.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'conversations'
                  AND column_name = 'id'
                  AND column_default IS NULL
            ) THEN
                CREATE SEQUENCE IF NOT EXISTS conversations_id_seq;
                PERFORM setval(
                    'conversations_id_seq',
                    COALESCE((SELECT MAX(id) FROM conversations), 0) + 1,
                    false
                );
                ALTER TABLE conversations
                ALTER COLUMN id SET DEFAULT nextval('conversations_id_seq');
            END IF;
        END
        $$;
        """
    )


def store_conversation(user_id, user_message, bot_response, session_id=None):
    """Persist a single conversation turn."""
    conn = None
    cursor = None
    try:
        conn = psycopg2.connect(Config.DB_CONNECTION_STRING)
        cursor = conn.cursor()
        _ensure_schema(cursor)
        cursor.execute(
            """
            INSERT INTO conversations (user_id, session_id, user_message, bot_response)
            VALUES (%s, %s, %s, %s)
            """,
            (user_id, session_id, user_message, bot_response),
        )
        conn.commit()
    except Exception as e:
        print(f"Error storing conversation: {e}")
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()