from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC
from datetime import datetime
from datetime import timedelta
from uuid import UUID
from urllib.parse import quote

from sqlalchemy import Select
from sqlalchemy import func
from sqlalchemy import literal
from sqlalchemy import or_
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.security import create_pdf_download_token
from app.modules.library.models import Article
from app.modules.library.models import LibraryItem
from app.modules.library.models import PDFDocument
from app.modules.library.models import Video
from app.modules.library.schemas import ArticleDetailResponse
from app.modules.library.schemas import ArticleMetadata
from app.modules.library.schemas import ArticlePosition
from app.modules.library.schemas import LibraryItemDetailResponse
from app.modules.library.schemas import LibraryItemSummary
from app.modules.library.schemas import LibraryListQuery
from app.modules.library.schemas import PDFDetailResponse
from app.modules.library.schemas import PDFMetadata
from app.modules.library.schemas import PDFPosition
from app.modules.library.schemas import VideoDetailResponse
from app.modules.library.schemas import VideoMetadata
from app.modules.library.schemas import VideoPosition
from app.modules.progress.models import LearningProgress
from app.modules.vocabulary.models import VocabularyItem
from app.core.config import settings
from app.shared.enums import CaptionSource
from app.shared.enums import LibraryItemType
from app.shared.enums import ProcessingStatus
from app.storage.models import StoredFile


class LibrarySelector:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_library(
        self,
        *,
        user_id: UUID,
        query: LibraryListQuery,
    ) -> tuple[list[LibraryItemSummary], int]:
        base = (
            select(
                LibraryItem,
                Article,
                PDFDocument,
                StoredFile,
                Video,
                LearningProgress,
                func.count(VocabularyItem.id).label("saved_word_count"),
                func.count().over().label("total_count"),
            )
            .outerjoin(Article, Article.library_item_id == LibraryItem.id)
            .outerjoin(PDFDocument, PDFDocument.library_item_id == LibraryItem.id)
            .outerjoin(StoredFile, StoredFile.id == PDFDocument.file_id)
            .outerjoin(Video, Video.library_item_id == LibraryItem.id)
            .join(LearningProgress, LearningProgress.library_item_id == LibraryItem.id)
            .outerjoin(
                VocabularyItem,
                VocabularyItem.source_library_item_id == LibraryItem.id,
            )
            .where(
                LibraryItem.user_id == user_id,
                LibraryItem.type.in_(
                    [
                        LibraryItemType.ARTICLE.value,
                        LibraryItemType.PDF.value,
                        LibraryItemType.VIDEO.value,
                    ]
                ),
            )
            .group_by(
                LibraryItem.id,
                Article.library_item_id,
                PDFDocument.library_item_id,
                StoredFile.id,
                Video.library_item_id,
                LearningProgress.library_item_id,
            )
        )
        base = _apply_list_filters(base, query)
        base = _apply_list_sort(base, query)
        statement = base.offset((query.page - 1) * query.page_size).limit(query.page_size)

        result = await self.session.execute(statement)
        rows = result.all()
        total = int(rows[0].total_count) if rows else 0
        summaries = [
            await _summary_from_row(
                item,
                article,
                pdf_document,
                stored_file,
                video,
                progress,
                int(saved_word_count),
            )
            for item, article, pdf_document, stored_file, video, progress, saved_word_count, _total_count in rows
        ]
        return summaries, total

    async def get_article_detail(
        self,
        *,
        item_id: UUID,
        user_id: UUID,
    ) -> ArticleDetailResponse | None:
        statement = (
            select(
                LibraryItem,
                Article,
                LearningProgress,
                func.count(VocabularyItem.id).label("saved_word_count"),
            )
            .join(Article, Article.library_item_id == LibraryItem.id)
            .join(LearningProgress, LearningProgress.library_item_id == LibraryItem.id)
            .outerjoin(
                VocabularyItem,
                VocabularyItem.source_library_item_id == LibraryItem.id,
            )
            .where(
                LibraryItem.id == item_id,
                LibraryItem.user_id == user_id,
                LibraryItem.type == LibraryItemType.ARTICLE.value,
            )
            .group_by(LibraryItem.id, Article.library_item_id, LearningProgress.library_item_id)
        )
        result = await self.session.execute(statement)
        row = result.one_or_none()
        if row is None:
            return None
        item, article, progress, saved_word_count = row
        return _article_detail_from_row(item, article, progress, int(saved_word_count))

    async def get_video_detail(
        self,
        *,
        item_id: UUID,
        user_id: UUID,
    ) -> VideoDetailResponse | None:
        statement = (
            select(
                LibraryItem,
                Video,
                LearningProgress,
                func.count(VocabularyItem.id).label("saved_word_count"),
            )
            .join(Video, Video.library_item_id == LibraryItem.id)
            .join(LearningProgress, LearningProgress.library_item_id == LibraryItem.id)
            .outerjoin(
                VocabularyItem,
                VocabularyItem.source_library_item_id == LibraryItem.id,
            )
            .where(
                LibraryItem.id == item_id,
                LibraryItem.user_id == user_id,
                LibraryItem.type == LibraryItemType.VIDEO.value,
            )
            .group_by(LibraryItem.id, Video.library_item_id, LearningProgress.library_item_id)
        )
        result = await self.session.execute(statement)
        row = result.one_or_none()
        if row is None:
            return None
        item, video, progress, saved_word_count = row
        return _video_detail_from_row(item, video, progress, int(saved_word_count))

    async def get_pdf_detail(
        self,
        *,
        item_id: UUID,
        user_id: UUID,
    ) -> PDFDetailResponse | None:
        statement = (
            select(
                LibraryItem,
                PDFDocument,
                StoredFile,
                LearningProgress,
                func.count(VocabularyItem.id).label("saved_word_count"),
            )
            .join(PDFDocument, PDFDocument.library_item_id == LibraryItem.id)
            .join(StoredFile, StoredFile.id == PDFDocument.file_id)
            .join(LearningProgress, LearningProgress.library_item_id == LibraryItem.id)
            .outerjoin(
                VocabularyItem,
                VocabularyItem.source_library_item_id == LibraryItem.id,
            )
            .where(
                LibraryItem.id == item_id,
                LibraryItem.user_id == user_id,
                LibraryItem.type == LibraryItemType.PDF.value,
            )
            .group_by(LibraryItem.id, PDFDocument.library_item_id, StoredFile.id, LearningProgress.library_item_id)
        )
        result = await self.session.execute(statement)
        row = result.one_or_none()
        if row is None:
            return None
        item, pdf_document, stored_file, progress, saved_word_count = row
        return await _pdf_detail_from_row(
            item,
            pdf_document,
            stored_file,
            progress,
            int(saved_word_count),
        )

    async def get_library_item_detail(
        self,
        *,
        item_id: UUID,
        user_id: UUID,
    ) -> LibraryItemDetailResponse | None:
        article = await self.get_article_detail(item_id=item_id, user_id=user_id)
        if article is not None:
            return article
        pdf = await self.get_pdf_detail(item_id=item_id, user_id=user_id)
        if pdf is not None:
            return pdf
        return await self.get_video_detail(item_id=item_id, user_id=user_id)


