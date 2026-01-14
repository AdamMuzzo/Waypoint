"""
Shared FastAPI dependencies.

require_auth:
- Reads the Authorization header (Bearer token)
- Verifies JWT signature and expiry
- Ensures the token subject matches the configured single user
"""

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_access_token
from app.config import settings

_bearer = HTTPBearer(auto_error=False)

def require_auth(creds: HTTPAuthorizationCredentials | None = Depends(_bearer),) -> str:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(401, "Missing bearer token")
    
    token = creds.credentials
    try:
        payload = decode_access_token(token, settings.jwt_secret, settings.jwt_alg)
    except Exception:
        raise HTTPException(401, "Invalid or expired token")
    
    if payload.get("sub") != settings.username:
        raise HTTPException(401, "Invalid token subject")
    
    return payload["sub"]
