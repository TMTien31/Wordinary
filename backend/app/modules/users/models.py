from __future__ import annotations

import uuid
from datetime import date
from datetime import datetime

from sqlalchemy import BigInteger
from sqlalchemy import Boolean
from sqlalchemy import CheckConstraint
from sqlalchemy import Date
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import Index
from sqlalchemy import Integer
from sqlalchemy import SmallInteger
from sqlalchemy import String
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.db.base import TimestampMixin
from app.db.base import UUIDPrimaryKeyMixin


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="active")
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    settings: Mapped["UserSettings"] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    learning_profile: Mapped["LearningProfile"] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    daily_activities: Mapped[list["DailyActivity"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'pending', 'disabled')",
            name="status_values",
        ),
        Index("uq_users_email_ci", func.lower(email), unique=True),
    )


class UserSettings(TimestampMixin, Base):
    __tablename__ = "user_settings"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    language: Mapped[str] = mapped_column(String(12), nullable=False, server_default="vi")
    theme: Mapped[str] = mapped_column(String(16), nullable=False, server_default="system")
    font_size: Mapped[int] = mapped_column(
        SmallInteger,
        nullable=False,
        server_default="21",
    )
    reader_rail_collapsed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default="false",
    )
    main_sidebar_collapsed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default="false",
    )

    user: Mapped[User] = relationship(back_populates="settings")

    __table_args__ = (
        CheckConstraint("theme IN ('light', 'dark', 'system')", name="theme_values"),
        CheckConstraint("font_size BETWEEN 12 AND 32", name="font_size_range"),
    )


class LearningProfile(TimestampMixin, Base):
    __tablename__ = "learning_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    native_language: Mapped[str] = mapped_column(String(12), nullable=False, server_default="vi")
    target_language: Mapped[str] = mapped_column(String(12), nullable=False, server_default="en")
    xp: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default="0")
    current_streak: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    longest_streak: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    daily_goal: Mapped[int] = mapped_column(Integer, nullable=False, server_default="8")
    timezone: Mapped[str] = mapped_column(
        String(60),
        nullable=False,
        server_default="Asia/Ho_Chi_Minh",
    )
    last_activity_date: Mapped[date | None] = mapped_column(Date)

    user: Mapped[User] = relationship(back_populates="learning_profile")

    __table_args__ = (
        CheckConstraint("xp >= 0", name="xp_nonnegative"),
        CheckConstraint("current_streak >= 0", name="current_streak_nonnegative"),
        CheckConstraint("longest_streak >= 0", name="longest_streak_nonnegative"),
        CheckConstraint("daily_goal BETWEEN 1 AND 200", name="daily_goal_range"),
    )


class DailyActivity(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "daily_activities"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    activity_date: Mapped[date] = mapped_column(Date, nullable=False)
    activity_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    xp_earned: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    review_answers_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    saved_vocabulary_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    completed_items_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    reading_seconds: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    video_seconds: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    user: Mapped[User] = relationship(back_populates="daily_activities")

    __table_args__ = (
        CheckConstraint("activity_count >= 0", name="activity_count_nonnegative"),
        CheckConstraint("xp_earned >= 0", name="xp_earned_nonnegative"),
        CheckConstraint("review_answers_count >= 0", name="review_answers_count_nonnegative"),
        CheckConstraint("saved_vocabulary_count >= 0", name="saved_vocabulary_count_nonnegative"),
        CheckConstraint("completed_items_count >= 0", name="completed_items_count_nonnegative"),
        CheckConstraint("reading_seconds >= 0", name="reading_seconds_nonnegative"),
        CheckConstraint("video_seconds >= 0", name="video_seconds_nonnegative"),
        Index("uq_daily_activities_user_activity_date", "user_id", "activity_date", unique=True),
        Index("ix_daily_activities_user_date", "user_id", activity_date.desc()),
    )


__all__ = ["DailyActivity", "LearningProfile", "User", "UserSettings"]
