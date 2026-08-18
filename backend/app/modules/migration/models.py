from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean
from sqlalchemy import CheckConstraint
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import ForeignKeyConstraint
from sqlalchemy import func
from sqlalchemy import Index
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy import UniqueConstraint
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.db.base import UUIDPrimaryKeyMixin
from app.modules.users.models import User


class DataImport(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "data_imports"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    client_import_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    data_version: Mapped[int] = mapped_column(Integer, nullable=False)
    dry_run: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default="pending")
    imported_library_items: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    imported_vocabulary_items: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default="0",
    )
    skipped_items: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    failed_items: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    warnings: Mapped[list] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default=text("'[]'::jsonb"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship()
    items: Mapped[list["DataImportItem"]] = relationship(
        back_populates="data_import",
        cascade="all, delete-orphan",
        passive_deletes=True,
        overlaps="user",
    )

    __table_args__ = (
        UniqueConstraint("id", "user_id", name="uq_data_imports_id_user_id"),
        CheckConstraint(
            "status IN ('pending', 'processing', 'completed', 'failed')",
            name="status_values",
        ),
        CheckConstraint("data_version >= 0", name="data_version_nonnegative"),
        CheckConstraint(
            "imported_library_items >= 0",
            name="imported_library_items_nonnegative",
        ),
        CheckConstraint(
            "imported_vocabulary_items >= 0",
            name="imported_vocabulary_items_nonnegative",
        ),
        CheckConstraint("skipped_items >= 0", name="skipped_items_nonnegative"),
        CheckConstraint("failed_items >= 0", name="failed_items_nonnegative"),
        Index("uq_data_imports_user_client_import", "user_id", "client_import_id", unique=True),
        Index("ix_data_imports_user_created", "user_id", created_at.desc()),
    )


class DataImportItem(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "data_import_items"

    import_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False)
    local_id: Mapped[str] = mapped_column(Text, nullable=False)
    canonical_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    warning: Mapped[str | None] = mapped_column(Text)
    payload_hash: Mapped[str | None] = mapped_column(String(64))
    raw_payload: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    user: Mapped[User] = relationship(overlaps="data_import,items")
    data_import: Mapped[DataImport] = relationship(back_populates="items", overlaps="user")

    __table_args__ = (
        ForeignKeyConstraint(
            ["import_id", "user_id"],
            ["data_imports.id", "data_imports.user_id"],
            name="fk_data_import_items_import_user_data_imports",
            ondelete="CASCADE",
        ),
        CheckConstraint(
            """
            entity_type IN (
                'library_item',
                'vocabulary_item',
                'caption_track',
                'user_settings',
                'learning_profile'
            )
            """,
            name="entity_type_values",
        ),
        CheckConstraint(
            "status IN ('imported', 'skipped', 'failed')",
            name="status_values",
        ),
        CheckConstraint(
            "payload_hash IS NULL OR payload_hash ~ '^[0-9a-f]{64}$'",
            name="payload_hash_lower_hex",
        ),
        Index("uq_data_import_items_user_entity_local", "user_id", "entity_type", "local_id", unique=True),
        Index("ix_data_import_items_import_status", "import_id", "status"),
        Index("ix_data_import_items_user_canonical", "user_id", "canonical_id"),
    )


__all__ = ["DataImport", "DataImportItem"]
