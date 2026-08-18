# Wordinary Backend Schema Contracts

This file is the source of truth for the current Pydantic schema layer.
It describes API contracts only. Database models do not need to mirror these
fields one-to-one.

## Contract Decisions

- Canonical API ids use `UUID`.
- Canonical API datetimes use timezone-aware ISO 8601 values.
- Legacy localStorage migration accepts prefixed string ids through `local_id`.
- Legacy localStorage migration accepts epoch milliseconds from `Date.now()`.
- Learning progress uses percent `0..100`, matching the current frontend.
- Review answers use `good/again`, matching the current practice UI.
- Article file import method is `file`; file extension and MIME type belong in metadata.
- Caption cues are canonicalized through the captions module, not embedded in `VideoMetadata`.
- Legacy video caption caches are migration-only input.
- Custom vocabulary images may arrive as data URLs during migration, but canonical storage should return URLs.
- Public API responses do not expose internal `storage_key` values.
- `availableInSession` is frontend session state only and is not canonical backend metadata.

## Shared

### `app/shared/schemas.py`

- `APIModel`: common Pydantic base with camelCase aliases, ORM serialization, stripped strings, and forbidden extra fields.
- `Page[T]`: paginated response wrapper.
- `MessageResponse`: simple message response.
- `ProblemDetail`: structured API error response.

### `app/shared/types.py`

- `ProgressPercent`: float, `0..100`.
- `NonNegativeSeconds`: float, `>= 0`.
- `LanguageCode`: BCP-47-like language code.
- `UtcDateTime`: timezone-aware datetime.
- `LegacyEpochMilliseconds`: int, `>= 0`.

### `app/shared/enums.py`

- `LibraryItemType`: `article`, `pdf`, `video`.
- `ReviewResult`: `good`, `again`.
- `CaptionSource`: `manual`, `automatic`, `upload`, `pasted`.
- `ProcessingStatus`: `pending`, `processing`, `ready`, `failed`.

## Auth

### `app/modules/auth/schemas.py`

- `UserRegister`
- `UserLogin`
- `TokenResponse`
- `PasswordChangeRequest`

Auth imports `UserResponse` from the users module. User response contracts
belong to users, not auth.

## Users

### `app/modules/users/enums.py`

- `UserStatus`: `active`, `pending`, `disabled`.
- `Theme`: `light`, `dark`, `system`.

### `app/modules/users/schemas.py`

- `UserResponse`
- `UserUpdate`
- `UserSettingsUpdate`
- `UserSettingsResponse`
- `LearningProfileUpdate`
- `LearningProfileResponse`

XP, streak, and daily activity are response-owned values. The frontend should
not directly write them through settings/profile update schemas.

## Library

### `app/modules/library/enums.py`

- `ImportMethod`: `paste`, `url`, `file`, `pdf_upload`, `youtube`.

### `app/modules/library/schemas.py`

Position value objects:

- `ArticlePosition`
- `PDFPosition`
- `VideoPosition`

Create/update requests:

- `ArticleCreate`
- `VideoCreate`
- `PDFCreateMetadata`
- `LibraryItemUpdate`
- `ArticleContentUpdate`

Metadata responses:

- `ArticleMetadata`
- `PDFMetadata`
- `VideoMetadata`

List/detail responses:

- `LibraryItemSummary`
- `LibraryItemBaseResponse`
- `ArticleDetailResponse`
- `PDFDetailResponse`
- `VideoDetailResponse`
- `LibraryItemDetailResponse`
- `LibraryListQuery`

`LibraryItemDetailResponse` is a discriminated union by `type`.

`VideoMetadata` contains caption summary fields only: count, language, source,
and processing state. Full cues belong to captions.

`PDFMetadata` exposes user-facing file metadata and runtime download data only:
file name, page count, file size, checksum, availability, processing status, and
an optional download URL with expiry. Internal storage keys stay in the storage
model/service layer.

## Progress

### `app/modules/progress/schemas.py`

- `ArticleProgressUpdate`
- `PDFProgressUpdate`
- `VideoProgressUpdate`
- `LearningProgressUpdate`
- `LearningProgressResponse`

Progress update schemas use a discriminated union by `type` and reuse position
objects from library.

## Vocabulary

### `app/modules/vocabulary/schemas.py`

Source locators:

- `ArticleSourceLocator`
- `PDFSourceLocator`
- `VideoSourceLocator`
- `ManualSourceLocator`
- `SourceLocator`

Vocabulary contracts:

- `VocabularyCreate`
- `VocabularyUpdate`
- `VocabularyResponse`
- `VocabularyListQuery`

The `source` field is a discriminated union. It is intentionally not the same as
`LibraryItemType` because vocabulary may also be manual.

The `icon` field is permissive at the schema layer to support current frontend
values. Service/storage code should later normalize data URLs into stored files.

## Review

### `app/modules/review/enums.py`

- `ReviewMode`: `all`, `due`, `retry`, `custom`.

### `app/modules/review/schemas.py`

- `ReviewSessionCreate`
- `ReviewCardResponse`
- `ReviewSessionResponse`
- `ReviewAnswerCreate`
- `ReviewAnswerResponse`
- `ReviewSessionSummary`

`ReviewAnswerCreate` includes `client_answer_id` for idempotency. The backend
owns round calculation; clients do not need to send `round_number`.

## Captions

### `app/modules/captions/schemas.py`

- `CaptionCue`
- `CaptionFetchRequest`
- `CaptionTrackResponse`
- `VideoInfoResponse`

`CaptionCue` validates that `end > start`. Caption timing uses seconds, not
milliseconds.

Provider-specific yt-dlp data belongs under `app/integrations/youtube`, not in
caption API schemas.

## Word Analysis

### `app/modules/word_analysis/schemas.py`

- `WordAnalyzeRequest`
- `AlternativeWordSense`
- `WordAnalysisResponse`

This contract covers translation, sentence translation, lemma, phonetic, part
of speech, definition, icon candidates, and alternative senses.

## Migration

### `app/modules/migration/enums.py`

- `ImportEntityType`: `library_item`, `vocabulary_item`, `caption_track`, `user_settings`, `learning_profile`.

### `app/modules/migration/schemas.py`

- `LegacyTimestampFields`
- `LocalDataImportRequest`
- `LocalDataImportItemResult`
- `LocalDataImportResponse`

Migration may accept flexible `dict[str, Any]` localStorage payloads because the
legacy frontend data is not fully normalized.

Migration must preserve enough mapping data to safely retry imports:

- `import_id`
- `local_id`
- `id_map`
- `dry_run`
- legacy epoch millisecond timestamps
- explicit `ImportEntityType` values instead of broad module names

## Dashboard

### `app/modules/dashboard/schemas.py`

- `DashboardResponse`

Dashboard is an aggregate response. It should not have its own database model
unless a future reporting/cache use case requires one.

## Notes For Database Design

Schemas are not database tables.

Examples:

- `saved_word_count` can be computed from vocabulary rows.
- `caption_count` can be computed from caption cues or cached on a track/item.
- `source` in vocabulary can become several queryable columns in the database.
- `metadata` and `position` may be partly normalized into columns and partly
  stored as JSON, depending on query needs.
- Migration-only fields such as `local_id`, cached captions, data URL icons, and
  epoch milliseconds do not need to appear in every canonical response.
- Internal storage values such as `storage_key` do not belong in public schemas.
