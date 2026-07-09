import logging

from fastapi import APIRouter, Depends, HTTPException

from models.schemas import EmotionDetectionRequest, EmotionDetectionResponse
from utils.auth_utils import get_current_user
from utils.ml_utils import decode_base64_image, detect_emotion

router = APIRouter(prefix="/emotion", tags=["Emotion Detection"])
logger = logging.getLogger("emotune.emotion")


@router.post("/detect", response_model=EmotionDetectionResponse)
async def detect_emotion_endpoint(
    request: EmotionDetectionRequest,
    current_user: str = Depends(get_current_user),
):
    if not request.image_base64:
        raise HTTPException(status_code=400, detail="No image data provided.")

    try:
        image = decode_base64_image(request.image_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read the uploaded image.")

    try:
        result = detect_emotion(image)
    except FileNotFoundError as exc:
        logger.error("Emotion model unavailable: %s", exc)
        raise HTTPException(status_code=503, detail="Emotion detection model is unavailable.")
    except Exception as exc:
        logger.exception("Unexpected error during emotion detection")
        raise HTTPException(status_code=500, detail="Emotion detection failed.")

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result
