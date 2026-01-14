"""
Realtime filesystem events via WebSocket.

- Watches settings.remote_root for filesystem changes.
- Pushes JSON events to connected clients.
- Auth required via query param token: ws://.../events?token=<JWT>
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from watchfiles import awatch

from app.core.security import decode_access_token
from app.settings import settings

router = APIRouter(tags=["events"])


def _is_authed(token: str | None) -> bool:
    if not token:
        return False
    try:
        payload = decode_access_token(token, settings.jwt_secret)
        return payload.get("sub") == settings.username
    except Exception:
        return False


def _rel(root: Path, p: Path) -> str:
    try:
        return str(p.relative_to(root)).replace("\\", "/")
    except Exception:
        return ""


@router.websocket("/events")
async def events(ws: WebSocket):
    token = ws.query_params.get("token")
    if not _is_authed(token):
        await ws.close(code=1008)  # policy violation
        return

    await ws.accept()

    root = settings.remote_root

    try:
        async for changes in awatch(root):
            # changes is a set of tuples: (Change.<type>, "path")
            payload: list[dict[str, Any]] = []
            for change, path_str in changes:
                p = Path(path_str)
                payload.append(
                    {
                        "change": str(change),  # e.g. "Change.added"
                        "path": _rel(root, p),
                    }
                )

            await ws.send_text(json.dumps({"events": payload}))
            await asyncio.sleep(0)  # yield
    except WebSocketDisconnect:
        return