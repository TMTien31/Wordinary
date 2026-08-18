from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field

from app.modules.captions.schemas import CaptionCue
from app.modules.library.enums import ImportMethod
from app.shared.enums import CaptionSource, LibraryItemType, ProcessingStatus
from app.shared.schemas import APIModel
from app.shared.types import LanguageCode, NonNegativeSeconds, ProgressPercent, UtcDateTime


class ArticlePosition(APIModel):
    scroll_progress: ProgressPercent = 0


class PDFPosition(APIModel):
    page: int = Field(default=1, ge=1)
    zoom: float | None = Field(default=None, ge=0.25, le=5)


class VideoPosition(APIModel):
    timestamp: NonNegativeSeconds = 0
    caption_index: int | None = Field(default=None, ge=0)


class ArticleCreate(APIModel):
    title: str = Field(min_length=1, max_length=240)
    content: str = Field(min_length=1)
    source_url: str | None = Field(default=None, max_length=2048)
    import_method: ImportMethod = ImportMethod.PASTE
    original_file_name: str | None = Field(default=None, max_length=255)


class VideoCreate(APIModel):
    url: str = Field(min_length=1, max_length=2048)
    title: str | None = Field(default=None, max_length=240)
    language: LanguageCode = "en"
    fetch_captions: bool = True
    duration: NonNegativeSeconds | None = None
    thumbnail_url: str | None = Field(default=None, max_length=2048)
    embeddable: bool | None = None
    source_label: str | None = Field(default=None, max_length=120)
    captions: list[CaptionCue] = Field(default_factory=list, max_length=600)
    is_demo: bool = False


class PDFCreateMetadata(APIModel):
    title: str | None = Field(default=None, max_length=240)
    file_name: str = Field(min_length=1, max_length=255)
    mime_type: str | None = Field(default=None, max_length=120)
    file_size_bytes: int | None = Field(default=None, ge=0)


class LibraryItemUpdate(APIModel):
    title: str | None = Field(default=None, min_length=1, max_length=240)
    description: str | None = Field(default=None, max_length=1000)
    thumbnail_url: str | None = Field(default=None, max_length=2048)
    source_url: str | None = Field(default=None, max_length=2048)
    progress: ProgressPercent | None = None


class ArticleContentUpdate(APIModel):
    title: str | None = Field(default=None, min_length=1, max_length=240)
    content: str | None = Field(default=None, min_length=1)
    author: str | None = Field(default=None, max_length=160)
    level: str | None = Field(default=None, max_length=20)


class VideoContentUpdate(APIModel):
    title: str | None = Field(default=None, min_length=1, max_length=240)
    duration: NonNegativeSeconds | None = None
    thumbnail_url: str | None = Field(default=None, max_length=2048)
    embeddable: bool | None = None
    source_label: str | None = Field(default=None, max_length=120)
    captions: list[CaptionCue] | None = Field(default=None, max_length=600)
    is_demo: bool | None = None


class ArticleMetadata(APIModel):
    author: str | None = Field(default=None, max_length=160)
    level: str | None = Field(default=None, max_length=20)
    word_count: int = Field(default=0, ge=0)
    reading_minutes: int = Field(default=1, ge=1)
    import_method: ImportMethod | None = None
    original_file_name: str | None = Field(default=None, max_length=255)


class PDFMetadata(APIModel):
    file_name: str = Field(max_length=255)
    original_file_name: str | None = Field(default=None, max_length=255)
    page_count: int = Field(default=0, ge=0)
    file_size_bytes: int | None = Field(default=None, ge=0)
    mime_type: str | None = Field(default=None, max_length=120)
    checksum_sha256: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    file_available: bool = True
    processing_status: ProcessingStatus = ProcessingStatus.READY
    download_url: str | None = Field(default=None, max_length=2048)
    download_url_expires_at: UtcDateTime | None = None
    text_layer_available: bool = False
    ocr_used: bool = False


class VideoMetadata(APIModel):
    url: str = Field(max_length=2048)
    youtube_id: str | None = Field(default=None, max_length=64)
    duration: NonNegativeSeconds | None = None
    channel: str | None = Field(default=None, max_length=240)
    channel_id: str | None = Field(default=None, max_length=120)
    caption_count: int = Field(default=0, ge=0)
    caption_language: LanguageCode | None = None
    caption_source: CaptionSource | None = None
    embeddable: bool | None = None
    processing_status: ProcessingStatus = ProcessingStatus.READY
    is_demo: bool = False
    source_label: str = ""
    captions: list[CaptionCue] = Field(default_factory=list, max_length=600)


LibraryPosition = ArticlePosition | PDFPosition | VideoPosition
LibraryMetadata = ArticleMetadata | PDFMetadata | VideoMetadata


class LibraryItemSummary(APIModel):
    id: UUID
    type: LibraryItemType
    title: str
    description: str = ""
    thumbnail_url: str = ""
    source_url: str = ""
    created_at: UtcDateTime
    last_opened_at: UtcDateTime | None = None
    progress: ProgressPercent = 0
    saved_word_count: int = Field(default=0, ge=0)
    position: LibraryPosition
    metadata: LibraryMetadata


class LibraryItemBaseResponse(APIModel):
    id: UUID
    title: str
    description: str = ""
    thumbnail_url: str = ""
    source_url: str = ""
    created_at: UtcDateTime
    last_opened_at: UtcDateTime | None = None
    progress: ProgressPercent = 0
    saved_word_count: int = Field(default=0, ge=0)


class ArticleDetailResponse(LibraryItemBaseResponse):
    type: Literal["article"] = "article"
    content: str
    position: ArticlePosition
    metadata: ArticleMetadata


class PDFDetailResponse(LibraryItemBaseResponse):
    type: Literal["pdf"] = "pdf"
    position: PDFPosition
    metadata: PDFMetadata


class VideoDetailResponse(LibraryItemBaseResponse):
    type: Literal["video"] = "video"
    position: VideoPosition
    metadata: VideoMetadata


LibraryItemDetailResponse = Annotated[
    ArticleDetailResponse | PDFDetailResponse | VideoDetailResponse,
    Field(discriminator="type"),
]


class LibraryListQuery(APIModel):
    type: LibraryItemType | Literal["all"] = "all"
    search: str | None = Field(default=None, max_length=200)
    sort: Literal["recent", "added", "saved", "progress", "title"] = "recent"
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=30, ge=1, le=100)
