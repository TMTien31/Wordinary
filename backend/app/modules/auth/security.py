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


__all__ = ["create_access_token", "decode_access_token", "hash_password", "verify_password"]
