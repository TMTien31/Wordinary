from __future__ import annotations

import asyncio
import os
import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine

from app.modules.review.enums import ReviewMode
from app.modules.review.schemas import ReviewAnswerCreate
from app.modules.review.schemas import ReviewSessionCreate
from app.modules.review.service import ReviewService
from app.modules.users.service import get_learning_profile_response
from app.modules.users.models import User
from app.modules.vocabulary.models import VocabularyItem
from app.modules.vocabulary.schemas import ManualSourceLocator
from app.modules.vocabulary.schemas import VocabularyCreate
from app.modules.vocabulary.service import VocabularyService
from app.shared.enums import ReviewResult


pytestmark = pytest.mark.skipif(
    not os.getenv("WORDINARY_RUN_DB_TESTS") or not os.getenv("TEST_DATABASE_URL"),
    reason="set WORDINARY_RUN_DB_TESTS=1 and TEST_DATABASE_URL to run PostgreSQL integration tests",
)


def test_review_session_answer_idempotency_and_summary() -> None:
    async def scenario() -> None:
        async with _session() as session:
            user = await _create_user(session)
            vocabulary = VocabularyService(session)
            first = await vocabulary.create_vocabulary(
                user_id=user.id,
                data=VocabularyCreate(
                    word="anchor",
                    translation="neo",
                    sentence="Anchor this memory.",
                    source=ManualSourceLocator(source_title="Manual"),
                ),
            )
            second = await vocabulary.create_vocabulary(
                user_id=user.id,
                data=VocabularyCreate(
                    word="signal",
                    translation="tin hieu",
                    sentence="The signal was clear.",
                    source=ManualSourceLocator(source_title="Manual"),
                ),
            )

            review = ReviewService(session)
            review_session = await review.create_session(
                user_id=user.id,
                data=ReviewSessionCreate(mode=ReviewMode.DUE, limit=10),
            )
            assert review_session.total_cards == 2
            assert {card.vocabulary_id for card in review_session.cards} == {first.id, second.id}

            client_answer_id = uuid.uuid4()
            answer = await review.answer(
                session_id=review_session.id,
                user_id=user.id,
                data=ReviewAnswerCreate(
                    vocabulary_id=first.id,
                    result=ReviewResult.GOOD,
                    client_answer_id=client_answer_id,
                ),
            )
            duplicate = await review.answer(
                session_id=review_session.id,
                user_id=user.id,
                data=ReviewAnswerCreate(
                    vocabulary_id=first.id,
                    result=ReviewResult.GOOD,
                    client_answer_id=client_answer_id,
                ),
            )
            assert duplicate.id == answer.id
            assert duplicate.review_count == answer.review_count

            saved = await session.get(VocabularyItem, first.id)
            assert saved is not None
            assert saved.mastery == 1
            assert saved.review_count == 1
            assert saved.last_result == "good"

            summary = await review.finish_session(session_id=review_session.id, user_id=user.id)
            assert summary.cards_reviewed == 1
            assert summary.good_count == 1
            assert summary.again_count == 0
            assert summary.xp_awarded == 8

            profile = await get_learning_profile_response(session, user_id=user.id)
            assert profile.xp == 32
            assert profile.daily_activity == 3
            assert profile.daily_xp == 32
            assert profile.streak == 1

    _run_db_scenario(scenario())


async def _create_user(session: AsyncSession) -> User:
    user = User(
        email=f"review-{uuid.uuid4().hex}@example.com",
        password_hash="test",
        display_name="Review User",
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
        raise RuntimeError("Review integration tests require a dedicated *_test database")
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
