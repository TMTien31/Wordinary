from __future__ import annotations

from pydantic import Field, model_validator

from app.shared.enums import CaptionSource
from app.shared.schemas import APIModel
from app.shared.types import LanguageCode, NonNegativeSeconds


class CaptionCue(APIModel):
    start: NonNegativeSeconds
    end: NonNegativeSeconds
    text: str = Field(min_length=1)
    translation: str = ""

    @model_validator(mode="after")
    def validate_timing(self) -> "CaptionCue":
        if self.end <= self.start:
            raise ValueError("Caption end must be greater than start")
        return self


class CaptionFetchRequest(APIModel):
    url: str = Field(min_length=1, max_length=2048)
    language: LanguageCode = "en"
    prefer_manual: bool = True


class CaptionTrackResponse(APIModel):
    video_id: str | None = None
    title: str
    duration: NonNegativeSeconds | None = None
    channel: str | None = None
    channel_id: str | None = None
    thumbnail: str | None = None
    webpage_url: str | None = None
    embeddable: bool | None = None
    availability: str | None = None
    live_status: str | None = None
    language: LanguageCode
    source: CaptionSource
    format: str = Field(max_length=20)
    caption_count: int = Field(ge=0)
    captions: list[CaptionCue]


class VideoInfoResponse(APIModel):
    id: str | None = None
    title: str
    duration: NonNegativeSeconds | None = None
    channel: str | None = None
    channel_id: str | None = None
    thumbnail: str | None = None
    webpage_url: str
    embeddable: bool | None = None
    availability: str | None = None
    live_status: str | None = None
