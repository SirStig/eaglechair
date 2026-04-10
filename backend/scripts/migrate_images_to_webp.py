"""
Migrate Existing Uploaded Images to WebP

Converts every JPEG/PNG in the uploads directory to WebP (quality 85, max 2000px),
then rewrites all database references so URLs point to the new .webp files.

GIF and SVG files are left untouched.
Files already in WebP format are skipped.

Usage
-----
From the project root with the virtualenv active:

    # Preview what would change (no files written, no DB changes)
    python -m backend.scripts.migrate_images_to_webp --dry-run

    # Run the migration (keeps originals by default)
    python -m backend.scripts.migrate_images_to_webp

    # Run and delete originals after successful conversion
    python -m backend.scripts.migrate_images_to_webp --delete-originals

    # Point at a different uploads root (e.g. production path)
    python -m backend.scripts.migrate_images_to_webp --uploads-dir /path/to/uploads
"""

import argparse
import asyncio
import io
import logging
import sys
from pathlib import Path
from typing import Any

from PIL import Image
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# ---------------------------------------------------------------------------
# Project path setup (so this runs from any cwd)
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.core.config import settings  # noqa: E402 – must come after path fix
from backend.models.chair import (  # noqa: E402
    Category,
    Chair,
    Color,
    Finish,
    ProductFamily,
    ProductImage,
    ProductVariation,
    Upholstery,
)
from backend.models.content import (  # noqa: E402
    Catalog,
    ClientLogo,
    CompanyInfo,
    CompanyMilestone,
    CompanyValue,
    ContactLocation,
    Feature,
    Hardware,
    HeroSlide,
    Installation,
    Laminate,
    PageContent,
    SalesRepresentative,
    SiteSettings,
    TeamMember,
)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("migrate_webp")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CONVERTIBLE_SUFFIXES = {".jpg", ".jpeg", ".png"}
MAX_DIMENSION = 2000


# ---------------------------------------------------------------------------
# Image conversion
# ---------------------------------------------------------------------------

def convert_to_webp(src: Path, dry_run: bool) -> Path | None:
    """
    Convert *src* to WebP next to the original.

    Returns the destination Path on success, None if skipped/failed.
    """
    dest = src.with_suffix(".webp")

    if dest.exists():
        log.debug("  already exists, skip: %s", dest.name)
        return dest  # idempotent

    if dry_run:
        log.info("  [dry-run] would convert → %s", dest.name)
        return dest

    try:
        img = Image.open(src)

        # Correct EXIF orientation
        try:
            import PIL.ExifTags
            exif = img.getexif()
            orient_key = next(
                (k for k, v in PIL.ExifTags.TAGS.items() if v == "Orientation"), None
            )
            if orient_key and orient_key in exif:
                rotation = {3: 180, 6: 270, 8: 90}.get(exif[orient_key])
                if rotation:
                    img = img.rotate(rotation, expand=True)
        except Exception:
            pass

        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA" if img.mode in ("P", "LA") else "RGB")

        w, h = img.size
        if w > MAX_DIMENSION or h > MAX_DIMENSION:
            img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.LANCZOS)

        buf = io.BytesIO()
        img.save(buf, format="WEBP", quality=85, method=6)

        dest.write_bytes(buf.getvalue())

        orig_kb = src.stat().st_size // 1024
        new_kb = dest.stat().st_size // 1024
        pct = round((1 - new_kb / max(orig_kb, 1)) * 100)
        log.info("  converted  %s → %s  (%d KB → %d KB, -%d%%)", src.name, dest.name, orig_kb, new_kb, pct)
        return dest

    except Exception as exc:
        log.error("  FAILED to convert %s: %s", src, exc)
        return None


# ---------------------------------------------------------------------------
# Filesystem scan
# ---------------------------------------------------------------------------

def scan_uploads(uploads_dir: Path, dry_run: bool) -> dict[str, str]:
    """
    Walk *uploads_dir*, convert all eligible images to WebP, and return a
    mapping of old URL path → new URL path.

    URL paths look like  /uploads/images/products/chair_123.jpg
    """
    if not uploads_dir.exists():
        log.warning("Uploads directory not found: %s", uploads_dir)
        return {}

    url_mapping: dict[str, str] = {}
    total = skipped = converted = failed = 0

    for src in sorted(uploads_dir.rglob("*")):
        if not src.is_file():
            continue
        if src.suffix.lower() not in CONVERTIBLE_SUFFIXES:
            continue

        total += 1
        dest = convert_to_webp(src, dry_run)

        if dest is None:
            failed += 1
            continue

        # Build URL path relative to parent of uploads dir
        # uploads dir is  /project/uploads  → URL root is  /uploads/...
        try:
            rel = src.relative_to(uploads_dir.parent)
        except ValueError:
            rel = src.relative_to(uploads_dir)
            rel = Path("uploads") / rel

        old_url = "/" + rel.as_posix()
        new_url = "/" + rel.with_suffix(".webp").as_posix()

        if old_url != new_url:
            url_mapping[old_url] = new_url

        if dest.exists() and dest != src:
            converted += 1
        else:
            skipped += 1

    log.info(
        "Files: %d eligible  |  %d converted  |  %d already-webp/skipped  |  %d failed",
        total, converted, skipped, failed,
    )
    return url_mapping


