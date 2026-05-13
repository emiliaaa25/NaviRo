# Voice Chat Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NAVIRO VOICE CHAT SYSTEM                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React/Vite)                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ ChatApp.jsx                                                             │ │
│  │ ┌────────────────────┐  ┌──────────────────┐  ┌─────────────────────┐ │ │
│  │ │  Messages List     │  │  VoiceInput Btn  │  │  Text Input Field   │ │ │
│  │ │  ├─ User messages  │  │                  │  │                     │ │ │
│  │ │  ├─ Bot responses  │  │  [🎤 Record]     │  │  [Type here...]     │ │ │
│  │ │  └─ Voice URLs     │  └──────────────────┘  └─────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                  │                                            │
│                    ┌─────────────┴─────────────┐                             │
│                    │                           │                             │
│         ┌──────────▼──────────┐    ┌──────────▼──────────┐                  │
│         │  VoiceInput.jsx     │    │  useVoice Hook      │                  │
│         │  (UI Component)     │    │  (Business Logic)   │                  │
│         ├─────────────────────┤    ├─────────────────────┤                  │
│         │ • Mic button        │    │ • Recording control │                  │
│         │ • Waveform display  │    │ • Transcription     │                  │
│         │ • Language selector │    │ • TTS playback      │                  │
│         │ • Transcript show   │    │ • Error handling    │                  │
│         │ • Play/Send buttons │    │ • Language detect   │                  │
│         └────────┬────────────┘    └────────┬────────────┘                  │
│                  │                           │                              │
│                  └───────────────┬───────────┘                              │
│                                  │                                           │
│         ┌────────────────────────▼────────────────────────┐                 │
│         │         Web Audio API / MediaRecorder           │                 │
│         │         Browser Speech Recognition API           │                 │
│         │         Web Speech Synthesis API                │                 │
│         └────────────────────────┬────────────────────────┘                 │
│                                  │                                           │
└──────────────────────────────────┼──────────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    │ Socket.io / HTTP Requests   │
                    │                             │
                    ▼                             ▼
