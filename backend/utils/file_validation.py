"""
File validation helpers

Strict content (magic byte) sniffing for user-supplied uploads and the
private, non-web-served storage location for sensitive files.
"""

from pathlib import Path
from typing import Optional

# Repository root (backend/utils/file_validation.py -> repo root), independent of CWD/settings
REPO_ROOT = Path(__file__).resolve().parent.parent.parent

# Private storage: NOT under the public /uploads static mount
PRIVATE_UPLOAD_DIR = REPO_ROOT / "private_uploads"

# Canonical extension for each accepted content type
_MIME_EXTENSIONS = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def sniff_file_type(content: bytes) -> Optional[str]:
    """
    Detect MIME type from magic bytes only (never from filename or client headers).

    Returns one of the MIME types in _MIME_EXTENSIONS, or None if unrecognized.
    """
    if not content:
        return None
    if content.startswith(b"%PDF-"):
        return "application/pdf"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        return "image/webp"
    if content.startswith(b"GIF87a") or content.startswith(b"GIF89a"):
        return "image/gif"
    return None


def extension_for_mime(mime_type: str) -> Optional[str]:
    """Return the canonical file extension (with dot) for a sniffed MIME type."""
    return _MIME_EXTENSIONS.get(mime_type)


def is_within_directory(path: Path, directory: Path) -> bool:
    """True if `path` resolves to a location inside `directory`."""
    try:
        path.resolve().relative_to(directory.resolve())
        return True
    except ValueError:
        return False
