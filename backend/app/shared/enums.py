from __future__ import annotations

from enum import StrEnum


class LibraryItemType(StrEnum):
    ARTICLE = "article"
    PDF = "pdf"
    VIDEO = "video"


class ReviewResult(StrEnum):
    GOOD = "good"
    AGAIN = "again"


class CaptionSource(StrEnum):
    MANUAL = "manual"
    AUTOMATIC = "automatic"
    UPLOAD = "upload"
    PASTED = "pasted"


class ProcessingStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"
