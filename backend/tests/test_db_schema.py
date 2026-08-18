from __future__ import annotations

import asyncio
import os
import uuid

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from sqlalchemy.engine import make_url
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import create_async_engine

import app.db.models  # noqa: F401
from app.db.base import Base


EXPECTED_TABLES = {
    "users",
    "user_settings",
    "learning_profiles",
    "daily_activities",
    "user_sessions",
    "stored_files",
    "library_items",
    "articles",
    "pdf_documents",
    "videos",
    "learning_progress",
    "vocabulary_items",
    "review_sessions",
    "review_session_items",
    "review_answers",
    "caption_tracks",
    "caption_cues",
    "data_imports",
    "data_import_items",
}


def test_metadata_contains_expected_initial_tables() -> None:
    assert set(Base.metadata.tables) == EXPECTED_TABLES


def test_metadata_has_key_constraints_and_indexes() -> None:
    tables = Base.metadata.tables

    assert "uq_users_email_ci" in {index.name for index in tables["users"].indexes}
    assert "ck_videos_provider_values" in _constraint_names("videos")
    assert "ck_pdf_documents_page_count_positive" in _constraint_names("pdf_documents")
    assert "ck_vocabulary_items_single_icon_source" in _constraint_names("vocabulary_items")
    assert "ck_caption_tracks_source_values" in _constraint_names("caption_tracks")
    assert "ck_caption_tracks_processing_status_values" in _constraint_names("caption_tracks")
    assert "ck_data_import_items_status_values" in _constraint_names("data_import_items")

    default_caption_index = next(
        index
        for index in tables["caption_tracks"].indexes
        if index.name == "uq_caption_tracks_default_per_video"
    )
    assert default_caption_index.unique is True
    assert str(default_caption_index.dialect_options["postgresql"]["where"]) == (
        "caption_tracks.is_default IS true"
    )

    import_item_fks = {
        constraint.name: constraint
        for constraint in tables["data_import_items"].constraints
        if isinstance(constraint, sa.ForeignKeyConstraint)
    }
    composite_fk = import_item_fks["fk_data_import_items_import_user_data_imports"]
    assert [element.parent.name for element in composite_fk.elements] == ["import_id", "user_id"]
    assert [element.column.table.name for element in composite_fk.elements] == [
        "data_imports",
        "data_imports",
    ]
    assert composite_fk.ondelete == "CASCADE"

    assert tables["learning_progress"].c.progress_percent.type.precision == 5
    assert tables["learning_progress"].c.progress_percent.type.scale == 2
    assert isinstance(tables["caption_cues"].c.id.identity, sa.Identity)
    assert tables["caption_cues"].c.id.identity.always is True
    assert isinstance(tables["videos"].c.provider_metadata.type, sa.dialects.postgresql.JSONB)
    assert isinstance(tables["data_imports"].c.warnings.type, sa.dialects.postgresql.JSONB)


def test_every_foreign_key_declares_ondelete() -> None:
    for table in Base.metadata.tables.values():
        for constraint in table.foreign_key_constraints:
            assert constraint.ondelete, constraint.name


def test_public_schemas_do_not_expose_storage_key() -> None:
    from app.modules.library.schemas import PDFMetadata

    assert "storage_key" not in PDFMetadata.model_fields


def test_destructive_database_url_guard_rejects_non_test_database() -> None:
    with pytest.raises(RuntimeError, match=r"\*_test database"):
        _require_dedicated_test_database(
            "postgresql+asyncpg://wordinary:wordinary@localhost:5432/wordinary"
        )


@pytest.mark.skipif(
    not os.getenv("WORDINARY_RUN_DB_TESTS") or not os.getenv("TEST_DATABASE_URL"),
    reason="set WORDINARY_RUN_DB_TESTS=1 and TEST_DATABASE_URL to run destructive PostgreSQL tests",
)
def test_initial_migration_round_trip_and_postgresql_constraints() -> None:
    database_url = os.environ["TEST_DATABASE_URL"]
    _require_dedicated_test_database(database_url)
    os.environ["DATABASE_URL"] = database_url

    alembic_cfg = Config("alembic.ini")
    command.downgrade(alembic_cfg, "base")
    command.upgrade(alembic_cfg, "head")
    asyncio.run(_assert_postgresql_schema(database_url))
    asyncio.run(_assert_key_database_constraints(database_url))
    command.downgrade(alembic_cfg, "base")
    command.upgrade(alembic_cfg, "head")


def _constraint_names(table_name: str) -> set[str]:
    return {constraint.name for constraint in Base.metadata.tables[table_name].constraints}


def _require_dedicated_test_database(database_url: str) -> None:
    url = make_url(database_url)
    if not url.database or not url.database.endswith("_test"):
        raise RuntimeError("Destructive DB tests require a dedicated *_test database")


