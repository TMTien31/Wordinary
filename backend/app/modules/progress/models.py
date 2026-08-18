from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import func
from sqlalchemy import Index
from sqlalchemy import Integer
from sqlalchemy import Numeric
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.modules.library.models import LibraryItem


class LearningProgress(Base):
    __tablename__ = "learning_progress"

    library_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("library_items.id", ondelete="CASCADE"),
        primary_key=True,
    )
    progress_percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        server_default="0",
    )
    position: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")

    library_item: Mapped[LibraryItem] = relationship(back_populates="learning_progress")

    __table_args__ = (
        CheckConstraint("progress_percent BETWEEN 0 AND 100", name="progress_percent_range"),
        CheckConstraint("version >= 1", name="version_positive"),
        Index(
            "ix_learning_progress_recent",
            last_opened_at.desc(),
            postgresql_where=last_opened_at.is_not(None),
        ),
    )


__all__ = ["LearningProgress"]
