# Wordinary Backend

FastAPI backend for Wordinary.

Schema notes live in `SCHEMAS.md`.

## Architecture

- Modular monolith.
- Feature-first modules under `app/modules`.
- FastAPI + SQLAlchemy 2 + PostgreSQL.
- Router -> service -> repository/selector -> database or integration.
- File bytes live behind storage adapters, not directly in PostgreSQL.
- `/health` lives outside `/api/v1`; business endpoints live under `/api/v1`.
- YouTube fetching belongs in `app/integrations/youtube`; caption workflows belong in `app/modules/captions`.

## Implemented Areas

- Auth and user profile endpoints.
- Library CRUD for articles, PDFs, and videos.
- PDF upload/download through MinIO/S3-backed storage.
- Vocabulary cards, review sessions, and progress tracking.
- YouTube metadata/caption fetching through yt-dlp.
- Word analysis fallback services used by the frontend.

## Local Commands

From the repository root:

```bash
python -m pip install ./backend
python -m pytest backend/tests
```

From `backend/`:

```bash
alembic upgrade head
uvicorn app.main:app --reload
```

The Docker Compose development stack runs these pieces together:

```bash
docker compose up --build
```

## Production Config Guard

`app/core/config.py` validates production settings during startup. When `ENVIRONMENT=production`, the backend rejects:

- placeholder or default auth/storage secrets;
- local development database credentials;
- the development MinIO bucket;
- localhost or wildcard CORS origins.

Keep `env.prod.example` as a template only. Production servers must provide real values in `.env`.

## YouTube Runtime

The backend image installs yt-dlp and Deno. Deno is required by modern yt-dlp YouTube extraction when JavaScript challenges appear.

Cookie-based access is configured with:

```text
WORDINARY_COOKIES_FILE=/run/wordinary/youtube-cookies/cookies.txt
```

Use `/api/v1/captions/health` to inspect yt-dlp and cookie file visibility from inside the API container.
