from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field

from app.shared.enums import ReviewResult
from app.shared.schemas import APIModel
from app.shared.types import LanguageCode, NonNegativeSeconds, UtcDateTime


class ArticleSourceLocator(APIModel):
    type: Literal["article"] = "article"
    library_item_id: UUID | None = None
    source_title: str | None = Field(default=None, max_length=240)
    source_url: str | None = Field(default=None, max_length=2048)
    sentence_index: int | None = Field(default=None, ge=0)


class PDFSourceLocator(APIModel):
    type: Literal["pdf"] = "pdf"
    library_item_id: UUID | None = None
    document_id: UUID | None = None
    source_title: str | None = Field(default=None, max_length=240)
    page: int | None = Field(default=None, ge=1)


class VideoSourceLocator(APIModel):
    type: Literal["video"] = "video"
    library_item_id: UUID | None = None
    source_title: str | None = Field(default=None, max_length=240)
    source_url: str | None = Field(default=None, max_length=2048)
    timestamp: NonNegativeSeconds | None = None
    caption_index: int | None = Field(default=None, ge=0)


class ManualSourceLocator(APIModel):
    type: Literal["manual"] = "manual"
    source_title: str | None = Field(default=None, max_length=240)
    note: str | None = Field(default=None, max_length=1000)


SourceLocator = Annotated[
    ArticleSourceLocator | PDFSourceLocator | VideoSourceLocator | ManualSourceLocator,
    Field(discriminator="type"),
]


class VocabularyCreate(APIModel):
    word: str = Field(min_length=1, max_length=120)
    translation: str = Field(min_length=1, max_length=500)
    sentence: str = Field(min_length=1, max_length=2000)
    sentence_translation: str = Field(default="", max_length=2000)
    definition: str = Field(default="", max_length=2000)
    phonetic: str = Field(default="", max_length=120)
    part_of_speech: str = Field(default="", max_length=80)
    icon: str | None = None
    source: SourceLocator
    source_language: LanguageCode = "en"
    target_language: LanguageCode = "vi"


class VocabularyUpdate(APIModel):
    word: str | None = Field(default=None, min_length=1, max_length=120)
    translation: str | None = Field(default=None, min_length=1, max_length=500)
    sentence: str | None = Field(default=None, min_length=1, max_length=2000)
    sentence_translation: str | None = Field(default=None, max_length=2000)
    definition: str | None = Field(default=None, max_length=2000)
    phonetic: str | None = Field(default=None, max_length=120)
    part_of_speech: str | None = Field(default=None, max_length=80)
    icon: str | None = None
    source: SourceLocator | None = None


class VocabularyResponse(APIModel):
    id: UUID
    word: str
    translation: str
    sentence: str
    sentence_translation: str = ""
    definition: str = ""
    phonetic: str = ""
    part_of_speech: str = ""
    icon: str | None = None
    source: SourceLocator
    source_language: LanguageCode
    target_language: LanguageCode
    mastery: int = Field(ge=0, le=5)
    review_count: int = Field(ge=0)
    last_result: ReviewResult | None = None
    next_review_at: UtcDateTime | None = None
    last_reviewed_at: UtcDateTime | None = None
    created_at: UtcDateTime
    updated_at: UtcDateTime | None = None


class VocabularyListQuery(APIModel):
    search: str | None = Field(default=None, max_length=200)
    source_type: Literal["article", "pdf", "video", "manual", "all"] = "all"
    due_only: bool = False
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=200)
