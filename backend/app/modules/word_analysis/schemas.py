from __future__ import annotations

from pydantic import Field

from app.shared.schemas import APIModel
from app.shared.types import LanguageCode


class WordAnalyzeRequest(APIModel):
    word: str = Field(min_length=1, max_length=120)
    sentence: str = Field(default="", max_length=2000)
    source_language: LanguageCode = "en"
    target_language: LanguageCode = "vi"


class AlternativeWordSense(APIModel):
    part_of_speech: str = ""
    definition: str = ""
    translation: str = ""
    example: str | None = None


class WordAnalysisResponse(APIModel):
    word: str
    translation: str
    sentence_translation: str = ""
    lemma: str | None = None
    phonetic: str = ""
    part_of_speech: str = ""
    definition: str = ""
    icon_candidates: list[str] = Field(default_factory=list, max_length=8)
    selected_icon: str | None = None
    alternatives: list[AlternativeWordSense] = Field(default_factory=list, max_length=12)
