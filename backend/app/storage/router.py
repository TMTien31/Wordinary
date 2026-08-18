from __future__ import annotations

import secrets

from fastapi import APIRouter
from fastapi import HTTPException
from starlette import status

from app.api.dependencies import CurrentUser
from app.core.config import settings
from app.storage.schemas import StorageHealthResponse
from app.storage.schemas import StorageSmokeResponse
from app.storage.service import get_file_storage

router = APIRouter()


@router.get("/health", response_model=StorageHealthResponse)
async def storage_health() -> StorageHealthResponse:
    result = await get_file_storage().healthcheck()
    return StorageHealthResponse.model_validate(result)


@router.post("/smoke-test", response_model=StorageSmokeResponse)
async def storage_smoke_test(current_user: CurrentUser) -> StorageSmokeResponse:
    if settings.environment != "development":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    storage = get_file_storage()
    key = f"smoke/{current_user.id}/{secrets.token_hex(12)}.txt"
    content = b"wordinary storage smoke"
    await storage.save(key=key, content=content, content_type="text/plain")
    read_back = await storage.read(key)
    if read_back != content:
        raise RuntimeError("Storage smoke read-back mismatch")
    download_url = await storage.create_download_url(
        key=key,
        expires_in=settings.storage_presigned_expires_seconds,
    )
    await storage.delete(key)
    deleted = not await storage.exists(key)
    return StorageSmokeResponse(
        ok=deleted,
        key=key,
        size_bytes=len(read_back),
        download_url=download_url,
        deleted=deleted,
    )


__all__ = ["router"]
