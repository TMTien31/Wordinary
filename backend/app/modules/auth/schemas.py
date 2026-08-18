from __future__ import annotations

from pydantic import Field

from app.modules.users.schemas import UserResponse
from app.shared.schemas import APIModel


class UserRegister(APIModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8, max_length=256)
    display_name: str = Field(min_length=1, max_length=120)


class UserLogin(APIModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=1, max_length=256)


class TokenResponse(APIModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(ge=1)
    user: UserResponse


class PasswordChangeRequest(APIModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=8, max_length=256)