┌─────────────────────────────┐    ┌──────────────────────────────┐
│  Socket.io Message Flow     │    │  REST API Calls              │
│  (Real-time chat)           │    │  (Voice processing)          │
├─────────────────────────────┤    ├──────────────────────────────┤
│ user_uttered EVENT:         │    │ POST /chat/transcribe        │
│ {                           │    │ • Audio blob → Text          │
│   message,                  │    │                              │
│   language,                 │    │ POST /chat/tts               │
│   enable_tts,               │    │ • Text → Audio blob          │
│   is_voice_message,         │    │                              │
│   transcription,            │    │ GET /health                  │
│   voice_url,                │    │                              │
│   history                   │    │ POST /auth/verify            │
│ }                           │    │ POST /chat/* (chat endpoint) │
│                             │    │                              │
│ bot_uttered EVENT:          │    │ All protected with token     │
│ {                           │    │                              │
│   text,                     │    │                              │
│   metadata: {               │    │                              │
│     language,               │    │                              │
│     voice_response_url,     │    │                              │
│     citations               │    │                              │
│   }                         │    │                              │
│ }                           │    │                              │
└─────────────────────────────┘    └──────────────────────────────┘
                    │                             │
                    └──────────────┬──────────────┘
                                   │
┌──────────────────────────────────┼──────────────────────────────────────────┐
│                                  ▼                                           │
│                      BACKEND (Python/Flask)                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ api_server.py (REST Endpoints)                                        │  │
│  ├────────────────────────────────────────────────────────────────────────┤  │
│  │ • /chat/transcribe (POST)                                            │  │
│  │   └─ Saves audio file → Calls VoiceProcessor                         │  │
│  │                                                                        │  │
│  │ • /chat/tts (POST)                                                   │  │
│  │   └─ Text → Calls VoiceProcessor → Returns audio file               │  │
│  │                                                                        │  │
│  │ • /auth/*, /profile/*, /projects/* (existing endpoints)             │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                  │                                            │
│                                  ▼                                            │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ assistant.py (Socket.io Handler)                                      │  │
│  ├────────────────────────────────────────────────────────────────────────┤  │
│  │ • user_uttered event handler                                          │  │
│  │   ├─ Receives user message + voice metadata                           │  │
│  │   ├─ Calls GPT/Rasa for response                                      │  │
│  │   ├─ If TTS enabled:                                                  │  │
│  │   │   └─ Calls VoiceProcessor.text_to_speech()                        │  │
│  │   ├─ Emits bot_uttered with voice_response_url                        │  │
│  │   └─ Calls store_conversation() with voice fields                     │  │
│  │                                                                        │  │
│  │ • send_message route (REST endpoint)                                  │  │
│  │   └─ Same flow but for HTTP POST                                      │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                  │                                            │
│                                  ▼                                            │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ voice_processor.py (Voice Processing Service)                         │  │
│  ├────────────────────────────────────────────────────────────────────────┤  │
│  │ • transcribe_audio(path, language)                                    │  │
│  │   └─ Uses SpeechRecognition (Google Speech API)                       │  │
│  │                                                                        │  │
│  │ • text_to_speech(text, language)                                      │  │
│  │   └─ Uses pyttsx3 (offline TTS engine)                                │  │
│  │                                                                        │  │
│  │ • detect_language_from_text(text)                                     │  │
│  │   └─ Simple keyword/pattern matching (en/ro)                          │  │
│  │                                                                        │  │
│  │ • get_tts_engine()                                                    │  │
│  │   └─ Initialize and configure pyttsx3                                 │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                  │                                            │
│                   ┌──────────────┴──────────────┐                            │
│                   │                             │                            │
│                   ▼                             ▼                            │
│  ┌────────────────────────────┐  ┌──────────────────────────┐                │
│  │ utils.py                   │  │ auth.py (existing)       │                │
│  ├────────────────────────────┤  ├──────────────────────────┤                │
│  │ • store_conversation()     │  │ • Authentication         │                │
│  │   ├─ Extended with voice   │  │ • JWT token validation   │                │
│  │   │ fields:                │  │ • User verification      │                │
│  │   ├─ transcription         │  │                          │                │
│  │   ├─ voice_url             │  │                          │                │
│  │   ├─ voice_response_url    │  │                          │                │
│  │   ├─ language              │  │                          │                │
│  │   ├─ is_voice_message      │  │                          │                │
│  │   └─ tts_enabled           │  │                          │                │
│  │                            │  │                          │                │
│  │ • Ensures DB schema (new)  │  │                          │                │
│  └────────────────────────────┘  └──────────────────────────┘                │
│                   │                                                           │
│                   ▼                                                           │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ db.py (Database Connection)                                           │  │
│  ├────────────────────────────────────────────────────────────────────────┤  │
│  │ • PostgreSQL connection pooling                                       │  │
│  │ • Schema initialization                                              │  │
│  │ • Migration support                                                  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                  │                                            │
│                                  ▼                                            │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ migrate_voice_fields.py (Database Migration Script)                   │  │
│  ├────────────────────────────────────────────────────────────────────────┤  │
│  │ • Adds voice columns to conversations table                           │  │
│  │ • Safe: Uses "IF NOT EXISTS" checks                                   │  │
│  │ • Backwards compatible                                                │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         DATABASE (PostgreSQL)                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  conversations TABLE:                                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ id (BIGSERIAL) - PRIMARY KEY                                         │   │
│  │ user_id (TEXT)                                                       │   │
│  │ session_id (TEXT)                                                    │   │
│  │ user_message (TEXT) ✓ Existing                                       │   │
│  │ bot_response (TEXT) ✓ Existing                                       │   │
│  │ created_at (TIMESTAMPTZ) ✓ Existing                                  │   │
│  │                                                                      │   │
│  │ ╔════════════════════════════════════════════════════════════════╗   │   │
│  │ ║          VOICE FIELDS (NEW)                                  ║   │   │
│  │ ║════════════════════════════════════════════════════════════════║   │   │
│  │ ║ transcription (TEXT)                - Transcribed text        ║   │   │
│  │ ║ voice_url (VARCHAR 500)             - User's audio file URL  ║   │   │
│  │ ║ voice_response_url (VARCHAR 500)    - Bot's audio file URL   ║   │   │
│  │ ║ language (VARCHAR 10)               - Detected language (en) ║   │   │
│  │ ║ is_voice_message (BOOLEAN)          - Voice-initiated flag   ║   │   │
│  │ ║ tts_enabled (BOOLEAN)               - TTS was used flag      ║   │   │
│  │ ╚════════════════════════════════════════════════════════════════╝   │   │
│  │                                                                      │   │
│  │ Other tables (existing):                                             │   │
│  │ ├─ users                                                              │   │
│  │ ├─ student_profiles                                                  │   │
│  │ ├─ quest_relocation_profiles                                         │   │
│  │ ├─ quest_tokens                                                      │   │
│  │ ├─ quest_progress                                                    │   │
│  │ ├─ projects                                                          │   │
│  │ └─ verified_links                                                    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌────────────────────────────┐  ┌──────────────────────────────┐            │
│  │ Google Speech Recognition  │  │ pyttsx3 (Offline TTS)        │            │
│  ├────────────────────────────┤  ├──────────────────────────────┤            │
│  │ • SpeechRecognition lib    │  │ • Local engine               │            │
│  │ • Converts audio → text    │  │ • No API costs               │            │
│  │ • Supports multiple langs  │  │ • OS-dependent voices        │            │
│  │ • Free tier (rate limited) │  │ • Offline capable            │            │
│  │ • API key optional         │  │ • Configurable rate/volume   │            │
│  └────────────────────────────┘  └──────────────────────────────┘            │
│                                                                               │
│  Optional: Google Cloud Storage (for audio archiving)                        │
│  Optional: Azure Speech Services (for better STT/TTS)                        │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### 1. Voice Message Flow (STT)

```
User speaks to microphone
        ↓
   [Browser]
        ↓
Web Audio API captures sound
        ↓
MediaRecorder creates Blob
        ↓
Waveform visualization updates (real-time)
        ↓
User clicks "Stop" or timeout
        ↓
Audio Blob sent to server
        ↓
   [Flask API]
        ↓
POST /chat/transcribe
        ↓
Save to temporary file
        ↓
VoiceProcessor.transcribe_audio()
        ↓
Google Speech Recognition API
        ↓
Transcript returned
        ↓
Display on frontend
        ↓
User sees transcribed text in VoiceInput component
        ↓
User clicks "Send"
        ↓
Message sent with metadata:
{
  message: "Tell me about housing",
  transcription: "Tell me about housing",
  is_voice_message: true,
  language: "en-US",
  voice_url: "..."
}
        ↓
Backend stores in conversations table with all voice fields
```

### 2. Bot Response with TTS Flow

```
Bot receives user message
        ↓
   [Backend]
        ↓
GPT/Rasa generates response
        ↓
Response text ready
        ↓
Check if TTS enabled (from socket event)
        ↓
  [YES] → VoiceProcessor.text_to_speech()
        ↓
pyttsx3 generates audio file (.mp3)
        ↓
Store file path / URL
        ↓
Socket emit bot_uttered with:
{
  text: "Housing in Iași...",
  metadata: {
    voice_response_url: "/audio/response_123.mp3",
    language: "en-US"
  }
}
        ↓
   [Frontend]
        ↓
Receive bot_uttered event
        ↓
Display text in chat
        ↓
Auto-play audio file OR show play button
        ↓
User hears bot response in voice
        ↓
Store conversation with all voice metadata
```

### 3. Language Detection Flow

```
User records audio message
        ↓
Transcribed to text
        ↓
VoiceProcessor.detect_language_from_text()
        ↓
Analyze text for Romanian patterns:
- Diacritics: ă, î, ș, ț
- Common words: care, pentru, cum, un, pe...
        ↓
If > 10% Romanian patterns
  → language = "ro-RO"
ELSE
  → language = "en-US"
        ↓
Store detected language in database
        ↓
Use same language for TTS response
```

## Component Interaction Map

```
┌─────────────────────────────────────────────────────────────┐
│                  ChatApp.jsx                                │
│  (Main chat container, state management)                    │
│  ├─ voiceEnabled state                                      │
│  ├─ enableTTS state                                         │
│  ├─ currentLanguage state                                   │
│  └─ messages state (from useChat hook)                      │
└──────────────────────────┬──────────────────────────────────┘
              │                        │
              │                        │
              ▼                        ▼
    ┌──────────────────┐    ┌──────────────────┐
    │  VoiceInput.jsx  │    │   useVoice Hook  │
    │                  │    │                  │
    │ • UI rendering   │◄──►│ • Recording      │
    │ • User interaction   │ • Transcription  │
    │ • Display waveform   │ • TTS playback   │
    │ • Show transcript    │ • Error handling │
    └──────────────────┘    └──────────────────┘
              │
              │ (onSend, onTranscript)
              │
              ▼
    ┌──────────────────────┐
    │ sendMessage()        │
    │                      │
    │ Emit user_uttered    │
    │ with voice metadata  │
    └──────────────────────┘
              │
              │ Socket.io
              │
    ┌─────────┴──────────────────────────┐
    │                                     │
    ▼                                     ▼
[Backend Socket Handler]        [Frontend Socket Listener]
    │                                     │
    ├─ Process message                   ├─ Receive bot_uttered
    ├─ Generate response                 ├─ Parse metadata
    ├─ Generate TTS                      ├─ Display text
    ├─ Store in DB                       └─ Play audio (optional)
    └─ Emit bot_uttered
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PRODUCTION ENVIRONMENT                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐        ┌──────────────┐                  │
│  │  Browser     │        │  Static CDN  │                  │
│  │  (Frontend)  │◄──────►│  (React App) │                  │
│  └──────┬───────┘        └──────────────┘                  │
│         │                                                   │
│         │ HTTPS                                             │
│         │ Socket.io / REST                                  │
│         │                                                   │
│  ┌──────▼──────────────────────────────────────────┐       │
│  │  Load Balancer / Reverse Proxy (Nginx)          │       │
│  │  ├─ SSL/TLS termination                         │       │
│  │  ├─ Socket.io routing                           │       │
│  │  └─ Request routing                             │       │
│  └──────┬──────────────────────────────────────────┘       │
│         │                                                   │
│  ┌──────┴──────────────────────────────────────────┐       │
│  │  Backend Services (Kubernetes pods)             │       │
│  │  ┌─────────────────────────────────────────┐   │       │
│  │  │  Flask/SocketIO Application             │   │       │
│  │  │  ├─ api_server.py (REST endpoints)     │   │       │
│  │  │  ├─ assistant.py (Socket handlers)     │   │       │
│  │  │  ├─ voice_processor.py (STT/TTS)      │   │       │
│  │  │  └─ utils.py (DB helpers)              │   │       │
│  │  │                                         │   │       │
│  │  │  Dependencies:                          │   │       │
│  │  │  ├─ pyttsx3 (TTS)                      │   │       │
│  │  │  ├─ SpeechRecognition (STT)            │   │       │
│  │  │  ├─ psycopg2 (PostgreSQL)              │   │       │
│  │  │  └─ Flask/SocketIO                     │   │       │
│  │  └─────────────────────────────────────────┘   │       │
│  │                                                  │       │
│  │  Horizontal scaling: Run multiple pod replicas  │       │
│  └──────┬──────────────────────────────────────────┘       │
│         │                                                   │
│  ┌──────▼──────────────────────────────────────────┐       │
│  │  PostgreSQL Database (Managed Service)          │       │
│  │  ├─ conversations table (with voice fields)     │       │
│  │  ├─ users, profiles, projects tables            │       │
│  │  └─ Backups & replication enabled               │       │
│  └──────┬──────────────────────────────────────────┘       │
│         │                                                   │
│  ┌──────▼──────────────────────────────────────────┐       │
│  │  File Storage (Cloud Storage)                   │       │
│  │  ├─ Temporary audio files (TTL: 24h)           │       │
│  │  ├─ Generated TTS responses                     │       │
│  │  └─ User voice recordings (archived)            │       │
│  └──────────────────────────────────────────────────┘       │
│                                                              │
│  External Services:                                         │
│  ├─ Google Speech Recognition API (free tier)              │
│  ├─ Optional: Azure Speech Services                        │
│  └─ Optional: Google Cloud Storage                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Data Structures

### Voice Message Object (Frontend to Backend)

```json
{
  "message": "Tell me about housing",
  "sender": "user_123",
  "session_id": "chat-1234567890",
  "language": "en-US",
  "enable_tts": true,
  "is_voice_message": true,
  "transcription": "Tell me about housing",
  "voice_url": "blob:http://localhost:5173/abc123...",
  "history": [
    {
      "role": "user",
      "content": "What about visa?"
    },
    {
      "role": "assistant",
      "content": "For visa you need..."
    }
  ]
}
```

### Voice Conversation Record (Database)

```sql
INSERT INTO conversations (
  user_id,
  session_id,
  user_message,
  bot_response,
  transcription,
  voice_url,
  voice_response_url,
  language,
  is_voice_message,
  tts_enabled,
  created_at
) VALUES (
  'user_123',
  'chat-1234567890',
  'Tell me about housing',
  'Student housing in Iași is...',
  'Tell me about housing',  -- transcription (same as user_message for voice)
  'https://storage.example.com/user_audio/msg_123.webm',
  'https://storage.example.com/bot_audio/response_456.mp3',
  'en-US',
  true,
  true,
  NOW()
);
```

## Performance Metrics

```
┌────────────────────────────────────────────────┐
│  Component              │  Target Time           │
├────────────────────────────────────────────────┤
│ Recording start        │  < 200ms               │
│ Waveform animation     │  60 FPS (16.7ms/frame) │
│ Recording stop         │  < 100ms               │
│ Audio upload           │  Depends on file size  │
│ Transcription API call │  < 5 seconds           │
│ TTS generation         │  < 2 seconds           │
│ Socket emit latency    │  < 100ms               │
│ Database insert        │  < 50ms                │
│ Audio playback start   │  < 500ms               │
└────────────────────────────────────────────────┘
```

## Error Handling Flow

```
Error occurs
        ↓
┌─────────────────────────────────┐
│ Error Type Detection            │
├─────────────────────────────────┤
│ ├─ Microphone denied            │
│ ├─ Audio capture failed         │
│ ├─ Network error                │
│ ├─ Transcription failed         │
│ ├─ TTS generation failed        │
│ ├─ Database error               │
│ └─ Socket connection lost       │
└────────────┬────────────────────┘
             │
        ┌────▼────┐
        │ Log     │
        │ Error   │
        └────┬────┘
             │
        ┌────▼────────────────────────┐
        │ User Notification           │
        ├────────────────────────────┤
        │ VoiceInput component shows  │
        │ error message in badge      │
        │ Error stays visible 5 sec   │
        │ Auto-dismiss or dismiss btn │
        └────────────────────────────┘
             │
        ┌────▼──────────────┐
        │ Recovery Action   │
        ├───────────────────┤
        │ • Clear error     │
        │ • Reset controls  │
        │ • Enable retry    │
        │ • Maintain state  │
        └───────────────────┘
```

---

This architecture ensures:

- ✅ Scalability (horizontal pod scaling)
- ✅ Reliability (error handling, retries)
- ✅ Performance (optimized for < 5s transcription)
- ✅ Security (token-protected endpoints)
- ✅ Maintainability (modular components)
- ✅ Extensibility (pluggable STT/TTS services)
