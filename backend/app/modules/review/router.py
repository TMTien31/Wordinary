from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter

from app.api.dependencies import CurrentUser
from app.api.dependencies import DbSession
from app.modules.review.schemas import ReviewAnswerCreate
from app.modules.review.schemas import ReviewAnswerResponse
from app.modules.review.schemas import ReviewSessionCreate
from app.modules.review.schemas import ReviewSessionResponse
from app.modules.review.schemas import ReviewSessionSummary
from app.modules.review.service import ReviewService

router = APIRouter()


@router.post("/sessions", response_model=ReviewSessionResponse, status_code=201)
async def create_review_session(
    payload: ReviewSessionCreate,
    session: DbSession,
    current_user: CurrentUser,
) -> ReviewSessionResponse:
    return await ReviewService(session).create_session(
        user_id=current_user.id,
        data=payload,
    )


@router.post("/sessions/{session_id}/answers", response_model=ReviewAnswerResponse)
async def answer_review_card(
    session_id: UUID,
    payload: ReviewAnswerCreate,
    session: DbSession,
    current_user: CurrentUser,
) -> ReviewAnswerResponse:
    return await ReviewService(session).answer(
        session_id=session_id,
        user_id=current_user.id,
        data=payload,
    )


@router.post("/sessions/{session_id}/finish", response_model=ReviewSessionSummary)
async def finish_review_session(
    session_id: UUID,
    session: DbSession,
    current_user: CurrentUser,
) -> ReviewSessionSummary:
    return await ReviewService(session).finish_session(
        session_id=session_id,
        user_id=current_user.id,
    )
