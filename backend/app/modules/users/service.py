from __future__ import annotations

from datetime import UTC
from datetime import date
from datetime import datetime
from datetime import timedelta
from uuid import UUID
from zoneinfo import ZoneInfo
from zoneinfo import ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.models import DailyActivity
from app.modules.users.models import LearningProfile
from app.modules.users.schemas import LearningProfileResponse


async def get_learning_profile_response(
    session: AsyncSession,
    *,
    user_id: UUID,
) -> LearningProfileResponse:
    profile = await _get_or_create_profile(session, user_id=user_id)
    today = _today(profile.timezone)
    daily = await _get_daily_activity(session, user_id=user_id, activity_date=today)
    return _profile_response(profile, daily)


async def record_learning_activity(
    session: AsyncSession,
    *,
    user_id: UUID,
    xp: int,
    activity_count: int = 1,
    review_answers: int = 0,
    saved_vocabulary: int = 0,
) -> LearningProfileResponse:
    profile = await _get_or_create_profile(session, user_id=user_id)
    today = _today(profile.timezone)
    daily = await _get_or_create_daily_activity(session, user_id=user_id, activity_date=today)

    xp = max(0, int(xp))
    activity_count = max(0, int(activity_count))
    profile.xp = (profile.xp or 0) + xp
    daily.xp_earned = (daily.xp_earned or 0) + xp
    daily.activity_count = (daily.activity_count or 0) + activity_count
    daily.review_answers_count = (daily.review_answers_count or 0) + max(0, int(review_answers))
    daily.saved_vocabulary_count = (daily.saved_vocabulary_count or 0) + max(0, int(saved_vocabulary))
    _update_streak(profile, today, activity_count=activity_count)
    await session.flush()
    return _profile_response(profile, daily)


async def _get_or_create_profile(session: AsyncSession, *, user_id: UUID) -> LearningProfile:
    profile = await session.get(LearningProfile, user_id)
    if profile is None:
        profile = LearningProfile(
            user_id=user_id,
            native_language="vi",
            target_language="en",
            xp=0,
            current_streak=0,
            longest_streak=0,
            daily_goal=8,
            timezone="Asia/Ho_Chi_Minh",
        )
        session.add(profile)
        await session.flush()
    return profile


async def _get_daily_activity(
    session: AsyncSession,
    *,
    user_id: UUID,
    activity_date: date,
) -> DailyActivity | None:
    result = await session.execute(
        select(DailyActivity).where(
            DailyActivity.user_id == user_id,
            DailyActivity.activity_date == activity_date,
        )
    )
    return result.scalar_one_or_none()


async def _get_or_create_daily_activity(
    session: AsyncSession,
    *,
    user_id: UUID,
    activity_date: date,
) -> DailyActivity:
    daily = await _get_daily_activity(session, user_id=user_id, activity_date=activity_date)
    if daily is None:
        daily = DailyActivity(
            user_id=user_id,
            activity_date=activity_date,
            activity_count=0,
            xp_earned=0,
            review_answers_count=0,
            saved_vocabulary_count=0,
            completed_items_count=0,
            reading_seconds=0,
            video_seconds=0,
        )
        session.add(daily)
        await session.flush()
    return daily


def _update_streak(profile: LearningProfile, today: date, *, activity_count: int) -> None:
    if activity_count <= 0:
        return
    previous = profile.last_activity_date
    if previous == today:
        return
    if previous == today - timedelta(days=1):
        profile.current_streak = (profile.current_streak or 0) + 1
    else:
        profile.current_streak = 1
    profile.longest_streak = max(profile.longest_streak or 0, profile.current_streak)
    profile.last_activity_date = today


def _today(timezone_name: str) -> date:
    try:
        timezone = ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        timezone = UTC
    return datetime.now(timezone).date()


def _profile_response(profile: LearningProfile, daily: DailyActivity | None) -> LearningProfileResponse:
    return LearningProfileResponse(
        native_language=profile.native_language,
        target_language=profile.target_language,
        daily_goal=profile.daily_goal,
        xp=profile.xp,
        streak=profile.current_streak,
        longest_streak=profile.longest_streak,
        daily_activity=daily.activity_count if daily else 0,
        daily_xp=daily.xp_earned if daily else 0,
        last_activity_date=profile.last_activity_date,
    )


__all__ = ["get_learning_profile_response", "record_learning_activity"]
