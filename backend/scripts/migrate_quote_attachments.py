"""
Move legacy guest-quote attachments out of the public uploads directory.

Before the attachment security fix, guest quote attachments were written to
``<uploads>/quotes/<quote_number>/<timestamp>_<name>`` (``<uploads>`` is
``FRONTEND_PATH/uploads`` in production, i.e. inside the Apache docroot) and
``QuoteAttachment.file_url`` pointed at ``/uploads/quotes/...``, so anyone with
the URL could download them.

New attachments live in ``private_uploads/quotes/<quote_number>/<32 hex>.<ext>``
and are served only by the admin endpoint
``/api/v1/admin/quotes/attachments/<quote_number>/<name>``. This script moves
every file under ``<uploads>/quotes`` into that scheme:

* Files whose magic bytes are an allowed attachment type (PDF/PNG/JPEG/WEBP)
  are renamed to ``<uuid hex>.<canonical ext>`` in the private directory and
  matching ``QuoteAttachment.file_url`` values are rewritten (``file_type`` is
  set to the sniffed MIME type).
* Anything else (unknown content, bad quote-number folder, stray files) is
  quarantined - never deleted - under ``private_uploads/rejected/quotes/...``
  and its DB rows are pointed at a non-servable ``quarantined:`` marker.

Idempotent: target names are deterministic (uuid5 of the legacy path), the
source is only removed after the DB commit, and a re-run finds nothing left to
move. Rows still pointing at /uploads/quotes/ with no file on disk are reported.

Usage (from the project root, venv active):

    python -m backend.scripts.migrate_quote_attachments --dry-run
    python -m backend.scripts.migrate_quote_attachments
    python -m backend.scripts.migrate_quote_attachments --uploads-dir /path/to/frontend/uploads
"""

import argparse
import logging
import os
import re
import shutil
import sys
import uuid
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy import create_engine, select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

import backend.models  # noqa: E402,F401  (register all mappers)
from backend.core.config import settings  # noqa: E402
from backend.models.quote import QuoteAttachment  # noqa: E402
from backend.scripts.add_performance_indexes import sync_database_url  # noqa: E402
from backend.services.quote_service import (  # noqa: E402
    GUEST_ATTACHMENT_MIME_TYPES,
    QUOTE_ATTACHMENT_DIR,
    QUOTE_ATTACHMENT_URL_PREFIX,
)
from backend.utils.file_validation import (  # noqa: E402
    PRIVATE_UPLOAD_DIR,
    extension_for_mime,
    is_within_directory,
    sniff_file_type,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)-8s %(message)s")
logger = logging.getLogger("migrate_quote_attachments")

LEGACY_URL_PREFIX = "/uploads/quotes"
REJECTED_DIR = PRIVATE_UPLOAD_DIR / "rejected" / "quotes"
QUARANTINE_URL_PREFIX = "quarantined:rejected/quotes"
# Same constraints as the admin download endpoint (admin/quotes.py)
QUOTE_NUMBER_RE = re.compile(r"^[A-Za-z0-9-]{1,50}$")
_NAMESPACE = uuid.UUID("5b0f3c2e-8a4d-4f7e-9c1a-6d2e7f8a9b0c")


def default_uploads_dir() -> Path:
    """Same resolution as backend.api.v1.routes.admin.upload.get_upload_base_dir."""
    frontend_path = Path(settings.FRONTEND_PATH)
    if frontend_path.is_absolute():
        return frontend_path / "uploads"
    return PROJECT_ROOT / "uploads"


def private_name(quote_number: str, legacy_name: str, ext: str) -> str:
    """Deterministic uuid-hex name so re-runs after a crash reuse the same target."""
    return uuid.uuid5(_NAMESPACE, f"{quote_number}/{legacy_name}").hex + ext


def _safe_component(name: str) -> str:
    return "".join(c for c in name if c.isalnum() or c in ".-_") or "file"


def _quarantine_target(rel: Path) -> Path:
    parts = [_safe_component(p) for p in rel.parts]
    target = REJECTED_DIR.joinpath(*parts)
    stem, suffix, n = target.stem, target.suffix, 1
    while target.exists():
        target = target.with_name(f"{stem}.dup{n}{suffix}")
        n += 1
    return target


