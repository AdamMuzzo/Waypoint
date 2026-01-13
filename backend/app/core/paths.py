"""
Filesystem path safety helpers.

safe_path(root, rel_path):
- Resolves a user-supplied relative path against the configured sandbox root.
- Rejects path traversal attempts (e.g., ..\..\Windows\System32).
"""

from pathlib import Path
from fastapi import HTTPException

def safe_path(root: Path, rel_path: str) -> Path:
    candidate = (root / rel_path.lstrip("/\\")).resolve()
    if candidate != root and root not in candidate.parents:
        raise HTTPException(400, "Invalid path (outside sandbox root)")
    return candidate