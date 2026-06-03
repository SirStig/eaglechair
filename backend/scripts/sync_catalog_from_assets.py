"""
Sync production catalog from Eagle Chair assets: audit, cleanup junk/duplicates, enrich images and PDF data.

Usage (from repo root, venv active):
  python -m backend.scripts.sync_catalog_from_assets audit --env-file backend/.env.production
  python -m backend.scripts.sync_catalog_from_assets cleanup --env-file backend/.env.production --dry-run
  python -m backend.scripts.sync_catalog_from_assets cleanup --env-file backend/.env.production --apply
  python -m backend.scripts.sync_catalog_from_assets enrich-images --env-file backend/.env.production --apply
  python -m backend.scripts.sync_catalog_from_assets enrich-catalog --env-file backend/.env.production --apply
  python -m backend.scripts.sync_catalog_from_assets all --env-file backend/.env.production --apply

Exports deletion plans to backend/scripts/output/ before destructive steps.
"""

import argparse
import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

if "--env-file" in sys.argv:
    idx = sys.argv.index("--env-file")
    env_path = sys.argv[idx + 1] if idx + 1 < len(sys.argv) and not sys.argv[idx + 1].startswith("-") else "backend/.env.production"
    env_path = project_root / env_path if not os.path.isabs(env_path) else Path(env_path)
    if env_path.is_file():
        from dotenv import load_dotenv
        load_dotenv(env_path, override=True)

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.core.config import settings
from backend.database.base import AsyncSessionLocal
from backend.models.chair import Chair, ProductFamily, ProductVariation
from backend.scripts.catalog_sync_utils import (
    build_images_json,
    classify_junk,
    copy_asset_to_uploads,
    dims_to_update,
    find_duplicate_groups,
    index_asset_images,
    parse_pdfs_for_models,
    pick_best_asset_image,
    variations_from_pdf_record,
)
from backend.services.admin_service import AdminService

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

DEFAULT_ASSETS = "/home/jkac/Documents/Eagel Chair Assets"
DEFAULT_PDF_DIR = f"{DEFAULT_ASSETS}/catalog pages 4 email"
OUTPUT_DIR = project_root / "backend" / "scripts" / "output"


def resolve_uploads_dir(cli_uploads: Optional[str]) -> Path:
    if cli_uploads:
        return Path(cli_uploads).resolve()
    frontend = Path(settings.FRONTEND_PATH)
    if frontend.is_absolute() and (frontend / "uploads").exists():
        return frontend / "uploads"
    local = project_root / "uploads"
    local.mkdir(parents=True, exist_ok=True)
    return local


def _write_report(name: str, data: Any) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = OUTPUT_DIR / f"{name}_{ts}.json"
    path.write_text(json.dumps(data, indent=2, default=str))
    logger.info("Wrote %s", path)
    return path


async def cmd_audit(assets_root: Path, pdf_dir: Path) -> Dict[str, Any]:
    asset_index = index_asset_images(assets_root)
    async with AsyncSessionLocal() as db:
        chairs = (await db.execute(select(Chair))).scalars().all()
        variations = (await db.execute(select(ProductVariation))).scalars().all()
        families = (await db.execute(select(ProductFamily))).scalars().all()

    junk = []
    for c in chairs:
        reason = classify_junk(c)
        if reason:
            junk.append({"id": c.id, "model_number": c.model_number, "name": c.name, "slug": c.slug, "reason": reason})

    dup_groups = find_duplicate_groups(chairs)
    dups = [
        {
            "model_number": g[0].model_number,
            "model_suffix": g[0].model_suffix,
            "keep_id": g[0].id,
            "delete_ids": [x.id for x in g[1:]],
        }
        for g in dup_groups
    ]

    no_image = [c.id for c in chairs if c.is_active and not c.primary_image_url]
    asset_match = [c.id for c in chairs if c.model_number in asset_index]
    gaps = [
        {"id": c.id, "model_number": c.model_number, "name": c.name}
        for c in chairs
        if c.is_active and c.model_number and c.model_number not in asset_index
    ]

    report = {
        "counts": {
            "chairs": len(chairs),
            "active_chairs": sum(1 for c in chairs if c.is_active),
            "variations": len(variations),
            "families": len(families),
            "asset_models_indexed": len(asset_index),
            "junk_candidates": len(junk),
            "duplicate_groups": len(dup_groups),
            "active_without_primary_image": len(no_image),
            "active_with_asset_match": len(asset_match),
            "active_without_asset_match": len(gaps),
        },
        "junk": junk,
        "duplicates": dups,
        "gaps_sample": gaps[:100],
    }
    _write_report("catalog_audit", report)
    logger.info("Audit: %s", json.dumps(report["counts"], indent=2))
    return report


