from __future__ import annotations

import hashlib
import re
import uuid
from datetime import UTC
from datetime import datetime
from math import ceil
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status

from app.modules.library.enums import ImportMethod
from app.modules.library.models import Article
from app.modules.library.models import LibraryItem
from app.modules.library.models import PDFDocument
from app.modules.library.models import Video
from app.modules.library.repository import LibraryRepository
from app.modules.library.schemas import ArticleContentUpdate
from app.modules.library.schemas import ArticleCreate
from app.modules.library.schemas import ArticleDetailResponse
from app.modules.library.schemas import LibraryItemDetailResponse
from app.modules.library.schemas import LibraryItemUpdate
from app.modules.library.schemas import LibraryListQuery
from app.modules.library.schemas import LibraryItemSummary
from app.modules.library.schemas import PDFDetailResponse
from app.modules.library.schemas import VideoContentUpdate
from app.modules.library.schemas import VideoCreate
from app.modules.library.schemas import VideoDetailResponse
from app.modules.library.selector import LibrarySelector
from app.modules.progress.models import LearningProgress
from app.modules.progress.schemas import LearningProgressResponse
from app.modules.progress.schemas import LearningProgressUpdate
from app.shared.enums import LibraryItemType
from app.shared.schemas import Page
from app.storage.models import StoredFile
from app.storage.service import get_file_storage

ARTICLE_IMPORT_METHODS = {
    ImportMethod.PASTE.value,
    ImportMethod.URL.value,
    ImportMethod.FILE.value,
}
WORDS_PER_MINUTE = 220
MAX_PDF_UPLOAD_BYTES = 100 * 1024 * 1024


