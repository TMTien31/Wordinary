from __future__ import annotations

import re
from datetime import UTC
from datetime import datetime
from datetime import timedelta
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.modules.vocabulary.models import VocabularyItem
from app.modules.vocabulary.repository import VocabularyRepository
from app.modules.vocabulary.schemas import VocabularyCreate
from app.modules.vocabulary.schemas import VocabularyListQuery
from app.modules.vocabulary.schemas import VocabularyResponse
from app.modules.vocabulary.schemas import VocabularyUpdate
from app.modules.vocabulary.selector import VocabularySelector
from app.modules.users.service import record_learning_activity
from app.shared.schemas import Page


class VocabularyService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = VocabularyRepository(session)
        self.selector = VocabularySelector(session)

    async def create_vocabulary(
        self,
        *,
        user_id: UUID,
        data: VocabularyCreate,
    ) -> VocabularyResponse:
        await self._validate_owned_source(user_id=user_id, data=data)
        source_values = _source_columns(data.source)
        item = VocabularyItem(
            user_id=user_id,
            word=data.word,
            normalized_word=_normalize_word(data.word),
            translation=data.translation,
            source_context=data.sentence,
            sentence_translation=data.sentence_translation or None,
            definition=data.definition or None,
            phonetic=data.phonetic or None,
            part_of_speech=data.part_of_speech or None,
            icon_name=_icon_name(data.icon),
            icon_url=_icon_url(data.icon),
            mastery=0,
            review_count=0,
            next_review_at=datetime.now(UTC),
            **source_values,
        )
        self.repository.add(item)
        await self.session.flush()
        response = await self.selector.get_response(item_id=item.id, user_id=user_id)
        if response is None:
            raise RuntimeError("Created vocabulary item could not be loaded")
        await record_learning_activity(
            self.session,
            user_id=user_id,
            xp=10,
            saved_vocabulary=1,
        )
        await self.session.commit()
        return response

    async def list_vocabulary(
        self,
        *,
        user_id: UUID,
        query: VocabularyListQuery,
    ) -> Page[VocabularyResponse]:
        items, total = await self.selector.list_vocabulary(user_id=user_id, query=query)
        return Page(items=items, total=total, page=query.page, page_size=query.page_size)

    async def update_vocabulary(
        self,
        *,
        item_id: UUID,
        user_id: UUID,
        data: VocabularyUpdate,
    ) -> VocabularyResponse:
        item = await self.repository.get_owned(item_id=item_id, user_id=user_id)
        if item is None:
            raise _not_found()
        if data.source is not None:
            await self._validate_owned_source(user_id=user_id, data=data)
            for key, value in _source_columns(data.source).items():
                setattr(item, key, value)
        if data.word is not None:
            item.word = data.word
            item.normalized_word = _normalize_word(data.word)
        if data.translation is not None:
            item.translation = data.translation
        if data.sentence is not None:
            item.source_context = data.sentence
        if data.sentence_translation is not None:
            item.sentence_translation = data.sentence_translation or None
        if data.definition is not None:
            item.definition = data.definition or None
        if data.phonetic is not None:
            item.phonetic = data.phonetic or None
        if data.part_of_speech is not None:
            item.part_of_speech = data.part_of_speech or None
        if data.icon is not None:
            item.icon_name = _icon_name(data.icon)
            item.icon_url = _icon_url(data.icon)

        await self.session.flush()
        response = await self.selector.get_response(item_id=item.id, user_id=user_id)
        if response is None:
            raise _not_found()
        await self.session.commit()
        return response

    async def delete_vocabulary(self, *, item_id: UUID, user_id: UUID) -> None:
        deleted = await self.repository.delete_owned(item_id=item_id, user_id=user_id)
        if not deleted:
            raise _not_found()
        await self.session.commit()

    async def record_review(
        self,
        *,
        item_id: UUID,
        user_id: UUID,
        result: str,
    ) -> VocabularyResponse:
        if result not in {"good", "again"}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="result must be good or again",
            )
        item = await self.repository.get_owned(item_id=item_id, user_id=user_id)
        if item is None:
            raise _not_found()
        now = datetime.now(UTC)
        item.review_count += 1
        item.last_reviewed_at = now
        item.last_result = result
        if result == "good":
            item.mastery = min(5, item.mastery + 1)
            due_minutes = [0, 24 * 60, 2 * 24 * 60, 5 * 24 * 60, 12 * 24 * 60, 30 * 24 * 60][
                item.mastery
            ]
        else:
            item.mastery = max(0, item.mastery - 1)
            due_minutes = 5
        item.next_review_at = now.replace(microsecond=0) if due_minutes == 0 else _add_minutes(now, due_minutes)
        await self.session.flush()
        response = await self.selector.get_response(item_id=item.id, user_id=user_id)
        if response is None:
            raise _not_found()
        await record_learning_activity(
            self.session,
            user_id=user_id,
            xp=8 if result == "good" else 3,
            review_answers=1,
        )
        await self.session.commit()
        return response

    async def _validate_owned_source(self, *, user_id: UUID, data: VocabularyCreate | VocabularyUpdate) -> None:
        source = data.source
        library_item_id = getattr(source, "library_item_id", None)
        if source is None or library_item_id is None:
            return
        item = await self.repository.get_owned_source_library_item(
            item_id=library_item_id,
            user_id=user_id,
        )
        if item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Source library item not found",
            )
        if item.type != source.type:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Source type does not match the library item type",
            )


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Vocabulary item not found",
    )


def _normalize_word(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().casefold()


def _source_columns(source) -> dict[str, object]:
    values: dict[str, object] = {
        "source_type": source.type,
        "source_library_item_id": getattr(source, "library_item_id", None),
        "source_title_snapshot": getattr(source, "source_title", None),
        "source_url_snapshot": getattr(source, "source_url", None),
        "pdf_page": None,
        "video_timestamp_seconds": None,
        "video_caption_index": None,
        "article_paragraph_index": None,
    }
    if source.type == "pdf":
        values["pdf_page"] = source.page
    if source.type == "video":
        values["video_timestamp_seconds"] = source.timestamp
        values["video_caption_index"] = source.caption_index
    return values


def _icon_name(value: str | None) -> str | None:
    if not value:
        return None
    stripped = value.strip()
    return stripped if re.fullmatch(r"[a-z0-9-]+:[a-z0-9-]+", stripped, flags=re.I) else None


def _icon_url(value: str | None) -> str | None:
    if not value:
        return None
    stripped = value.strip()
    return stripped if _icon_name(stripped) is None else None


def _add_minutes(value: datetime, minutes: int) -> datetime:
    return value.replace(microsecond=0) + timedelta(minutes=max(1, minutes))


__all__ = ["VocabularyService"]
