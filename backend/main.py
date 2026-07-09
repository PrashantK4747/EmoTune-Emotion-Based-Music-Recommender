import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from routes import auth, emotion, music
from utils.db_utils import ensure_schema

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("emotune")

app = FastAPI(
    title="EmoTune API",
    description="Backend API for emotion-based music recommendation",
    version="1.1.0",
)

# Enable CORS for the configured frontend origins (see backend/.env)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(emotion.router)
app.include_router(music.router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})


@app.on_event("startup")
async def on_startup():
    try:
        ensure_schema()
    except Exception:
        logger.warning(
            "Skipping automatic schema check — could not reach the database. "
            "Make sure PostgreSQL is running and backend/.env is configured correctly."
        )


@app.get("/")
async def root():
    return {"message": "EmoTune API is running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