def _move(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    os.chmod(dst.parent, 0o700)
    tmp = dst.with_name(dst.name + ".tmp")
    shutil.copyfile(src, tmp)
    os.chmod(tmp, 0o600)
    os.replace(tmp, dst)


def run(uploads_dir: Path, dry_run: bool) -> dict:
    stats = {"moved": 0, "quarantined": 0, "rows_updated": 0, "orphan_files": 0, "missing_files": 0}
    legacy_root = uploads_dir / "quotes"
    prefix = "[dry-run] " if dry_run else ""
    logger.info("Legacy dir: %s", legacy_root)
    logger.info("Private dir: %s", QUOTE_ATTACHMENT_DIR)

    engine = create_engine(sync_database_url(settings.database_url_async), poolclass=NullPool)
    try:
        with Session(engine) as db:
            files = []
            if legacy_root.is_dir():
                for p in sorted(legacy_root.rglob("*")):
                    if p.is_symlink() or not is_within_directory(p, legacy_root):
                        # Never follow links; the web-server block still covers them
                        logger.warning("Skipping symlink %s (remove it manually)", p)
                    elif p.is_file():
                        files.append(p)
            else:
                logger.info("No legacy directory found")

            for src in files:
                rel = src.relative_to(legacy_root)
                legacy_url = f"{LEGACY_URL_PREFIX}/{rel.as_posix()}"
                rows = db.execute(
                    select(QuoteAttachment).where(QuoteAttachment.file_url == legacy_url)
                ).scalars().all()
                if not rows:
                    stats["orphan_files"] += 1

                mime = None
                if len(rel.parts) == 2 and QUOTE_NUMBER_RE.match(rel.parts[0]):
                    with open(src, "rb") as fh:
                        mime = sniff_file_type(fh.read(16))

                if mime in GUEST_ATTACHMENT_MIME_TYPES:
                    quote_number = rel.parts[0]
                    name = private_name(quote_number, rel.parts[1], extension_for_mime(mime))
                    dst = QUOTE_ATTACHMENT_DIR / quote_number / name
                    if not is_within_directory(dst, QUOTE_ATTACHMENT_DIR):
                        raise RuntimeError(f"Refusing path outside private dir: {dst}")
                    new_url = f"{QUOTE_ATTACHMENT_URL_PREFIX}/{quote_number}/{name}"
                    logger.info("%smove %s -> %s (%d row(s))", prefix, legacy_url, dst, len(rows))
                    stats["moved"] += 1
                    for row in rows:
                        row.file_url = new_url
                        row.file_type = mime
                else:
                    dst = _quarantine_target(rel)
                    new_url = f"{QUARANTINE_URL_PREFIX}/{dst.relative_to(REJECTED_DIR).as_posix()}"
                    logger.warning(
                        "%squarantine %s -> %s (%s, %d row(s))",
                        prefix, legacy_url, dst, "failed validation", len(rows),
                    )
                    stats["quarantined"] += 1
                    for row in rows:
                        row.file_url = new_url
                stats["rows_updated"] += len(rows)

                if dry_run:
                    db.rollback()
                    continue
                _move(src, dst)
                db.commit()
                src.unlink()

            # Rows that still point at the public path but have no file on disk
            missing = db.execute(
                select(QuoteAttachment).where(QuoteAttachment.file_url.like(f"{LEGACY_URL_PREFIX}/%"))
            ).scalars().all()
            for row in missing:
                if not (legacy_root / row.file_url[len(LEGACY_URL_PREFIX) + 1:]).is_file():
                    logger.warning("Row %s (quote_id=%s) points at missing file %s", row.id, row.quote_id, row.file_url)
                    stats["missing_files"] += 1
    finally:
        engine.dispose()

    if not dry_run and legacy_root.is_dir():
        for d in sorted((p for p in legacy_root.rglob("*") if p.is_dir()), key=lambda p: len(p.parts), reverse=True):
            try:
                d.rmdir()
            except OSError:
                pass

    logger.info(
        "%sDone: %d moved, %d quarantined, %d DB row(s) rewritten, %d file(s) with no DB row, %d row(s) with missing file",
        prefix, stats["moved"], stats["quarantined"], stats["rows_updated"], stats["orphan_files"], stats["missing_files"],
    )
    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--dry-run", action="store_true", help="Report what would change without touching files or the DB")
    parser.add_argument(
        "--uploads-dir",
        type=Path,
        default=None,
        help="Public uploads directory containing quotes/ (default: FRONTEND_PATH/uploads, or <repo>/uploads in dev)",
    )
    args = parser.parse_args()
    run((args.uploads_dir or default_uploads_dir()).resolve(), args.dry_run)


if __name__ == "__main__":
    main()
