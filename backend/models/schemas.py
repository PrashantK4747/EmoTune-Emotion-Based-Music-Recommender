from pydantic import BaseModel, Field
from typing import Optional, List

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=6, max_length=128)

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    username: str
    name: str

class EmotionDetectionRequest(BaseModel):
    image_base64: str

class EmotionDetectionResponse(BaseModel):
    emotion: str
    confidence: dict
    emoji: str

class MusicRequest(BaseModel):
    emotion: str
    limit: int = Field(default=10, ge=1, le=30)

class Song(BaseModel):
    id: str
    title: str
    artist: str
    stream_url: str
    image: str
    duration: int

class MusicResponse(BaseModel):
    emotion: str
    songs: List[Song]