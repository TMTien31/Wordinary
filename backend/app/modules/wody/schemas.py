from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import Field

from app.shared.schemas import APIModel


class WodyMessage(APIModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class WodyChatRequest(APIModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[WodyMessage] = Field(default_factory=list, max_length=12)


class WodyChatResponse(APIModel):
    reply: str
    tools_used: list[str] = Field(default_factory=list)
    pending_actions: list["WodyPendingAction"] = Field(default_factory=list)


class WodyPendingAction(APIModel):
    type: Literal["delete_vocabulary_item", "delete_library_item"]
    target_id: UUID
    label: str = Field(min_length=1, max_length=300)
    item_type: str = Field(default="", max_length=30)


class WodyExecuteActionRequest(APIModel):
    action: WodyPendingAction


class WodyExecuteActionResponse(APIModel):
    ok: bool
    message: str


__all__ = [
    "WodyChatRequest",
    "WodyChatResponse",
    "WodyExecuteActionRequest",
    "WodyExecuteActionResponse",
    "WodyMessage",
    "WodyPendingAction",
]
