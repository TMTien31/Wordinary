from __future__ import annotations

from enum import StrEnum


class ReviewMode(StrEnum):
    ALL = "all"
    DUE = "due"
    RETRY = "retry"
    CUSTOM = "custom"
