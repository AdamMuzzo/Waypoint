"""
Security utilities for Waypoint.

Responsibilities:
- Verify the single-user password using Argon2 (stored as a hash in .env)
- Create and verify JWT access tokens (short-lived)
- Create refresh tokens (longer-lived; v1 stored in-memory as a hash)
"""

from __future__ import annotations

import base64
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

_ph = PasswordHasher()

def verify_password(plain_password: str, password_hash: str) -> bool:
    # Return True if plain_password matches the stored Argon2 hash
    try:
        return _ph.verify(password_hash, plain_password)
    except VerifyMismatchError:
        return False

def hash_value(value: str) -> str:
    # Hash an arbitrary secret value (used for refresh token storage)
    return _ph.hash(value)

def verify_hash(value: str, value_hash: str) -> bool:
    # Verify a value against an Argon2 hash
    try:
        return _ph.verify(value_hash, value)
    except VerifyMismatchError:
        return False

def make_refresh_token() -> str:
    # Generate a URL-safe random refresh token (not a JWT)
    return base64.urlsafe_b64encode(os.urandom(32)).decode("utf-8").rstrip("=")

def create_access_token(subject: str, secret: str, ttl_minutes: int) -> str:
     """
    Create a signed JWT access token.
    subject: who the token is for (your username)
    ttl_minutes: how long the token is valid
    """
     now = datetime.now(timezone.utc)
     payload: Dict[str, Any] = {
         "sub": subject,
         "iat": int(now.timestamp()),
         "exp": int((now + timedelta(minutes=ttl_minutes)).timestamp()),
     }
     return jwt.encode(payload, secret, algorithm="HS256")

def decode_access_token(token: str, secret: str) -> Dict[str, Any]:
    # Decode/verify a JWT access token. Raises if invalid/expired
    return jwt.decode(token, secret, algorithms=["HS256"])
