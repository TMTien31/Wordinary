from __future__ import annotations

import html
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections.abc import Iterable
from typing import Any


ALLOWED_YOUTUBE_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
    "www.youtu.be",
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
}
MAX_URL_LENGTH = 2_048
MAX_SUBTITLE_BYTES = 12 * 1024 * 1024
MAX_CAPTION_CUES = 8_000
LANGUAGE_RE = re.compile(r"^[A-Za-z0-9-]{2,20}$")


def clean_text(value: str) -> str:
    value = re.sub(r"<br\s*/?>", " ", value or "", flags=re.I)
    value = re.sub(r"<[^>]+>", "", value)
    value = html.unescape(value)
    return re.sub(r"\s+", " ", value).strip()


def parse_time(value: str) -> float:
    token = value.strip().replace(",", ".")
    token = re.sub(r"[^0-9:.+-].*$", "", token)
    parts = token.split(":")
    try:
        nums = [float(part) for part in parts]
    except ValueError:
        return 0.0
    if len(nums) == 3:
        return nums[0] * 3600 + nums[1] * 60 + nums[2]
    if len(nums) == 2:
        return nums[0] * 60 + nums[1]
    return nums[0] if nums else 0.0


def normalize_cues(cues: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    cleaned: list[dict[str, Any]] = []
    for item in cues:
        cue = _caption(
            float(item.get("start", 0) or 0),
            float(item.get("end", 0) or 0),
            str(item.get("text", "")),
        )
        if cue:
            cleaned.append(cue)

    cleaned.sort(key=lambda item: (item["start"], item["end"]))
    result: list[dict[str, Any]] = []
    for cue in cleaned:
        if result:
            previous = result[-1]
            same_text = cue["text"].casefold() == previous["text"].casefold()
            nearly_same_start = abs(cue["start"] - previous["start"]) < 0.12
            if same_text and nearly_same_start:
                previous["end"] = max(previous["end"], cue["end"])
                continue
        result.append(cue)
        if len(result) >= MAX_CAPTION_CUES:
            break
    return result


def parse_vtt_or_srt(raw: str) -> list[dict[str, Any]]:
    raw = raw.replace("\ufeff", "").replace("\r", "")
    raw = re.sub(r"^WEBVTT[^\n]*\n+", "", raw, flags=re.I)
    cues: list[dict[str, Any]] = []
    for block in re.split(r"\n{2,}", raw.strip()):
        lines = [line.strip() for line in block.split("\n") if line.strip()]
        timing_index = next((i for i, line in enumerate(lines) if "-->" in line), -1)
        if timing_index < 0:
            continue
        match = re.search(r"([^\s]+)\s*-->\s*([^\s]+)", lines[timing_index])
        if not match:
            continue
        cue = _caption(
            parse_time(match.group(1)),
            parse_time(match.group(2)),
            " ".join(lines[timing_index + 1 :]),
        )
        if cue:
            cues.append(cue)
    return normalize_cues(cues)


def parse_json3(raw: str) -> list[dict[str, Any]]:
    data = json.loads(raw)
    cues: list[dict[str, Any]] = []
    for event in data.get("events", []):
        start = float(event.get("tStartMs", 0) or 0) / 1000
        duration = float(event.get("dDurationMs", 0) or 0) / 1000
        text = "".join(segment.get("utf8", "") for segment in event.get("segs", []))
        cue = _caption(start, start + max(duration, 0.15), text)
        if cue:
            cues.append(cue)
    return normalize_cues(cues)


def parse_ttml_or_srv3(raw: str) -> list[dict[str, Any]]:
    root = ET.fromstring(raw)
    cues: list[dict[str, Any]] = []
    for node in root.iter():
        tag = node.tag.rsplit("}", 1)[-1].lower()
        if tag not in {"p", "text"}:
            continue

        begin = node.attrib.get("begin")
        end = node.attrib.get("end")
        duration = node.attrib.get("dur")
        if begin is not None:
            start = parse_time(begin)
            finish = parse_time(end) if end is not None else start + parse_time(duration or "0")
        else:
            try:
                start = float(node.attrib.get("t", 0) or 0) / 1000
                finish = start + float(node.attrib.get("d", 0) or 0) / 1000
            except ValueError:
                continue

        cue = _caption(start, finish, "".join(node.itertext()))
        if cue:
            cues.append(cue)
    return normalize_cues(cues)


def choose_language(tracks: dict[str, Any], requested: str) -> str | None:
    if not tracks:
        return None
    requested = requested.strip()
    requested_lower = requested.casefold()
    exact_candidates = (requested, f"{requested}-orig", f"{requested}-US", f"{requested}-GB")
    for candidate in exact_candidates:
        if candidate in tracks:
            return candidate

    for key in tracks:
        if key.casefold() == requested_lower or key.casefold().startswith(requested_lower + "-"):
            return key
    return None


def choose_format(formats: list[dict[str, Any]]) -> dict[str, Any] | None:
    preference = {"json3": 0, "vtt": 1, "srt": 2, "srv3": 3, "ttml": 4}
    useful = [item for item in formats if item.get("url") and item.get("ext") in preference]
    useful.sort(key=lambda item: preference[item.get("ext", "")])
    return useful[0] if useful else None


def validate_youtube_url(url: str) -> str:
    url = (url or "").strip()
    if not url:
        raise ValueError("Missing YouTube URL")
    if len(url) > MAX_URL_LENGTH:
        raise ValueError("YouTube URL is too long")

    parsed = urllib.parse.urlparse(url)
    hostname = (parsed.hostname or "").lower().rstrip(".")
    if parsed.scheme not in {"http", "https"} or hostname not in ALLOWED_YOUTUBE_HOSTS:
        raise ValueError("Only YouTube URLs are supported")
    return url


def yt_dlp_version() -> str:
    yt_dlp = import_yt_dlp()
    return str(getattr(getattr(yt_dlp, "version", None), "__version__", "installed"))


def get_video_metadata(url: str) -> dict[str, Any]:
    url = validate_youtube_url(url)
    info = extract_video_info(url)
    return basic_metadata(info, url)


def get_captions(url: str, language: str) -> dict[str, Any]:
    url = validate_youtube_url(url)
    language = (language or "en").strip()
    if not LANGUAGE_RE.fullmatch(language):
        raise ValueError("Invalid caption language code")

    info = extract_video_info(url)
    manual = info.get("subtitles") or {}
    automatic = info.get("automatic_captions") or {}

    source = "manual"
    tracks = manual
    selected_language = choose_language(tracks, language)
    if not selected_language:
        source = "automatic"
        tracks = automatic
        selected_language = choose_language(tracks, language)
    if not selected_language:
        raise LookupError(f"No '{language}' captions were found for this video")

    selected = choose_format(tracks.get(selected_language) or [])
    if not selected:
        raise RuntimeError("A caption track exists, but no supported subtitle format was available")

    raw = download_subtitle_track(selected)
    ext = str(selected.get("ext", "")).lower()
    if ext == "json3":
        cues = parse_json3(raw)
    elif ext in {"ttml", "srv3"}:
        cues = parse_ttml_or_srv3(raw)
    else:
        cues = parse_vtt_or_srt(raw)

    if not cues:
        raise RuntimeError(f"Downloaded subtitle track ({ext}) did not contain readable cues")

    return {
        **basic_metadata(info, url),
        "language": selected_language,
        "source": source,
        "format": ext,
        "caption_count": len(cues),
        "captions": cues,
    }


def _caption(start: float, end: float, text: str) -> dict[str, Any] | None:
    text = clean_text(text)
    start = max(0.0, float(start or 0.0))
    end = float(end or 0.0)
    if not text:
        return None
    if end <= start:
        end = start + 0.15
    return {"start": round(start, 3), "end": round(end, 3), "text": text}


def import_yt_dlp() -> Any:
    try:
        import yt_dlp  # type: ignore
    except ImportError as exc:
        raise RuntimeError("yt-dlp is not installed in the backend container") from exc
    return yt_dlp


def yt_dlp_options() -> dict[str, Any]:
    options: dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
        "socket_timeout": 25,
        "cachedir": False,
        "extract_flat": False,
        "http_headers": {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/126.0 Safari/537.36"
            )
        },
    }
    cookies_file = os.getenv("WORDINARY_COOKIES_FILE", "").strip()
    if cookies_file:
        options["cookiefile"] = cookies_file
    return options


