from __future__ import annotations

from uuid import UUID

from sqlalchemy import delete
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.library.models import Article
from app.modules.library.models import LibraryItem
from app.modules.library.models import PDFDocument
from app.modules.library.models import Video
from app.modules.progress.models import LearningProgress
from app.storage.models import StoredFile


class LibraryRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def add_library_item(self, item: LibraryItem) -> None:
        self.session.add(item)

    def add_article(self, article: Article) -> None:
        self.session.add(article)

    def add_video(self, video: Video) -> None:
        self.session.add(video)

    def add_pdf_document(self, pdf_document: PDFDocument) -> None:
        self.session.add(pdf_document)

    def add_stored_file(self, stored_file: StoredFile) -> None:
        self.session.add(stored_file)

    def add_progress(self, progress: LearningProgress) -> None:
        self.session.add(progress)

    async def get_owned_item(self, item_id: UUID, user_id: UUID) -> LibraryItem | None:
        statement = select(LibraryItem).where(
            LibraryItem.id == item_id,
            LibraryItem.user_id == user_id,
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_article(self, item_id: UUID) -> Article | None:
        return await self.session.get(Article, item_id)

    async def get_video(self, item_id: UUID) -> Video | None:
        return await self.session.get(Video, item_id)

    async def get_pdf_document(self, item_id: UUID) -> PDFDocument | None:
        return await self.session.get(PDFDocument, item_id)

    async def get_pdf_file(self, item_id: UUID, user_id: UUID) -> StoredFile | None:
        statement = (
            select(StoredFile)
            .join(PDFDocument, PDFDocument.file_id == StoredFile.id)
            .join(LibraryItem, LibraryItem.id == PDFDocument.library_item_id)
            .where(
                LibraryItem.id == item_id,
                LibraryItem.user_id == user_id,
                LibraryItem.type == "pdf",
            )
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_progress(self, item_id: UUID) -> LearningProgress | None:
        return await self.session.get(LearningProgress, item_id)

    async def delete_owned_item(self, item_id: UUID, user_id: UUID) -> bool:
        statement = delete(LibraryItem).where(
            LibraryItem.id == item_id,
            LibraryItem.user_id == user_id,
        )
        result = await self.session.execute(statement)
        return result.rowcount == 1

    async def delete_stored_file(self, file_id: UUID, user_id: UUID) -> bool:
        statement = delete(StoredFile).where(
            StoredFile.id == file_id,
            StoredFile.user_id == user_id,
        )
        result = await self.session.execute(statement)
        return result.rowcount == 1


__all__ = ["LibraryRepository"]
