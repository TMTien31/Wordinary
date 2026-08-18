from __future__ import annotations

from fastapi import APIRouter

from app.api.dependencies import CurrentUser
from app.modules.captions.schemas import CaptionTrackResponse
from app.modules.captions.schemas import VideoInfoResponse
from app.modules.captions.service import CaptionService

router = APIRouter()


@router.get("/health")
async def caption_health() -> dict[str, object]:
    return await CaptionService().healthcheck()


@router.get("/video-info", response_model=VideoInfoResponse)
async def fetch_video_info(
    current_user: CurrentUser,
    url: str,
) -> VideoInfoResponse:
    _ = current_user
    return await CaptionService().fetch_video_info(url=url)


@router.get("/fetch", response_model=CaptionTrackResponse)
async def fetch_captions(
    current_user: CurrentUser,
    url: str,
    lang: str = "en",
) -> CaptionTrackResponse:
    _ = current_user
    return await CaptionService().fetch_captions(url=url, language=lang)
