from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import BigInteger
from sqlalchemy import Boolean
from sqlalchemy import CheckConstraint
from sqlalchemy import DateTime
from sqlalchemy import Float
from sqlalchemy import ForeignKey
from sqlalchemy import func
from sqlalchemy import Identity
from sqlalchemy import Index
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.db.base import TimestampMixin
from app.db.base import UUIDPrimaryKeyMixin
from app.modules.library.models import Video


class CaptionTrack(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "caption_tracks"

    video_library_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("videos.library_item_id", ondelete="CASCADE"),
        nullable=False,
    )
    language: Mapped[str] = mapped_column(String(12), nullable=False)
    source: Mapped[str] = mapped_column(String(16), nullable=False)
    processing_status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        server_default="ready",
    )
    processing_error: Mapped[str | None] = mapped_column(Text)
    cue_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    provider_metadata: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    fetched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    video: Mapped[Video] = relationship(back_populates="caption_tracks")
    cues: Mapped[list["CaptionCue"]] = relationship(
        back_populates="track",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        CheckConstraint(
            "source IN ('manual', 'automatic', 'upload', 'pasted')",
            name="source_values",
        ),
        CheckConstraint(
            "processing_status IN ('pending', 'processing', 'ready', 'failed')",
            name="processing_status_values",
        ),
        CheckConstraint("cue_count >= 0", name="cue_count_nonnegative"),
        Index(
            "uq_caption_tracks_video_language_source",
            "video_library_item_id",
            "language",
            "source",
            unique=True,
        ),
        Index("ix_caption_tracks_video_default", "video_library_item_id", "is_default"),
        Index(
            "uq_caption_tracks_default_per_video",
            "video_library_item_id",
            unique=True,
            postgresql_where=is_default.is_(True),
        ),
        Index(
            "ix_caption_tracks_processing",
            "updated_at",
            postgresql_where=processing_status.in_(["pending", "processing"]),
        ),
    )


class CaptionCue(TimestampMixin, Base):
    __tablename__ = "caption_cues"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    track_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("caption_tracks.id", ondelete="CASCADE"),
        nullable=False,
    )
    cue_index: Mapped[int] = mapped_column(Integer, nullable=False)
    start_seconds: Mapped[float] = mapped_column(Float, nullable=False)
    end_seconds: Mapped[float] = mapped_column(Float, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    translation: Mapped[str | None] = mapped_column(Text)

    track: Mapped[CaptionTrack] = relationship(back_populates="cues")

    __table_args__ = (
        CheckConstraint("cue_index >= 0", name="cue_index_nonnegative"),
        CheckConstraint("start_seconds >= 0", name="start_seconds_nonnegative"),
        CheckConstraint("end_seconds > start_seconds", name="end_seconds_after_start"),
        Index("uq_caption_cues_track_cue_index", "track_id", "cue_index", unique=True),
        Index("ix_caption_cues_track_time", "track_id", "start_seconds"),
    )


__all__ = ["CaptionCue", "CaptionTrack"]
