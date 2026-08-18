# Architecture Map

## Frontend (`frontend/`)

- `src/main.js`: final entry point.
- `src/app/bootstrap.js`: event wiring and application initialization.
- `src/app/state.js`: application, video, and persisted UI state.
- `src/core/storage.js`: safe browser storage adapters.
- `src/core/persistence.js`: persistence orchestration.
- `src/infrastructure/api/learning-services.js`: translation, dictionary, icon, and network services.
- `src/infrastructure/repositories/library-repository.js`: article/library normalization and persistence helpers.

Feature folders:

- `reader`: article rendering, selection, contextual lookup, and import.
- `library`: unified article/PDF/video library and article context view.
- `vocabulary`: saved cards and card editor.
- `practice`: review flow and grading.
- `video`: native/YouTube player, captions, bridge integration, and events.
- `pdf`: PDF.js rendering, text layer, search, selection, and OCR.
- `navigation` and `settings`: layout and controls styling.

Frontend dependency direction for future ES modules:

```text
main -> app -> features -> infrastructure -> core/shared
```

Feature code should not import another feature's internal files. Move reusable
UI/browser helpers to `shared`, persistence mechanics to `core`, and data access
behind `infrastructure/repositories`.

## Backend (`backend/`)

The backend follows a modular monolith with feature-first modules.

- `app/main.py`: small FastAPI app factory.
- `app/api/health.py`: root `/health` endpoint for deployment checks.
- `app/api/v1/router.py`: `/api/v1` business API router.
- `app/core`: settings and application-level error handling.
- `app/db`: SQLAlchemy base, session, naming convention, and model import hub.
- `app/modules`: feature-first domains such as users, library, vocabulary, review, captions, and word analysis.
- `app/integrations`: external providers such as YouTube, translation, dictionary, and icons.
- `app/storage`: file storage boundary.
- `app/workers`: future background task entry points.

Backend dependency direction:

```text
api/router -> module router -> service -> repository/selector -> db
                                 `-> integration/storage
```

Rules:

- Routers translate HTTP into application calls only.
- Services own business rules and transaction boundaries.
- Repositories/selectors own database access.
- Integrations own provider-specific details.
- `shared/` stays small and boring: schemas/base types only, no `utils.py` or `common.py` dumping ground.

Schema contract decisions:

- Canonical API ids are `UUID`.
- Legacy localStorage imports carry `local_id` string mappings.
- Canonical API datetimes are timezone-aware ISO 8601 values.
- Legacy migration accepts epoch milliseconds from `Date.now()`.
- Learning progress uses `0..100` percent to match the current frontend.
- Review answers use `good/again`, matching the current practice UI.
- Article file imports use `file`; deeper file type belongs in metadata.
- Canonical video metadata does not embed caption cues; caption caches are migration-only input.
- Custom vocabulary images may arrive as legacy data URLs, but canonical storage should return URLs.

## Captions Boundary

`app/modules/captions` owns Wordinary caption workflows: saved caption records,
normalization policy, request/response schemas, and business decisions.

`app/integrations/youtube` owns YouTube-specific mechanics: URL validation,
yt-dlp options, metadata fetching, subtitle track selection, and subtitle format
parsing.

The module may call the integration. The integration must not import module
models, routers, or services.