# ---------------------------------------------------------------------------
# URL replacement helpers
# ---------------------------------------------------------------------------

def remap_url(url: Any, mapping: dict[str, str]) -> str | None:
    """Return the new URL if *url* is in *mapping*, else None."""
    if not isinstance(url, str):
        return None
    return mapping.get(url)


def remap_json_list(items: Any, mapping: dict[str, str]) -> tuple[Any, bool]:
    """
    Walk a JSON list that may contain:
      - plain strings             "url"
      - dicts with a "url" key   {"url": "...", ...}

    Returns (updated_list, changed: bool).
    """
    if not isinstance(items, list):
        return items, False

    changed = False
    result = []
    for item in items:
        if isinstance(item, str):
            new = mapping.get(item)
            if new:
                result.append(new)
                changed = True
            else:
                result.append(item)
        elif isinstance(item, dict) and "url" in item:
            new = mapping.get(item["url"])
            if new:
                result.append({**item, "url": new})
                changed = True
            else:
                result.append(item)
        else:
            result.append(item)

    return result, changed


# ---------------------------------------------------------------------------
# Database updates
# ---------------------------------------------------------------------------

async def update_db(session: AsyncSession, mapping: dict[str, str], dry_run: bool) -> int:
    """
    Rewrite all image URL references in the database.

    Returns total number of rows updated.
    """
    if not mapping:
        log.info("No URL mapping — nothing to update in DB.")
        return 0

    total_updated = 0

    # ------------------------------------------------------------------
    # Helper: update a single string column across an entire table
    # ------------------------------------------------------------------
    async def patch_string_col(model, col_name: str):
        nonlocal total_updated
        result = await session.execute(
            select(model).where(getattr(model, col_name).is_not(None))
        )
        rows = result.scalars().all()
        count = 0
        for row in rows:
            old = getattr(row, col_name)
            new = remap_url(old, mapping)
            if new:
                if not dry_run:
                    setattr(row, col_name, new)
                count += 1
        if count:
            log.info("  %s.%s: %d row(s) updated", model.__tablename__, col_name, count)
            total_updated += count

    # ------------------------------------------------------------------
    # Helper: update a JSON list column
    # ------------------------------------------------------------------
    async def patch_json_col(model, col_name: str):
        nonlocal total_updated
        result = await session.execute(
            select(model).where(getattr(model, col_name).is_not(None))
        )
        rows = result.scalars().all()
        count = 0
        for row in rows:
            old_list = getattr(row, col_name)
            new_list, changed = remap_json_list(old_list, mapping)
            if changed:
                if not dry_run:
                    setattr(row, col_name, new_list)
                    # Force SQLAlchemy to detect the change on a JSON column
                    from sqlalchemy.orm.attributes import flag_modified
                    flag_modified(row, col_name)
                count += 1
        if count:
            log.info("  %s.%s: %d row(s) updated", model.__tablename__, col_name, count)
            total_updated += count

    # ------------------------------------------------------------------
    # Simple string columns
    # ------------------------------------------------------------------
    log.info("Updating simple string URL columns…")

    await patch_string_col(Category, "icon_url")
    await patch_string_col(Category, "banner_image_url")

    await patch_string_col(ProductFamily, "family_image")
    await patch_string_col(ProductFamily, "banner_image_url")

    await patch_string_col(Finish, "image_url")

    await patch_string_col(Upholstery, "image_url")
    await patch_string_col(Upholstery, "swatch_image_url")

    await patch_string_col(Chair, "primary_image_url")
    await patch_string_col(Chair, "thumbnail")

    await patch_string_col(ProductVariation, "primary_image_url")

    await patch_string_col(ProductImage, "image_url")

    await patch_string_col(Color, "image_url")

    await patch_string_col(TeamMember, "photo_url")

    await patch_string_col(CompanyInfo, "image_url")

    await patch_string_col(Catalog, "thumbnail_url")

    await patch_string_col(Installation, "primary_image")

    await patch_string_col(ContactLocation, "image_url")

    await patch_string_col(HeroSlide, "background_image_url")

    await patch_string_col(ClientLogo, "logo_url")

    await patch_string_col(Feature, "image_url")

    await patch_string_col(CompanyValue, "image_url")

    await patch_string_col(CompanyMilestone, "image_url")

    await patch_string_col(SalesRepresentative, "photo_url")

    await patch_string_col(SiteSettings, "logo_url")
    await patch_string_col(SiteSettings, "logo_dark_url")
    await patch_string_col(SiteSettings, "favicon_url")

    await patch_string_col(PageContent, "image_url")

    await patch_string_col(Hardware, "image_url")
    await patch_string_col(Hardware, "thumbnail_url")

    await patch_string_col(Laminate, "swatch_image_url")
    await patch_string_col(Laminate, "full_image_url")

    # ------------------------------------------------------------------
    # JSON list columns
    # ------------------------------------------------------------------
    log.info("Updating JSON list URL columns…")

    await patch_json_col(Chair, "images")
    await patch_json_col(Chair, "hover_images")

    await patch_json_col(ProductVariation, "images")

    await patch_json_col(Installation, "images")

    await patch_json_col(Hardware, "additional_images")

    await patch_json_col(Laminate, "additional_images")

    if not dry_run:
        await session.commit()
        log.info("DB changes committed.")
    else:
        await session.rollback()
        log.info("[dry-run] DB changes rolled back (nothing persisted).")

    return total_updated


