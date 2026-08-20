from __future__ import annotations

from app.modules.captions import service


def test_runtime_detail_summarizes_youtube_bot_check() -> None:
    detail = service._runtime_detail(
        RuntimeError(
            "yt-dlp failed to fetch video metadata: ERROR: [youtube] abc: "
            "Sign in to confirm you're not a bot. Use --cookies-from-browser or --cookies"
        )
    )

    assert detail == (
        "YouTube is asking this server to prove it is not a bot. "
        "Export YouTube cookies to youtube-cookies/cookies.txt on the server, then redeploy/restart."
    )
