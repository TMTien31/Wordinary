from __future__ import annotations

from datetime import UTC
from datetime import datetime
from uuid import UUID

from sqlalchemy import Select
from sqlalchemy import func
from sqlalchemy import or_
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.vocabulary.models import VocabularyItem
from app.modules.vocabulary.schemas import ArticleSourceLocator
from app.modules.vocabulary.schemas import ManualSourceLocator
from app.modules.vocabulary.schemas import PDFSourceLocator
from app.modules.vocabulary.schemas import SourceLocator
from app.modules.vocabulary.schemas import VocabularyListQuery
from app.modules.vocabulary.schemas import VocabularyResponse
from app.modules.vocabulary.schemas import VideoSourceLocator


class VocabularySelector:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_vocabulary(
        self,
        *,
        user_id: UUID,
        query: VocabularyListQuery,
    ) -> tuple[list[VocabularyResponse], int]:
        base = select(VocabularyItem, func.count().over().label("total_count")).where(
            VocabularyItem.user_id == user_id
        )
        base = _apply_filters(base, query)
        base = base.order_by(VocabularyItem.created_at.desc())
        statement = base.offset((query.page - 1) * query.page_size).limit(query.page_size)
        result = await self.session.execute(statement)
        rows = result.all()
        total = int(rows[0].total_count) if rows else 0
        return [_response_from_model(item) for item, _total in rows], total

    async def get_response(self, *, item_id: UUID, user_id: UUID) -> VocabularyResponse | None:
        result = await self.session.execute(
            select(VocabularyItem).where(
                VocabularyItem.id == item_id,
                VocabularyItem.user_id == user_id,
            )
        )
        item = result.scalar_one_or_none()
        return _response_from_model(item) if item else None


def _apply_filters(statement: Select, query: VocabularyListQuery) -> Select:
    if query.source_type != "all":
        statement = statement.where(VocabularyItem.source_type == query.source_type)
    if query.due_only:
        statement = statement.where(VocabularyItem.next_review_at <= datetime.now(UTC))
    if query.search:
        pattern = f"%{query.search.lower()}%"
        statement = statement.where(
            or_(
                func.lower(VocabularyItem.word).like(pattern),
                func.lower(VocabularyItem.normalized_word).like(pattern),
                func.lower(VocabularyItem.translation).like(pattern),
                func.lower(func.coalesce(VocabularyItem.source_context, "")).like(pattern),
                func.lower(func.coalesce(VocabularyItem.source_title_snapshot, "")).like(pattern),
            )
        )
    return statement


def _response_from_model(item: VocabularyItem) -> VocabularyResponse:
    return VocabularyResponse(
        id=item.id,
        word=item.word,
        translation=item.translation,
        sentence=item.source_context or "",
        sentence_translation=item.sentence_translation or "",
        definition=item.definition or "",
        phonetic=item.phonetic or "",
        part_of_speech=item.part_of_speech or "",
        icon=item.icon_name or item.icon_url,
        source=_source_from_model(item),
        source_language="en",
        target_language="vi",
        mastery=item.mastery,
        review_count=item.review_count,
        last_result=item.last_result,
        next_review_at=item.next_review_at,
        last_reviewed_at=item.last_reviewed_at,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _source_from_model(item: VocabularyItem) -> SourceLocator:
    if item.source_type == "pdf":
        return PDFSourceLocator(
            library_item_id=item.source_library_item_id,
            source_title=item.source_title_snapshot,
            page=item.pdf_page,
        )
    if item.source_type == "video":
        return VideoSourceLocator(
            library_item_id=item.source_library_item_id,
            source_title=item.source_title_snapshot,
            source_url=item.source_url_snapshot,
            timestamp=item.video_timestamp_seconds,
            caption_index=item.video_caption_index,
        )
    if item.source_type == "manual":
        return ManualSourceLocator(
            source_title=item.source_title_snapshot,
            note=item.source_context,
        )
    return ArticleSourceLocator(
        library_item_id=item.source_library_item_id,
        source_title=item.source_title_snapshot,
        source_url=item.source_url_snapshot,
    )


__all__ = ["VocabularySelector"]
