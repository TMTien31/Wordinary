from __future__ import annotations

from app.shared.schemas import APIModel


class StorageHealthResponse(APIModel):
    ok: bool
    backend: str
    bucket: str
    endpoint: str


class StorageSmokeResponse(APIModel):
    ok: bool
    key: str
    size_bytes: int
    download_url: str
    deleted: bool
