"""
Authentication routes (single user).

Endpoints:
- POST /auth/login: validate username/password, return access + refresh tokens
- POST /auth/refresh: rotate refresh token, return new tokens
- POST /auth/logout: revoke refresh token

Persistence:
- Stores the refresh token hash on disk so sessions survive server restarts.
  File: <WAYPOINT_STATE_DIR>/refresh.json
"""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.security import (
    create_access_token,
    make_refresh_token,
    verify_password,
    hash_value,
    verify_hash,
)
from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

STATE_DIR = settings.state_dir
STATE_FILE = settings.state_dir / "refresh.json"

_refresh_hash: str | None = None


def _load_refresh_hash() -> str | None:
    try:
        data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        v = data.get("refresh_hash")
        return v if isinstance(v, str) and v else None
    except FileNotFoundError:
        return None
    except Exception:
        # If state is corrupted, treat as logged out.
        return None


def _save_refresh_hash(value: str | None) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    data = {"refresh_hash": value}
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data), encoding="utf-8")
    tmp.replace(STATE_FILE)


# Load persisted session at import time
_refresh_hash = _load_refresh_hash()


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
        raise HTTPException(401, "Invalid credentials")

    if not verify_password(data.password, settings.password_hash):
        raise HTTPException(401, "Invalid credentials")

    access = create_access_token(
        subject=settings.username,
        secret=settings.jwt_secret,
        ttl_minutes=settings.access_ttl_min,
        alg=settings.jwt_alg,
    )

    refresh = make_refresh_token()
    global _refresh_hash
    _refresh_hash = hash_value(refresh)
    _save_refresh_hash(_refresh_hash)

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
        alg=settings.jwt_alg,
    )

    new_refresh = make_refresh_token()
    _refresh_hash = hash_value(new_refresh)
    _save_refresh_hash(_refresh_hash)

    return TokenOut(
        access_token=access,
        refresh_token=new_refresh,
        expires_in=settings.access_ttl_min * 60,
    )


@router.post("/logout")
def logout():
    global _refresh_hash
    _refresh_hash = None
    _save_refresh_hash(None)
    return {"ok": True}
