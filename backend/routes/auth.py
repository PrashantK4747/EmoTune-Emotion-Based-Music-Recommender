from fastapi import APIRouter, HTTPException, status

from models.schemas import Token, UserCreate, UserLogin
from utils.auth_utils import create_access_token
from utils.db_utils import create_user, get_user, verify_password

router = APIRouter(prefix="/auth", tags=["Authentication"])

MIN_PASSWORD_LENGTH = 6
MIN_USERNAME_LENGTH = 3


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate):
    username = user.username.strip()
    name = user.name.strip()

    if len(username) < MIN_USERNAME_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Username must be at least {MIN_USERNAME_LENGTH} characters.",
        )
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Full name is required."
        )
    if len(user.password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters.",
        )

    if create_user(username, name, user.password):
        return {"message": "User created successfully"}

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Username already exists",
    )


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    user_data = get_user(credentials.username.strip())

    if not user_data or not verify_password(credentials.password, user_data[2]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    access_token = create_access_token({"sub": credentials.username})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": user_data[0],
        "name": user_data[1],
    }