class LibraryService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = LibraryRepository(session)
        self.selector = LibrarySelector(session)

    async def create_article(
        self,
        *,
        user_id: UUID,
        data: ArticleCreate,
    ) -> ArticleDetailResponse:
        if data.import_method.value not in ARTICLE_IMPORT_METHODS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Article import_method must be paste, url, or file",
            )

        content = _normalize_content(data.content)
        word_count = _count_words(content)
        item = LibraryItem(
            user_id=user_id,
            type=LibraryItemType.ARTICLE.value,
            title=data.title.strip(),
            source_url=_normalize_url(data.source_url),
            processing_status="ready",
        )
        article = Article(
            library_item=item,
            content=content,
            content_format="plain_text",
            import_method=data.import_method.value,
            original_file_name=data.original_file_name,
            word_count=word_count,
            reading_minutes=_reading_minutes(word_count),
            content_checksum=_content_checksum(content),
        )
        progress = LearningProgress(
            library_item=item,
            progress_percent=0,
            position={},
            version=1,
        )

        self.repository.add_library_item(item)
        self.repository.add_article(article)
        self.repository.add_progress(progress)
        await self.session.flush()

        detail = await self.selector.get_article_detail(item_id=item.id, user_id=user_id)
        if detail is None:
            raise RuntimeError("Created article could not be loaded")
        await self.session.commit()
        return detail

    async def list_library(
        self,
        *,
        user_id: UUID,
        query: LibraryListQuery,
    ) -> Page[LibraryItemSummary]:
        items, total = await self.selector.list_library(user_id=user_id, query=query)
        return Page(items=items, total=total, page=query.page, page_size=query.page_size)

    async def create_video(
        self,
        *,
        user_id: UUID,
        data: VideoCreate,
    ) -> VideoDetailResponse:
        url = _normalize_url(data.url)
        if url is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Video url is required",
            )
        youtube_id = _parse_youtube_id(url)
        provider = "youtube" if youtube_id else "external"
        title = (data.title or (f"YouTube • {youtube_id}" if youtube_id else "Video")).strip()
        captions = [caption.model_dump(by_alias=True) for caption in data.captions]
        metadata = {
            "url": url,
            "captionLanguage": data.language,
            "captionCount": len(captions),
            "captionSource": "manual" if captions else None,
            "sourceLabel": data.source_label or "",
            "captions": captions,
            "isDemo": data.is_demo,
        }
        item = LibraryItem(
            user_id=user_id,
            type=LibraryItemType.VIDEO.value,
            title=title,
            description="YouTube video" if youtube_id else "Interactive video",
            source_url=url,
            thumbnail_url=_normalize_url(data.thumbnail_url) or (
                f"https://i.ytimg.com/vi/{youtube_id}/hqdefault.jpg" if youtube_id else None
            ),
            processing_status="ready",
        )
        video = Video(
            library_item=item,
            provider=provider,
            provider_video_id=youtube_id or None,
            duration_seconds=data.duration,
            embeddable=data.embeddable,
            provider_metadata=metadata,
        )
        progress = LearningProgress(
            library_item=item,
            progress_percent=0,
            position={},
            version=1,
        )

        self.repository.add_library_item(item)
        self.repository.add_video(video)
        self.repository.add_progress(progress)
        await self.session.flush()

        detail = await self.selector.get_video_detail(item_id=item.id, user_id=user_id)
        if detail is None:
            raise RuntimeError("Created video could not be loaded")
        await self.session.commit()
        return detail

    async def create_pdf(
        self,
        *,
        user_id: UUID,
        file_name: str,
        mime_type: str | None,
        content: bytes,
        page_count: int,
        title: str | None = None,
        text_layer_available: bool = True,
    ) -> PDFDetailResponse:
        if not content:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="PDF file is empty",
            )
        if len(content) > MAX_PDF_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="PDF file is too large",
            )
        normalized_mime = (mime_type or "application/pdf").strip() or "application/pdf"
        if normalized_mime != "application/pdf" and not file_name.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Only PDF files are supported",
            )
        if page_count < 1:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="page_count must be at least 1",
            )

        file_id = uuid.uuid4()
        checksum = hashlib.sha256(content).hexdigest()
        storage_key = f"pdfs/{user_id}/{file_id}.pdf"
        display_title = (title or file_name).strip()
        storage = get_file_storage()
        await storage.save(key=storage_key, content=content, content_type="application/pdf")

        try:
            stored_file = StoredFile(
                id=file_id,
                user_id=user_id,
                purpose="pdf_document",
                storage_backend=storage.config.backend_name,
                storage_key=storage_key,
                original_file_name=file_name.strip() or "document.pdf",
                mime_type="application/pdf",
                size_bytes=len(content),
                checksum_sha256=checksum,
            )
            item = LibraryItem(
                user_id=user_id,
                type=LibraryItemType.PDF.value,
                title=display_title or "document.pdf",
                description=f"{page_count} pages",
                processing_status="ready",
            )
            pdf_document = PDFDocument(
                library_item=item,
                file=stored_file,
                page_count=page_count,
                text_layer_available=text_layer_available,
                ocr_used=False,
            )
            progress = LearningProgress(
                library_item=item,
                progress_percent=0,
                position={"page": 1},
                version=1,
            )

            self.repository.add_stored_file(stored_file)
            self.repository.add_library_item(item)
            self.repository.add_pdf_document(pdf_document)
            self.repository.add_progress(progress)
            await self.session.flush()

            detail = await self.selector.get_pdf_detail(item_id=item.id, user_id=user_id)
            if detail is None:
                raise RuntimeError("Created PDF could not be loaded")
            await self.session.commit()
            return detail
        except Exception:
            await self.session.rollback()
            await storage.delete(storage_key)
            raise

    async def get_library_item_detail(
        self,
        *,
        item_id: UUID,
        user_id: UUID,
    ) -> LibraryItemDetailResponse:
        detail = await self.selector.get_library_item_detail(item_id=item_id, user_id=user_id)
        if detail is None:
            raise _not_found()
        return detail

    async def get_article_detail(
        self,
        *,
        item_id: UUID,
        user_id: UUID,
    ) -> ArticleDetailResponse:
        detail = await self.selector.get_article_detail(item_id=item_id, user_id=user_id)
        if detail is None:
            raise _not_found()
        return detail

    async def get_pdf_detail(
        self,
        *,
        item_id: UUID,
        user_id: UUID,
    ) -> PDFDetailResponse:
        detail = await self.selector.get_pdf_detail(item_id=item_id, user_id=user_id)
        if detail is None:
            raise _not_found()
        return detail

    async def update_library_item(
        self,
        *,
        item_id: UUID,
        user_id: UUID,
        data: LibraryItemUpdate,
    ) -> LibraryItemDetailResponse:
        if data.progress is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Use the progress endpoint to update progress",
            )
        item = await self.repository.get_owned_item(item_id=item_id, user_id=user_id)
        if item is None:
            raise _not_found()

        if data.title is not None:
            item.title = data.title.strip()
        if data.description is not None:
            item.description = data.description
        if data.thumbnail_url is not None:
            item.thumbnail_url = _normalize_url(data.thumbnail_url)
        if data.source_url is not None:
            item.source_url = _normalize_url(data.source_url)

        await self.session.flush()
        detail = await self.get_library_item_detail(item_id=item_id, user_id=user_id)
        await self.session.commit()
        return detail

    async def update_article_content(
        self,
        *,
        item_id: UUID,
        user_id: UUID,
        data: ArticleContentUpdate,
    ) -> ArticleDetailResponse:
        item = await self._get_owned_article_item(item_id=item_id, user_id=user_id)
        article = await self.repository.get_article(item_id)
        if article is None:
            raise _not_found()

        if data.title is not None:
            item.title = data.title.strip()
        if data.content is not None:
            content = _normalize_content(data.content)
            word_count = _count_words(content)
            article.content = content
            article.word_count = word_count
            article.reading_minutes = _reading_minutes(word_count)
            article.content_checksum = _content_checksum(content)
        if data.author is not None:
            article.author = data.author
        if data.level is not None:
            article.level = data.level

        await self.session.flush()
        detail = await self.get_article_detail(item_id=item_id, user_id=user_id)
        await self.session.commit()
        return detail

    async def update_video_content(
        self,
        *,
        item_id: UUID,
        user_id: UUID,
        data: VideoContentUpdate,
    ) -> VideoDetailResponse:
        item = await self._get_owned_video_item(item_id=item_id, user_id=user_id)
        video = await self.repository.get_video(item_id)
        if video is None:
            raise _not_found()

        metadata = dict(video.provider_metadata or {})
        if data.title is not None:
            item.title = data.title.strip()
        if data.duration is not None:
            video.duration_seconds = data.duration
        if data.thumbnail_url is not None:
            item.thumbnail_url = _normalize_url(data.thumbnail_url)
        if data.embeddable is not None:
            video.embeddable = data.embeddable
        if data.source_label is not None:
            metadata["sourceLabel"] = data.source_label
        if data.is_demo is not None:
            metadata["isDemo"] = data.is_demo
        if data.captions is not None:
            captions = [caption.model_dump(by_alias=True) for caption in data.captions]
            metadata["captions"] = captions
            metadata["captionCount"] = len(captions)
            metadata["captionSource"] = "manual" if captions else None
        video.provider_metadata = metadata

        await self.session.flush()
        detail = await self.selector.get_video_detail(item_id=item_id, user_id=user_id)
        if detail is None:
            raise _not_found()
        await self.session.commit()
        return detail

    async def delete_library_item(
        self,
        *,
        item_id: UUID,
        user_id: UUID,
    ) -> None:
        pdf_file = await self.repository.get_pdf_file(item_id=item_id, user_id=user_id)
        deleted = await self.repository.delete_owned_item(item_id=item_id, user_id=user_id)
        if not deleted:
            raise _not_found()
        if pdf_file is not None:
            await self.session.flush()
            await get_file_storage().delete(pdf_file.storage_key)
            await self.repository.delete_stored_file(file_id=pdf_file.id, user_id=user_id)
        await self.session.commit()

    async def update_progress(
        self,
        *,
        item_id: UUID,
        user_id: UUID,
        data: LearningProgressUpdate,
    ) -> LearningProgressResponse:
        if data.library_item_id != item_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="library_item_id must match the path item_id",
            )

        item = await self.repository.get_owned_item(item_id=item_id, user_id=user_id)
        if item is None:
            raise _not_found()
        if item.type != data.type:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Progress type does not match the library item type",
            )

        progress = await self.repository.get_progress(item_id)
        if progress is None:
            raise _not_found()

        now = datetime.now(UTC)
        if progress.started_at is None:
            progress.started_at = now
        progress.progress_percent = data.progress
        progress.position = data.position.model_dump(by_alias=True)
        progress.last_opened_at = now
        progress.updated_at = now
        progress.version += 1
        progress.completed_at = now if data.progress >= 100 else None

        await self.session.commit()
        return LearningProgressResponse(
            library_item_id=item_id,
            type=data.type,
            progress=float(progress.progress_percent),
            position=data.position,
            updated_at=progress.updated_at,
        )

    async def _get_owned_article_item(self, *, item_id: UUID, user_id: UUID) -> LibraryItem:
        item = await self.repository.get_owned_item(item_id=item_id, user_id=user_id)
        if item is None or item.type != LibraryItemType.ARTICLE.value:
            raise _not_found()
        return item

    async def _get_owned_video_item(self, *, item_id: UUID, user_id: UUID) -> LibraryItem:
        item = await self.repository.get_owned_item(item_id=item_id, user_id=user_id)
        if item is None or item.type != LibraryItemType.VIDEO.value:
            raise _not_found()
        return item

    async def _get_owned_pdf_item(self, *, item_id: UUID, user_id: UUID) -> LibraryItem:
        item = await self.repository.get_owned_item(item_id=item_id, user_id=user_id)
        if item is None or item.type != LibraryItemType.PDF.value:
            raise _not_found()
        return item


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Library item not found",
    )


def _normalize_content(content: str) -> str:
    return re.sub(r"\s+", " ", content).strip()


def _normalize_url(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _count_words(content: str) -> int:
    return len(re.findall(r"[\w'-]+", content, flags=re.UNICODE))


def _reading_minutes(word_count: int) -> int:
    return max(1, ceil(word_count / WORDS_PER_MINUTE))


def _content_checksum(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _parse_youtube_id(value: str) -> str:
    stripped = value.strip()
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", stripped):
        return stripped
    patterns = [
        r"youtu\.be/([A-Za-z0-9_-]{11})",
        r"[?&]v=([A-Za-z0-9_-]{11})",
        r"/(?:embed|shorts|live)/([A-Za-z0-9_-]{11})",
    ]
    for pattern in patterns:
        match = re.search(pattern, stripped)
        if match:
            return match.group(1)
    return ""


__all__ = ["LibraryService"]