async def cmd_cleanup(apply: bool) -> None:
    async with AsyncSessionLocal() as db:
        chairs = (await db.execute(select(Chair))).scalars().all()
        to_delete: List[Dict[str, Any]] = []

        for c in chairs:
            reason = classify_junk(c)
            if reason:
                to_delete.append({"id": c.id, "model_number": c.model_number, "name": c.name, "reason": reason, "hard_delete": True})

        for group in find_duplicate_groups(chairs):
            keeper = group[0]
            for loser in group[1:]:
                if loser.id in {d["id"] for d in to_delete}:
                    continue
                to_delete.append({
                    "id": loser.id,
                    "model_number": loser.model_number,
                    "name": loser.name,
                    "reason": f"duplicate-of-{keeper.id}",
                    "hard_delete": True,
                })

        plan_path = _write_report("catalog_cleanup_plan", {"delete": to_delete, "apply": apply})
        if not apply:
            logger.info("Dry-run: would delete %s products. See %s", len(to_delete), plan_path)
            return

        deleted = 0
        for item in to_delete:
            try:
                await AdminService.delete_product(db, item["id"], hard_delete=True)
                deleted += 1
                logger.info("Deleted id=%s (%s) reason=%s", item["id"], item["model_number"], item["reason"])
            except Exception as e:
                logger.error("Failed to delete id=%s: %s", item["id"], e)
        logger.info("Cleanup complete: %s deleted", deleted)


async def cmd_enrich_images(assets_root: Path, uploads_dir: Path, apply: bool, limit: Optional[int]) -> None:
    asset_index = index_asset_images(assets_root)
    updated = 0
    skipped = 0
    async with AsyncSessionLocal() as db:
        q = select(Chair).where(Chair.is_active == True).order_by(Chair.id)
        if limit:
            q = q.limit(limit)
        chairs = (await db.execute(q)).scalars().all()

        for chair in chairs:
            if chair.primary_image_url and "/uploads/images/products/" in chair.primary_image_url:
                skipped += 1
                continue
            paths = asset_index.get(chair.model_number) or asset_index.get((chair.model_number or "").strip())
            if not paths:
                skipped += 1
                continue
            src = pick_best_asset_image(paths)
            if not src:
                skipped += 1
                continue

            if apply:
                url = copy_asset_to_uploads(src, uploads_dir, chair.model_number)
                alt = chair.name or chair.model_number
                images = build_images_json(url, alt)
                await AdminService.update_product(
                    db,
                    chair.id,
                    {
                        "primary_image_url": url,
                        "thumbnail": url,
                        "images": images,
                    },
                )
                updated += 1
                logger.info("Image id=%s model=%s <- %s", chair.id, chair.model_number, src.name)
            else:
                updated += 1
                logger.info("[dry-run] would set image id=%s model=%s <- %s", chair.id, chair.model_number, src.name)

    logger.info("enrich-images: updated=%s skipped=%s apply=%s uploads=%s", updated, skipped, apply, uploads_dir)


