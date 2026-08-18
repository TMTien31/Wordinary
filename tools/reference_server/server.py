#!/usr/bin/env python3
"""Wordinary v7 local web server + YouTube caption bridge.

This server has two responsibilities:

1. Serve the Wordinary frontend over HTTP so YouTube receives a normal
   localhost origin/referrer instead of a ``file://`` page.
2. Fetch YouTube metadata and subtitle tracks through yt-dlp without
   downloading video files.

The app's mock Library, Vocabulary, Practice progress, and preferences still
live in the browser. This file intentionally does not add PostgreSQL, MongoDB,
or user-account storage yet.

Install the only optional dependency with:

    uv pip install -r tools/reference_server/requirements.txt

Then run:

    python tools/reference_server/server.py
"""
from __future__ import annotations

import argparse
import html
import json
import mimetypes
import os
import re
import threading
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Iterable

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8787
ROOT = Path(__file__).resolve().parents[2]
DEFAULT_APP_CANDIDATES = (
    "frontend/index.html",
    "wordinary_v7_unified_library_practice.html",
    "wordinary_v6_4_complete_bilingual.html",
    "wordinary_v6_3_settings_collapsible_sidebars.html",
    "wordinary_mock_v6_2_embed_fallback.html",
    "wordinary_mock_v6_2_embed_fallback(1).html",
)
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


@dataclass(frozen=True)
class ServerConfig:
    host: str
    port: int
    app_file: Path
    open_browser: bool


def clean_text(value: str) -> str:
    """Remove subtitle markup while preserving readable text."""
    value = re.sub(r"<br\s*/?>", " ", value or "", flags=re.I)
    value = re.sub(r"<[^>]+>", "", value)
    value = html.unescape(value)
    return re.sub(r"\s+", " ", value).strip()


def parse_time(value: str) -> float:
    """Parse SRT/VTT clock values into seconds."""
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


def _caption(start: float, end: float, text: str) -> dict[str, Any] | None:
    text = clean_text(text)
    start = max(0.0, float(start or 0.0))
    end = float(end or 0.0)
    if not text:
        return None
    if end <= start:
        end = start + 0.15
    return {
        "start": round(start, 3),
        "end": round(end, 3),
        "text": text,
    }


