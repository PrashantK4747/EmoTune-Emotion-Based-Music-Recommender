import logging
from contextlib import contextmanager
from typing import Optional, Tuple

import psycopg2
from bcrypt import checkpw, gensalt, hashpw

from config import settings

logger = logging.getLogger("emotune.db")


@contextmanager
def get_db_connection():
    """Context manager that always closes the connection, even on error."""
    conn = psycopg2.connect(
        dbname=settings.DB_NAME,
        user=settings.DB_USER,
        password=settings.DB_PASS,
        host=settings.DB_HOST,
        port=settings.DB_PORT,
    )
    try:
        yield conn
    finally:
        conn.close()


def ensure_schema() -> None:
    """Create the users table if it doesn't already exist.

    Called once on application startup so a fresh Postgres database works
    out of the box without a manual SQL setup step.
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS users (
                        id SERIAL PRIMARY KEY,
                        username VARCHAR(50) UNIQUE NOT NULL,
                        name VARCHAR(100) NOT NULL,
                        password_hash TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT NOW()
                    )
                    """
                )
                conn.commit()
        logger.info("Database schema verified.")
    except Exception as exc:  # pragma: no cover - startup diagnostics
        logger.error("Could not verify/create database schema: %s", exc)
        raise


def hash_password(password: str) -> str:
    return hashpw(password.encode("utf-8"), gensalt()).decode("utf-8")


def verify_password(plaintext: str, hashed: str) -> bool:
    return checkpw(plaintext.encode("utf-8"), hashed.encode("utf-8"))


def create_user(username: str, name: str, password: str) -> bool:
    hashed_password = hash_password(password)
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO users (username, name, password_hash) VALUES (%s, %s, %s)",
                    (username, name, hashed_password),
                )
                conn.commit()
        return True
    except psycopg2.IntegrityError:
        # Username already taken
        return False
    except Exception as exc:
        logger.error("Failed to create user '%s': %s", username, exc)
        return False


def get_user(username: str) -> Optional[Tuple]:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT username, name, password_hash FROM users WHERE username = %s",
                    (username,),
                )
                return cur.fetchone()
    except Exception as exc:
        logger.error("Failed to fetch user '%s': %s", username, exc)
        return None
