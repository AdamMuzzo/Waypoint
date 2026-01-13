"""
Filesystem routes (protected).

Endpoints:
- GET  /fs/list?path=
- GET  /fs/download?path=
- POST /fs/upload?path=&overwrite=
- POST /fs/mkdir
- POST /fs/move
- DELETE /fs/delete

Security:
- All routes require authentication (Bearer token)
- All paths are sandboxed under settings.remote_root using safe_path()
"""
from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from starlette.responses import FileResponse

from app.core.paths import safe_path
from app.deps import require_auth
from app.settings import settings

router = APIRouter(prefix="/fs", tags=["fs"])

def _file_info(p: Path, root: Path) -> dict[str, Any]:
    st = p.stat()
    rel = str(p.relative_to(root)).replace("\\", "/") if p != root else ""
    return {
        "path": rel,
        "name": p.name,
        "is_dir": p.is_dir(),
        "size": st.st_size,
        "mtime": int(st.st_mtime),
    }

@router.get("/list")
def list_dir(path: str = "", user: str = Depends(require_auth)):
    p = safe_path(settings.remote_root, path)
    if not p.exists() or not p.is_dir():
        raise HTTPException(404, "Not a directory")

    items = [_file_info(child, settings.remote_root) for child in p.iterdir()]
    # Optional: sort dirs first, then by name
    items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
    return {"path": path, "items": items}

@router.get("/download")
def download(path: str, user: str = Depends(require_auth)):
    p = safe_path(settings.remote_root, path)
    if not p.exists() or not p.is_file():
        raise HTTPException(404, "File not found")

    # FileResponse streams the file efficiently.
    return FileResponse(
        path=str(p),
        filename=p.name,
        media_type="application/octet-stream",
    )

@router.post("/upload")
def upload(
    path: str,
    overwrite: bool = False,
    file: UploadFile = File(...),
    user: str = Depends(require_auth),
):
    dest = safe_path(settings.remote_root, path)

    if dest.exists() and not overwrite:
        raise HTTPException(409, "File already exists (set overwrite=true to replace)")

    dest.parent.mkdir(parents=True, exist_ok=True)

    # Atomic-ish write: write to a temp file in the same directory, then replace.
    # This prevents partial/corrupt files if an upload is interrupted.
    with tempfile.NamedTemporaryFile(delete=False, dir=str(dest.parent)) as tmp:
        tmp_path = Path(tmp.name)
        try:
            shutil.copyfileobj(file.file, tmp)
        finally:
            file.file.close()

    try:
        os.replace(str(tmp_path), str(dest))
    except Exception:
        # Cleanup temp file if replace fails
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)
        raise

    return {"ok": True, "item": _file_info(dest, settings.remote_root)}

@router.post("/mkdir")
def mkdir(path: str, parents: bool = True, user: str = Depends(require_auth)):
    p = safe_path(settings.remote_root, path)
    if p.exists():
        raise HTTPException(409, "Path already exists")

    p.mkdir(parents=parents, exist_ok=False)
    return {"ok": True, "item": _file_info(p, settings.remote_root)}

@router.post("/move")
def move(
    src: str,
    dst: str,
    overwrite: bool = False,
    user: str = Depends(require_auth),
):
    src_p = safe_path(settings.remote_root, src)
    dst_p = safe_path(settings.remote_root, dst)

    if not src_p.exists():
        raise HTTPException(404, "Source not found")

    if dst_p.exists() and not overwrite:
        raise HTTPException(409, "Destination exists (set overwrite=true to replace)")

    dst_p.parent.mkdir(parents=True, exist_ok=True)

    # If overwrite=true and destination exists, remove it first.
    if overwrite and dst_p.exists():
        if dst_p.is_dir():
            shutil.rmtree(dst_p)
        else:
            dst_p.unlink()

    shutil.move(str(src_p), str(dst_p))
    return {"ok": True, "src": src, "dst": dst}

@router.delete("/delete")
def delete(path: str, recursive: bool = False, user: str = Depends(require_auth)):
    p = safe_path(settings.remote_root, path)
    if not p.exists():
        raise HTTPException(404, "Not found")

    if p.is_dir():
        if recursive:
            shutil.rmtree(p)
        else:
            # Only deletes empty dir
            p.rmdir()
    else:
        p.unlink()

    return {"ok": True, "deleted": path}