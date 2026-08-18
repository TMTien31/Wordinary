from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from pydantic import Field

from app.modules.migration.enums import ImportEntityType
from app.shared.schemas import APIModel
from app.shared.types import LegacyEpochMilliseconds


class LegacyTimestampFields(APIModel):
    created_at_ms: LegacyEpochMilliseconds | None = None
    updated_at_ms: LegacyEpochMilliseconds | None = None
    last_opened_at_ms: LegacyEpochMilliseconds | None = None
    next_review_ms: LegacyEpochMilliseconds | None = None
    last_reviewed_at_ms: LegacyEpochMilliseconds | None = None


class LocalDataImportRequest(APIModel):
    import_id: UUID
    dry_run: bool = False
    data_version: int | None = Field(default=None, ge=0)
    local_storage: dict[str, Any] = Field(default_factory=dict)


class LocalDataImportItemResult(APIModel):
    local_id: str | None = None
    server_id: UUID | None = None
    entity_type: ImportEntityType
    status: Literal["imported", "skipped", "failed"]
    warning: str | None = None
    error: str | None = None


class LocalDataImportResponse(APIModel):
    import_id: UUID
    dry_run: bool
    imported_count: int = Field(ge=0)
    skipped_count: int = Field(ge=0)
    failed_count: int = Field(ge=0)
    id_map: dict[str, UUID] = Field(default_factory=dict)
    results: list[LocalDataImportItemResult] = Field(default_factory=list)
