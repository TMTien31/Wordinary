from __future__ import annotations

import asyncio
import uuid
from types import SimpleNamespace
from urllib.parse import parse_qs
from urllib.parse import urlparse

from app.core.config import settings
from app.modules.auth.security import decode_pdf_download_token
from app.modules.library import selector
from app.shared.enums import ProcessingStatus


def test_pdf_metadata_uses_authenticated_api_download_url() -> None:
    item_id = uuid.uuid4()
    user_id = uuid.uuid4()
    item = SimpleNamespace(
        id=item_id,
        user_id=user_id,
        title="Document",
        processing_status="ready",
    )
    pdf_document = SimpleNamespace(
        page_count=4,
        text_layer_available=True,
        ocr_used=False,
    )
    stored_file = SimpleNamespace(
        original_file_name="document.pdf",
        size_bytes=1234,
        mime_type="application/pdf",
        checksum_sha256="a" * 64,
        deleted_at=None,
    )

    metadata = asyncio.run(
        selector._pdf_metadata(
            item,
            pdf_document,
            stored_file,
            include_download_url=True,
        )
    )

    assert metadata.processing_status == ProcessingStatus.READY
    assert metadata.download_url is not None
    parsed = urlparse(metadata.download_url)
    assert parsed.path == f"{settings.api_v1_prefix}/library/pdfs/{item_id}/file"
    token = parse_qs(parsed.query)["downloadToken"][0]
    assert decode_pdf_download_token(token, item_id=item_id) == user_id
    assert metadata.download_url_expires_at is not None
