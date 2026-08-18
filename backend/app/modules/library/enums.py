from __future__ import annotations

from enum import StrEnum


class ImportMethod(StrEnum):
    PASTE = "paste"
    URL = "url"
    FILE = "file"
    PDF_UPLOAD = "pdf_upload"
    YOUTUBE = "youtube"
