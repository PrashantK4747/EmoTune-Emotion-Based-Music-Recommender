import base64
import io
import logging

import cv2
import numpy as np
from PIL import Image
from tensorflow.keras.preprocessing.image import img_to_array
from tensorflow.keras.models import load_model

from config import settings

logger = logging.getLogger("emotune.ml")

EMOTION_LABELS = ["angry", "fear", "happy", "sad", "surprise", "neutral"]
EMOTION_EMOJI = {
    "angry": "😠",
    "fear": "😨",
    "happy": "😊",
    "sad": "😢",
    "surprise": "😲",
    "neutral": "😐",
}

_emotion_model = None
_face_cascade = None


def _load_assets():
    """Lazily load the Keras model and Haar cascade the first time they're
    needed, using paths that are resolved relative to the project (not the
    current working directory), so `uvicorn main:app` works from any folder.
    """
    global _emotion_model, _face_cascade

    if _emotion_model is None:
        if not settings.MODEL_PATH.exists():
            raise FileNotFoundError(f"Emotion model not found at {settings.MODEL_PATH}")
        logger.info("Loading emotion model from %s", settings.MODEL_PATH)
        _emotion_model = load_model(str(settings.MODEL_PATH))

    if _face_cascade is None:
        if not settings.CASCADE_PATH.exists():
            raise FileNotFoundError(f"Haar cascade not found at {settings.CASCADE_PATH}")
        _face_cascade = cv2.CascadeClassifier(str(settings.CASCADE_PATH))

    return _emotion_model, _face_cascade


def decode_base64_image(base64_string: str) -> np.ndarray:
    """Convert a base64 (optionally data-URL prefixed) string to an OpenCV BGR image."""
    img_data = base64.b64decode(base64_string.split(",")[-1])
    img = Image.open(io.BytesIO(img_data)).convert("RGB")
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)


def detect_emotion(image: np.ndarray) -> dict:
    """Detect the dominant facial emotion in an image."""
    model, face_cascade = _load_assets()

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(40, 40))

    if len(faces) == 0:
        return {"error": "No face detected. Make sure your face is clearly visible and well lit."}

    # Use the largest detected face (closest to camera)
    (x, y, w, h) = max(faces, key=lambda rect: rect[2] * rect[3])
    roi_gray = gray[y : y + h, x : x + w]
    roi_gray = cv2.resize(roi_gray, (48, 48), interpolation=cv2.INTER_AREA)

    if np.sum([roi_gray]) == 0:
        return {"error": "Face processing failed. Please try again."}

    roi = roi_gray.astype("float") / 255.0
    roi = img_to_array(roi)
    roi = np.expand_dims(roi, axis=0)

    prediction = model.predict(roi, verbose=0)[0]
    emotion = EMOTION_LABELS[int(prediction.argmax())]

    confidence = {label: float(prediction[idx]) for idx, label in enumerate(EMOTION_LABELS)}

    return {
        "emotion": emotion,
        "confidence": confidence,
        "emoji": EMOTION_EMOJI[emotion],
    }
