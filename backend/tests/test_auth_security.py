from __future__ import annotations

import uuid

from app.modules.auth.security import create_access_token
from app.modules.auth.security import decode_access_token
from app.modules.auth.security import hash_password
from app.modules.auth.security import verify_password


def test_password_hash_round_trip_and_rejects_wrong_password() -> None:
    password_hash = hash_password("correct horse battery staple")

    assert verify_password("correct horse battery staple", password_hash)
    assert not verify_password("wrong password", password_hash)
    assert password_hash.startswith("$argon2")
    assert "correct horse battery staple" not in password_hash


def test_access_token_round_trip_and_rejects_tampering() -> None:
    user_id = uuid.uuid4()
    token, expires_in = create_access_token(user_id)

    assert expires_in > 0
    assert decode_access_token(token) == user_id
    assert decode_access_token(f"{token}tampered") is None
