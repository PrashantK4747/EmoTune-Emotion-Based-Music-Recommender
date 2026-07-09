import logging
import random
from typing import Dict, List

import requests

from config import settings

logger = logging.getLogger("emotune.jamendo")

# Emotion -> mood/genre tags used to query Jamendo's public catalog.
EMOTION_TO_TAGS = {
    "angry": ["rock", "metal", "hardcore", "aggressive", "energetic"],
    "fear": ["dark", "ambient", "atmospheric", "mysterious", "suspense"],
    "happy": ["happy", "upbeat", "pop", "party", "energetic"],
    "sad": ["sad", "melancholy", "emotional", "slow", "calm"],
    "surprise": ["electronic", "energetic", "upbeat", "dance", "surprising"],
    "surprised": ["electronic", "energetic", "upbeat", "dance", "surprising"],
    "neutral": ["chill", "lofi", "calm", "relaxing", "ambient"],
}


def search_tracks_by_emotion(emotion: str, limit: int = 10) -> List[Dict]:
    """Fetch a page of tracks from Jamendo that match the given emotion."""
    emotion = (emotion or "neutral").lower()
    tag = random.choice(EMOTION_TO_TAGS.get(emotion, EMOTION_TO_TAGS["neutral"]))
    offset = random.randint(0, 50)

    params = {
        "client_id": settings.JAMENDO_CLIENT_ID,
        "format": "json",
        "limit": limit,
        "offset": offset,
        "tags": tag,
        "include": "musicinfo",
        "audioformat": "mp32",
    }

    try:
        response = requests.get(f"{settings.JAMENDO_API_URL}/tracks", params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as exc:
        logger.error("Jamendo request failed: %s", exc)
        return []
    except ValueError as exc:
        logger.error("Jamendo returned invalid JSON: %s", exc)
        return []

    tracks = []
    for t in data.get("results", []):
        if not t.get("audio"):
            continue
        tracks.append(
            {
                "id": str(t.get("id")),
                "title": t.get("name", "Unknown Title"),
                "artist": t.get("artist_name", "Unknown Artist"),
                "stream_url": t.get("audio", ""),
                "image": t.get("image", ""),
                "duration": t.get("duration", 0),
            }
        )
    return tracks[:limit]
