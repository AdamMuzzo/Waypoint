"""
Waypoint Backend Entrypoint (FastAPI Application)

Purpose
-------
Creates the FastAPI application instance and attaches all API routes.
This is the module uvicorn points at when starting the server.

Key responsibilities
--------------------
1) Build the FastAPI app (title/version)
2) Run startup initialization:
   - ensure the configured sandbox folder (WAYPOINT_ROOT) exists
3) Include the master API router (app/api/router.py)

How it is launched
------------------
From backend/:
  uvicorn app.main:app --reload

Notes
-----
- This file stays intentionally small; most logic belongs in:
  * app/api/*      (HTTP endpoints)
  * app/core/*     (security, path safety, helpers)
  * app/services/* (business logic)
"""
from fastapi import FastAPI

from app.api.router import api_router
from app.config import settings
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Waypoint", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# When the server starts, ensure the allowed root folder exists
@app.on_event("startup")
def _startup() -> None:
    settings.remote_root.mkdir(parents=True, exist_ok=True)

# Plug in all API routes
app.include_router(api_router)
