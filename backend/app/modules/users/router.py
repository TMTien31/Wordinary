from __future__ import annotations

from fastapi import APIRouter

from app.api.dependencies import CurrentUser
from app.api.dependencies import DbSession
from app.modules.users.schemas import LearningProfileResponse
from app.modules.users.schemas import OnboardingStatusResponse
from app.modules.users.schemas import UserResponse
from app.modules.users.service import complete_onboarding
from app.modules.users.service import get_learning_profile_response
from app.modules.users.service import get_onboarding_status

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


@router.get("/me/onboarding", response_model=OnboardingStatusResponse)
async def get_my_onboarding_status(
    session: DbSession,
    current_user: CurrentUser,
) -> OnboardingStatusResponse:
    return await get_onboarding_status(session, user_id=current_user.id)


@router.post("/me/onboarding/complete", response_model=OnboardingStatusResponse)
async def complete_my_onboarding(
    session: DbSession,
    current_user: CurrentUser,
) -> OnboardingStatusResponse:
    return await complete_onboarding(session, user_id=current_user.id)
