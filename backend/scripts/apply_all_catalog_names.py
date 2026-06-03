"""
Force-update every active product name from PDF/booth/scan evidence (category unchanged).

Usage:
  python -m backend.scripts.apply_all_catalog_names --env-file backend/.env.production
"""

from __future__ import annotations

import asyncio
import os
import re
import sys
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.scripts.full_catalog_review import (
    MANUAL_FAMILY,
    build_name,
    build_pdf_indexes,
    family_from_scans,
    load_pdf_family_index,
    resolve_pdf_family,
)
from backend.scripts.fix_scan_only_images import index_by_model

SCANS_DIR = Path("/home/jkac/Documents/Eagel Chair Assets/CMYK-scans-converted")
CATALOG_DIR = Path("/home/jkac/Documents/Eagel Chair Assets/catalog pages 4 email")


async def main() -> None:
    if "--env-file" in sys.argv:
        idx = sys.argv.index("--env-file")
        env_arg = sys.argv[idx + 1] if idx + 1 < len(sys.argv) else "backend/.env.production"
        env_path = project_root / env_arg if not os.path.isabs(env_arg) else Path(env_arg)
        if env_path.is_file():
            from dotenv import load_dotenv

            load_dotenv(env_path, override=True)

    from sqlalchemy import select

    from backend.database.base import AsyncSessionLocal
    from backend.models.chair import Category, Chair

    pdf_by, pdf_fam, booth_fam = build_pdf_indexes()
    pdf_fam.update(load_pdf_family_index())
    scan_index = index_by_model(SCANS_DIR)

    updated = 0
    async with AsyncSessionLocal() as db:
        cats = {c.id: c for c in (await db.execute(select(Category))).scalars().all()}
        chairs = (
            await db.execute(select(Chair).where(Chair.is_active == True))
        ).scalars().all()

        for ch in chairs:
            mn = ch.model_number
            cat_slug = cats[ch.category_id].slug
            pdfs = pdf_by.get(mn, [])
            fam, _ = resolve_pdf_family(mn, pdfs, booth_fam)
            fam = MANUAL_FAMILY.get(mn) or fam or family_from_scans(mn, scan_index.get(mn, []))
            if cat_slug == "booths-banquettes" and booth_fam.get(mn):
                fam = booth_fam[mn]
            new_name = build_name(mn, cat_slug, fam, ch.model_suffix)
            if new_name != ch.name:
                ch.name = new_name
                updated += 1
        await db.commit()
    print(f"Updated {updated} product names")


if __name__ == "__main__":
    asyncio.run(main())
