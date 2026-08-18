from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlparse
from urllib.parse import urlunparse

import anyio
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError


@dataclass(frozen=True)
class S3StorageConfig:
    endpoint_url: str
    public_endpoint_url: str | None
    access_key: str
    secret_key: str
    bucket: str
    region: str = "us-east-1"
    backend_name: str = "minio"


class S3ObjectStorage:
    def __init__(self, config: S3StorageConfig) -> None:
        self.config = config
        self._client = _client(config, config.endpoint_url)
        self._public_client = _client(config, config.public_endpoint_url or config.endpoint_url)
        self._bucket_ready = False

    async def save(self, *, key: str, content: bytes, content_type: str) -> None:
        await self._ensure_bucket()

        def put_object() -> None:
            self._client.put_object(
                Bucket=self.config.bucket,
                Key=key,
                Body=content,
                ContentType=content_type,
            )

        await anyio.to_thread.run_sync(put_object)

    async def read(self, key: str) -> bytes:
        await self._ensure_bucket()

        def get_object() -> bytes:
            response = self._client.get_object(Bucket=self.config.bucket, Key=key)
            body = response["Body"]
            try:
                return body.read()
            finally:
                body.close()

        return await anyio.to_thread.run_sync(get_object)

    async def exists(self, key: str) -> bool:
        await self._ensure_bucket()

        def head_object() -> bool:
            try:
                self._client.head_object(Bucket=self.config.bucket, Key=key)
            except ClientError as exc:
                if _error_code(exc) in {"404", "NoSuchKey", "NotFound"}:
                    return False
                raise
            return True

        return await anyio.to_thread.run_sync(head_object)

    async def delete(self, key: str) -> None:
        await self._ensure_bucket()

        def delete_object() -> None:
            self._client.delete_object(Bucket=self.config.bucket, Key=key)

        await anyio.to_thread.run_sync(delete_object)

    async def create_download_url(self, *, key: str, expires_in: int) -> str:
        await self._ensure_bucket()

        def presign() -> str:
            url = self._public_client.generate_presigned_url(
                ClientMethod="get_object",
                Params={"Bucket": self.config.bucket, "Key": key},
                ExpiresIn=expires_in,
            )
            if self.config.public_endpoint_url:
                return _replace_url_origin(url, self.config.public_endpoint_url)
            return url

        return await anyio.to_thread.run_sync(presign)

    async def healthcheck(self) -> dict[str, str | bool]:
        await self._ensure_bucket()
        return {
            "ok": True,
            "backend": self.config.backend_name,
            "bucket": self.config.bucket,
            "endpoint": self.config.endpoint_url,
        }

    async def _ensure_bucket(self) -> None:
        if self._bucket_ready:
            return

        def ensure() -> None:
            try:
                self._client.head_bucket(Bucket=self.config.bucket)
            except ClientError as exc:
                if _error_code(exc) not in {"404", "NoSuchBucket", "NotFound"}:
                    raise
                create_kwargs = {"Bucket": self.config.bucket}
                if self.config.region != "us-east-1":
                    create_kwargs["CreateBucketConfiguration"] = {
                        "LocationConstraint": self.config.region,
                    }
                self._client.create_bucket(**create_kwargs)

        await anyio.to_thread.run_sync(ensure)
        self._bucket_ready = True


def _client(config: S3StorageConfig, endpoint_url: str):
    return boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=config.access_key,
        aws_secret_access_key=config.secret_key,
        region_name=config.region,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def _error_code(exc: ClientError) -> str:
    return str(exc.response.get("Error", {}).get("Code", ""))


def _replace_url_origin(url: str, origin: str) -> str:
    parsed = urlparse(url)
    origin_parsed = urlparse(origin)
    return urlunparse(
        parsed._replace(
            scheme=origin_parsed.scheme or parsed.scheme,
            netloc=origin_parsed.netloc or parsed.netloc,
        )
    )


__all__ = ["S3ObjectStorage", "S3StorageConfig"]
