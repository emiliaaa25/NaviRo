# NaviRo

NaviRo is a Rasa chatbot project with a React frontend.

The repository has 2 major parts:

- `bot/`: Rasa assistant, NLU/stories/domain files, and custom actions
- `frontend/`: React + Vite chat UI

Local backend services run with Docker Compose:

- PostgreSQL
- Rasa action server
- Rasa server (REST + Socket.IO)

## 1. Prerequisites

Install these before running the project:

- Docker Desktop (with `docker compose`)
- Node.js 18+ and npm
- Git

Optional but useful:

- `curl` for health checks

## 2. Clone And Enter Project

```bash
git clone <your-repo-url>
cd NaviRo
```

## 3. Environment Configuration (`.env`)

Copy the example file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Current example keys:

- `AZURE_SPEECH_KEY`
- `DEEPSEEK_API_KEY`
- `DB_PASSWORD`

Important:

- The current compose and Rasa config use hardcoded PostgreSQL values (`postgres`) in `docker-compose.yml` and `bot/endpoints.yml`.
- If you change `DB_PASSWORD` in `.env`, also update it in:
  - `docker-compose.yml` -> `services.db.environment.POSTGRES_PASSWORD`
  - `bot/endpoints.yml` -> `tracker_store.password`

Keep `.env` local and do not commit secrets.

## 4. Install Frontend Dependencies

From project root:

```bash
cd frontend
npm install
cd ..
```

## 5. Start Backend (Docker)

From project root:

```bash
docker compose up --build
```

This starts:

- Postgres on `localhost:5432`
- Action server on `localhost:5055`
- Rasa server on `localhost:5005`

Leave this terminal running.

### 2. Start frontend

Open a second terminal:

```bash
cd frontend
npm run dev
```

Open the URL shown by Vite (usually `http://localhost:5173`).

## 7. Verify Everything Is Up

Check Rasa status:

```bash
curl http://localhost:5005/status
```

Expected result: JSON response with server details.

You can also verify containers:

```bash
docker compose ps
```

## 8. Train A New Rasa Model

If you change files in `bot/domain.yml`, `bot/data/nlu.yml`, or `bot/data/stories.yml`:

```bash
docker compose run --rm rasa_server train
```

Generated models are saved under `bot/models`.

## 9. Stop Services

Stop and keep data:

```bash
docker compose down
```

Stop and remove volumes (including database data):

```bash
docker compose down -v
```

## 10. Common Operations

Rebuild only action server after action code changes:

```bash
docker compose up --build action_server
```

Restart backend stack:

```bash
docker compose restart
```

View backend logs:

```bash
docker compose logs -f rasa_server
docker compose logs -f action_server
```

## 11. Troubleshooting

1. Port already in use (`5005`, `5055`, `5432`, `5173`)

- Stop conflicting process/container, or change mapped ports.

2. Frontend connects but no bot response

- Check backend containers are healthy: `docker compose ps`.
- Confirm Rasa endpoint returns status on `http://localhost:5005/status`.
- Confirm Socket.IO events in `bot/credentials.yml` match frontend expectations.

3. Database connection errors

- Ensure password matches in all three places: `.env`, `docker-compose.yml`, `bot/endpoints.yml`.
- Recreate stack after changes: `docker compose down -v` then `docker compose up --build`.

4. Frontend dependency or build errors

- Check Node version (`node -v`) is 18+.
- Remove and reinstall dependencies in `frontend/`:

```bash
rm -rf node_modules package-lock.json
npm install
```

On Windows PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

## 12. Project Structure

```text
NaviRo/
  .env.example
  docker-compose.yml
  bot/
    config.yml
    credentials.yml
    domain.yml
    endpoints.yml
    actions/
      actions.py
      requirements.txt
    data/
      nlu.yml
      stories.yml
    models/
  frontend/
    package.json
    src/
```
