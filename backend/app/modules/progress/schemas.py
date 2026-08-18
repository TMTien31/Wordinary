from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field

from app.modules.library.schemas import ArticlePosition, PDFPosition, VideoPosition
from app.shared.schemas import APIModel
from app.shared.types import ProgressPercent, UtcDateTime


class ArticleProgressUpdate(APIModel):
    type: Literal["article"] = "article"
    library_item_id: UUID
    progress: ProgressPercent
    position: ArticlePosition


class PDFProgressUpdate(APIModel):
    type: Literal["pdf"] = "pdf"
    library_item_id: UUID
    progress: ProgressPercent
    position: PDFPosition


class VideoProgressUpdate(APIModel):
    type: Literal["video"] = "video"
    library_item_id: UUID
    progress: ProgressPercent
    position: VideoPosition


LearningProgressUpdate = Annotated[
    ArticleProgressUpdate | PDFProgressUpdate | VideoProgressUpdate,
    Field(discriminator="type"),
]


class LearningProgressResponse(APIModel):
    library_item_id: UUID
    type: Literal["article", "pdf", "video"]
    progress: ProgressPercent
    position: ArticlePosition | PDFPosition | VideoPosition
    updated_at: UtcDateTime
