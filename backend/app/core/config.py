from __future__ import annotations

from typing import Annotated

from pydantic import field_validator
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic_settings import NoDecode

DEFAULT_AUTH_SECRET_KEY = "RX4OgfZ-dGuYyx3JkJx55N43sC6dL9OwbTJHZ9dkZqL0bpTlU0SLsN2A1K44Q-M6"
DEFAULT_STORAGE_SECRET_KEY = "wordinary-local-minio-secret"


def _is_placeholder(value: str | None) -> bool:
    if not value:
        return True
    normalized = value.strip().lower()
    return normalized.startswith(("replace-with", "change-me")) or "replace-with" in normalized


def _is_local_origin(origin: str) -> bool:
    normalized = origin.strip().lower()
    return (
        "localhost" in normalized
        or "127.0.0.1" in normalized
        or normalized.startswith("http://0.0.0.0")
    )


class Settings(BaseSettings):
    app_name: str = "Wordinary API"
    api_v1_prefix: str = "/api/v1"
    backend_cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5500"]
    database_url: str = "postgresql+asyncpg://wordinary:wordinary@db:5432/wordinary"
    environment: str = "development"
    auth_secret_key: str = DEFAULT_AUTH_SECRET_KEY
    access_token_expires_seconds: int = 60 * 60 * 24 * 7
    storage_backend: str = "minio"
    storage_endpoint_url: str = "http://localhost:9000"
    storage_public_endpoint_url: str | None = "http://localhost:9000"
    storage_access_key: str = "wordinary"
    storage_secret_key: str = DEFAULT_STORAGE_SECRET_KEY
    storage_bucket: str = "wordinary-dev"
    storage_region: str = "us-east-1"
    storage_presigned_expires_seconds: int = 900
    openai_base_url: str | None = None
    wody_model: str = "gpt-5-mini"
    wody_temperature: float = 0.5
    wody_timeout_seconds: int = 45
    jina_api_key: str | None = None
    jina_timeout_seconds: int = 25
    jina_max_tokens: int = 8000

    @field_validator("backend_cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("openai_base_url", "jina_api_key", mode="before")
    @classmethod
    def blank_strings_to_none(cls, value: str | None) -> str | None:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        self.environment = self.environment.strip().lower()
        if self.environment != "production":
            return self

        errors: list[str] = []
        if _is_placeholder(self.auth_secret_key) or self.auth_secret_key == DEFAULT_AUTH_SECRET_KEY:
            errors.append("AUTH_SECRET_KEY must be set to a unique production secret")
        if len(self.auth_secret_key) < 32:
            errors.append("AUTH_SECRET_KEY must be at least 32 characters in production")
        if _is_placeholder(self.storage_access_key) or self.storage_access_key == "wordinary":
            errors.append("STORAGE_ACCESS_KEY must be set to a production MinIO/S3 access key")
        if _is_placeholder(self.storage_secret_key) or self.storage_secret_key == DEFAULT_STORAGE_SECRET_KEY:
            errors.append("STORAGE_SECRET_KEY must be set to a production MinIO/S3 secret key")
        if len(self.storage_secret_key) < 16:
            errors.append("STORAGE_SECRET_KEY must be at least 16 characters in production")
        if _is_placeholder(self.database_url) or "wordinary:wordinary@" in self.database_url:
            errors.append("DATABASE_URL must not use default or placeholder credentials in production")
        if self.storage_bucket == "wordinary-dev":
            errors.append("STORAGE_BUCKET must not use the development bucket in production")
        if any(_is_local_origin(origin) or origin == "*" for origin in self.backend_cors_origins):
            errors.append("BACKEND_CORS_ORIGINS must not include localhost or '*' in production")
        if errors:
            raise ValueError("; ".join(errors))
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
