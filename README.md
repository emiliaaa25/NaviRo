# NaviRo

NaviRo is a Rasa-based chatbot project with a React frontend.

The stack is split into:

- `bot`: Rasa assistant, training data, and custom actions
- `frontend`: React + Vite UI
- `docker-compose.yml`: local backend stack (PostgreSQL, Rasa server, action server)

## Prerequisites

Install these tools before running the project:

- Docker Desktop (with Docker Compose)
- Node.js 18+ and npm

## Quick Start (Recommended)

### 1. Start backend services with Docker

From the repository root:

```bash
docker compose up --build
```

This starts:

- PostgreSQL on `localhost:5432`
- Rasa action server on `localhost:5055`
- Rasa server API + Socket.IO on `localhost:5005`

Keep this terminal running.

### 2. Start frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Vite will print the frontend URL (usually `http://localhost:5173`).

### 3. Use the app

Open the frontend URL in your browser and chat with the assistant.

## Verify Services

You can quickly check if Rasa is up:

```bash
curl http://localhost:5005/status
```

You should get a JSON response.

## Train a New Rasa Model (Optional)

If you change NLU/stories/domain data, train a new model:

```bash
docker compose run --rm rasa_server train
```

The generated model file is saved in `bot/models`.

## Stop the Project

From repository root:

```bash
docker compose down
```

To also remove volumes (including database data):

```bash
docker compose down -v
```

## Common Issues

1. Port already in use (`5005`, `5055`, `5432`, or `5173`)

- Stop the conflicting process or change ports.

2. Frontend connects but no bot response

- Confirm Docker services are running.
- Confirm Rasa socket endpoint is reachable on `http://localhost:5005`.

3. `npm install` fails

- Make sure Node.js is version 18 or newer.

## Project Structure

```text
NaviRo/
  bot/
    actions/
    data/
    models/
    config.yml
    credentials.yml
    domain.yml
    endpoints.yml
  frontend/
    src/
    package.json
  docker-compose.yml
```
