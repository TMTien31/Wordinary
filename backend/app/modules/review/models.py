from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import Index
from sqlalchemy import Integer
from sqlalchemy import SmallInteger
from sqlalchemy import String
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.db.base import UUIDPrimaryKeyMixin
from app.modules.users.models import User
from app.modules.vocabulary.models import VocabularyItem


class ReviewSession(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "review_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    mode: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default="active")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship()
    items: Mapped[list["ReviewSessionItem"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        CheckConstraint("mode IN ('all', 'due', 'retry', 'custom')", name="mode_values"),
        CheckConstraint(
            "status IN ('active', 'completed', 'abandoned')",
            name="status_values",
        ),
        Index("ix_review_sessions_user_started", "user_id", started_at.desc()),
        Index(
            "ix_review_sessions_active",
            "user_id",
            postgresql_where=status == "active",
        ),
    )


class ReviewSessionItem(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "review_session_items"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("review_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    vocabulary_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vocabulary_items.id", ondelete="SET NULL"),
    )
    queue_index: Mapped[int] = mapped_column(Integer, nullable=False)
    card_snapshot: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
    mastery_at_start: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    session: Mapped[ReviewSession] = relationship(back_populates="items")
    vocabulary_item: Mapped[VocabularyItem | None] = relationship()
    answers: Mapped[list["ReviewAnswer"]] = relationship(
        back_populates="session_item",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        CheckConstraint("queue_index >= 0", name="queue_index_nonnegative"),
        CheckConstraint("mastery_at_start BETWEEN 0 AND 5", name="mastery_at_start_range"),
        Index("uq_review_session_items_session_queue", "session_id", "queue_index", unique=True),
        Index(
            "uq_review_session_items_session_vocabulary",
            "session_id",
            "vocabulary_item_id",
            unique=True,
            postgresql_where=vocabulary_item_id.is_not(None),
        ),
    )


class ReviewAnswer(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "review_answers"

    session_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("review_session_items.id", ondelete="CASCADE"),
        nullable=False,
    )
    client_answer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    result: Mapped[str] = mapped_column(String(10), nullable=False)
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)
    response_time_ms: Mapped[int | None] = mapped_column(Integer)
    mastery_before: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    mastery_after: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    xp_earned: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    session_item: Mapped[ReviewSessionItem] = relationship(back_populates="answers")

    __table_args__ = (
        CheckConstraint("result IN ('good', 'again')", name="result_values"),
        CheckConstraint("round_number >= 1", name="round_number_positive"),
        CheckConstraint(
            "response_time_ms IS NULL OR response_time_ms BETWEEN 0 AND 3600000",
            name="response_time_ms_range",
        ),
        CheckConstraint("mastery_before BETWEEN 0 AND 5", name="mastery_before_range"),
        CheckConstraint("mastery_after BETWEEN 0 AND 5", name="mastery_after_range"),
        CheckConstraint("xp_earned >= 0", name="xp_earned_nonnegative"),
        Index("uq_review_answers_client_answer_id", "client_answer_id", unique=True),
        Index("uq_review_answers_session_item_round", "session_item_id", "round_number", unique=True),
        Index("ix_review_answers_session_item_answered", "session_item_id", "answered_at"),
    )


__all__ = ["ReviewAnswer", "ReviewSession", "ReviewSessionItem"]
