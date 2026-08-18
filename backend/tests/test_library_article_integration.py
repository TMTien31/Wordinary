from __future__ import annotations

import asyncio
import os
import uuid
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator
from datetime import UTC
from datetime import datetime
from datetime import timedelta

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine

from app.modules.library.schemas import ArticleCreate
from app.modules.library.schemas import ArticlePosition
from app.modules.library.schemas import LibraryItemUpdate
from app.modules.library.schemas import LibraryListQuery
from app.modules.library.schemas import VideoContentUpdate
from app.modules.library.schemas import VideoCreate
from app.modules.library.schemas import VideoPosition
from app.modules.library.service import LibraryService
from app.modules.captions.schemas import CaptionCue
from app.modules.progress.models import LearningProgress
from app.modules.progress.schemas import ArticleProgressUpdate
from app.modules.progress.schemas import VideoProgressUpdate
from app.modules.users.models import User
from app.modules.vocabulary.models import VocabularyItem


pytestmark = pytest.mark.skipif(
    not os.getenv("WORDINARY_RUN_DB_TESTS") or not os.getenv("TEST_DATABASE_URL"),
    reason="set WORDINARY_RUN_DB_TESTS=1 and TEST_DATABASE_URL to run PostgreSQL integration tests",
)


def test_create_article_creates_parent_detail_and_progress() -> None:
    async def scenario() -> None:
        async with _session() as session:
            user = await _create_user(session)
            detail = await LibraryService(session).create_article(
                user_id=user.id,
                data=ArticleCreate(
                    title=" First article ",
                    content="One two three. Four five.",
                    source_url=" https://example.com/a ",
                ),
            )

            rows = (
                await session.execute(
                    sa.text(
                        """
                        SELECT
                            (SELECT count(*) FROM library_items WHERE id = :id AND user_id = :user_id) AS items,
                            (SELECT count(*) FROM articles WHERE library_item_id = :id) AS articles,
                            (SELECT count(*) FROM learning_progress WHERE library_item_id = :id) AS progress
                        """
                    ),
                    {"id": detail.id, "user_id": user.id},
                )
            ).one()

            assert detail.title == "First article"
            assert detail.metadata.word_count == 5
            assert detail.metadata.reading_minutes == 1
            assert detail.progress == 0
            assert detail.position.scroll_progress == 0
            assert rows == (1, 1, 1)

    _run_db_scenario(scenario())


def test_ownership_list_detail_update_and_delete_return_404_for_other_user() -> None:
    async def scenario() -> None:
        async with _session() as session:
            user_a = await _create_user(session, "a")
            user_b = await _create_user(session, "b")
            service = LibraryService(session)
            article = await service.create_article(
                user_id=user_a.id,
                data=ArticleCreate(title="Private Article", content="Owned only by user A."),
            )

        async with _session() as session:
            service = LibraryService(session)
            own_page = await service.list_library(user_id=user_a.id, query=LibraryListQuery())
            other_page = await service.list_library(user_id=user_b.id, query=LibraryListQuery())

            assert [item.id for item in own_page.items] == [article.id]
            assert other_page.items == []

            with pytest.raises(HTTPException) as detail_error:
                await service.get_article_detail(item_id=article.id, user_id=user_b.id)
            assert detail_error.value.status_code == 404

            with pytest.raises(HTTPException) as update_error:
                await service.update_library_item(
                    item_id=article.id,
                    user_id=user_b.id,
                    data=LibraryItemUpdate(title="Nope"),
                )
            assert update_error.value.status_code == 404

            with pytest.raises(HTTPException) as delete_error:
                await service.delete_library_item(item_id=article.id, user_id=user_b.id)
            assert delete_error.value.status_code == 404

    _run_db_scenario(scenario())


