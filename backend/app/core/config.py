from __future__ import annotations

from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic_settings import NoDecode


class Settings(BaseSettings):
    app_name: str = "Wordinary API"
    api_v1_prefix: str = "/api/v1"
    backend_cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5500"]
    database_url: str = "postgresql+asyncpg://wordinary:wordinary@db:5432/wordinary"
    environment: str = "development"
    auth_secret_key: str = "RX4OgfZ-dGuYyx3JkJx55N43sC6dL9OwbTJHZ9dkZqL0bpTlU0SLsN2A1K44Q-M6"
    access_token_expires_seconds: int = 60 * 60 * 24 * 7
    storage_backend: str = "minio"
    storage_endpoint_url: str = "http://localhost:9000"
    storage_public_endpoint_url: str | None = "http://localhost:9000"
    storage_access_key: str = "wordinary"
    storage_secret_key: str = "wordinary-local-minio-secret"
    storage_bucket: str = "wordinary-dev"
    storage_region: str = "us-east-1"
    storage_presigned_expires_seconds: int = 900

    @field_validator("backend_cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
