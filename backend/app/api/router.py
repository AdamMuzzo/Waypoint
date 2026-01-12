"""
API Router Aggregator

Purpose
-------
Collects and registers all API route modules in one place, producing a single
`api_router` that `app/main.py` can include.

Why it exists
-------------
- Keeps `main.py` small and clean
- Makes it easy to add new modules (auth, fs, websockets, etc.)
- Provides a predictable place to wire up all endpoints

Typical usage
-------------
- main.py calls: app.include_router(api_router)
- router.py includes: health_router, auth_router, fs_router, ...
"""
from fastapi import APIRouter
from app.api.health import router as health_router

api_router = APIRouter()
api_router.include_router(health_router)