def test_list_supports_pagination_filter_search_and_recent_sort() -> None:
    async def scenario() -> None:
        async with _session() as session:
            user = await _create_user(session)
            service = LibraryService(session)
            older = await service.create_article(
                user_id=user.id,
                data=ArticleCreate(title="Alpha grammar", content="Alpha content"),
            )
            newer = await service.create_article(
                user_id=user.id,
                data=ArticleCreate(title="Beta story", content="Beta content"),
            )

        async with _session() as session:
            progress = await session.get(LearningProgress, older.id)
            assert progress is not None
            progress.last_opened_at = datetime.now(UTC) - timedelta(days=1)
            progress.progress_percent = 12
            progress = await session.get(LearningProgress, newer.id)
            assert progress is not None
            progress.last_opened_at = datetime.now(UTC)
            progress.progress_percent = 88
            await session.commit()

        async with _session() as session:
            service = LibraryService(session)
            recent = await service.list_library(user_id=user.id, query=LibraryListQuery(sort="recent"))
            assert [item.id for item in recent.items] == [newer.id, older.id]

            searched = await service.list_library(
                user_id=user.id,
                query=LibraryListQuery(search="grammar"),
            )
            assert [item.id for item in searched.items] == [older.id]

            paged = await service.list_library(
                user_id=user.id,
                query=LibraryListQuery(page=2, page_size=1, sort="title"),
            )
            assert paged.total == 2
            assert paged.page == 2
            assert [item.title for item in paged.items] == ["Beta story"]

    _run_db_scenario(scenario())


def test_article_progress_updates_backend_owned_timestamps_and_rejects_invalid_type() -> None:
    async def scenario() -> None:
        async with _session() as session:
            user = await _create_user(session)
            service = LibraryService(session)
            article = await service.create_article(
                user_id=user.id,
                data=ArticleCreate(title="Progress Article", content="Scroll through this text."),
            )

        async with _session() as session:
            service = LibraryService(session)
            response = await service.update_progress(
                item_id=article.id,
                user_id=user.id,
                data=ArticleProgressUpdate(
                    library_item_id=article.id,
                    progress=42.5,
                    position=ArticlePosition(scroll_progress=42.5),
                ),
            )
            progress = await session.get(LearningProgress, article.id)
            assert progress is not None
            assert response.progress == 42.5
            assert response.position.scroll_progress == 42.5
            assert progress.started_at is not None
            assert progress.last_opened_at is not None
            assert progress.completed_at is None

        async with _session() as session:
            service = LibraryService(session)
            completed = await service.update_progress(
                item_id=article.id,
                user_id=user.id,
                data=ArticleProgressUpdate(
                    library_item_id=article.id,
                    progress=100,
                    position=ArticlePosition(scroll_progress=100),
                ),
            )
            progress = await session.get(LearningProgress, article.id)
            assert progress is not None
            assert completed.progress == 100
            assert progress.completed_at is not None

            with pytest.raises(HTTPException) as type_error:
                await service.update_progress(
                    item_id=article.id,
                    user_id=user.id,
                    data=VideoProgressUpdate(
                        library_item_id=article.id,
                        progress=10,
                        position={"timestamp": 1},
                    ),
                )
            assert type_error.value.status_code == 422

    _run_db_scenario(scenario())


def test_delete_cascades_article_and_progress_but_preserves_vocabulary_snapshot() -> None:
    async def scenario() -> None:
        async with _session() as session:
            user = await _create_user(session)
            service = LibraryService(session)
            article = await service.create_article(
                user_id=user.id,
                data=ArticleCreate(title="Delete Article", content="Vocabulary source text."),
            )
            vocabulary = VocabularyItem(
                user_id=user.id,
                source_library_item_id=article.id,
                source_type="article",
                word="source",
                normalized_word="source",
                translation="nguon",
                source_title_snapshot=article.title,
                source_context="Vocabulary source text.",
            )
            session.add(vocabulary)
            await session.commit()
            vocabulary_id = vocabulary.id

        async with _session() as session:
            await LibraryService(session).delete_library_item(item_id=article.id, user_id=user.id)

        async with _session() as session:
            assert await session.get(LearningProgress, article.id) is None
            article_row = (
                await session.execute(
                    sa.text("SELECT count(*) FROM articles WHERE library_item_id = :id"),
                    {"id": article.id},
                )
            ).scalar_one()
            vocabulary = await session.get(VocabularyItem, vocabulary_id)
            assert article_row == 0
            assert vocabulary is not None
            assert vocabulary.source_library_item_id is None
            assert vocabulary.source_title_snapshot == "Delete Article"

    _run_db_scenario(scenario())


