"""
Centralized application configuration.

All secrets and environment-specific values are read from environment
variables (loaded from a local .env file via python-dotenv). This keeps
credentials out of source control and makes it trivial to reconfigure the
app for different machines / environments.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# Load variables from backend/.env if present
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


class Settings:
    # --- Auth ---
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-only-secret-change-me")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_HOURS: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_HOURS", "24"))

    # --- Database ---
    DB_NAME: str = os.getenv("DB_NAME", "emotune_db")
    DB_USER: str = os.getenv("DB_USER", "postgres")
    DB_PASS: str = os.getenv("DB_PASS", "postgres")
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: str = os.getenv("DB_PORT", "5432")

    # --- Jamendo (music) ---
    JAMENDO_CLIENT_ID: str = os.getenv("JAMENDO_CLIENT_ID", "983783ac")
    JAMENDO_API_URL: str = "https://api.jamendo.com/v3.0"

    # --- CORS ---
    CORS_ORIGINS: list[str] = _split_csv(
        os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5500,http://127.0.0.1:5500,"
            "http://localhost:5501,http://127.0.0.1:5501,"
            "http://localhost:8000,http://127.0.0.1:8000",
        )
    )

    # --- ML model paths (relative to the shared/ folder) ---
    MODEL_PATH: Path = BASE_DIR.parent / "shared" / "emotune_model_v2.keras"
    CASCADE_PATH: Path = BASE_DIR.parent / "shared" / "haarcascade_frontalface_default.xml"


settings = Settings()

if settings.SECRET_KEY == "dev-only-secret-change-me":
    import warnings

    warnings.warn(
        "Using the default SECRET_KEY. Set SECRET_KEY in backend/.env before "
        "deploying to production.",
        RuntimeWarning,
    )
