from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.modules.auth.schemas import TokenResponse
from app.modules.auth.schemas import UserLogin
from app.modules.auth.schemas import UserRegister
from app.modules.auth.security import create_access_token
from app.modules.auth.security import hash_password
from app.modules.auth.security import verify_password
from app.modules.users.models import User
from app.modules.users.repository import UserRepository
from app.modules.users.schemas import UserResponse


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.users = UserRepository(session)

    async def register(self, payload: UserRegister) -> TokenResponse:
        existing = await self.users.get_by_email(payload.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email is already registered",
            )

        user = User(
            email=payload.email.lower(),
            password_hash=hash_password(payload.password),
            display_name=payload.display_name,
            status="active",
        )
        self.users.add(user)
        self.users.add_default_owned_rows(user)

        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email is already registered",
            ) from exc

        await self.session.refresh(user)
        return _token_response(user)

    async def login(self, payload: UserLogin) -> TokenResponse:
        user = await self.users.get_by_email(payload.email)
        if not user or not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
            )
        if user.status != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is not active",
            )
        return _token_response(user)


def _token_response(user: User) -> TokenResponse:
    token, expires_in = create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        expires_in=expires_in,
        user=UserResponse.model_validate(user),
    )


__all__ = ["AuthService"]
