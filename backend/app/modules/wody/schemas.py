from __future__ import annotations

from typing import Literal

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


__all__ = ["WodyChatRequest", "WodyChatResponse", "WodyMessage"]
