from __future__ import annotations

from datetime import date
from uuid import UUID

from pydantic import Field

from app.modules.users.enums import Theme, UserStatus
from app.shared.schemas import APIModel
from app.shared.types import LanguageCode, UtcDateTime


class UserResponse(APIModel):
    id: UUID
    email: str
    display_name: str
    status: UserStatus
    created_at: UtcDateTime
    updated_at: UtcDateTime | None = None


class UserUpdate(APIModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    avatar_url: str | None = Field(default=None, max_length=2048)


class UserSettingsUpdate(APIModel):
    theme: Theme | None = None
    language: LanguageCode | None = None
    font_size: int | None = Field(default=None, ge=12, le=32)
    reader_rail_collapsed: bool | None = None
    main_sidebar_collapsed: bool | None = None


class UserSettingsResponse(APIModel):
    theme: Theme
    language: LanguageCode
    font_size: int = Field(ge=12, le=32)
    reader_rail_collapsed: bool
    main_sidebar_collapsed: bool


class LearningProfileUpdate(APIModel):
    native_language: LanguageCode | None = None
    target_language: LanguageCode | None = None
    daily_goal: int | None = Field(default=None, ge=1, le=200)


class LearningProfileResponse(APIModel):
    native_language: LanguageCode
    target_language: LanguageCode
    daily_goal: int = Field(ge=1, le=200)
    xp: int = Field(ge=0)
    streak: int = Field(ge=0)
    longest_streak: int = Field(ge=0)
    daily_activity: int = Field(ge=0)
    daily_xp: int = Field(ge=0)
    last_activity_date: date | None = None
