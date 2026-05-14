# NaviRo

NaviRo uses an Azure-based assistant backend with a React frontend.

## Stack

- Frontend: React + Vite
- Auth/Profile API: Flask (`api_server`) on port `5056`
- Chat Assistant API: Flask-SocketIO (`assistant_server`) on port `5000`
- Database: PostgreSQL on port `5432`

## Quick Start

1. Create `.env` in repository root and set Azure keys:

```bash
AZURE_PROJECT_ENDPOINT=...
AZURE_AGENT_NAME=...
AZURE_AGENT_VERSION=...
AZURE_ASSISTANT_ID=...
AZURE_API_KEY=...
AZURE_API_VERSION=2025-11-15-preview
AZURE_DEPLOYMENT_NAME=gpt-4o
SYSTEM_PROMPT=
GOOGLE_CLIENT_ID=
```

2. Start backend services:

```bash
docker compose up -d --build
```

3. Start frontend:

```bash
cd frontend
npm install
npm run dev
```

## Health Checks

```bash
curl http://localhost:5056/health
curl http://localhost:5000/health
docker compose ps
```

## Notes

- Frontend proxies `/api` to `5056` and `/socket.io` to `5000`.
- Chat events use `user_uttered` and `bot_uttered`.
- Legacy chatbot runtime/config files were removed from active setup.
