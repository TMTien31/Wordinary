from __future__ import annotations

from enum import StrEnum


class ImportEntityType(StrEnum):
    LIBRARY_ITEM = "library_item"
    VOCABULARY_ITEM = "vocabulary_item"
    CAPTION_TRACK = "caption_track"
    USER_SETTINGS = "user_settings"
    LEARNING_PROFILE = "learning_profile"