def _apply_list_filters(statement: Select, query: LibraryListQuery) -> Select:
    if query.type != "all":
        statement = statement.where(LibraryItem.type == query.type.value)
    if query.search:
        pattern = f"%{query.search.lower()}%"
        statement = statement.where(
            or_(
                func.lower(LibraryItem.title).like(pattern),
                func.lower(func.coalesce(LibraryItem.description, "")).like(pattern),
                func.lower(func.coalesce(Article.content, "")).like(pattern),
                func.lower(func.coalesce(StoredFile.original_file_name, "")).like(pattern),
                func.lower(func.coalesce(Video.provider_video_id, "")).like(pattern),
                func.lower(func.coalesce(Video.channel_name, "")).like(pattern),
            )
        )
    return statement


def _apply_list_sort(statement: Select, query: LibraryListQuery) -> Select:
    saved_count = func.count(VocabularyItem.id)
    if query.sort == "added":
        return statement.order_by(LibraryItem.created_at.desc())
    if query.sort == "saved":
        return statement.order_by(saved_count.desc(), LibraryItem.created_at.desc())
    if query.sort == "progress":
        return statement.order_by(LearningProgress.progress_percent.desc(), LibraryItem.created_at.desc())
    if query.sort == "title":
        return statement.order_by(func.lower(LibraryItem.title).asc())
    return statement.order_by(
        LearningProgress.last_opened_at.desc().nulls_last(),
        LibraryItem.created_at.desc(),
    )


async def _summary_from_row(
    item: LibraryItem,
    article: Article | None,
    pdf_document: PDFDocument | None,
    stored_file: StoredFile | None,
    video: Video | None,
    progress: LearningProgress,
    saved_word_count: int,
) -> LibraryItemSummary:
    item_type = LibraryItemType(item.type)
    if item_type == LibraryItemType.ARTICLE:
        position = ArticlePosition.model_validate(progress.position or {})
        metadata = _article_metadata(article) if article is not None else ArticleMetadata()
    elif item_type == LibraryItemType.PDF:
        position = PDFPosition.model_validate(progress.position or {})
        metadata = await _pdf_metadata(item, pdf_document, stored_file, include_download_url=False)
    else:
        position = VideoPosition.model_validate(progress.position or {})
        metadata = _video_metadata(item, video)
    return LibraryItemSummary(
        id=item.id,
        type=item_type,
        title=item.title,
        description=item.description or "",
        thumbnail_url=item.thumbnail_url or "",
        source_url=item.source_url or "",
        created_at=item.created_at,
        last_opened_at=progress.last_opened_at,
        progress=float(progress.progress_percent),
        saved_word_count=saved_word_count,
        position=position,
        metadata=metadata,
    )


