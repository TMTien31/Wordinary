from __future__ import annotations

import asyncio
import uuid
from types import SimpleNamespace

from app.core.config import settings
from app.modules.library import selector
from app.shared.enums import ProcessingStatus


def test_pdf_metadata_uses_authenticated_api_download_url() -> None:
    item_id = uuid.uuid4()
    item = SimpleNamespace(id=item_id, title="Document", processing_status="ready")
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
    assert metadata.download_url == f"{settings.api_v1_prefix}/library/pdfs/{item_id}/file"
    assert metadata.download_url_expires_at is None
