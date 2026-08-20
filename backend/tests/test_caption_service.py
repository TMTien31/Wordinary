from __future__ import annotations

from app.modules.captions import service


def test_runtime_detail_summarizes_youtube_bot_check(monkeypatch) -> None:
    monkeypatch.setattr(
        service,
        "yt_dlp_cookie_status",
        lambda: {
            "configured": True,
            "path": "/run/wordinary/youtube-cookies/cookies.txt",
            "exists": True,
            "readable": True,
            "writable": True,
            "size_bytes": 200,
        },
    )

    detail = service._runtime_detail(
        RuntimeError(
            "yt-dlp failed to fetch video metadata: ERROR: [youtube] abc: "
            "Sign in to confirm you're not a bot. Use --cookies-from-browser or --cookies"
        )
    )

    assert detail == (
        "YouTube rejected the cookies currently mounted in the server. "
        "Export a fresh YouTube cookies.txt from the browser session that can play this video, "
        "replace youtube-cookies/cookies.txt, then restart the API."
    )