async def _assert_postgresql_schema(database_url: str) -> None:
    engine = create_async_engine(database_url)
    async with engine.connect() as connection:
        table_names = await connection.run_sync(
            lambda sync_connection: set(inspect(sync_connection).get_table_names())
        )
        assert EXPECTED_TABLES <= table_names

        indexes = await connection.run_sync(
            lambda sync_connection: {
                index["name"]: index
                for index in inspect(sync_connection).get_indexes("caption_tracks")
            }
        )
        assert indexes["uq_caption_tracks_default_per_video"]["unique"] is True
        assert "is_default = true" in indexes["uq_caption_tracks_default_per_video"]["dialect_options"][
            "postgresql_where"
        ]

        fks = await connection.run_sync(
            lambda sync_connection: inspect(sync_connection).get_foreign_keys("data_import_items")
        )
        composite_fk = next(
            fk for fk in fks if fk["name"] == "fk_data_import_items_import_user_data_imports"
        )
        assert composite_fk["constrained_columns"] == ["import_id", "user_id"]
        assert composite_fk["referred_columns"] == ["id", "user_id"]
        assert composite_fk["options"]["ondelete"] == "CASCADE"

    await engine.dispose()


async def _assert_key_database_constraints(database_url: str) -> None:
    engine = create_async_engine(database_url)
    ids = {name: uuid.uuid4() for name in _ID_NAMES}

    async with engine.begin() as connection:
        await connection.execute(
            sa.text(
                """
                INSERT INTO users (id, email, password_hash, display_name, status)
                VALUES (:user_id, 'schema@example.com', 'hash', 'Schema User', 'active'),
                       (:other_user_id, 'other@example.com', 'hash', 'Other User', 'active')
                """
            ),
            ids,
        )
        await connection.execute(
            sa.text(
                """
                INSERT INTO stored_files (
                    id, user_id, purpose, storage_backend, storage_key,
                    original_file_name, mime_type, size_bytes
                )
                VALUES (
                    :file_id, :user_id, 'pdf_document', 'local', 'pdf/key',
                    'doc.pdf', 'application/pdf', 12
                )
                """
            ),
            ids,
        )
        await connection.execute(
            sa.text(
                """
                INSERT INTO library_items (id, user_id, type, title, processing_status)
                VALUES (:video_item_id, :user_id, 'video', 'Video', 'ready'),
                       (:pdf_item_id, :user_id, 'pdf', 'PDF', 'ready'),
                       (:progress_item_id, :user_id, 'article', 'Article', 'ready')
                """
            ),
            ids,
        )
        await connection.execute(
            sa.text(
                """
                INSERT INTO videos (library_item_id, provider, provider_metadata)
                VALUES (:video_item_id, 'youtube', '{}'::jsonb)
                """
            ),
            ids,
        )
        await connection.execute(
            sa.text(
                """
                INSERT INTO data_imports (
                    id, user_id, client_import_id, data_version, status, warnings
                )
                VALUES (:import_id, :user_id, :client_import_id, 1, 'pending', '[]'::jsonb)
                """
            ),
            ids,
        )

    await _expect_integrity_error(
        engine,
        "INSERT INTO users (id, email, password_hash, display_name, status) "
        "VALUES (:id, 'bad@example.com', 'hash', 'Bad', 'deleted')",
        {"id": uuid.uuid4()},
    )
    await _expect_integrity_error(
        engine,
        "INSERT INTO videos (library_item_id, provider, provider_metadata) "
        "VALUES (:id, 'upload', '{}'::jsonb)",
        {"id": ids["progress_item_id"]},
    )
    await _expect_integrity_error(
        engine,
        "INSERT INTO pdf_documents (library_item_id, file_id, page_count) "
        "VALUES (:pdf_item_id, :file_id, 0)",
        ids,
    )
    await _expect_integrity_error(
        engine,
        """
        INSERT INTO learning_progress (library_item_id, progress_percent, position)
        VALUES (:progress_item_id, 101, '{}'::jsonb)
        """,
        ids,
    )
    await _expect_integrity_error(
        engine,
        """
        INSERT INTO vocabulary_items (
            id, user_id, source_type, word, normalized_word, translation, icon_name, icon_url
        )
        VALUES (:id, :user_id, 'manual', 'word', 'word', 'tu', 'lucide:book', 'https://e.test/i.png')
        """,
        {"id": uuid.uuid4(), **ids},
    )
    await _expect_integrity_error(
        engine,
        """
        INSERT INTO data_import_items (id, import_id, user_id, entity_type, local_id, status)
        VALUES (:id, :import_id, :other_user_id, 'library_item', 'local-1', 'imported')
        """,
        {"id": uuid.uuid4(), **ids},
    )

    async with engine.begin() as connection:
        await connection.execute(
            sa.text(
                """
                INSERT INTO caption_tracks (
                    id, video_library_item_id, language, source, processing_status, is_default
                )
                VALUES (:track_id, :video_item_id, 'en', 'manual', 'ready', true)
                """
            ),
            ids,
        )
    await _expect_integrity_error(
        engine,
        """
        INSERT INTO caption_tracks (
            id, video_library_item_id, language, source, processing_status, is_default
        )
        VALUES (:id, :video_item_id, 'vi', 'manual', 'ready', true)
        """,
        {"id": uuid.uuid4(), **ids},
    )

    await engine.dispose()


async def _expect_integrity_error(
    engine: sa.ext.asyncio.AsyncEngine,
    statement: str,
    params: dict[str, object],
) -> None:
    async with engine.connect() as connection:
        transaction = await connection.begin()
        with pytest.raises(IntegrityError):
            await connection.execute(sa.text(statement), params)
        await transaction.rollback()


_ID_NAMES = (
    "user_id",
    "other_user_id",
    "file_id",
    "video_item_id",
    "pdf_item_id",
    "progress_item_id",
    "import_id",
    "client_import_id",
    "track_id",
)
