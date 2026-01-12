"""
Waypoint Settings / Configuration

Purpose
-------
Centralizes configuration for the backend by loading environment variables
(from `backend/.env`) and exposing them as a strongly-typed `settings` object.

What this enables
-----------------
- Keeps secrets and machine-specific configuration out of source code
- Makes it easy to change config without editing Python
- Ensures required values exist (fail fast with a clear error message)
- Provides a single source of truth for:
  * login configuration (single-user username, password hash, JWT secret)
  * filesystem sandbox root directory (WAYPOINT_REMOTE_ROOT)
  * access token lifetime

Used by
-------
- app/main.py (startup checks and app init)
- auth endpoints (to validate credentials & sign tokens)
- filesystem endpoints (to enforce the sandbox root)
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# Load variables from backend/.env into environment variables.
load_dotenv()

def _require(name: str) -> str:
    v = os.getenv(name)
    if not v:
        raise RuntimeError(f"Missing required env var: {name}")
    return v

@dataclass(frozen=True)
class Settings:
    # Single user login settings
    username: str
    password_hash: str
    jwt_secret: str

    # File sandbox settings
    remote_root: Path

    # Login token expiry
    access_ttl_min: int

settings = Settings(
    username = _require("WAYPOINT_USERNAME"),
    password_hash = _require("WAYPOINT_PASSWORD_HASH"),
    jwt_secret = _require("WAYPOINT_JWT_SECRET"),
    remote_root = Path(os.getenv("WAYPOINT_REMOTE_ROOT", r"A:\WaypointRoot")).resolve(),
    access_ttl_min=int(os.getenv("WAYPOINT_ACCESS_TTL_MIN", "15")),
)