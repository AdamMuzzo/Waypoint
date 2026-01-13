"""
Filesystem routes (protected).

Currently:
- GET /fs/list?path=...

All endpoints in this module require authentication (Bearer token)
and enforce the sandbox root via safe_path().
"""
from fastapi import APIRouter, Depends, HTTPException

from app.core.paths import safe_path
from app.deps import require_auth
from app.settings import settings

router = APIRouter(prefix="/fs", tags=["fs"])

@router.get("/list")
def list_dir(path: str = "", user: str = Depends(require_auth)):
    p = safe_path(settings.remote_root, path)
    if not p.exists() or not p.is_dir():
        raise HTTPException(404, "Not a directory")

    items = []
    for child in p.iterdir():
        st = child.stat()
        items.append(
            {
                "name": child.name,
                "is_dir": child.is_dir(),
                "size": st.st_size,
                "mtime": int(st.st_mtime),
            }
        )

    return {"path": path, "items": items}