"""
Generate Responsive Image Renditions for Existing Uploads

Walks <uploads>/images/** and writes, next to every JPEG/PNG/WebP original,
the renditions described in backend/services/media_service.py: a tiny
placeholder (`.w32.webp`), responsive widths (`.w{N}.webp`) and a
full-resolution WebP (`.full.webp`). Originals and DB URLs are left untouched:
the frontend derives rendition URLs from the stored URL and falls back to the
original if one is missing.

Idempotent: a variant is only rewritten when missing or older than its source.

Usage (from the project root, venv active):

    python -m backend.scripts.generate_image_variants --dry-run
    python -m backend.scripts.generate_image_variants
    python -m backend.scripts.generate_image_variants --uploads-dir /home/dh_wmujeb/joshua.eaglechair.com/uploads
    python -m backend.scripts.generate_image_variants --force --workers 2
    python -m backend.scripts.generate_image_variants --prune   # delete variants whose source is gone
"""

import argparse
import logging
import os
import re
import sys
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.services import media_service  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-8s  %(message)s", datefmt="%H:%M:%S")
logger = logging.getLogger("generate_image_variants")

SOURCE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".bmp"}  # match getImageSrcSet in apiHelpers.js


def default_uploads_dir() -> Path:
    from backend.core.config import settings

    frontend_path = Path(settings.FRONTEND_PATH)
    if frontend_path.is_absolute():
        return frontend_path / "uploads"
    return PROJECT_ROOT / "uploads"


def find_sources(images_dir: Path) -> list[Path]:
    sources = [
        p for p in images_dir.rglob("*")
        if p.is_file() and p.suffix.lower() in SOURCE_EXTENSIONS and not media_service.is_variant_path(p)
    ]
    # foo.jpg and foo.png would both map to foo.w640.webp; prefer the newest.
    by_stem: dict[Path, list[Path]] = defaultdict(list)
    for p in sources:
        by_stem[p.with_suffix("")].append(p)
    result = []
    for stem, group in by_stem.items():
        if len(group) > 1:
            group.sort(key=lambda p: p.stat().st_mtime, reverse=True)
            logger.warning(f"Stem collision, using {group[0].name}, skipping {[g.name for g in group[1:]]}")
        result.append(group[0])
    return sorted(result)


def _process(path_str: str, force: bool) -> tuple[str, int, str | None]:
    path = Path(path_str)
    try:
        return path_str, media_service.write_variants(path, force=force), None
    except Exception as exc:  # corrupt/unsupported file: report and move on
        return path_str, 0, str(exc)


def prune(images_dir: Path, dry_run: bool) -> int:
    removed = 0
    for v in images_dir.rglob("*.webp"):
        if not media_service.is_variant_path(v):
            continue
        stem = re.sub(r"\.(w\d+|full)\.webp$", "", v.name, flags=re.IGNORECASE)
        if not any((v.parent / f"{stem}{ext}").exists() for ext in SOURCE_EXTENSIONS | {e.upper() for e in SOURCE_EXTENSIONS}):
            logger.info(f"{'[dry-run] ' if dry_run else ''}orphan variant: {v}")
            if not dry_run:
                v.unlink()
            removed += 1
    return removed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--uploads-dir", type=Path, default=None)
    parser.add_argument("--dry-run", action="store_true", help="List what would be generated; write nothing.")
    parser.add_argument("--force", action="store_true", help="Regenerate variants even if up to date.")
    parser.add_argument("--workers", type=int, default=max(1, min(4, (os.cpu_count() or 2) - 1)))
    parser.add_argument("--prune", action="store_true", help="Delete variants whose source image no longer exists.")
    args = parser.parse_args()

    uploads_dir = (args.uploads_dir or default_uploads_dir()).resolve()
    images_dir = uploads_dir / "images"
    if not images_dir.is_dir():
        logger.error(f"No images directory at {images_dir}")
        return 1

    if args.prune:
        n = prune(images_dir, args.dry_run)
        logger.info(f"{n} orphan variant(s) {'found' if args.dry_run else 'removed'}")
        return 0

    sources = find_sources(images_dir)
    logger.info(f"{len(sources)} source image(s) under {images_dir}")

    if args.dry_run:
        pending = [
            s for s in sources
            if args.force or any(
                not v.exists() or v.stat().st_mtime < s.stat().st_mtime for v in media_service.variant_paths(s)
            )
        ]
        for s in pending:
            logger.info(f"[dry-run] would generate variants for {s.relative_to(uploads_dir)}")
        logger.info(f"[dry-run] {len(pending)} image(s) need variants")
        return 0

    written = failed = 0
    with ProcessPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(_process, str(s), args.force) for s in sources]
        for i, fut in enumerate(as_completed(futures), 1):
            path_str, count, error = fut.result()
            if error:
                failed += 1
                logger.warning(f"FAILED {path_str}: {error}")
            written += count
            if i % 50 == 0:
                logger.info(f"  {i}/{len(sources)} processed")

    logger.info(f"Done: {written} variant file(s) written, {failed} failure(s)")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
