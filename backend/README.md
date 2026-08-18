# Wordinary Backend

FastAPI backend skeleton for Wordinary.

Schema source of truth: `SCHEMAS.md`.

Architecture direction:

- Modular monolith.
- Feature-first modules under `app/modules`.
- FastAPI + SQLAlchemy 2 + PostgreSQL.
- Router -> service -> repository/selector -> database or integration.
- File bytes live behind storage adapters, not directly in PostgreSQL.
- `/health` lives outside `/api/v1`; business endpoints live under `/api/v1`.
- YouTube fetching belongs in `app/integrations/youtube`; caption workflows belong in `app/modules/captions`.

Current implementation status:

- Schema contracts exist for shared, users, auth, library, progress, vocabulary, review, captions, word analysis, migration, and dashboard.
- Endpoint/service/repository/model implementations are intentionally not added yet.
- Canonical API contracts use UUIDs, ISO datetimes, progress percent `0..100`, and review results `good/again`.
- Migration contracts accept legacy localStorage shapes such as prefixed string ids, epoch milliseconds, cached captions, and data URL icons.

Add concrete models, repositories, selectors, and services only when a feature is implemented.