# ---------------------------------------------------------------------------
# Delete originals
# ---------------------------------------------------------------------------

def delete_originals(url_mapping: dict[str, str], uploads_dir: Path, dry_run: bool):
    """Delete original JPEG/PNG files that were successfully converted."""
    deleted = 0
    for old_url in url_mapping:
        # Reconstruct the filesystem path from the URL
        # URL: /uploads/images/products/chair_123.jpg
        # Path: <uploads_dir.parent>/uploads/images/products/chair_123.jpg
        rel = old_url.lstrip("/")
        old_path = uploads_dir.parent / rel

        new_path = old_path.with_suffix(".webp")
        if not new_path.exists():
            log.warning("WebP not found for %s — keeping original", old_path.name)
            continue

        if old_path.exists():
            if dry_run:
                log.info("  [dry-run] would delete %s", old_path)
            else:
                old_path.unlink()
                log.info("  deleted %s", old_path)
            deleted += 1

    log.info("Originals deleted: %d", deleted)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def main(uploads_dir: Path, dry_run: bool, delete_originals_flag: bool):
    log.info("=" * 60)
    log.info("EagleChair → WebP image migration")
    log.info("uploads dir : %s", uploads_dir)
    log.info("dry run     : %s", dry_run)
    log.info("del originals: %s", delete_originals_flag)
    log.info("=" * 60)

    # 1. Convert files on disk
    log.info("\n── Step 1: Convert images on disk ──────────────────────")
    url_mapping = scan_uploads(uploads_dir, dry_run)

    if not url_mapping:
        log.info("No images needed conversion. DB will still be checked for stale URLs.")

    # 2. Update database
    log.info("\n── Step 2: Update database references ──────────────────")
    engine = create_async_engine(settings.database_url_async, echo=False)
    SessionMaker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with SessionMaker() as session:
        db_rows_updated = await update_db(session, url_mapping, dry_run)

    await engine.dispose()

    # 3. Optionally delete originals
    if delete_originals_flag and url_mapping:
        log.info("\n── Step 3: Delete original files ───────────────────────")
        delete_originals(url_mapping, uploads_dir, dry_run)

    # Summary
    log.info("\n── Done ─────────────────────────────────────────────────")
    log.info("Images remapped : %d", len(url_mapping))
    log.info("DB rows updated : %d", db_rows_updated)
    if dry_run:
        log.info("This was a DRY RUN — no files were written and no DB changes were saved.")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Convert uploaded images to WebP and update the database."
    )
    parser.add_argument(
        "--uploads-dir",
        type=Path,
        default=None,
        help=(
            "Path to the uploads root directory. "
            "Defaults to <project_root>/uploads in dev or "
            "<FRONTEND_PATH>/uploads in production."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without writing any files or touching the DB.",
    )
    parser.add_argument(
        "--delete-originals",
        action="store_true",
        help="Delete original JPEG/PNG files after successful WebP conversion.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    # Resolve uploads directory (mirrors the logic in upload.py)
    if args.uploads_dir:
        uploads_dir = args.uploads_dir.resolve()
    else:
        frontend_path = Path(settings.FRONTEND_PATH)
        if frontend_path.is_absolute():
            uploads_dir = frontend_path / "uploads"
        else:
            uploads_dir = PROJECT_ROOT / "uploads"

    asyncio.run(main(uploads_dir, args.dry_run, args.delete_originals))