def _article_detail_from_row(
    item: LibraryItem,
    article: Article,
    progress: LearningProgress,
    saved_word_count: int,
) -> ArticleDetailResponse:
    return ArticleDetailResponse(
        id=item.id,
        title=item.title,
        description=item.description or "",
        thumbnail_url=item.thumbnail_url or "",
        source_url=item.source_url or "",
        created_at=item.created_at,
        last_opened_at=progress.last_opened_at,
        progress=float(progress.progress_percent),
        saved_word_count=saved_word_count,
        content=article.content,
        position=ArticlePosition.model_validate(progress.position or {}),
        metadata=_article_metadata(article),
    )


def _article_metadata(article: Article) -> ArticleMetadata:
    return ArticleMetadata(
        author=article.author,
        level=article.level,
        word_count=article.word_count,
        reading_minutes=max(1, article.reading_minutes),
        import_method=article.import_method,
        original_file_name=article.original_file_name,
    )


async def _pdf_detail_from_row(
    item: LibraryItem,
    pdf_document: PDFDocument,
    stored_file: StoredFile,
    progress: LearningProgress,
    saved_word_count: int,
) -> PDFDetailResponse:
    return PDFDetailResponse(
        id=item.id,
        title=item.title,
        description=item.description or "",
        thumbnail_url=item.thumbnail_url or "",
        source_url=item.source_url or "",
        created_at=item.created_at,
        last_opened_at=progress.last_opened_at,
        progress=float(progress.progress_percent),
        saved_word_count=saved_word_count,
        position=PDFPosition.model_validate(progress.position or {}),
        metadata=await _pdf_metadata(
            item,
            pdf_document,
            stored_file,
            include_download_url=True,
        ),
    )


async def _pdf_metadata(
    item: LibraryItem,
    pdf_document: PDFDocument | None,
    stored_file: StoredFile | None,
    *,
    include_download_url: bool,
) -> PDFMetadata:
    download_url = None
    expires_at = None
    file_available = stored_file is not None and stored_file.deleted_at is None
    if include_download_url and stored_file is not None and file_available:
        token = create_pdf_download_token(
            user_id=item.user_id,
            item_id=item.id,
            expires_seconds=settings.storage_presigned_expires_seconds,
        )
        download_url = (
            f"{settings.api_v1_prefix}/library/pdfs/{item.id}/file"
            f"?downloadToken={quote(token)}"
        )
        expires_at = datetime.now(UTC) + timedelta(seconds=settings.storage_presigned_expires_seconds)
    return PDFMetadata(
        file_name=stored_file.original_file_name if stored_file is not None else item.title,
        original_file_name=stored_file.original_file_name if stored_file is not None else None,
        page_count=pdf_document.page_count if pdf_document is not None else 0,
        file_size_bytes=stored_file.size_bytes if stored_file is not None else None,
        mime_type=stored_file.mime_type if stored_file is not None else None,
        checksum_sha256=stored_file.checksum_sha256 if stored_file is not None else None,
        file_available=file_available,
        processing_status=ProcessingStatus(item.processing_status),
        download_url=download_url,
        download_url_expires_at=expires_at,
        text_layer_available=bool(pdf_document.text_layer_available) if pdf_document is not None else False,
        ocr_used=bool(pdf_document.ocr_used) if pdf_document is not None else False,
    )


def _video_detail_from_row(
    item: LibraryItem,
    video: Video,
    progress: LearningProgress,
    saved_word_count: int,
) -> VideoDetailResponse:
    return VideoDetailResponse(
        id=item.id,
        title=item.title,
        description=item.description or "",
        thumbnail_url=item.thumbnail_url or "",
        source_url=item.source_url or "",
        created_at=item.created_at,
        last_opened_at=progress.last_opened_at,
        progress=float(progress.progress_percent),
        saved_word_count=saved_word_count,
        position=VideoPosition.model_validate(progress.position or {}),
        metadata=_video_metadata(item, video),
    )


def _video_metadata(item: LibraryItem, video: Video | None) -> VideoMetadata:
    if video is None:
        return VideoMetadata(url=item.source_url or "")
    metadata = video.provider_metadata or {}
    source = metadata.get("captionSource")
    caption_source = CaptionSource(source) if source in {item.value for item in CaptionSource} else None
    return VideoMetadata(
        url=str(metadata.get("url") or item.source_url or ""),
        youtube_id=video.provider_video_id,
        duration=video.duration_seconds,
        channel=video.channel_name,
        channel_id=metadata.get("channelId"),
        caption_count=int(metadata.get("captionCount") or 0),
        caption_language=metadata.get("captionLanguage"),
        caption_source=caption_source,
        embeddable=video.embeddable,
        processing_status=ProcessingStatus(item.processing_status),
        is_demo=bool(metadata.get("isDemo") or False),
        source_label=str(metadata.get("sourceLabel") or ""),
        captions=list(metadata.get("captions") or []),
    )


__all__ = ["LibrarySelector"]
