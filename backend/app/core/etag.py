"""
ETag helpers (lightweight conflict detection).

We use a weak ETag derived from mtime_ns + size.
This is fast (no hashing file contents) and good enough to detect changes.
"""
from pathlib import Path

def compute_etag(p: Path) -> str:
    st = p.stat()
    return f'W/"{st.st_mtime_ns}-{st.st_size}"'