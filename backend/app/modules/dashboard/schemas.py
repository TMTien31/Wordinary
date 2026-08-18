from __future__ import annotations

from pydantic import Field

from app.modules.library.schemas import LibraryItemSummary
from app.modules.users.schemas import LearningProfileResponse
from app.modules.vocabulary.schemas import VocabularyResponse
from app.shared.schemas import APIModel


class DashboardResponse(APIModel):
    profile: LearningProfileResponse
    continue_learning: list[LibraryItemSummary] = Field(default_factory=list)
    recent_vocabulary: list[VocabularyResponse] = Field(default_factory=list)
    due_review_count: int = Field(ge=0)
    library_item_count: int = Field(ge=0)
    vocabulary_count: int = Field(ge=0)
