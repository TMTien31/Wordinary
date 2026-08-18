from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint
from sqlalchemy import DateTime
from sqlalchemy import Float
from sqlalchemy import ForeignKey
from sqlalchemy import Index
from sqlalchemy import Integer
from sqlalchemy import SmallInteger
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.db.base import TimestampMixin
from app.db.base import UUIDPrimaryKeyMixin
from app.modules.library.models import LibraryItem
from app.modules.users.models import User
from app.storage.models import StoredFile


class VocabularyItem(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "vocabulary_items"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    source_library_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("library_items.id", ondelete="SET NULL"),
    )
    source_type: Mapped[str] = mapped_column(String(16), nullable=False)
    word: Mapped[str] = mapped_column(String(200), nullable=False)
    normalized_word: Mapped[str] = mapped_column(String(200), nullable=False)
    lemma: Mapped[str | None] = mapped_column(String(200))
    translation: Mapped[str] = mapped_column(String(500), nullable=False)
    definition: Mapped[str | None] = mapped_column(Text)
    phonetic: Mapped[str | None] = mapped_column(String(200))
    part_of_speech: Mapped[str | None] = mapped_column(String(80))
    example_sentence: Mapped[str | None] = mapped_column(Text)
    sentence_translation: Mapped[str | None] = mapped_column(Text)
    icon_name: Mapped[str | None] = mapped_column(String(255))
    icon_file_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("stored_files.id", ondelete="SET NULL"),
    )
    icon_url: Mapped[str | None] = mapped_column(Text)
    source_title_snapshot: Mapped[str | None] = mapped_column(String(300))
    source_url_snapshot: Mapped[str | None] = mapped_column(Text)
    source_context: Mapped[str | None] = mapped_column(Text)
    article_paragraph_index: Mapped[int | None] = mapped_column(Integer)
    article_character_start: Mapped[int | None] = mapped_column(Integer)
    article_character_end: Mapped[int | None] = mapped_column(Integer)
    pdf_page: Mapped[int | None] = mapped_column(Integer)
    video_timestamp_seconds: Mapped[float | None] = mapped_column(Float)
    video_caption_index: Mapped[int | None] = mapped_column(Integer)
    mastery: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default="0")
    review_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    last_result: Mapped[str | None] = mapped_column(String(10))
    last_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_review_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship()
    source_library_item: Mapped[LibraryItem | None] = relationship()
    icon_file: Mapped[StoredFile | None] = relationship()

    __table_args__ = (
        CheckConstraint(
            "source_type IN ('article', 'pdf', 'video', 'manual')",
            name="source_type_values",
        ),
        CheckConstraint("mastery BETWEEN 0 AND 5", name="mastery_range"),
        CheckConstraint("review_count >= 0", name="review_count_nonnegative"),
        CheckConstraint(
            "last_result IS NULL OR last_result IN ('good', 'again')",
            name="last_result_values",
        ),
        CheckConstraint(
            "article_paragraph_index IS NULL OR article_paragraph_index >= 0",
            name="article_paragraph_index_nonnegative",
        ),
        CheckConstraint(
            "article_character_start IS NULL OR article_character_start >= 0",
            name="article_character_start_nonnegative",
        ),
        CheckConstraint(
            "article_character_end IS NULL OR article_character_end >= 0",
            name="article_character_end_nonnegative",
        ),
        CheckConstraint(
            """
            article_character_end IS NULL
            OR article_character_start IS NULL
            OR article_character_end >= article_character_start
            """,
            name="article_character_end_after_start",
        ),
        CheckConstraint("pdf_page IS NULL OR pdf_page >= 1", name="pdf_page_positive"),
        CheckConstraint(
            "video_timestamp_seconds IS NULL OR video_timestamp_seconds >= 0",
            name="video_timestamp_seconds_nonnegative",
        ),
        CheckConstraint(
            "video_caption_index IS NULL OR video_caption_index >= 0",
            name="video_caption_index_nonnegative",
        ),
        CheckConstraint(
            "num_nonnulls(icon_name, icon_file_id, icon_url) <= 1",
            name="single_icon_source",
        ),
        Index("ix_vocabulary_items_user_word", "user_id", "normalized_word"),
        Index(
            "ix_vocabulary_items_user_due",
            "user_id",
            "next_review_at",
            postgresql_where=next_review_at.is_not(None),
        ),
        Index("ix_vocabulary_items_user_source_type", "user_id", "source_type"),
        Index("ix_vocabulary_items_source_library_item", "source_library_item_id"),
    )


__all__ = ["VocabularyItem"]