def extract_video_info(url: str) -> dict[str, Any]:
    yt_dlp = import_yt_dlp()
    with yt_dlp.YoutubeDL(yt_dlp_options()) as ydl:
        info = ydl.extract_info(url, download=False)
    if not isinstance(info, dict):
        raise RuntimeError("yt-dlp did not return valid metadata")
    return info


def download_subtitle_track(track: dict[str, Any]) -> str:
    headers = {
        "User-Agent": "Mozilla/5.0 WordinaryBackend/1.0",
        **(track.get("http_headers") or {}),
    }
    request = urllib.request.Request(track["url"], headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            declared_length = response.headers.get("Content-Length")
            if declared_length and int(declared_length) > MAX_SUBTITLE_BYTES:
                raise RuntimeError("Subtitle track is too large")
            body = response.read(MAX_SUBTITLE_BYTES + 1)
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"YouTube rejected the subtitle track (HTTP {exc.code})") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError("Could not connect to the YouTube subtitle track") from exc

    if len(body) > MAX_SUBTITLE_BYTES:
        raise RuntimeError("Subtitle track exceeded the size limit")
    return body.decode("utf-8", errors="replace")


def basic_metadata(info: dict[str, Any], original_url: str) -> dict[str, Any]:
    return {
        "id": info.get("id"),
        "title": info.get("title") or "YouTube video",
        "duration": info.get("duration"),
        "channel": info.get("channel") or info.get("uploader"),
        "channel_id": info.get("channel_id") or info.get("uploader_id"),
        "thumbnail": info.get("thumbnail"),
        "webpage_url": info.get("webpage_url") or original_url,
        "embeddable": info.get("playable_in_embed"),
        "availability": info.get("availability"),
        "live_status": info.get("live_status"),
    }


__all__ = ["get_captions", "get_video_metadata", "yt_dlp_version"]
