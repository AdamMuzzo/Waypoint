"""
Waypoint backend configuration.

Reads environment variables (from backend/.env via python-dotenv) and exposes
them as a strongly-typed Settings object.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = REPO_ROOT / "backend" / ".env"
LEGACY_DEFAULT_ROOT = Path(r"A:\WaypointRoot")
DEFAULT_REPO_ROOT = REPO_ROOT / "WaypointRoot"

load_dotenv(dotenv_path=ENV_PATH)


def _env_first(names: list[str]) -> str | None:
    for name in names:
        value = os.getenv(name)
        if value:
            return value
    return None


def _require(names: list[str]) -> str:
    value = _env_first(names)
    if not value:
        joined = " or ".join(names)
        raise RuntimeError(f"Missing required env var: {joined}")
    return value


def _as_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError as exc:
        raise RuntimeError(f"Invalid integer for {name}: {raw}") from exc


def _default_root() -> Path:
    if LEGACY_DEFAULT_ROOT.exists():
        return LEGACY_DEFAULT_ROOT
    return DEFAULT_REPO_ROOT


def _split_origins(raw: str) -> list[str]:
    return [o.strip() for o in raw.split(",") if o.strip()]


@dataclass(frozen=True)
class Settings:
    # Single user login settings
    username: str
    password_hash: str
    jwt_secret: str
    jwt_alg: str

    # File sandbox settings
    remote_root: Path

    # Login token expiry
    access_ttl_min: int

    # Auth state persistence
    state_dir: Path

    # CORS
    allowed_origins: list[str]

    # Server binding (used by scripts/docs)
    host: str
    port: int


settings = Settings(
    username=_require(["WAYPOINT_USERNAME"]),
    password_hash=_require(["WAYPOINT_PASSWORD_HASH"]),
    jwt_secret=_require(["WAYPOINT_JWT_SECRET", "JWT_SECRET"]),
    jwt_alg=_env_first(["WAYPOINT_JWT_ALG", "JWT_ALG"]) or "HS256",
    remote_root=Path(
        _env_first(["WAYPOINT_ROOT", "WAYPOINT_REMOTE_ROOT"]) or str(_default_root())
    )
    .expanduser()
    .resolve(),
    access_ttl_min=_as_int("WAYPOINT_ACCESS_TTL_MIN", 15),
    state_dir=Path(os.getenv("WAYPOINT_STATE_DIR", ".waypoint_state")).expanduser().resolve(),
    allowed_origins=_split_origins(
        os.getenv("WAYPOINT_ALLOWED_ORIGINS", "http://localhost:5173")
    ),
    host=os.getenv("WAYPOINT_HOST", "127.0.0.1"),
    port=_as_int("WAYPOINT_PORT", 8000),
)
