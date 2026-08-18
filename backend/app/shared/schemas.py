from __future__ import annotations

from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field


def to_camel(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(part[:1].upper() + part[1:] for part in parts[1:])


class APIModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        extra="forbid",
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
    )


T = TypeVar("T")


class Page(APIModel, Generic[T]):
    items: list[T]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=200)


class MessageResponse(APIModel):
    message: str


class ProblemDetail(APIModel):
    type: str = "about:blank"
    title: str
    status: int = Field(ge=100, le=599)
    detail: str | None = None
    code: str | None = None
    errors: list[dict[str, Any]] = Field(default_factory=list)
