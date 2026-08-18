from __future__ import annotations

import json

from fastapi import HTTPException
from starlette import status
from starlette.concurrency import run_in_threadpool

from app.integrations.youtube.client import get_captions
from app.integrations.youtube.client import get_video_metadata
from app.integrations.youtube.client import yt_dlp_version
from app.modules.captions.schemas import CaptionTrackResponse
from app.modules.captions.schemas import VideoInfoResponse


class CaptionService:
    async def healthcheck(self) -> dict[str, object]:
        try:
            version = await run_in_threadpool(yt_dlp_version)
        except RuntimeError as exc:
            return {"ok": False, "yt_dlp": None, "error": str(exc)}
        return {"ok": True, "yt_dlp": version}

    async def fetch_video_info(self, *, url: str) -> VideoInfoResponse:
        try:
            data = await run_in_threadpool(get_video_metadata, url)
        except ValueError as exc:
            raise _http_error(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
        except RuntimeError as exc:
            raise _http_error(_runtime_status(exc), str(exc)) from exc
        return VideoInfoResponse(**data)

    async def fetch_captions(self, *, url: str, language: str = "en") -> CaptionTrackResponse:
        try:
            data = await run_in_threadpool(get_captions, url, language)
        except ValueError as exc:
            raise _http_error(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
        except LookupError as exc:
            raise _http_error(status.HTTP_404_NOT_FOUND, str(exc)) from exc
        except (json.JSONDecodeError, RuntimeError) as exc:
            raise _http_error(_runtime_status(exc), str(exc)) from exc
        return CaptionTrackResponse(video_id=data.pop("id", None), **data)


def _runtime_status(exc: Exception) -> int:
    return (
        status.HTTP_503_SERVICE_UNAVAILABLE
        if "yt-dlp" in str(exc).casefold()
        else status.HTTP_502_BAD_GATEWAY
    )


def _http_error(status_code: int, detail: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail=detail)


__all__ = ["CaptionService"]
