from __future__ import annotations

import pytest

from app.core.config import Settings


def production_settings(**overrides: object) -> Settings:
    values = {
        "environment": "production",
        "auth_secret_key": "prod-auth-secret-that-is-long-enough-123",
        "database_url": "postgresql+asyncpg://wordinary:strong-db-pass@db:5432/wordinary",
        "storage_access_key": "prod-minio-user",
        "storage_secret_key": "prod-minio-secret-that-is-long-enough",
        "storage_bucket": "wordinary-prod",
        "backend_cors_origins": ["https://wordinary.example.com"],
    }
    values.update(overrides)
    return Settings(**values)


def test_production_settings_accept_real_secrets() -> None:
    settings = production_settings()

    assert settings.environment == "production"


def test_production_settings_reject_placeholder_secrets() -> None:
    with pytest.raises(ValueError, match="AUTH_SECRET_KEY"):
        production_settings(auth_secret_key="replace-with-a-long-random-secret")


def test_production_settings_reject_local_cors_origins() -> None:
    with pytest.raises(ValueError, match="BACKEND_CORS_ORIGINS"):
        production_settings(backend_cors_origins=["https://wordinary.example.com", "http://localhost:5500"])
