"""
Apply human-reviewed catalog fixes from manual_review_decisions.json only.
Does not infer categories — only writes explicit decisions.

Usage:
  python -m backend.scripts.apply_manual_review --env-file backend/.env.production
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

DECISIONS_PATH = project_root / "backend/scripts/output/manual_review_decisions.json"


def _load_env():
    if "--env-file" in sys.argv:
        idx = sys.argv.index("--env-file")
        env_arg = (
            sys.argv[idx + 1]
            if idx + 1 < len(sys.argv) and not sys.argv[idx + 1].startswith("-")
            else "backend/.env.production"
        )
        env_path = project_root / env_arg if not os.path.isabs(env_arg) else Path(env_arg)
        if env_path.is_file():
            from dotenv import load_dotenv

            load_dotenv(env_path, override=True)


async def apply_decisions() -> None:
    from sqlalchemy import select

    from backend.database.base import AsyncSessionLocal
    from backend.models.chair import Category, Chair, ProductFamily, ProductSubcategory
    from backend.scripts.catalog_sync_utils import copy_asset_to_uploads
    from backend.scripts.fix_scan_only_images import merge_gallery, parse_gallery, pick_best_scan, resolve_uploads_dir
    from backend.scripts.fix_scan_only_images import index_by_model, SCANS_DIR

    data = json.loads(DECISIONS_PATH.read_text())
    reviews = data.get("reviews", [])
    if not reviews:
        print("No reviews in decisions file")
        return

    uploads = resolve_uploads_dir(None)
    scan_index = index_by_model(SCANS_DIR)

    async with AsyncSessionLocal() as db:
        cats_by_slug = {
            c.slug: c
            for c in (await db.execute(select(Category))).scalars().all()
        }
        subs_by_key = {}
        for s in (await db.execute(select(ProductSubcategory))).scalars().all():
            cat = await db.get(Category, s.category_id)
            subs_by_key[(cat.slug, s.slug)] = s
        fams_by_name = {
            f.name: f
            for f in (await db.execute(select(ProductFamily))).scalars().all()
        }

        applied = 0
        for rev in reviews:
            if rev.get("status") == "applied":
                continue
            mn = rev["model_number"]
            chair = (
                await db.execute(
                    select(Chair).where(
                        Chair.model_number == mn,
                        Chair.is_active == True,
                    )
                )
            ).scalar_one_or_none()
            if not chair:
                print(f"SKIP {mn}: not found")
                continue

            fixes = rev.get("fixes", {})
            notes = []

            if "category_slug" in fixes:
                cat = cats_by_slug.get(fixes["category_slug"])
                if cat:
                    chair.category_id = cat.id
                    notes.append(f"cat={cat.slug}")

            if "subcategory_slug" in fixes:
                cat_slug = fixes.get("category_slug") or next(
                    (c.slug for c in cats_by_slug.values() if c.id == chair.category_id),
                    None,
                )
                sub = subs_by_key.get((cat_slug, fixes["subcategory_slug"]))
                if sub:
                    chair.subcategory_id = sub.id
                    notes.append(f"sub={sub.slug}")
            elif fixes.get("subcategory_slug") is None and "subcategory_slug" in fixes:
                chair.subcategory_id = None

            if "name" in fixes:
                chair.name = fixes["name"]
                notes.append(f"name={fixes['name']!r}")

            if "family_name" in fixes:
                fam = fams_by_name.get(fixes["family_name"])
                if fam:
                    chair.family_id = fam.id
                    notes.append(f"family={fam.name}")

            if "primary_scan" in fixes:
                scan_path = SCANS_DIR / fixes["primary_scan"]
                if scan_path.is_file():
                    url = copy_asset_to_uploads(scan_path, uploads, mn)
                    chair.primary_image_url = url
                    chair.thumbnail = url
                    notes.append("primary=scan")
                else:
                    print(f"WARN {mn}: scan missing {scan_path}")

            if fixes.get("clear_primary"):
                chair.primary_image_url = None
                chair.thumbnail = None
                notes.append("primary=null")

            if "gallery_add_scans" in fixes:
                gallery = parse_gallery(chair.images)
                for fname in fixes["gallery_add_scans"]:
                    p = SCANS_DIR / fname
                    if p.is_file():
                        url = copy_asset_to_uploads(p, uploads, mn)
                        gallery = merge_gallery(
                            gallery, [{"url": url, "type": "gallery", "alt": fname}]
                        )
                chair.images = gallery

            rev["status"] = "applied"
            rev["applied_notes"] = notes
            applied += 1
            print(f"OK {mn}: {', '.join(notes)}")

        await db.commit()
        DECISIONS_PATH.write_text(json.dumps(data, indent=2))
        print(f"Applied {applied} reviews")


def main():
    _load_env()
    if not DECISIONS_PATH.is_file():
        print(f"Missing {DECISIONS_PATH}")
        sys.exit(1)
    asyncio.run(apply_decisions())


if __name__ == "__main__":
    main()
