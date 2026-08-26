from __future__ import annotations

from fastapi import APIRouter

from app.modules.auth.router import router as auth_router
from app.modules.captions.router import router as captions_router
from app.modules.library.router import router as library_router
from app.modules.review.router import router as review_router
from app.modules.users.router import router as users_router
from app.modules.vocabulary.router import router as vocabulary_router
from app.modules.wody.router import router as wody_router
from app.modules.word_analysis.router import router as word_analysis_router
from app.storage.router import router as storage_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["Auth"])
api_router.include_router(users_router, prefix="/users", tags=["Users"])
api_router.include_router(library_router, prefix="/library", tags=["Library"])
api_router.include_router(vocabulary_router, prefix="/vocabulary", tags=["Vocabulary"])
api_router.include_router(review_router, prefix="/reviews", tags=["Reviews"])
api_router.include_router(captions_router, prefix="/captions", tags=["Captions"])
api_router.include_router(word_analysis_router, prefix="/word-analysis", tags=["Word Analysis"])
api_router.include_router(storage_router, prefix="/storage", tags=["Storage"])
api_router.include_router(wody_router, prefix="/wody", tags=["Wody"])
