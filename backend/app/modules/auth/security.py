from __future__ import annotations

from datetime import UTC
from datetime import datetime
from datetime import timedelta
from uuid import UUID

import jwt
from jwt import InvalidTokenError
from pwdlib import PasswordHash

from app.core.config import settings

TOKEN_ALGORITHM = "HS256"
_password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _password_hash.verify(password, password_hash)
    except (TypeError, ValueError):
        return False


def create_access_token(user_id: UUID) -> tuple[str, int]:
    now = datetime.now(UTC)
    expires_at = now + timedelta(seconds=settings.access_token_expires_seconds)
    payload = {"sub": str(user_id), "iat": now, "exp": expires_at}
    token = jwt.encode(payload, settings.auth_secret_key, algorithm=TOKEN_ALGORITHM)
    return token, settings.access_token_expires_seconds


def decode_access_token(token: str) -> UUID | None:
    try:
        payload = jwt.decode(
            token,
            settings.auth_secret_key,
            algorithms=[TOKEN_ALGORITHM],
            options={"require": ["exp", "sub"]},
        )
        return UUID(str(payload["sub"]))
    except (InvalidTokenError, KeyError, TypeError, ValueError):
        return None


def create_pdf_download_token(
    *,
    user_id: UUID,
    item_id: UUID,
    expires_seconds: int,
) -> str:
    now = datetime.now(UTC)
    expires_at = now + timedelta(seconds=expires_seconds)
    payload = {
        "sub": str(user_id),
        "item": str(item_id),
        "purpose": "pdf_download",
        "iat": now,
        "exp": expires_at,
    }
    return jwt.encode(payload, settings.auth_secret_key, algorithm=TOKEN_ALGORITHM)


def decode_pdf_download_token(token: str, *, item_id: UUID) -> UUID | None:
    try:
        payload = jwt.decode(
            token,
            settings.auth_secret_key,
            algorithms=[TOKEN_ALGORITHM],
            options={"require": ["exp", "sub", "item", "purpose"]},
        )
        if payload["purpose"] != "pdf_download" or UUID(str(payload["item"])) != item_id:
            return None
        return UUID(str(payload["sub"]))
    except (InvalidTokenError, KeyError, TypeError, ValueError):
        return None


__all__ = [
    "create_access_token",
    "create_pdf_download_token",
    "decode_access_token",
    "decode_pdf_download_token",
    "hash_password",
    "verify_password",
]
