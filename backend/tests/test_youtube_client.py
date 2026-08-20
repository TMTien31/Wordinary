from __future__ import annotations

from typing import Any

from app.integrations.youtube import client


class _FakeResponse:
    headers = {"Content-Length": "11"}

    def __init__(self) -> None:
        self.closed = False

    def read(self, size: int) -> bytes:
        assert size == client.MAX_SUBTITLE_BYTES + 1
        return b"hello world"

    def close(self) -> None:
        self.closed = True


class _FakeYDL:
    def __init__(self, options: dict[str, Any]) -> None:
        self.options = options
        self.request = None
        self.response = _FakeResponse()

    def __enter__(self) -> "_FakeYDL":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def urlopen(self, request):
        self.request = request
        return self.response


def test_download_subtitle_track_uses_yt_dlp_urlopen(monkeypatch) -> None:
    created: list[_FakeYDL] = []

    class FakeYtDlp:
        @staticmethod
        def YoutubeDL(options: dict[str, Any]) -> _FakeYDL:
            ydl = _FakeYDL(options)
            created.append(ydl)
            return ydl

    monkeypatch.setattr(client, "import_yt_dlp", lambda: FakeYtDlp)

    raw = client.download_subtitle_track(
        {
            "url": "https://example.com/subtitles.vtt",
            "http_headers": {"User-Agent": "TrackAgent", "X-Test": "1"},
        }
    )

    assert raw == "hello world"
    assert len(created) == 1
    assert created[0].options["source_address"] == "0.0.0.0"
    assert created[0].request.full_url == "https://example.com/subtitles.vtt"
    assert dict(created[0].request.header_items())["User-agent"] == "TrackAgent"
    assert dict(created[0].request.header_items())["X-test"] == "1"
    assert created[0].response.closed is True
