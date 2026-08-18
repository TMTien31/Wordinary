from __future__ import annotations

from typing import Protocol


class FileStorage(Protocol):
    async def save(self, *, key: str, content: bytes, content_type: str) -> None:
        ...

    async def read(self, key: str) -> bytes:
        ...

    async def exists(self, key: str) -> bool:
        ...

    async def delete(self, key: str) -> None:
        ...

    async def create_download_url(self, *, key: str, expires_in: int) -> str:
        ...
