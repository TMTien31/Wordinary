from __future__ import annotations

import uuid

from sqlalchemy import Boolean
from sqlalchemy import CheckConstraint
from sqlalchemy import Float
from sqlalchemy import ForeignKey
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
from app.modules.users.models import User
from app.storage.models import StoredFile


class LibraryItem(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "library_items"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[str] = mapped_column(String(16), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000))
    source_url: Mapped[str | None] = mapped_column(Text)
    thumbnail_url: Mapped[str | None] = mapped_column(Text)
    processing_status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        server_default="ready",
    )
    processing_error: Mapped[str | None] = mapped_column(Text)

    user: Mapped[User] = relationship()
    article: Mapped["Article | None"] = relationship(
        back_populates="library_item",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    pdf_document: Mapped["PDFDocument | None"] = relationship(
        back_populates="library_item",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    video: Mapped["Video | None"] = relationship(
        back_populates="library_item",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    learning_progress: Mapped["LearningProgress | None"] = relationship(
        back_populates="library_item",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        CheckConstraint("type IN ('article', 'pdf', 'video')", name="type_values"),
        CheckConstraint(
            "processing_status IN ('pending', 'processing', 'ready', 'failed')",
            name="processing_status_values",
        ),
    )


class Article(Base):
    __tablename__ = "articles"

    library_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("library_items.id", ondelete="CASCADE"),
        primary_key=True,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_format: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        server_default="html",
    )
    author: Mapped[str | None] = mapped_column(String(160))
    level: Mapped[str | None] = mapped_column(String(30))
    import_method: Mapped[str] = mapped_column(String(20), nullable=False)
    original_file_name: Mapped[str | None] = mapped_column(String(255))
    mime_type: Mapped[str | None] = mapped_column(String(127))
    word_count: Mapped[int] = mapped_column(Integer, nullable=False)
    reading_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    content_checksum: Mapped[str | None] = mapped_column(String(64))

    library_item: Mapped[LibraryItem] = relationship(back_populates="article")

    __table_args__ = (
        CheckConstraint(
            "content_format IN ('html', 'plain_text', 'markdown')",
            name="content_format_values",
        ),
        CheckConstraint("import_method IN ('paste', 'url', 'file')", name="import_method_values"),
        CheckConstraint("word_count >= 0", name="word_count_nonnegative"),
        CheckConstraint("reading_minutes >= 0", name="reading_minutes_nonnegative"),
        CheckConstraint(
            "content_checksum IS NULL OR content_checksum ~ '^[0-9a-f]{64}$'",
            name="content_checksum_lower_hex",
        ),
    )


class PDFDocument(Base):
    __tablename__ = "pdf_documents"

    library_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("library_items.id", ondelete="CASCADE"),
        primary_key=True,
    )
    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("stored_files.id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,
    )
    page_count: Mapped[int] = mapped_column(Integer, nullable=False)
    text_layer_available: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default="false",
    )
    ocr_used: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    library_item: Mapped[LibraryItem] = relationship(back_populates="pdf_document")
    file: Mapped[StoredFile] = relationship()

    __table_args__ = (
        CheckConstraint("page_count >= 1", name="page_count_positive"),
    )


class Video(Base):
    __tablename__ = "videos"

    library_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("library_items.id", ondelete="CASCADE"),
        primary_key=True,
    )
    provider: Mapped[str] = mapped_column(String(20), nullable=False)
    provider_video_id: Mapped[str | None] = mapped_column(String(128))
    channel_name: Mapped[str | None] = mapped_column(String(255))
    duration_seconds: Mapped[float | None] = mapped_column(Float)
    embeddable: Mapped[bool | None] = mapped_column(Boolean)
    availability: Mapped[str | None] = mapped_column(String(64))
    provider_metadata: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )

    library_item: Mapped[LibraryItem] = relationship(back_populates="video")
    caption_tracks: Mapped[list["CaptionTrack"]] = relationship(
        back_populates="video",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        CheckConstraint("provider IN ('youtube', 'external')", name="provider_values"),
        CheckConstraint(
            "duration_seconds IS NULL OR duration_seconds >= 0",
            name="duration_seconds_nonnegative",
        ),
        Index("ix_videos_provider_video", "provider", "provider_video_id"),
    )


Index(
    "ix_library_items_user_type_created",
    LibraryItem.user_id,
    LibraryItem.type,
    LibraryItem.created_at.desc(),
)
Index("ix_library_items_user_updated", LibraryItem.user_id, LibraryItem.updated_at.desc())


__all__ = ["Article", "LibraryItem", "PDFDocument", "Video"]