async def cmd_enrich_catalog(pdf_dir: Path, apply: bool, limit: Optional[int]) -> None:
    async with AsyncSessionLocal() as db:
        fam_rows = (await db.execute(select(ProductFamily))).scalars().all()
        fam_by_name = {f.name.lower(): f.id for f in fam_rows}

        chairs = (await db.execute(select(Chair).where(Chair.is_active == True).order_by(Chair.id))).scalars().all()
        if limit:
            chairs = chairs[:limit]

        model_numbers = {c.model_number for c in chairs if c.model_number}
        pdf_index = parse_pdfs_for_models(pdf_dir, model_numbers)
        logger.info("Parsed catalog data for %s models from PDFs", len(pdf_index))

        updated = 0
        for chair in chairs:
            rec = pdf_index.get(chair.model_number)
            if not rec:
                continue

            update_data: Dict[str, Any] = {}
            dims = dims_to_update(rec.get("dimensions") or {})
            update_data.update(dims)

            family_name = (rec.get("family_name") or "").strip()
            if family_name and not chair.family_id:
                fid = fam_by_name.get(family_name.lower())
                if fid:
                    update_data["family_id"] = fid

            variations = variations_from_pdf_record(rec, chair.model_number)
            if variations:
                update_data["variations"] = variations

            fi = rec.get("family_info") or {}
            if fi.get("features") and not chair.features:
                update_data["features"] = fi["features"]

            if not update_data:
                continue

            if apply:
                await AdminService.update_product(db, chair.id, update_data)
                logger.info("Catalog enrich id=%s model=%s keys=%s", chair.id, chair.model_number, list(update_data.keys()))
            else:
                logger.info("[dry-run] would enrich id=%s model=%s keys=%s", chair.id, chair.model_number, list(update_data.keys()))
            updated += 1

    logger.info("enrich-catalog: touched=%s apply=%s", updated, apply)


async def main_async(args: argparse.Namespace) -> None:
    assets_root = Path(args.assets_root)
    pdf_dir = Path(args.pdf_dir)
    uploads_dir = resolve_uploads_dir(args.uploads_dir)

    if args.command == "audit":
        await cmd_audit(assets_root, pdf_dir)
    elif args.command == "cleanup":
        await cmd_cleanup(apply=args.apply)
    elif args.command == "enrich-images":
        await cmd_enrich_images(assets_root, uploads_dir, args.apply, args.limit)
    elif args.command == "enrich-catalog":
        await cmd_enrich_catalog(pdf_dir, args.apply, args.limit)
    elif args.command == "all":
        await cmd_audit(assets_root, pdf_dir)
        await cmd_cleanup(apply=args.apply)
        await cmd_enrich_images(assets_root, uploads_dir, args.apply, args.limit)
        await cmd_enrich_catalog(pdf_dir, args.apply, args.limit)
        await cmd_audit(assets_root, pdf_dir)
    else:
        raise SystemExit(f"Unknown command: {args.command}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Sync catalog from Eagle Chair assets")
    ap.add_argument("command", choices=["audit", "cleanup", "enrich-images", "enrich-catalog", "all"])
    ap.add_argument("--assets-root", default=DEFAULT_ASSETS)
    ap.add_argument("--pdf-dir", default=DEFAULT_PDF_DIR)
    ap.add_argument("--uploads-dir", default=None, help="Override uploads root (default: FRONTEND_PATH/uploads or ./uploads)")
    ap.add_argument("--env-file", nargs="?", const="backend/.env.production", default=None)
    ap.add_argument("--apply", action="store_true", help="Write changes (default is dry-run for enrich; cleanup uses --apply)")
    ap.add_argument("--dry-run", action="store_true", help="Alias: do not apply enrich steps")
    ap.add_argument("--limit", type=int, default=None, help="Max products to process in enrich steps")
    args = ap.parse_args()
    if args.dry_run:
        args.apply = False
    if args.command == "cleanup" and not args.apply and not args.dry_run:
        logger.warning("cleanup without --apply: export plan only (use --apply to delete)")
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
