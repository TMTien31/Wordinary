# Wordinary

Wordinary is a language-learning app for reading articles, PDFs, and YouTube videos with saved vocabulary, review sessions, and progress tracking.

The app is currently a Docker Compose deployment with:

- `frontend/`: static Vanilla JS frontend served by nginx.
- `backend/`: FastAPI modular monolith with PostgreSQL, MinIO/S3 storage, and yt-dlp caption integration.
- `scripts/`: repository smoke checks and local E2E helpers.

Backend schema notes live in `backend/SCHEMAS.md`.

## Run Locally

Create a local environment file if needed:

```bash
cp .env.example .env
```

Start the full stack:

```bash
docker compose up --build
```

Default development ports:

- Frontend: `http://localhost:5500`
- FastAPI: `http://localhost:8000`
- API health: `http://localhost:8000/health`
- MinIO API: `http://localhost:9000`
- MinIO console: `http://localhost:9001`

Do not open `frontend/index.html` through `file://`; PDF.js, API calls, and YouTube embeds expect a normal HTTP origin.

## YouTube Captions

YouTube may ask the server to prove it is not a bot. For videos that require authentication, export YouTube cookies from a browser session that can play the video and place them at:

```text
youtube-cookies/cookies.txt
```

The path is ignored by Git. Docker Compose mounts it into the API container as:

```text
/run/wordinary/youtube-cookies/cookies.txt
```

The API image includes yt-dlp and Deno so yt-dlp can solve YouTube JavaScript challenges.

## Verify Locally

Install backend dependencies, then run:

```bash
python -m pip install ./backend
python -m pytest backend/tests
python scripts/verify_source_encoding.py
python scripts/verify_structure.py
python scripts/verify_frontend_contracts.py
python scripts/verify_i18n.py
```

The browser E2E flow is intentionally separate because it needs a running stack and Playwright browser dependencies:

```bash
python -m pip install -r scripts/requirements-e2e.txt
python scripts/e2e_main_flow.py
```

## Production

Production uses `compose.prod.yaml` and images published by `.github/workflows/deploy-production.yml`.

Before deploying a server, create `.env` from `env.prod.example` and replace every placeholder secret. The backend refuses to start with production defaults or placeholder values when `ENVIRONMENT=production`.

Minimum production checks:

- `.env` exists on the server and uses real database/storage/auth secrets.
- `youtube-cookies/cookies.txt` exists, is non-empty, and is readable by the API container.
- Postgres and MinIO volumes are backed up.
- CI passes the quality gate before image build and deployment.

More operational notes are in `docs/PRODUCTION_RUNBOOK.md`.