def normalize_cues(cues: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    """Sort, validate, and lightly deduplicate caption cues."""
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


def _xml_text(node: ET.Element) -> str:
    return "".join(node.itertext())


def parse_ttml_or_srv3(raw: str) -> list[dict[str, Any]]:
    """Parse common TTML and YouTube srv3 XML subtitle formats."""
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
            # YouTube srv3 commonly stores integer milliseconds in t/d.
            try:
                start = float(node.attrib.get("t", 0) or 0) / 1000
                finish = start + float(node.attrib.get("d", 0) or 0) / 1000
            except ValueError:
                continue

        cue = _caption(start, finish, _xml_text(node))
        if cue:
            cues.append(cue)
    return normalize_cues(cues)


def choose_language(tracks: dict[str, Any], requested: str) -> str | None:
    if not tracks:
        return None
    requested = requested.strip()
    requested_lower = requested.casefold()
    exact_candidates = (
        requested,
        f"{requested}-orig",
        f"{requested}-US",
        f"{requested}-GB",
    )
    for candidate in exact_candidates:
        if candidate in tracks:
            return candidate

    for key in tracks:
        if key.casefold() == requested_lower or key.casefold().startswith(requested_lower + "-"):
            return key
    return None


def choose_format(formats: list[dict[str, Any]]) -> dict[str, Any] | None:
    preference = {
        "json3": 0,
        "vtt": 1,
        "srt": 2,
        "srv3": 3,
        "ttml": 4,
    }
    useful = [item for item in formats if item.get("url") and item.get("ext") in preference]
    useful.sort(key=lambda item: preference[item.get("ext", "")])
    return useful[0] if useful else None


def validate_youtube_url(url: str) -> str:
    url = (url or "").strip()
    if not url:
        raise ValueError("Thiếu URL YouTube.")
    if len(url) > MAX_URL_LENGTH:
        raise ValueError("URL quá dài.")

    parsed = urllib.parse.urlparse(url)
    hostname = (parsed.hostname or "").lower().rstrip(".")
    if parsed.scheme not in {"http", "https"} or hostname not in ALLOWED_YOUTUBE_HOSTS:
        raise ValueError("Companion server chỉ chấp nhận URL YouTube.")
    return url


def import_yt_dlp() -> Any:
    try:
        import yt_dlp  # type: ignore
    except ImportError as exc:
        raise RuntimeError("Chua cai yt-dlp. Chay: uv pip install -r tools/reference_server/requirements.txt") from exc
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
        raise RuntimeError("yt-dlp không trả về metadata hợp lệ.")
    return info


def download_subtitle_track(track: dict[str, Any]) -> str:
    headers = {
        "User-Agent": "Mozilla/5.0 WordinaryCaptionBridge/2.0",
        **(track.get("http_headers") or {}),
    }
    request = urllib.request.Request(track["url"], headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            declared_length = response.headers.get("Content-Length")
            if declared_length and int(declared_length) > MAX_SUBTITLE_BYTES:
                raise RuntimeError("Subtitle track quá lớn.")
            body = response.read(MAX_SUBTITLE_BYTES + 1)
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"YouTube từ chối subtitle track (HTTP {exc.code}).") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError("Không kết nối được đến subtitle track của YouTube.") from exc

    if len(body) > MAX_SUBTITLE_BYTES:
        raise RuntimeError("Subtitle track vượt quá giới hạn dung lượng.")
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


def get_video_metadata(url: str) -> dict[str, Any]:
    url = validate_youtube_url(url)
    info = extract_video_info(url)
    return basic_metadata(info, url)


def get_captions(url: str, language: str) -> dict[str, Any]:
    url = validate_youtube_url(url)
    language = (language or "en").strip()
    if not LANGUAGE_RE.fullmatch(language):
        raise ValueError("Mã ngôn ngữ caption không hợp lệ.")

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
        raise LookupError(f"Không tìm thấy caption '{language}' cho video này.")

    selected = choose_format(tracks.get(selected_language) or [])
    if not selected:
        raise RuntimeError("Có subtitle track nhưng không có định dạng Wordinary hỗ trợ.")

    raw = download_subtitle_track(selected)
    ext = str(selected.get("ext", "")).lower()
    if ext == "json3":
        cues = parse_json3(raw)
    elif ext in {"ttml", "srv3"}:
        cues = parse_ttml_or_srv3(raw)
    else:
        cues = parse_vtt_or_srt(raw)

    if not cues:
        raise RuntimeError(f"Đã tải subtitle ({ext}) nhưng không tách được cue.")

    return {
        **basic_metadata(info, url),
        "language": selected_language,
        "source": source,
        "format": ext,
        "caption_count": len(cues),
        "captions": cues,
    }


def resolve_app_file(value: str | None) -> Path:
    requested = (value or os.getenv("WORDINARY_APP_FILE", "")).strip()
    if requested:
        candidate = Path(requested)
        if not candidate.is_absolute():
            candidate = ROOT / candidate
        candidate = candidate.resolve()
        try:
            candidate.relative_to(ROOT)
        except ValueError as exc:
            raise ValueError("File giao diện phải nằm cùng thư mục hoặc bên trong thư mục server.") from exc
        if not candidate.is_file():
            raise FileNotFoundError(f"Không tìm thấy frontend: {candidate.name}")
        return candidate

    for name in DEFAULT_APP_CANDIDATES:
        candidate = ROOT / name
        if candidate.is_file():
            return candidate.resolve()

    html_files = sorted(ROOT.glob("*.html"), key=lambda item: item.stat().st_mtime, reverse=True)
    if html_files:
        return html_files[0].resolve()

    raise FileNotFoundError(
        "Không tìm thấy file HTML Wordinary trong cùng thư mục với server."
    )


class WordinaryHTTPServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = False

    def __init__(self, address: tuple[str, int], handler: type[BaseHTTPRequestHandler], app_file: Path):
        super().__init__(address, handler)
        self.app_file = app_file
        self.static_root = app_file.parent


class Handler(BaseHTTPRequestHandler):
    server_version = "WordinaryLocal/2.0"

    @property
    def app_file(self) -> Path:
        return self.server.app_file  # type: ignore[attr-defined]

    @property
    def static_root(self) -> Path:
        return self.server.static_root  # type: ignore[attr-defined]

    def _common_headers(self) -> None:
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin-allow-popups")

    def _cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept")
        self.send_header("Access-Control-Max-Age", "600")

    def _send_json(self, status: int, payload: Any, *, head_only: bool = False) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self._cors_headers()
        self._common_headers()
        self.end_headers()
        if not head_only and status != 204:
            self.wfile.write(body)

    def _send_api_error(self, status: int, code: str, message: str) -> None:
        self._send_json(status, {"ok": False, "code": code, "error": message})

    def _resolve_static_path(self, requested_path: str) -> Path | None:
        decoded = urllib.parse.unquote(requested_path)
        if decoded in {
            "",
            "/",
            "/index.html",
            "/frontend",
            "/frontend/",
            "/frontend/index.html",
            "/front_end",
            "/front_end/",
            "/front_end/index.html",
        }:
            return self.app_file

        relative = decoded.lstrip("/")
        for prefix in ("frontend/", "front_end/"):
            if relative.startswith(prefix):
                relative = relative[len(prefix) :]
                break

        candidate = (self.static_root / relative).resolve()
        try:
            candidate.relative_to(self.static_root)
        except ValueError:
            return None
        return candidate

    def _serve_file(self, requested_path: str, *, head_only: bool = False) -> None:
        candidate = self._resolve_static_path(requested_path)
        if candidate is None:
            self._send_api_error(403, "forbidden", "Forbidden")
            return
        if not candidate.is_file():
            self._send_api_error(404, "not_found", "Not found")
            return

        content_type = mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
        if candidate.suffix.lower() == ".html":
            content_type = "text/html; charset=utf-8"
        elif candidate.suffix.lower() in {".js", ".mjs"}:
            content_type = "text/javascript; charset=utf-8"
        elif candidate.suffix.lower() == ".css":
            content_type = "text/css; charset=utf-8"

        size = candidate.stat().st_size
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(size))
        self.send_header("Cache-Control", "no-store" if candidate.suffix.lower() == ".html" else "no-cache")
        self._common_headers()
        self.end_headers()
        if not head_only:
            try:
                with candidate.open("rb") as stream:
                    while chunk := stream.read(128 * 1024):
                        self.wfile.write(chunk)
            except (BrokenPipeError, ConnectionResetError):
                # The browser may cancel a request during navigation/refresh.
                return

    def _health_payload(self) -> tuple[int, dict[str, Any]]:
        if not self.app_file.is_file():
            return 503, {
                "ok": False,
                "server": self.server_version,
                "error": f"Frontend file is missing: {self.app_file}",
                "app": self.app_file.name,
            }

        try:
            yt_dlp = import_yt_dlp()
            version = getattr(getattr(yt_dlp, "version", None), "__version__", "installed")
            caption_bridge = {"ok": True, "yt_dlp": version}
        except RuntimeError as exc:
            caption_bridge = {"ok": False, "error": str(exc)}

        return 200, {
            "ok": True,
            "server": self.server_version,
            "app": self.app_file.name,
            "caption_bridge": caption_bridge,
            "caption_endpoint": "/api/captions",
            "metadata_endpoint": "/api/video-info",
        }

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.send_header("Cache-Control", "no-store")
        self._cors_headers()
        self._common_headers()
        self.end_headers()

    def do_HEAD(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path in {"/health", "/api/status"}:
            status, payload = self._health_payload()
            self._send_json(status, payload, head_only=True)
            return
        self._serve_file(parsed.path, head_only=True)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path in {"/health", "/api/status"}:
            status, payload = self._health_payload()
            self._send_json(status, payload)
            return

        if parsed.path == "/api/video-info":
            params = urllib.parse.parse_qs(parsed.query)
            url = (params.get("url") or [""])[0]
            try:
                self._send_json(200, {"ok": True, **get_video_metadata(url)})
            except ValueError as exc:
                self._send_api_error(400, "invalid_request", str(exc))
            except RuntimeError as exc:
                status = 503 if "yt-dlp" in str(exc).lower() else 502
                self._send_api_error(status, "metadata_failed", str(exc))
            except Exception as exc:  # defensive boundary around yt-dlp extractors
                self._send_api_error(502, "metadata_failed", str(exc))
            return

        if parsed.path == "/api/captions":
            params = urllib.parse.parse_qs(parsed.query)
            url = (params.get("url") or [""])[0]
            language = (params.get("lang") or ["en"])[0]
            try:
                self._send_json(200, {"ok": True, **get_captions(url, language)})
            except ValueError as exc:
                self._send_api_error(400, "invalid_request", str(exc))
            except LookupError as exc:
                self._send_api_error(404, "captions_not_found", str(exc))
            except RuntimeError as exc:
                status = 503 if "yt-dlp" in str(exc).lower() else 502
                self._send_api_error(status, "caption_fetch_failed", str(exc))
            except (json.JSONDecodeError, ET.ParseError) as exc:
                self._send_api_error(502, "caption_parse_failed", f"Subtitle không hợp lệ: {exc}")
            except Exception as exc:  # defensive boundary around yt-dlp/network errors
                self._send_api_error(502, "caption_fetch_failed", str(exc))
            return

        self._serve_file(parsed.path)

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[Wordinary] {self.address_string()} - {fmt % args}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve Wordinary v7 and expose a yt-dlp caption bridge.")
    parser.add_argument("--host", default=os.getenv("WORDINARY_HOST", DEFAULT_HOST))
    parser.add_argument("--port", type=int, default=int(os.getenv("WORDINARY_PORT", DEFAULT_PORT)))
    parser.add_argument(
        "--app",
        default=os.getenv("WORDINARY_APP_FILE", ""),
        help="Frontend HTML filename inside the project directory.",
    )
    parser.add_argument("--no-browser", action="store_true", help="Do not open the browser automatically.")
    return parser.parse_args()


def build_config(args: argparse.Namespace) -> ServerConfig:
    if not 1 <= args.port <= 65_535:
        raise ValueError("Port phải nằm trong khoảng 1–65535.")
    return ServerConfig(
        host=str(args.host),
        port=int(args.port),
        app_file=resolve_app_file(args.app or None),
        open_browser=not bool(args.no_browser),
    )


def main() -> None:
    try:
        config = build_config(parse_args())
    except (ValueError, FileNotFoundError) as exc:
        raise SystemExit(f"[Wordinary] {exc}") from exc

    app_url = f"http://{config.host}:{config.port}/"
    print("=" * 70)
    print(" Wordinary v7 — local frontend + YouTube caption bridge")
    print(f" Frontend : {config.app_file.name}")
    print(f" Open     : {app_url}")
    print(f" Health   : {app_url}health")
    print(" Install  : uv pip install -r tools/reference_server/requirements.txt")
    print(" Note     : video files are never downloaded by this server")
    print(" Stop     : Ctrl+C")
    print("=" * 70 + "\n")

    try:
        server = WordinaryHTTPServer((config.host, config.port), Handler, config.app_file)
    except OSError as exc:
        raise SystemExit(
            f"[Wordinary] Port {config.port} dang ban. "
            "Hay dung server cu bang Ctrl+C hoac kiem tra: netstat -ano | findstr :8787"
        ) from exc
    if config.open_browser:
        threading.Timer(0.8, lambda: webbrowser.open(app_url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Wordinary] Stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
