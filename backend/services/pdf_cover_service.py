"""
PDF Cover Service

Renders the first page of an uploaded PDF as a WebP cover so catalogs, spec
sheets, guides and drawings get a picture wherever documents are listed (admin
media/document library, public catalog cards) even when nobody uploaded a
cover image.

Covers are rendered on first request and cached under
uploads/.cache/pdf-covers, keyed by the PDF's path and modification time, so a
replaced PDF gets a fresh cover. A PDF that can't be rendered (encrypted,
corrupt, no pages) leaves a failure marker so it isn't retried on every
request; callers fall back to their file icon.
"""

import hashlib
import logging
import os
from pathlib import Path
from urllib.parse import quote

import fitz

from backend.services import document_library_service

logger = logging.getLogger(__name__)

COVER_WIDTH = 600
CACHE_SUBDIR = Path(".cache") / "pdf-covers"
ENDPOINT = "/api/v1/content/document-cover"


def is_pdf(url: str | None) -> bool:
    return bool(url) and url.split("?", 1)[0].lower().endswith(".pdf")


def cover_url(raw_url: str | None, version: float | None = None) -> str | None:
    """Public URL of the rendered cover for an uploaded PDF, or None if it isn't one."""
    path = document_library_service.normalize_url(raw_url or "")
    if not path or not is_pdf(path):
        return None
    url = f"{ENDPOINT}?url={quote(path, safe='/')}"
    if version:
        url += f"&v={int(version)}"
    return url


def _cache_paths(pdf_path: Path, upload_base: Path) -> tuple[Path, Path]:
    stat = pdf_path.stat()
    digest = hashlib.sha1(f"{pdf_path}|{int(stat.st_mtime)}|{stat.st_size}".encode()).hexdigest()
    cache_dir = upload_base / CACHE_SUBDIR / digest[:2]
    return cache_dir / f"{digest}.webp", cache_dir / f"{digest}.failed"


def _render(pdf_path: Path, out: Path) -> None:
    with fitz.open(str(pdf_path)) as doc:
        if doc.needs_pass or len(doc) == 0:
            raise ValueError("PDF is encrypted or has no pages")
        page = doc[0]
        zoom = COVER_WIDTH / max(page.rect.width, 1)
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        data = pix.pil_tobytes("WEBP", quality=82)
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(f".{os.getpid()}.tmp")
    tmp.write_bytes(data)
    os.replace(tmp, out)


def get_cover(raw_url: str, upload_base: Path) -> Path | None:
    """
    Cached cover image for an uploaded PDF, rendering it if needed.
    None when the URL isn't an uploaded PDF, the file is missing, or it can't be rendered.
    Blocking (PyMuPDF): call from a threadpool.
    """
    if not is_pdf(raw_url):
        return None
    pdf_path = document_library_service.resolve_document_path(raw_url, upload_base)
    if pdf_path is None or not pdf_path.is_file():
        return None
    try:
        out, failed = _cache_paths(pdf_path, upload_base)
    except OSError:
        return None
    if out.is_file():
        return out
    if failed.exists():
        return None
    try:
        _render(pdf_path, out)
        return out
    except Exception as exc:
        logger.warning(f"Could not render PDF cover for {raw_url}: {exc}")
        try:
            failed.parent.mkdir(parents=True, exist_ok=True)
            failed.touch()
        except OSError:
            pass
        return None
