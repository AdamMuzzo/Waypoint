"""
Compatibility shim.

Use app.config instead. This module re-exports settings to avoid breaking imports.
"""
from app.config import Settings, settings  # noqa: F401
