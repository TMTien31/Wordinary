from __future__ import annotations

from fastapi import APIRouter

from app.api.dependencies import CurrentUser
from app.api.dependencies import DbSession
from app.modules.users.schemas import LearningProfileResponse
from app.modules.users.schemas import UserResponse
from app.modules.users.service import get_learning_profile_response

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: CurrentUser) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.get("/me/profile", response_model=LearningProfileResponse)
async def get_my_learning_profile(
    session: DbSession,
    current_user: CurrentUser,
) -> LearningProfileResponse:
    return await get_learning_profile_response(session, user_id=current_user.id)
