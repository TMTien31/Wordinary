from __future__ import annotations

from uuid import UUID

from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.models import LearningProfile
from app.modules.users.models import User
from app.modules.users.models import UserSettings


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, user_id: UUID) -> User | None:
        return await self.session.get(User, user_id)

    async def get_by_email(self, email: str) -> User | None:
        statement = select(User).where(func.lower(User.email) == email.lower())
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    def add(self, user: User) -> None:
        self.session.add(user)

    def add_default_owned_rows(self, user: User) -> None:
        self.session.add(UserSettings(user=user))
        self.session.add(LearningProfile(user=user))


__all__ = ["UserRepository"]
