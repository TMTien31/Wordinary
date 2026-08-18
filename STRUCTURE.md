# Wordinary Project Structure

```text
wordinary_refactored/
|-- frontend/                 # Current Wordinary browser app
|-- backend/                  # FastAPI backend skeleton
|-- tools/
|   `-- reference_server/     # Temporary v7 server + caption bridge
|-- scripts/
|   `-- verify_structure.py   # Repo-level smoke checks
|-- compose.yaml              # Local Docker composition
|-- .env.example              # Shared compose/backend env template
|-- README.md
|-- ARCHITECTURE.md
`-- REFACTOR_REPORT.md
```

## `frontend/`

```text
frontend/
|-- index.html
|-- public/
|   `-- demo/
|       |-- demo-video.mp4
|       `-- demo-document.pdf
`-- src/
    |-- main.js
    |-- app/                  # Startup, event wiring, browser state
    |-- core/                 # Storage and persistence adapters
    |-- features/             # UI features
    |-- infrastructure/       # API-like services and repositories
    |-- mock/                 # Sample local data
    |-- shared/               # DOM, i18n, shared UI helpers
    `-- styles/               # Global CSS imports and tokens
```

Important files:

- `frontend/index.html`: shell markup and script load order.
- `frontend/src/styles/main.css`: CSS import order.
- `frontend/src/app/bootstrap.js`: event wiring and initialization.
- `frontend/src/app/state.js`: current browser state.
- `frontend/src/main.js`: calls `init()`.

## `backend/`

```text
backend/
|-- pyproject.toml
|-- Dockerfile
|-- alembic.ini
|-- .env.example
|-- SCHEMAS.md
|-- alembic/
|   |-- env.py
|   `-- versions/
|-- app/
|   |-- main.py              # FastAPI app factory
|   |-- api/
|   |   |-- health.py        # Root /health endpoint
|   |   |-- dependencies.py
|   |   `-- v1/
|   |       `-- router.py    # /api/v1 business router
|   |-- core/                # Config and error handling
|   |-- db/                  # SQLAlchemy base/session/naming/models import hub
|   |-- integrations/        # External providers
|   |-- modules/             # Feature-first backend modules and schemas
|   |-- shared/              # Carefully controlled shared schemas/types/enums
|   |-- storage/             # File storage interface
|   `-- workers/             # Future background task entry points
`-- tests/
```

Current backend contract files:

```text
app/shared/
|-- schemas.py               # APIModel, Page, MessageResponse, ProblemDetail
|-- types.py                 # ProgressPercent, seconds, language, datetime types
`-- enums.py                 # Shared domain enums

app/modules/
|-- auth/schemas.py
|-- users/
|   |-- enums.py
|   `-- schemas.py
|-- library/
|   |-- enums.py
|   `-- schemas.py
|-- progress/schemas.py
|-- vocabulary/schemas.py
|-- review/
|   |-- enums.py
|   `-- schemas.py
|-- captions/schemas.py
|-- word_analysis/schemas.py
|-- migration/
|   |-- enums.py
|   `-- schemas.py
`-- dashboard/schemas.py
```

These files define API contracts only. Add `models.py`, `repository.py`,
`selectors.py`, or `service.py` only when a feature implementation needs them.

## `tools/reference_server/`

Temporary server kept outside both `frontend/` and `backend/`.

```text
tools/reference_server/
|-- server.py
`-- requirements.txt
```

It serves `frontend/index.html`, serves static frontend files, and keeps the
existing YouTube caption bridge behavior while the real backend is being built.

## `scripts/`

```text
scripts/
`-- verify_structure.py
```

Run:

```bash
python scripts/verify_structure.py
```
