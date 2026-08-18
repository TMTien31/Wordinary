from __future__ import annotations

from uuid import UUID

from sqlalchemy import delete
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.library.models import LibraryItem
from app.modules.vocabulary.models import VocabularyItem


class VocabularyRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def add(self, item: VocabularyItem) -> None:
        self.session.add(item)

    async def get_owned(self, item_id: UUID, user_id: UUID) -> VocabularyItem | None:
        result = await self.session.execute(
            select(VocabularyItem).where(
                VocabularyItem.id == item_id,
                VocabularyItem.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_owned_source_library_item(
        self,
        *,
        item_id: UUID,
        user_id: UUID,
    ) -> LibraryItem | None:
        result = await self.session.execute(
            select(LibraryItem).where(
                LibraryItem.id == item_id,
                LibraryItem.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def delete_owned(self, item_id: UUID, user_id: UUID) -> bool:
        result = await self.session.execute(
            delete(VocabularyItem).where(
                VocabularyItem.id == item_id,
                VocabularyItem.user_id == user_id,
            )
        )
        return result.rowcount == 1


__all__ = ["VocabularyRepository"]
