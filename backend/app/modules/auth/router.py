from __future__ import annotations

from fastapi import APIRouter

from app.api.dependencies import DbSession
from app.modules.auth.schemas import TokenResponse
from app.modules.auth.schemas import UserLogin
from app.modules.auth.schemas import UserRegister
from app.modules.auth.service import AuthService

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(payload: UserRegister, session: DbSession) -> TokenResponse:
    return await AuthService(session).register(payload)


@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin, session: DbSession) -> TokenResponse:
    return await AuthService(session).login(payload)


__all__ = ["router"]
