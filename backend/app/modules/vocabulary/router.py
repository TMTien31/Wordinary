from __future__ import annotations

from fastapi import APIRouter
from fastapi import Depends
from uuid import UUID

from app.api.dependencies import CurrentUser
from app.api.dependencies import DbSession
from app.modules.vocabulary.schemas import VocabularyCreate
from app.modules.vocabulary.schemas import VocabularyListQuery
from app.modules.vocabulary.schemas import VocabularyResponse
from app.modules.vocabulary.schemas import VocabularyUpdate
from app.modules.vocabulary.service import VocabularyService
from app.shared.schemas import MessageResponse
from app.shared.schemas import Page

router = APIRouter()


@router.post("", response_model=VocabularyResponse, status_code=201)
async def create_vocabulary(
    payload: VocabularyCreate,
    session: DbSession,
    current_user: CurrentUser,
) -> VocabularyResponse:
    return await VocabularyService(session).create_vocabulary(
        user_id=current_user.id,
        data=payload,
    )


@router.get("", response_model=Page[VocabularyResponse])
async def list_vocabulary(
    session: DbSession,
    current_user: CurrentUser,
    query: VocabularyListQuery = Depends(),
) -> Page[VocabularyResponse]:
    return await VocabularyService(session).list_vocabulary(
        user_id=current_user.id,
        query=query,
    )


@router.patch("/{item_id}", response_model=VocabularyResponse)
async def update_vocabulary(
    item_id: UUID,
    payload: VocabularyUpdate,
    session: DbSession,
    current_user: CurrentUser,
) -> VocabularyResponse:
    return await VocabularyService(session).update_vocabulary(
        item_id=item_id,
        user_id=current_user.id,
        data=payload,
    )


@router.put("/{item_id}/review/{result}", response_model=VocabularyResponse)
async def record_vocabulary_review(
    item_id: UUID,
    result: str,
    session: DbSession,
    current_user: CurrentUser,
) -> VocabularyResponse:
    return await VocabularyService(session).record_review(
        item_id=item_id,
        user_id=current_user.id,
        result=result,
    )


@router.delete("/{item_id}", response_model=MessageResponse)
async def delete_vocabulary(
    item_id: UUID,
    session: DbSession,
    current_user: CurrentUser,
) -> MessageResponse:
    await VocabularyService(session).delete_vocabulary(
        item_id=item_id,
        user_id=current_user.id,
    )
    return MessageResponse(message="Vocabulary item deleted")
