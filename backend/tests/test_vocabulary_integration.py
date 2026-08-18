from __future__ import annotations

import asyncio
import os
import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import UTC
from datetime import datetime

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine

from app.modules.captions.schemas import CaptionCue
from app.modules.library.schemas import ArticleCreate
from app.modules.library.schemas import VideoCreate
from app.modules.library.service import LibraryService
from app.modules.users.models import User
from app.modules.vocabulary.models import VocabularyItem
from app.modules.vocabulary.schemas import ArticleSourceLocator
from app.modules.vocabulary.schemas import ManualSourceLocator
from app.modules.vocabulary.schemas import VideoSourceLocator
from app.modules.vocabulary.schemas import VocabularyCreate
from app.modules.vocabulary.schemas import VocabularyListQuery
from app.modules.vocabulary.schemas import VocabularyUpdate
from app.modules.vocabulary.service import VocabularyService


pytestmark = pytest.mark.skipif(
    not os.getenv("WORDINARY_RUN_DB_TESTS") or not os.getenv("TEST_DATABASE_URL"),
    reason="set WORDINARY_RUN_DB_TESTS=1 and TEST_DATABASE_URL to run PostgreSQL integration tests",
)


def test_create_list_update_review_and_delete_vocabulary_item() -> None:
    async def scenario() -> None:
        async with _session() as session:
            user = await _create_user(session)
            article = await LibraryService(session).create_article(
                user_id=user.id,
                data=ArticleCreate(
                    title="River Article",
                    content="The river bank was covered with reeds.",
                ),
            )
            service = VocabularyService(session)
            card = await service.create_vocabulary(
                user_id=user.id,
                data=VocabularyCreate(
                    word="Bank",
                    translation="bo song",
                    sentence="The river bank was covered with reeds.",
                    definition="The land along a river.",
                    source=ArticleSourceLocator(
                        library_item_id=article.id,
                        source_title=article.title,
                    ),
                ),
            )

            assert card.word == "Bank"
            assert card.translation == "bo song"
            assert card.mastery == 0
            assert card.review_count == 0
            assert card.source.type == "article"
            assert card.source.library_item_id == article.id

            listed = await service.list_vocabulary(user_id=user.id, query=VocabularyListQuery())
            searched = await service.list_vocabulary(
                user_id=user.id,
                query=VocabularyListQuery(search="river"),
            )
            article_cards = await service.list_vocabulary(
                user_id=user.id,
                query=VocabularyListQuery(source_type="article"),
            )

            assert listed.total == 1
            assert [item.id for item in searched.items] == [card.id]
            assert [item.id for item in article_cards.items] == [card.id]

            updated = await service.update_vocabulary(
                item_id=card.id,
                user_id=user.id,
                data=VocabularyUpdate(
                    translation="bo ven song",
                    definition="A river side, not a money place.",
                ),
            )
            assert updated.translation == "bo ven song"
            assert updated.definition == "A river side, not a money place."

            reviewed = await service.record_review(item_id=card.id, user_id=user.id, result="good")
            assert reviewed.mastery == 1
            assert reviewed.review_count == 1
            assert reviewed.last_result == "good"
            assert reviewed.last_reviewed_at is not None
            assert reviewed.next_review_at is not None

            await service.delete_vocabulary(item_id=card.id, user_id=user.id)
            empty = await service.list_vocabulary(user_id=user.id, query=VocabularyListQuery())
            assert empty.total == 0
            assert empty.items == []

    _run_db_scenario(scenario())


def test_vocabulary_source_ownership_is_enforced() -> None:
    async def scenario() -> None:
        async with _session() as session:
            user_a = await _create_user(session, "a")
            user_b = await _create_user(session, "b")
            article = await LibraryService(session).create_article(
                user_id=user_a.id,
                data=ArticleCreate(title="Private", content="Owned by user A only."),
            )

            with pytest.raises(HTTPException) as error:
                await VocabularyService(session).create_vocabulary(
                    user_id=user_b.id,
                    data=VocabularyCreate(
                        word="private",
                        translation="rieng tu",
                        sentence="Owned by user A only.",
                        source=ArticleSourceLocator(
                            library_item_id=article.id,
                            source_title=article.title,
                        ),
                    ),
                )
            assert error.value.status_code == 404

    _run_db_scenario(scenario())


