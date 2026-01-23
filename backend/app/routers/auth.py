from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import bcrypt
import httpx
from typing import Optional

from app.database import get_db
from app.models.user import User
from app.schemas.auth import (
    UserCreate,
    UserLogin,
    UserResponse,
    TokenResponse,
    GoogleAuthRequest,
    UserProfileUpdate,
)
from app.utils.jwt import create_access_token, create_refresh_token, verify_token, get_current_user
from app.config import get_settings

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    password_bytes = plain_password.encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user with email and password."""
    # Check if user already exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Generate tokens
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    
    response = JSONResponse(
        content={
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": settings.access_token_expire_minutes * 60,
        },
        status_code=status.HTTP_201_CREATED,
    )
    
    # Set refresh token as HTTP-only cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
    )
    
    return response


@router.post("/login", response_model=TokenResponse)
async def login(user_data: UserLogin, db: AsyncSession = Depends(get_db)):
    """Login with email and password."""
    result = await db.execute(select(User).where(User.email == user_data.email))
    user = result.scalar_one_or_none()
    
    if not user or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    if not verify_password(user_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Generate tokens
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    
    response = JSONResponse(
        content={
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": settings.access_token_expire_minutes * 60,
        }
    )
    
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
    )
    
    return response


@router.get("/google/login")
async def google_login():
    """Initiate Google OAuth flow."""
    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google OAuth not configured"
        )
    
    redirect_uri = "http://localhost:8000/auth/google/callback"
    google_auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={settings.google_client_id}&"
        f"redirect_uri={redirect_uri}&"
        f"response_type=code&"
        f"scope=openid%20email%20profile&"
        f"access_type=offline"
    )
    
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=google_auth_url)


@router.get("/google/callback")
async def google_callback(code: str, db: AsyncSession = Depends(get_db)):
    """Handle Google OAuth callback."""
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google OAuth not configured"
        )
    
    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": "http://localhost:8000/auth/google/callback",
                "grant_type": "authorization_code",
            },
        )
        
        if token_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange code for tokens"
            )
        
        tokens = token_response.json()
        
        # Get user info
        userinfo_response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        
        if userinfo_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to get user info"
            )
        
        userinfo = userinfo_response.json()
    
    # Find or create user
    result = await db.execute(select(User).where(User.google_id == userinfo["id"]))
    user = result.scalar_one_or_none()
    
    if not user:
        # Check if email already exists
        result = await db.execute(select(User).where(User.email == userinfo["email"]))
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            # Link Google account to existing user
            existing_user.google_id = userinfo["id"]
            user = existing_user
        else:
            # Create new user
            user = User(
                email=userinfo["email"],
                google_id=userinfo["id"],
            )
            db.add(user)
        
        await db.commit()
        await db.refresh(user)
    
    # Generate tokens
    access_token = create_access_token(user.id)
    refresh_token_value = create_refresh_token(user.id)
    
    # Redirect to frontend with tokens
    from fastapi.responses import RedirectResponse
    response = RedirectResponse(url=f"http://localhost:3000/?access_token={access_token}")
    
    response.set_cookie(
        key="refresh_token",
        value=refresh_token_value,
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
    )
    
    return response


@router.post("/google", response_model=TokenResponse)
async def google_auth(auth_data: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate with Google OAuth."""
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google OAuth not configured"
        )
    
    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": auth_data.code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": auth_data.redirect_uri or "http://localhost:3000/auth/callback",
                "grant_type": "authorization_code",
            },
        )
        
        if token_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange code for tokens"
            )
        
        tokens = token_response.json()
        
        # Get user info
        userinfo_response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        
        if userinfo_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to get user info"
            )
        
        userinfo = userinfo_response.json()
    
    # Find or create user
    result = await db.execute(select(User).where(User.google_id == userinfo["id"]))
    user = result.scalar_one_or_none()
    
    if not user:
        # Check if email already exists
        result = await db.execute(select(User).where(User.email == userinfo["email"]))
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            # Link Google account to existing user
            existing_user.google_id = userinfo["id"]
            user = existing_user
        else:
            # Create new user
            user = User(
                email=userinfo["email"],
                google_id=userinfo["id"],
            )
            db.add(user)
        
        await db.commit()
        await db.refresh(user)
    
    # Generate tokens
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    
    response = JSONResponse(
        content={
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": settings.access_token_expire_minutes * 60,
        }
    )
    
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
    )
    
    return response


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    response: Response,
    refresh_token: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Refresh access token using refresh token."""
    from fastapi import Request
    
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token required"
        )
    
    user_id = verify_token(refresh_token, "refresh")
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    # Generate new tokens
    new_access_token = create_access_token(user.id)
    new_refresh_token = create_refresh_token(user.id)
    
    resp = JSONResponse(
        content={
            "access_token": new_access_token,
            "token_type": "bearer",
            "expires_in": settings.access_token_expire_minutes * 60,
        }
    )
    
    resp.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
    )
    
    return resp


@router.post("/logout")
async def logout(response: Response):
    """Logout and clear refresh token cookie."""
    response = JSONResponse(content={"message": "Logged out successfully"})
    response.delete_cookie("refresh_token")
    return response


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current user information."""
    return current_user


@router.put("/profile", response_model=UserResponse)
async def update_user_profile(
    profile_data: UserProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update user profile (display name, etc.)."""
    if profile_data.display_name is not None:
        current_user.display_name = profile_data.display_name.strip() if profile_data.display_name else None
    
    await db.commit()
    await db.refresh(current_user)
    
    return current_user


# ============================================================================
# OTP Endpoints (Ported from old Next.js implementation)
# ============================================================================

from pydantic import BaseModel, EmailStr


class OTPSendRequest(BaseModel):
    """Request body for sending OTP."""
    email: EmailStr
    username: Optional[str] = "User"


class OTPVerifyRequest(BaseModel):
    """Request body for verifying OTP."""
    email: EmailStr
    otp: str
    skip_delete: Optional[bool] = False


class OTPResponse(BaseModel):
    """Response for OTP operations."""
    success: bool
    message: str


@router.post("/otp/send", response_model=OTPResponse)
async def send_otp(request: OTPSendRequest):
    """
    Send OTP to email for verification.
    
    Rate limited: minimum 1 minute between requests.
    OTP expires after 10 minutes.
    """
    from app.services.otp_service import otp_service
    
    result = await otp_service.send_otp(
        email=request.email,
        username=request.username or "User"
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS
            if "wait" in result["message"].lower()
            else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result["message"]
        )
    
    return OTPResponse(**result)


@router.post("/otp/verify", response_model=OTPResponse)
async def verify_otp(request: OTPVerifyRequest):
    """
    Verify OTP code.
    
    Maximum 5 attempts allowed.
    """
    from app.services.otp_service import otp_service
    
    result = await otp_service.verify_otp(
        email=request.email,
        otp=request.otp,
        skip_delete=request.skip_delete or False
    )
    
    if not result["success"]:
        # Determine appropriate status code
        if "expired" in result["message"].lower():
            status_code = status.HTTP_410_GONE
        elif "not found" in result["message"].lower():
            status_code = status.HTTP_404_NOT_FOUND
        elif "too many" in result["message"].lower():
            status_code = status.HTTP_429_TOO_MANY_REQUESTS
        else:
            status_code = status.HTTP_400_BAD_REQUEST
        
        raise HTTPException(status_code=status_code, detail=result["message"])
    
    return OTPResponse(**result)
