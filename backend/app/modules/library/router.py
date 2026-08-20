from __future__ import annotations

from uuid import UUID
from urllib.parse import quote

from fastapi import APIRouter
from fastapi import Depends
from fastapi import File
from fastapi import Form
from fastapi import HTTPException
from fastapi import Query
from fastapi import UploadFile
from fastapi.responses import Response
from fastapi.responses import StreamingResponse
from starlette import status

from app.api.dependencies import CurrentUser
from app.api.dependencies import DbSession
from app.modules.auth.security import decode_pdf_download_token
from app.modules.library.schemas import ArticleContentUpdate
from app.modules.library.schemas import ArticleCreate
from app.modules.library.schemas import ArticleDetailResponse
from app.modules.library.schemas import LibraryItemDetailResponse
from app.modules.library.schemas import LibraryItemSummary
from app.modules.library.schemas import LibraryItemUpdate
from app.modules.library.schemas import LibraryListQuery
from app.modules.library.schemas import PDFDetailResponse
from app.modules.library.schemas import VideoContentUpdate
from app.modules.library.schemas import VideoCreate
from app.modules.library.schemas import VideoDetailResponse
from app.modules.library.service import LibraryService
from app.modules.progress.schemas import LearningProgressResponse
from app.modules.progress.schemas import LearningProgressUpdate
from app.shared.schemas import MessageResponse
from app.shared.schemas import Page

router = APIRouter()


@router.post("/articles", response_model=ArticleDetailResponse, status_code=201)
async def create_article(
    payload: ArticleCreate,
    session: DbSession,
    current_user: CurrentUser,
) -> ArticleDetailResponse:
    return await LibraryService(session).create_article(
        user_id=current_user.id,
        data=payload,
    )


@router.post("/videos", response_model=VideoDetailResponse, status_code=201)
async def create_video(
    payload: VideoCreate,
    session: DbSession,
    current_user: CurrentUser,
) -> VideoDetailResponse:
    return await LibraryService(session).create_video(
        user_id=current_user.id,
        data=payload,
    )


@router.post("/pdfs", response_model=PDFDetailResponse, status_code=201)
async def create_pdf(
    session: DbSession,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    page_count: int = Form(..., alias="pageCount"),
    text_layer_available: bool = Form(default=True, alias="textLayerAvailable"),
) -> PDFDetailResponse:
    file_name = file.filename or "document.pdf"
    if file.content_type != "application/pdf" and not file_name.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Only PDF files are supported",
        )
    content = await file.read()
    return await LibraryService(session).create_pdf(
        user_id=current_user.id,
        file_name=file_name,
        mime_type=file.content_type,
        content=content,
        page_count=page_count,
        title=title,
        text_layer_available=text_layer_available,
    )


@router.get("", response_model=Page[LibraryItemSummary])
async def list_library(
    session: DbSession,
    current_user: CurrentUser,
    query: LibraryListQuery = Depends(),
) -> Page[LibraryItemSummary]:
    return await LibraryService(session).list_library(user_id=current_user.id, query=query)


@router.get("/pdfs/{item_id}/file", response_class=Response)
async def download_pdf_file(
    item_id: UUID,
    session: DbSession,
    download_token: str = Query(..., alias="downloadToken"),
) -> StreamingResponse:
    user_id = decode_pdf_download_token(download_token, item_id=item_id)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired download token",
        )
    download = await LibraryService(session).get_pdf_file(
        item_id=item_id,
        user_id=user_id,
    )
    file_name = quote(download.file_name or "document.pdf")
    headers = {
        "Content-Disposition": f"inline; filename*=UTF-8''{file_name}",
        "Content-Length": str(download.size_bytes),
    }
    return StreamingResponse(
        iter([download.content]),
        media_type=download.mime_type or "application/pdf",
        headers=headers,
    )


@router.get("/{item_id}", response_model=LibraryItemDetailResponse)
async def get_library_item(
    item_id: UUID,
    session: DbSession,
    current_user: CurrentUser,
) -> LibraryItemDetailResponse:
    return await LibraryService(session).get_library_item_detail(
        item_id=item_id,
        user_id=current_user.id,
    )


@router.patch("/{item_id}", response_model=LibraryItemDetailResponse)
async def update_library_item(
    item_id: UUID,
    payload: LibraryItemUpdate,
    session: DbSession,
    current_user: CurrentUser,
) -> LibraryItemDetailResponse:
    return await LibraryService(session).update_library_item(
        item_id=item_id,
        user_id=current_user.id,
        data=payload,
    )


@router.patch("/articles/{item_id}/content", response_model=ArticleDetailResponse)
async def update_article_content(
    item_id: UUID,
    payload: ArticleContentUpdate,
    session: DbSession,
    current_user: CurrentUser,
) -> ArticleDetailResponse:
    return await LibraryService(session).update_article_content(
        item_id=item_id,
        user_id=current_user.id,
        data=payload,
    )


@router.patch("/videos/{item_id}", response_model=VideoDetailResponse)
async def update_video_content(
    item_id: UUID,
    payload: VideoContentUpdate,
    session: DbSession,
    current_user: CurrentUser,
) -> VideoDetailResponse:
    return await LibraryService(session).update_video_content(
        item_id=item_id,
        user_id=current_user.id,
        data=payload,
    )


@router.put("/{item_id}/progress", response_model=LearningProgressResponse)
async def update_library_progress(
    item_id: UUID,
    payload: LearningProgressUpdate,
    session: DbSession,
    current_user: CurrentUser,
) -> LearningProgressResponse:
    return await LibraryService(session).update_progress(
        item_id=item_id,
        user_id=current_user.id,
        data=payload,
    )


@router.delete("/{item_id}", response_model=MessageResponse)
async def delete_library_item(
    item_id: UUID,
    session: DbSession,
    current_user: CurrentUser,
) -> MessageResponse:
    await LibraryService(session).delete_library_item(
        item_id=item_id,
        user_id=current_user.id,
    )
    return MessageResponse(message="Library item deleted")