def test_delete_library_item_preserves_vocabulary_snapshot_and_nulls_source() -> None:
    async def scenario() -> None:
        async with _session() as session:
            user = await _create_user(session)
            article = await LibraryService(session).create_article(
                user_id=user.id,
                data=ArticleCreate(
                    title="Snapshot Article",
                    content="A useful phrase remains useful after deleting the source.",
                    source_url="https://example.com/snapshot",
                ),
            )
            card = await VocabularyService(session).create_vocabulary(
                user_id=user.id,
                data=VocabularyCreate(
                    word="phrase",
                    translation="cum tu",
                    sentence="A useful phrase remains useful after deleting the source.",
                    source=ArticleSourceLocator(
                        library_item_id=article.id,
                        source_title=article.title,
                        source_url=article.source_url,
                    ),
                ),
            )

            await LibraryService(session).delete_library_item(item_id=article.id, user_id=user.id)
            saved = await session.get(VocabularyItem, card.id)

            assert saved is not None
            assert saved.source_library_item_id is None
            assert saved.source_title_snapshot == "Snapshot Article"
            assert saved.source_url_snapshot == "https://example.com/snapshot"
            assert saved.source_context == "A useful phrase remains useful after deleting the source."

    _run_db_scenario(scenario())


def test_manual_and_video_sources_list_filters() -> None:
    async def scenario() -> None:
        async with _session() as session:
            user = await _create_user(session)
            video = await LibraryService(session).create_video(
                user_id=user.id,
                data=VideoCreate(
                    url="https://youtu.be/dQw4w9WgXcQ",
                    title="Caption Lesson",
                    duration=213,
                    captions=[CaptionCue(start=12, end=14, text="Learning from captions")],
                    source_label="manual captions",
                ),
            )
            service = VocabularyService(session)
            manual = await service.create_vocabulary(
                user_id=user.id,
                data=VocabularyCreate(
                    word="note",
                    translation="ghi chu",
                    sentence="Remember this manually.",
                    source=ManualSourceLocator(source_title="Manual entry", note="typed by user"),
                ),
            )
            video_card = await service.create_vocabulary(
                user_id=user.id,
                data=VocabularyCreate(
                    word="caption",
                    translation="phu de",
                    sentence="Learning from captions",
                    source=VideoSourceLocator(
                        library_item_id=video.id,
                        source_title=video.title,
                        source_url=video.source_url,
                        timestamp=12.5,
                        caption_index=0,
                    ),
                ),
            )

            manual_cards = await service.list_vocabulary(
                user_id=user.id,
                query=VocabularyListQuery(source_type="manual"),
            )
            video_cards = await service.list_vocabulary(
                user_id=user.id,
                query=VocabularyListQuery(source_type="video"),
            )
            due_cards = await service.list_vocabulary(
                user_id=user.id,
                query=VocabularyListQuery(due_only=True),
            )

            assert [item.id for item in manual_cards.items] == [manual.id]
            assert [item.id for item in video_cards.items] == [video_card.id]
            assert video_cards.items[0].source.type == "video"
            assert video_cards.items[0].source.timestamp == 12.5
            assert {item.id for item in due_cards.items} == {manual.id, video_card.id}

    _run_db_scenario(scenario())


def test_review_again_keeps_mastery_nonnegative_and_rejects_bad_result() -> None:
    async def scenario() -> None:
        async with _session() as session:
            user = await _create_user(session)
            card = await VocabularyService(session).create_vocabulary(
                user_id=user.id,
                data=VocabularyCreate(
                    word="again",
                    translation="lai",
                    sentence="Try again.",
                    source=ManualSourceLocator(source_title="Manual"),
                ),
            )
            service = VocabularyService(session)
            reviewed = await service.record_review(item_id=card.id, user_id=user.id, result="again")
            assert reviewed.mastery == 0
            assert reviewed.review_count == 1
            assert reviewed.last_result == "again"
            assert reviewed.next_review_at is not None
            assert reviewed.next_review_at > datetime.now(UTC)

            with pytest.raises(HTTPException) as error:
                await service.record_review(item_id=card.id, user_id=user.id, result="easy")
            assert error.value.status_code == 422

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
        raise RuntimeError("Vocabulary integration tests require a dedicated *_test database")
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
