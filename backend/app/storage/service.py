from __future__ import annotations

from functools import lru_cache

from app.core.config import settings
from app.storage.s3 import S3ObjectStorage
from app.storage.s3 import S3StorageConfig


@lru_cache(maxsize=1)
def get_file_storage() -> S3ObjectStorage:
    if settings.storage_backend not in {"minio", "s3", "r2"}:
        raise RuntimeError(f"Unsupported storage backend: {settings.storage_backend}")
    return S3ObjectStorage(
        S3StorageConfig(
            endpoint_url=settings.storage_endpoint_url,
            public_endpoint_url=settings.storage_public_endpoint_url,
            access_key=settings.storage_access_key,
            secret_key=settings.storage_secret_key,
            bucket=settings.storage_bucket,
            region=settings.storage_region,
            backend_name=settings.storage_backend,
        )
    )


__all__ = ["get_file_storage"]
