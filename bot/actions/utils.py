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

    
    voice_migrations = [
        ("transcription", "TEXT"),
        ("voice_url", "VARCHAR(500)"),
        ("voice_response_url", "VARCHAR(500)"),
        ("language", "VARCHAR(10) DEFAULT 'en'"),
        ("is_voice_message", "BOOLEAN DEFAULT FALSE"),
        ("tts_enabled", "BOOLEAN DEFAULT TRUE"),
    ]

    for column_name, column_type in voice_migrations:
        cursor.execute(
            f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'conversations'
                      AND column_name = '{column_name}'
                ) THEN
                    ALTER TABLE conversations
                    ADD COLUMN {column_name} {column_type};
                END IF;
            END
            $$;
            """
        )

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


def store_conversation(
    user_id,
    user_message,
    bot_response,
    session_id=None,
    transcription=None,
    voice_url=None,
    voice_response_url=None,
    language="en",
    is_voice_message=False,
    tts_enabled=True
):
    """
    Persist a single conversation turn with optional voice fields.
    
    Args:
        user_id: User identifier
        user_message: Text of user message
        bot_response: Text of bot response
        session_id: Chat session identifier
        transcription: Transcribed text from voice input
        voice_url: URL to user's voice recording
        voice_response_url: URL to bot's TTS response audio
        language: Detected language (e.g., 'en', 'ro')
        is_voice_message: Flag if message was voice-initiated
        tts_enabled: Flag if TTS was used for response
    """
    conn = None
    cursor = None
    try:
        conn = psycopg2.connect(Config.DB_CONNECTION_STRING)
        cursor = conn.cursor()
        _ensure_schema(cursor)
        cursor.execute(
            """
            INSERT INTO conversations (
                user_id, session_id, user_message, bot_response,
                transcription, voice_url, voice_response_url,
                language, is_voice_message, tts_enabled
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                user_id, session_id, user_message, bot_response,
                transcription, voice_url, voice_response_url,
                language, is_voice_message, tts_enabled
            ),
        )
        conn.commit()
    except Exception as e:
        print(f"Error storing conversation: {e}")
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
