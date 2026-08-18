from __future__ import annotations

from uuid import UUID

from pydantic import Field

from app.modules.review.enums import ReviewMode
from app.shared.enums import ReviewResult
from app.shared.schemas import APIModel
from app.shared.types import UtcDateTime


class ReviewSessionCreate(APIModel):
    mode: ReviewMode = ReviewMode.DUE
    vocabulary_ids: list[UUID] = Field(default_factory=list, max_length=500)
    limit: int = Field(default=30, ge=1, le=200)


class ReviewCardResponse(APIModel):
    id: UUID
    vocabulary_id: UUID
    word: str
    translation: str
    sentence: str
    sentence_translation: str = ""
    phonetic: str = ""
    icon: str | None = None
    mastery: int = Field(ge=0, le=5)
    review_count: int = Field(ge=0)


class ReviewSessionResponse(APIModel):
    id: UUID
    mode: ReviewMode
    round_number: int = Field(default=1, ge=1)
    total_cards: int = Field(ge=0)
    cards: list[ReviewCardResponse]
    started_at: UtcDateTime


class ReviewAnswerCreate(APIModel):
    vocabulary_id: UUID
    result: ReviewResult
    client_answer_id: UUID
    answered_at: UtcDateTime | None = None


class ReviewAnswerResponse(APIModel):
    id: UUID
    vocabulary_id: UUID
    result: ReviewResult
    mastery: int = Field(ge=0, le=5)
    review_count: int = Field(ge=0)
    next_review_at: UtcDateTime
    xp_awarded: int = Field(ge=0)


class ReviewSessionSummary(APIModel):
    session_id: UUID
    mode: ReviewMode
    round_number: int = Field(ge=1)
    cards_reviewed: int = Field(ge=0)
    good_count: int = Field(ge=0)
    again_count: int = Field(ge=0)
    xp_awarded: int = Field(ge=0)
    finished_at: UtcDateTime
