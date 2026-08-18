from __future__ import annotations

from datetime import UTC
from datetime import datetime
from datetime import timedelta
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from starlette import status

from app.modules.review.enums import ReviewMode
from app.modules.review.models import ReviewAnswer
from app.modules.review.models import ReviewSession
from app.modules.review.models import ReviewSessionItem
from app.modules.review.schemas import ReviewAnswerCreate
from app.modules.review.schemas import ReviewAnswerResponse
from app.modules.review.schemas import ReviewCardResponse
from app.modules.review.schemas import ReviewSessionCreate
from app.modules.review.schemas import ReviewSessionResponse
from app.modules.review.schemas import ReviewSessionSummary
from app.modules.users.service import record_learning_activity
from app.modules.vocabulary.models import VocabularyItem
from app.shared.enums import ReviewResult


class ReviewService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_session(
        self,
        *,
        user_id: UUID,
        data: ReviewSessionCreate,
    ) -> ReviewSessionResponse:
        cards = await self._select_cards(user_id=user_id, data=data)
        now = datetime.now(UTC).replace(microsecond=0)
        review_session = ReviewSession(user_id=user_id, mode=data.mode, status="active", started_at=now)
        self.session.add(review_session)
        await self.session.flush()

        session_items = [
            ReviewSessionItem(
                session_id=review_session.id,
                vocabulary_item_id=card.id,
                queue_index=index,
                card_snapshot=_snapshot_card(card),
                mastery_at_start=card.mastery,
            )
            for index, card in enumerate(cards)
        ]
        self.session.add_all(session_items)
        await self.session.flush()
        await self.session.commit()

        return ReviewSessionResponse(
            id=review_session.id,
            mode=ReviewMode(review_session.mode),
            round_number=1,
            total_cards=len(cards),
            cards=[_card_response(card, session_item.id) for card, session_item in zip(cards, session_items, strict=True)],
            started_at=review_session.started_at,
        )

    async def answer(
        self,
        *,
        session_id: UUID,
        user_id: UUID,
        data: ReviewAnswerCreate,
    ) -> ReviewAnswerResponse:
        existing = await self._get_existing_answer(data.client_answer_id, user_id=user_id)
        if existing is not None:
            return existing

        session_item = await self._get_session_item(
            session_id=session_id,
            vocabulary_id=data.vocabulary_id,
            user_id=user_id,
        )
        if session_item is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review card not found")

        item = session_item.vocabulary_item
        if item is None or item.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vocabulary item not found")

        now = (data.answered_at or datetime.now(UTC)).replace(microsecond=0)
        mastery_before = item.mastery
        xp_awarded = 8 if data.result == ReviewResult.GOOD else 3
        item.review_count += 1
        item.last_reviewed_at = now
        item.last_result = data.result
        if data.result == ReviewResult.GOOD:
            item.mastery = min(5, item.mastery + 1)
            item.next_review_at = _next_due_at(now, item.mastery)
        else:
            item.mastery = max(0, item.mastery - 1)
            item.next_review_at = now + timedelta(minutes=5)

        round_number = await self._next_round_number(session_item.id)
        answer = ReviewAnswer(
            session_item_id=session_item.id,
            client_answer_id=data.client_answer_id,
            result=data.result,
            round_number=round_number,
            mastery_before=mastery_before,
            mastery_after=item.mastery,
            xp_earned=xp_awarded,
            answered_at=now,
        )
        self.session.add(answer)
        await record_learning_activity(
            self.session,
            user_id=user_id,
            xp=xp_awarded,
            review_answers=1,
        )
        await self.session.flush()
        await self.session.commit()
        return ReviewAnswerResponse(
            id=answer.id,
            vocabulary_id=item.id,
            result=ReviewResult(answer.result),
            mastery=item.mastery,
            review_count=item.review_count,
            next_review_at=item.next_review_at,
            xp_awarded=xp_awarded,
        )

    async def finish_session(
        self,
        *,
        session_id: UUID,
        user_id: UUID,
    ) -> ReviewSessionSummary:
        review_session = await self._get_session(session_id=session_id, user_id=user_id)
        if review_session is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review session not found")

        now = datetime.now(UTC).replace(microsecond=0)
        review_session.status = "completed"
        review_session.completed_at = now
        summary = await self._session_summary(review_session, finished_at=now)
        await self.session.commit()
        return summary

    async def _select_cards(self, *, user_id: UUID, data: ReviewSessionCreate) -> list[VocabularyItem]:
        statement = select(VocabularyItem).where(VocabularyItem.user_id == user_id)
        if data.mode == ReviewMode.CUSTOM:
            if not data.vocabulary_ids:
                return []
            statement = statement.where(VocabularyItem.id.in_(data.vocabulary_ids))
        elif data.vocabulary_ids:
            statement = statement.where(VocabularyItem.id.in_(data.vocabulary_ids))
        elif data.mode == ReviewMode.DUE:
            statement = statement.where(VocabularyItem.next_review_at <= datetime.now(UTC))
        statement = statement.order_by(
            VocabularyItem.next_review_at.asc().nullsfirst(),
            VocabularyItem.created_at.asc(),
        ).limit(data.limit)
        result = await self.session.execute(statement)
        return list(result.scalars())

    async def _get_session(self, *, session_id: UUID, user_id: UUID) -> ReviewSession | None:
        result = await self.session.execute(
            select(ReviewSession).where(
                ReviewSession.id == session_id,
                ReviewSession.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def _get_session_item(
        self,
        *,
        session_id: UUID,
        vocabulary_id: UUID,
        user_id: UUID,
    ) -> ReviewSessionItem | None:
        result = await self.session.execute(
            select(ReviewSessionItem)
            .options(selectinload(ReviewSessionItem.vocabulary_item))
            .join(ReviewSession, ReviewSession.id == ReviewSessionItem.session_id)
            .where(
                ReviewSession.id == session_id,
                ReviewSession.user_id == user_id,
                ReviewSessionItem.vocabulary_item_id == vocabulary_id,
            )
        )
        return result.scalar_one_or_none()

    async def _get_existing_answer(
        self,
        client_answer_id: UUID,
        *,
        user_id: UUID,
    ) -> ReviewAnswerResponse | None:
        result = await self.session.execute(
            select(ReviewAnswer, VocabularyItem)
            .join(ReviewSessionItem, ReviewSessionItem.id == ReviewAnswer.session_item_id)
            .join(ReviewSession, ReviewSession.id == ReviewSessionItem.session_id)
            .join(VocabularyItem, VocabularyItem.id == ReviewSessionItem.vocabulary_item_id)
            .where(
                ReviewAnswer.client_answer_id == client_answer_id,
                ReviewSession.user_id == user_id,
            )
        )
        row = result.one_or_none()
        if row is None:
            return None
        answer, item = row
        return ReviewAnswerResponse(
            id=answer.id,
            vocabulary_id=item.id,
            result=ReviewResult(answer.result),
            mastery=item.mastery,
            review_count=item.review_count,
            next_review_at=item.next_review_at,
            xp_awarded=answer.xp_earned,
        )

    async def _next_round_number(self, session_item_id: UUID) -> int:
        result = await self.session.execute(
            select(func.coalesce(func.max(ReviewAnswer.round_number), 0)).where(
                ReviewAnswer.session_item_id == session_item_id
            )
        )
        return int(result.scalar_one()) + 1

    async def _session_summary(self, review_session: ReviewSession, *, finished_at: datetime) -> ReviewSessionSummary:
        result = await self.session.execute(
            select(
                func.count(ReviewAnswer.id),
                func.count().filter(ReviewAnswer.result == ReviewResult.GOOD),
                func.count().filter(ReviewAnswer.result == ReviewResult.AGAIN),
                func.coalesce(func.sum(ReviewAnswer.xp_earned), 0),
            )
            .join(ReviewSessionItem, ReviewSessionItem.id == ReviewAnswer.session_item_id)
            .where(ReviewSessionItem.session_id == review_session.id)
        )
        cards_reviewed, good_count, again_count, xp_awarded = result.one()
        return ReviewSessionSummary(
            session_id=review_session.id,
            mode=ReviewMode(review_session.mode),
            round_number=1,
            cards_reviewed=int(cards_reviewed or 0),
            good_count=int(good_count or 0),
            again_count=int(again_count or 0),
            xp_awarded=int(xp_awarded or 0),
            finished_at=finished_at,
        )


def _snapshot_card(item: VocabularyItem) -> dict[str, object]:
    return {
        "word": item.word,
        "translation": item.translation,
        "sentence": item.source_context or "",
        "sentenceTranslation": item.sentence_translation or "",
        "phonetic": item.phonetic or "",
        "icon": item.icon_name or item.icon_url,
    }


def _card_response(item: VocabularyItem, review_card_id: UUID) -> ReviewCardResponse:
    return ReviewCardResponse(
        id=review_card_id,
        vocabulary_id=item.id,
        word=item.word,
        translation=item.translation,
        sentence=item.source_context or "",
        sentence_translation=item.sentence_translation or "",
        phonetic=item.phonetic or "",
        icon=item.icon_name or item.icon_url,
        mastery=item.mastery,
        review_count=item.review_count,
    )


def _next_due_at(now: datetime, mastery: int) -> datetime:
    minutes = [0, 24 * 60, 2 * 24 * 60, 5 * 24 * 60, 12 * 24 * 60, 30 * 24 * 60][mastery]
    return now if minutes == 0 else now + timedelta(minutes=minutes)


__all__ = ["ReviewService"]
