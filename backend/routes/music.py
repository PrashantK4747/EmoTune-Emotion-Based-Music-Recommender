import logging

from fastapi import APIRouter, Depends, HTTPException

from models.schemas import MusicRequest, MusicResponse
from utils.auth_utils import get_current_user
from utils.jamendo_utils import search_tracks_by_emotion

router = APIRouter(prefix="/music", tags=["Music"])
logger = logging.getLogger("emotune.music")


@router.post("/recommend", response_model=MusicResponse)
async def get_music_recommendations(
    request: MusicRequest,
    current_user: str = Depends(get_current_user),
):
    try:
        songs = search_tracks_by_emotion(request.emotion, request.limit)
        return {"emotion": request.emotion, "songs": songs}
    except Exception:
        logger.exception("Unexpected error while fetching recommendations")
        raise HTTPException(status_code=500, detail="Could not fetch music recommendations.")
