from __future__ import annotations

from fastapi import APIRouter

from app.api.dependencies import CurrentUser
from app.api.dependencies import DbSession
from app.modules.wody.schemas import WodyChatRequest
from app.modules.wody.schemas import WodyChatResponse
from app.modules.wody.service import WodyService

router = APIRouter()


@router.post("/chat", response_model=WodyChatResponse)
async def chat_with_wody(
    payload: WodyChatRequest,
    session: DbSession,
    current_user: CurrentUser,
) -> WodyChatResponse:
    return await WodyService(session).chat(user_id=current_user.id, payload=payload)


__all__ = ["router"]
