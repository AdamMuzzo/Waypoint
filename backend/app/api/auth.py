"""
Authentication routes (single user).

Endpoints:
- POST /auth/login: validate username/password, return access + refresh tokens
- POST /auth/refresh: rotate refresh token, return new tokens
- POST /auth/logout: revoke refresh token

Note:
- v1 stores refresh token hash in memory. Restarting the server invalidates it.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.security import (
    create_access_token,
    make_refresh_token,
    verify_password,
    hash_value,
    verify_hash,
)
from app.settings import settings

router = APIRouter(prefix="/auth", tags=["auth"])

_refresh_hash: str | None = None

class LoginIn(BaseModel):
    username: str
    password: str

class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int

@router.post("/login", response_model=TokenOut)
def login(data: LoginIn):
    if data.username != settings.username:
        raise HTTPException(401, "Invalid Credentials")
    
    if not verify_password(data.password, settings.password_hash):
        raise HTTPException(401, "Invalid credentials")
    
    access = create_access_token(
        subject=settings.username,
        secret=settings.jwt_secret,
        ttl_minutes=settings.access_ttl_min,
    )

    refresh = make_refresh_token()
    global _refresh_hash
    _refresh_hash = hash_value(refresh)

    return TokenOut(
        access_token=access,
        refresh_token=refresh,
        expires_in=settings.access_ttl_min * 60,
    )

class RefreshIn(BaseModel):
    refresh_token: str

@router.post("/refresh", response_model=TokenOut)
def refresh(data: RefreshIn):
    global _refresh_hash
    if not _refresh_hash or not verify_hash(data.refresh_token, _refresh_hash):
        raise HTTPException(401, "Invalid refresh token")
    
    access = create_access_token(
        subject=settings.username,
        secret=settings.jwt_secret,
        ttl_minutes=settings.access_ttl_min,
    )

    new_refresh = make_refresh_token()
    _refresh_hash = hash_value(new_refresh)

    return TokenOut(
        access_token=access,
        refresh_token=new_refresh,
        expires_in=settings.access_ttl_min * 60,
    )

@router.post("/logout")
def logout():
    global _refresh_hash
    _refresh_hash = None
    return {"ok", True}