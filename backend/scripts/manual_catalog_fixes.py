"""
Manual production catalog fixes: per-product image mappings, PDF extraction, junk removal.

Usage:
  python -m backend.scripts.manual_catalog_fixes plan --env-file backend/.env.production
  python -m backend.scripts.manual_catalog_fixes apply --env-file backend/.env.production
  python -m backend.scripts.manual_catalog_fixes prices --env-file backend/.env.production --xls "/path/to/woodchairs&barstools 2024.Jan.xls"
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

if "--env-file" in sys.argv:
    idx = sys.argv.index("--env-file")
    env_arg = sys.argv[idx + 1] if idx + 1 < len(sys.argv) and not sys.argv[idx + 1].startswith("-") else "backend/.env.production"
    env_path = project_root / env_arg if not os.path.isabs(env_arg) else Path(env_arg)
    if env_path.is_file():
        from dotenv import load_dotenv
        load_dotenv(env_path, override=True)

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import settings
from backend.database.base import AsyncSessionLocal
from backend.models.chair import Chair, ProductFamily
from backend.scripts.catalog_sync_utils import (
    build_images_json,
    copy_asset_to_uploads,
    dims_to_update,
    parse_pdfs_for_models,
    variations_from_pdf_record,
)
from backend.services.admin_service import AdminService
from backend.services.pdf_parser_service import extract_images_from_page

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

ASSETS = Path("/home/jkac/Documents/Eagel Chair Assets")
CATALOG_PDF = ASSETS / "catalog pages 4 email"
SCANS = ASSETS / "CMYK-scans-converted"
INSTALLS = ASSETS / "CMYK-installs-converted"
BOOTH_IMG = ASSETS / "Boothilicious_2024_images"
OUTPUT = project_root / "backend" / "scripts" / "output"
LOG_PATH = OUTPUT / "manual_fix_log.json"

JUNK_DELETE_IDS = [399, 402, 434]

MANUAL_ASSET_BY_MODEL: Dict[str, str] = {
    "8376": "CMYK-scans-converted/8376 single v74-0.png",
    "5736": "CMYK-scans-converted/5736 v07-0.png",
    "8342": "CMYK-installs-converted/Prince.3291V.8342L.160.install v491.png",
    "5690": "CMYK-scans-converted/6690P v40a-0.png",
    "6737": "CMYK-scans-converted/6736 Valetta v541-0.png",
    "5652": "CMYK-scans-converted/6652P v904-0.png",
    "6479": "CMYK-scans-converted/5479P v10-0.png",
}

PDF_EXTRACT_SPECS: List[Dict[str, Any]] = [
    {
        "pdf": "cat.3411.Sunray.2010.4mail.pdf",
        "page": 1,
        "models": ["3411", "4069", "4311"],
    },
    {
        "pdf": "cat.3523V-4523V.Ephyra.4mail.pdf",
        "page": 1,
        "models": ["3523", "4523"],
    },
    {
        "pdf": "cat.6331-5331-5022.Bella.4mail.pdf",
        "page": 1,
        "models": ["6331", "5331", "5022"],
    },
    {
        "pdf": "cat.6426X-5426X.Lutece.4mail.pdf",
        "page": 1,
        "models": ["6426", "5426"],
    },
    {
        "pdf": "cat.6690-5690.Rastrillo.4mail.pdf",
        "page": 1,
        "models": ["6690", "5690"],
    },
    {
        "pdf": "cat.6473-5473.Triptych.2010.4mail.pdf",
        "page": 1,
        "models": ["6473", "5473"],
    },
    {
        "pdf": "cat.6479-5479.Gorizia.2010.4mail.pdf",
        "page": 1,
        "models": ["6479", "5479"],
    },
    {
        "pdf": "cat.6736-6737-5736.Valetta.2010.4mail.pdf",
        "page": 1,
        "models": ["6736", "6737", "5736"],
    },
]

BOOTH_PNG_BY_MODEL: Dict[str, str] = {
    "8320": "Boothilicious_2024_images/Boothilicious 2024 Copy_image_01.png",
    "8324": "Boothilicious_2024_images/Boothilicious 2024 Copy_image_02.png",
    "8328": "Boothilicious_2024_images/Boothilicious 2024 Copy_image_03.png",
    "8330": "Boothilicious_2024_images/Boothilicious 2024 Copy_image_04.png",
    "8340": "Boothilicious_2024_images/Boothilicious 2024 Copy_image_05.jpg",
    "8346": "Boothilicious_2024_images/Boothilicious 2024 Copy_image_06.jpg",
    "8348": "Boothilicious_2024_images/Boothilicious 2024 Copy_image_07.jpg",
    "8374": "Boothilicious_2024_images/Boothilicious 2024 Copy_image_08.jpg",
    "8378": "Boothilicious_2024_images/Boothilicious 2024 Copy_image_09.jpg",
    "8382": "Boothilicious_2024_images/Boothilicious 2024 Copy_image_10.jpg",
    "8384": "Boothilicious_2024_images/Boothilicious 2024 Copy_image_11.jpg",
    "8386": "Boothilicious_2024_images/Boothilicious 2024 Copy_image_12.jpg",
    "8388": "Boothilicious_2024_images/Boothilicious 2024 Copy_image_13.jpg",
    "8505": "Boothilicious_2024_images/Boothilicious 2024 Copy_image_14.jpg",
    "8630": "Boothilicious_2024_images/Boothilicious 2024 Copy_image_15.jpg",
    "8634": "Boothilicious_2024_images/Boothilicious 2024 Copy_image_16.jpg",
}

PREFIX_SEARCH_MODELS = {
    "5018", "4067", "7025", "5632", "8100", "8024", "4248", "4247", "370",
}


def resolve_uploads_dir(cli: Optional[str]) -> Path:
    if cli:
        return Path(cli).resolve()
    fp = Path(settings.FRONTEND_PATH)
    if fp.is_absolute() and (fp / "uploads").exists():
        return fp / "uploads"
    p = project_root / "uploads"
    p.mkdir(parents=True, exist_ok=True)
    return p


def strict_scan_match(model: str) -> Optional[Path]:
    m = str(model).strip()
    if not m:
        return None
    candidates = []
    for folder in (SCANS, INSTALLS):
        if not folder.is_dir():
            continue
        for f in folder.iterdir():
            if not f.is_file():
                continue
            stem = f.stem
            if re.match(rf"^{re.escape(m)}([^0-9A-Za-z]|$)", stem) or re.match(
                rf"^{re.escape(m)}[A-Z.\-]", stem
            ):
                candidates.append(f)
    if not candidates:
        return None
    return sorted(candidates, key=lambda p: (0 if "scans" in str(p) else 1, p.name))[0]


def extract_pdf_product_paths(spec: Dict[str, Any]) -> Dict[str, Path]:
    pdf_path = CATALOG_PDF / spec["pdf"]
    if not pdf_path.is_file():
        logger.warning("PDF missing: %s", pdf_path)
        return {}
    tmp = Path("/tmp/eaglechair_pdf_extract") / spec["pdf"].replace("/", "_")
    product_imgs, _ = extract_images_from_page(str(pdf_path), spec["page"], tmp, "manual")
    product_imgs = [x for x in product_imgs if x.get("type") == "product"]
    product_imgs.sort(key=lambda x: x.get("width", 0) * x.get("height", 0), reverse=True)
    models = spec["models"]
    out: Dict[str, Path] = {}
    for i, model in enumerate(models):
        if i < len(product_imgs):
            out[model] = Path(product_imgs[i]["filepath"])
    return out


def build_fix_plan(chairs: List[Chair]) -> Dict[str, Any]:
    plan: Dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "delete_junk": [],
        "image_fixes": [],
        "enrich_catalog": [],
        "unresolved": [],
    }

    for jid in JUNK_DELETE_IDS:
        c = next((x for x in chairs if x.id == jid), None)
        if c:
            plan["delete_junk"].append(
                {"id": c.id, "model": c.model_number, "name": c.name, "reason": "year-false-positive-duplicate"}
            )

    pdf_paths: Dict[str, Path] = {}
    for spec in PDF_EXTRACT_SPECS:
        pdf_paths.update(extract_pdf_product_paths(spec))

    active = [c for c in chairs if c.is_active]
    for chair in active:
        mn = chair.model_number or ""
        img = chair.primary_image_url or ""
        needs = (not img) or ("wp-content" in img)
        if not needs:
            continue

        src: Optional[Path] = None
        note = ""
        if mn in MANUAL_ASSET_BY_MODEL:
            src = ASSETS / MANUAL_ASSET_BY_MODEL[mn]
            note = "manual_asset_map"
        elif mn in BOOTH_PNG_BY_MODEL:
            src = ASSETS / BOOTH_PNG_BY_MODEL[mn]
            note = "boothilicious_map"
        elif mn in pdf_paths:
            src = pdf_paths[mn]
            note = "pdf_extract"
        elif mn in PREFIX_SEARCH_MODELS or True:
            hit = strict_scan_match(mn)
            if hit:
                src = hit
                note = "strict_filename_match"
        if not src and img.startswith("http") and "wp-content" in img:
            wp_local = Path("/tmp/eaglechair_wp") / f"{chair.id}_{Path(img).name}"
            wp_local.parent.mkdir(parents=True, exist_ok=True)
            try:
                url = img if img.startswith("http") else f"https://eaglechair.com{img}"
                urllib.request.urlretrieve(url, wp_local)
                if wp_local.stat().st_size > 1000:
                    src = wp_local
                    note = "wp_content_download"
            except Exception:
                pass
        elif not src and img.startswith("/wp-content"):
            wp_local = Path("/tmp/eaglechair_wp") / f"{chair.id}_{Path(img).name}"
            wp_local.parent.mkdir(parents=True, exist_ok=True)
            try:
                urllib.request.urlretrieve(f"https://eaglechair.com{img}", wp_local)
                if wp_local.stat().st_size > 1000:
                    src = wp_local
                    note = "wp_content_download"
            except Exception:
                pass

        if src and src.is_file():
            plan["image_fixes"].append(
                {
                    "id": chair.id,
                    "model": mn,
                    "name": chair.name,
                    "source": str(src),
                    "note": note,
                    "prior_image": img or None,
                }
            )
        else:
            plan["unresolved"].append({"id": chair.id, "model": mn, "name": chair.name, "prior_image": img or None})

    return plan


async def apply_plan(plan: Dict[str, Any], uploads_dir: Path, apply: bool) -> Dict[str, Any]:
    results = {"deleted": [], "images_applied": [], "errors": []}
    log_entries = []

    async with AsyncSessionLocal() as db:
        for item in plan["delete_junk"]:
            if not apply:
                results["deleted"].append({**item, "dry_run": True})
                continue
            try:
                await AdminService.delete_product(db, item["id"], hard_delete=True)
                results["deleted"].append(item)
                log_entries.append({"action": "delete", **item})
            except Exception as e:
                results["errors"].append({"id": item["id"], "error": str(e)})

        for item in plan["image_fixes"]:
            chair = (
                await db.execute(select(Chair).where(Chair.id == item["id"]))
            ).scalar_one_or_none()
            if not chair:
                continue
            if not apply:
                results["images_applied"].append({**item, "dry_run": True})
                continue
            try:
                url = copy_asset_to_uploads(Path(item["source"]), uploads_dir, chair.model_number)
                alt = chair.name or chair.model_number
                await AdminService.update_product(
                    db,
                    chair.id,
                    {
                        "primary_image_url": url,
                        "thumbnail": url,
                        "images": build_images_json(url, alt),
                    },
                )
                entry = {**item, "url": url}
                results["images_applied"].append(entry)
                log_entries.append({"action": "image", **entry})
            except Exception as e:
                results["errors"].append({"id": item["id"], "error": str(e)})

        model_numbers = {c.model_number for c in (await db.execute(select(Chair).where(Chair.is_active == True))).scalars().all() if c.model_number}
        pdf_index = parse_pdfs_for_models(CATALOG_PDF, model_numbers)
        fam_rows = (await db.execute(select(ProductFamily))).scalars().all()
        fam_by_name = {f.name.lower(): f.id for f in fam_rows}

        for mn, rec in pdf_index.items():
            chair = (
                await db.execute(
                    select(Chair).where(Chair.model_number == mn, Chair.is_active == True).limit(1)
                )
            ).scalar_one_or_none()
            if not chair:
                continue
            update: Dict[str, Any] = {}
            update.update(dims_to_update(rec.get("dimensions") or {}))
            fname = (rec.get("family_name") or "").strip()
            if fname and not chair.family_id:
                fid = fam_by_name.get(fname.lower())
                if fid:
                    update["family_id"] = fid
            vars = variations_from_pdf_record(rec, mn)
            if vars:
                update["variations"] = vars
            if not update:
                continue
            plan["enrich_catalog"].append({"id": chair.id, "model": mn, "keys": list(update.keys())})
            if apply:
                await AdminService.update_product(db, chair.id, update)
                log_entries.append({"action": "catalog", "id": chair.id, "model": mn, "keys": list(update.keys())})

    OUTPUT.mkdir(parents=True, exist_ok=True)
    LOG_PATH.write_text(json.dumps({"plan_summary": plan, "results": results, "log": log_entries}, indent=2, default=str))
    return results


async def run_prices(xls_path: str, apply: bool) -> None:
    from backend.scripts.migrations.catalog_fill_utils import load_xls_prices

    prices = load_xls_prices(
        xls_path,
        model_column=1,
        list_price_column=9,
        skip_header=True,
        price_in_dollars=True,
        start_row=12,
    )
    logger.info("Loaded %s prices from XLS", len(prices))
    updated = 0
    async with AsyncSessionLocal() as db:
        chairs = (await db.execute(select(Chair).where(Chair.is_active == True))).scalars().all()
        for chair in chairs:
            cents = prices.get(chair.model_number) or prices.get(str(chair.model_number))
            if cents is None or (chair.base_price or 0) > 0:
                continue
            if apply:
                await AdminService.update_product(db, chair.id, {"base_price": cents})
            updated += 1
    logger.info("Prices: updated %s products (apply=%s)", updated, apply)


async def main_async(args: argparse.Namespace) -> None:
    uploads = resolve_uploads_dir(args.uploads_dir)

    async with AsyncSessionLocal() as db:
        chairs = (await db.execute(select(Chair))).scalars().all()

    if args.command == "plan":
        plan = build_fix_plan(chairs)
        path = OUTPUT / f"manual_fix_plan_{int(time.time())}.json"
        OUTPUT.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(plan, indent=2, default=str))
        logger.info("Plan: delete=%s images=%s unresolved=%s -> %s", len(plan["delete_junk"]), len(plan["image_fixes"]), len(plan["unresolved"]), path)
        return

    if args.command == "apply":
        plan_path = Path(args.plan) if args.plan else max(OUTPUT.glob("manual_fix_plan_*.json"), key=lambda p: p.stat().st_mtime, default=None)
        if not plan_path or not plan_path.is_file():
            plan = build_fix_plan(chairs)
        else:
            plan = json.loads(plan_path.read_text())
        results = await apply_plan(plan, uploads, apply=True)
        logger.info("Applied: deleted=%s images=%s errors=%s", len(results["deleted"]), len(results["images_applied"]), len(results["errors"]))
        return

    if args.command == "prices":
        if not args.xls:
            raise SystemExit("--xls required")
        await run_prices(args.xls, args.apply)
        return

    raise SystemExit(f"Unknown command {args.command}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["plan", "apply", "prices"])
    ap.add_argument("--env-file", nargs="?", const="backend/.env.production")
    ap.add_argument("--uploads-dir", default=None)
    ap.add_argument("--plan", default=None, help="Plan JSON for apply")
    ap.add_argument("--xls", default=None)
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
