# Wordinary v7 Refactored

This package separates the current browser app from the planned FastAPI backend.

- `frontend/`: compatibility-first Vanilla JS frontend extracted from Wordinary v7.
- `backend/`: FastAPI modular-monolith skeleton for API and database work.
- `tools/reference_server/`: temporary local server and YouTube caption bridge.
- `scripts/`: repo-level smoke/maintenance scripts.

Backend schema source of truth: `backend/SCHEMAS.md`.

## Run The Current Frontend

```bash
uv pip install -r tools/reference_server/requirements.txt
python tools/reference_server/server.py
```

Open `http://127.0.0.1:8787/` if the browser does not open automatically.
Do not open `frontend/index.html` through `file://`; YouTube embeds need a normal HTTP origin/referrer.

## Run With Docker Compose

Optional: create `.env` from `.env.example` if you want to override defaults.
Then run:

```bash
docker compose up --build
```

Default development ports:

- Frontend: `http://localhost:5500`
- FastAPI: `http://localhost:8000`
- Postgres: `db:5432` inside Docker, `localhost:5432` from the host

## Verify

```bash
python scripts/verify_structure.py
```

The smoke script checks frontend asset references, JavaScript syntax, CSS imports,
and the reference server syntax.

## Notes

The frontend still uses ordered `defer` scripts to preserve the original shared
scope and localStorage compatibility. The next safe migration is to introduce
explicit ES modules feature by feature, beginning with pure utilities, storage
adapters, and repositories.

The embedded Base64 MP4 and PDF were extracted to real files under
`frontend/public/demo`.
