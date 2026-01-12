"""
Health Check Routes

Purpose
-------
Exposes a minimal `/health` endpoint used to verify the server is running.

Why it exists
-------------
- Lets you confirm FastAPI boots, routing works, and the app is reachable
- Useful for debugging and later for monitoring (e.g., Docker healthchecks)

Behavior
--------
- GET /health returns: {"status": "ok"}
"""
from fastapi import APIRouter

router = APIRouter(tags=["health"])

@router.get("/health")
def health():
    return {"status": "ok"}