def test_video_create_list_detail_update_progress_and_delete() -> None:
    async def scenario() -> None:
        async with _session() as session:
            user = await _create_user(session)
            other = await _create_user(session, "other")
            service = LibraryService(session)
            video = await service.create_video(
                user_id=user.id,
                data=VideoCreate(
                    url="https://youtu.be/dQw4w9WgXcQ",
                    title="Video Lesson",
                    duration=213,
                    captions=[
                        CaptionCue(start=0, end=3.5, text="Never gonna give you up"),
                        CaptionCue(start=4, end=7, text="Never gonna let you down"),
                    ],
                    source_label="manual captions",
                ),
            )

            rows = (
                await session.execute(
                    sa.text(
                        """
                        SELECT
                            (SELECT count(*) FROM library_items WHERE id = :id AND user_id = :user_id AND type = 'video') AS items,
                            (SELECT count(*) FROM videos WHERE library_item_id = :id) AS videos,
                            (SELECT count(*) FROM learning_progress WHERE library_item_id = :id) AS progress
                        """
                    ),
                    {"id": video.id, "user_id": user.id},
                )
            ).one()

            assert video.type == "video"
            assert video.title == "Video Lesson"
            assert video.metadata.youtube_id == "dQw4w9WgXcQ"
            assert video.metadata.caption_count == 2
            assert len(video.metadata.captions) == 2
            assert rows == (1, 1, 1)

            all_items = await service.list_library(user_id=user.id, query=LibraryListQuery())
            video_items = await service.list_library(
                user_id=user.id,
                query=LibraryListQuery(type="video"),
            )
            assert [item.id for item in all_items.items] == [video.id]
            assert [item.type for item in video_items.items] == ["video"]

            with pytest.raises(HTTPException) as other_error:
                await service.get_library_item_detail(item_id=video.id, user_id=other.id)
            assert other_error.value.status_code == 404

            updated = await service.update_video_content(
                item_id=video.id,
                user_id=user.id,
                data=VideoContentUpdate(
                    title="Video Lesson Edited",
                    duration=220,
                    source_label="uploaded captions",
                    captions=[CaptionCue(start=10, end=12, text="Edited caption")],
                ),
            )
            assert updated.title == "Video Lesson Edited"
            assert updated.metadata.duration == 220
            assert updated.metadata.caption_count == 1
            assert updated.metadata.source_label == "uploaded captions"

            progress_response = await service.update_progress(
                item_id=video.id,
                user_id=user.id,
                data=VideoProgressUpdate(
                    library_item_id=video.id,
                    progress=37,
                    position=VideoPosition(timestamp=81.5, caption_index=0),
                ),
            )
            progress = await session.get(LearningProgress, video.id)
            assert progress is not None
            assert progress_response.progress == 37
            assert progress_response.position.timestamp == 81.5
            assert progress.position == {"timestamp": 81.5, "captionIndex": 0}

        async with _session() as session:
            await LibraryService(session).delete_library_item(item_id=video.id, user_id=user.id)

        async with _session() as session:
            video_row = (
                await session.execute(
                    sa.text("SELECT count(*) FROM videos WHERE library_item_id = :id"),
                    {"id": video.id},
                )
            ).scalar_one()
            assert video_row == 0
            assert await session.get(LearningProgress, video.id) is None

    _run_db_scenario(scenario())


async def _create_user(session: AsyncSession, label: str = "user") -> User:
    user = User(
        email=f"{label}-{uuid.uuid4().hex}@example.com",
        password_hash="test",
        display_name=f"Test {label}",
        status="active",
    )
    session.add(user)
    await session.commit()
    return user


def _run_db_scenario(coro) -> None:
    _ensure_database_ready()
    asyncio.run(coro)


def _ensure_database_ready() -> None:
    database_url = os.environ["TEST_DATABASE_URL"]
    if not database_url.rsplit("/", 1)[-1].endswith("_test"):
        raise RuntimeError("Library integration tests require a dedicated *_test database")
    os.environ["DATABASE_URL"] = database_url
    command.downgrade(Config("alembic.ini"), "base")
    command.upgrade(Config("alembic.ini"), "head")


@asynccontextmanager
async def _session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(os.environ["TEST_DATABASE_URL"])
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with session_factory() as session:
            yield session
    finally:
        await engine.dispose()
