"""
Detect and fix product type mismatches: name vs category vs CMYK scan filename.

Usage:
  python -m backend.scripts.fix_product_type_mismatches plan --env-file backend/.env.production
  python -m backend.scripts.fix_product_type_mismatches apply --env-file backend/.env.production
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
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

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

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.core.config import settings
from backend.database.base import AsyncSessionLocal
from backend.models.chair import Category, Chair, ProductSubcategory
from backend.scripts.catalog_sync_utils import copy_asset_to_uploads, parse_pdfs_for_models
from backend.scripts.fix_product_names import (
    CATEGORY_PRODUCT_TYPE,
    build_display_name,
    build_pdf_family_index,
    resolve_family_name,
)
from backend.scripts.fix_scan_only_images import (
    classify_url,
    index_by_model,
    merge_gallery,
    parse_gallery,
    pick_best_scan,
    scan_stem_matches_upload,
    upload_stem_from_url,
)
from backend.services.admin_service import AdminService

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

ASSETS_ROOT = Path("/home/jkac/Documents/Eagel Chair Assets")
SCANS_DIR = ASSETS_ROOT / "CMYK-scans-converted"
CATALOG_PDF = ASSETS_ROOT / "catalog pages 4 email"
OUTPUT = project_root / "backend" / "scripts" / "output"
LOG_PATH = OUTPUT / "type_mismatch_fix_log.json"

PRODUCT_TYPE_RE = re.compile(
    r"\b(Chair|Barstool|Booth|Banquette|Table|Table Base|Table Top|Stool|Bench|Ottoman|"
    r"Cast Iron Base|Loveseat)\b",
    re.I,
)

CATEGORY_SLUG_FOR_TYPE: Dict[str, str] = {
    "chairs": "chairs",
    "barstools": "barstools",
    "table": "table",
    "table-bases": "table-bases",
    "table-tops": "table",
    "booths-banquettes": "booths-banquettes",
    "benches-ottomans": "benches-ottomans",
    "outdoor-patio": "chairs",
    "cast-iron-bases": "cast-iron-bases",
}

TYPE_FROM_CATEGORY: Dict[str, str] = {
    **CATEGORY_PRODUCT_TYPE,
    "table-tops": "Table",
}

SCAN_TABLE_TOP = re.compile(
    r"table\s*top|tabletop|cube\s*table|laminated\s*cube|custom\s*table|woodedge",
    re.I,
)
SCAN_TABLE_BASE = re.compile(
    r"table\s*base|\bbase\b|pedestal|cast\s*iron|ellipto|pretzel\s*base",
    re.I,
)
SCAN_CHAIR_LIKE = re.compile(
    r"style\s*back|\bback\b|arm\s*chair|side\s*chair|dining\s*chair|\bchair\b|"
    r"upholstered|tufted|nail\s*perimeter|welted\s*back",
    re.I,
)
SCAN_BARSTOOL = re.compile(r"barstool|bar\s*stool", re.I)
SCAN_BOOTH = re.compile(r"booth|banquette", re.I)

TYPE_CONFLICTS = frozenset(
    {
        ("table_top", "chair"),
        ("table_top", "barstool"),
        ("table_base", "chair"),
        ("table_base", "barstool"),
        ("chair", "table_top"),
        ("chair", "barstool"),
        ("barstool", "chair"),
        ("barstool", "table_top"),
    }
)


def resolve_uploads_dir(cli: Optional[str]) -> Path:
    if cli:
        return Path(cli).resolve()
    fp = Path(settings.FRONTEND_PATH)
    if fp.is_absolute() and (fp / "uploads").exists():
        return fp / "uploads"
    p = project_root / "uploads"
    p.mkdir(parents=True, exist_ok=True)
    return p


def classify_scan(path: Path) -> str:
    n = path.name.lower()
    if SCAN_TABLE_TOP.search(n):
        return "table_top"
    if SCAN_BARSTOOL.search(n):
        return "barstool"
    if SCAN_BOOTH.search(n):
        return "booth"
    if SCAN_TABLE_BASE.search(n) and not SCAN_CHAIR_LIKE.search(n):
        return "table_base"
    if SCAN_CHAIR_LIKE.search(n):
        return "chair"
    return "neutral"


def type_from_name(name: str) -> Optional[str]:
    n = name or ""
    for label, key in [
        ("Table Top", "table_top"),
        ("Table Base", "table_base"),
        ("Cast Iron Base", "table_base"),
        ("Barstool", "barstool"),
        ("Banquette", "booth"),
        ("Booth", "booth"),
        ("Chair", "chair"),
        ("Table", "table_top"),
        ("Bench", "bench"),
        ("Ottoman", "ottoman"),
        ("Stool", "barstool"),
    ]:
        if re.search(rf"\b{re.escape(label)}\b", n, re.I):
            return key
    return None


def type_from_category_slug(slug: str) -> Optional[str]:
    product = TYPE_FROM_CATEGORY.get(slug or "")
    if not product:
        return None
    mapping = {
        "Chair": "chair",
        "Barstool": "barstool",
        "Table": "table_top",
        "Table Base": "table_base",
        "Cast Iron Base": "table_base",
        "Booth": "booth",
        "Bench": "bench",
        "Ottoman": "ottoman",
    }
    return mapping.get(product)


def expected_product_type(chair: Chair) -> str:
    cat_slug = chair.category.slug if chair.category else ""
    from_cat = type_from_category_slug(cat_slug)
    from_name = type_from_name(chair.name or "")
    mn = (chair.model_number or "").strip()

    if from_name == "booth" or (mn.startswith("8") and re.search(r"\bBooth\b", chair.name or "", re.I)):
        return "booth"
    if from_cat == "table_base" or from_name == "table_base":
        return "table_base"
    if from_cat == "table_top" or from_name == "table_top":
        return "table_top"
    if from_cat == "barstool" or from_name == "barstool":
        return "barstool"
    if from_cat == "booth":
        return "booth"
    if from_name == "chair" or from_cat == "chair":
        return "chair"
    return from_cat or from_name or "chair"


def model_has_barstool_scan(scans: List[Path]) -> bool:
    return any(classify_scan(p) == "barstool" for p in scans)


def model_has_table_top_scan(scans: List[Path]) -> bool:
    return any(classify_scan(p) == "table_top" for p in scans)


def scan_suitable_for_type(path: Path, expected: str) -> bool:
    got = classify_scan(path)
    if expected == "table_base":
        if got == "chair":
            return False
        if got in ("table_base", "neutral"):
            return True
        return SCAN_TABLE_BASE.search(path.name) and not SCAN_CHAIR_LIKE.search(path.name)
    if expected == "table_top":
        return got in ("table_top", "neutral") and got != "chair"
    if expected == "barstool":
        return got == "barstool" or SCAN_BARSTOOL.search(path.name)
    if expected == "booth":
        return got == "booth" or SCAN_BOOTH.search(path.name)
    if expected == "chair":
        return got not in ("table_top", "barstool")
    return True


def pick_scan_for_type(
    model_number: str,
    model_suffix: Optional[str],
    scans: List[Path],
    expected: str,
) -> Optional[Path]:
    suitable = [p for p in scans if scan_suitable_for_type(p, expected)]
    if not suitable:
        return None
    return pick_best_scan(model_number, model_suffix, suitable)


def match_primary_scan(url: str, scans: List[Path]) -> Optional[Path]:
    if not url or not scans:
        return None
    stem = upload_stem_from_url(url)
    for scan in scans:
        if scan_stem_matches_upload(scan, stem):
            return scan
    return None


def category_id_for_type(
    categories_by_slug: Dict[str, Category],
    product_type: str,
) -> Optional[int]:
    slug = CATEGORY_SLUG_FOR_TYPE.get(
        {
            "chair": "chairs",
            "barstool": "barstools",
            "table_top": "table",
            "table_base": "table-bases",
            "booth": "booths-banquettes",
        }.get(product_type, ""),
        "",
    )
    cat = categories_by_slug.get(slug)
    return cat.id if cat else None


def product_type_label(product_type: str) -> str:
    return {
        "chair": "Chair",
        "barstool": "Barstool",
        "table_top": "Table",
        "table_base": "Table Base",
        "booth": "Booth",
        "bench": "Bench",
        "ottoman": "Ottoman",
    }.get(product_type, "Chair")


def build_plan(
    chairs: List[Chair],
    scan_index: Dict[str, List[Path]],
    categories_by_slug: Dict[str, Category],
    category_by_id: Dict[int, Category],
    subcategory_by_id: Dict[int, ProductSubcategory],
    pdf_families: Dict[str, str],
    parsed_pdfs: Dict[str, Dict[str, Any]],
) -> Dict[str, Any]:
    plan: Dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "rules": "scan filename + category + name; CMYK-scans primary only",
        "fixes": [],
        "ambiguous": [],
        "unchanged": [],
    }

    for chair in chairs:
        if not chair.is_active:
            continue

        mn = chair.model_number or ""
        scans = scan_index.get(mn, [])
        expected = expected_product_type(chair)
        name_type = type_from_name(chair.name or "")
        cat_type = type_from_category_slug(chair.category.slug if chair.category else "")
        primary_url = chair.primary_image_url or ""

        issues: List[str] = []
        fix_image: Optional[Dict[str, Any]] = None
        fix_name: Optional[str] = None
        fix_category: Optional[Dict[str, Any]] = None

        current_scan = match_primary_scan(primary_url, scans) if primary_url else None
        scan_type = classify_scan(current_scan) if current_scan else None

        if scan_type == "barstool" and expected == "chair":
            expected = "barstool"
            issues.append("barstool_scan_overrides_chair")
            family, _ = resolve_family_name(chair, pdf_families, parsed_pdfs)
            fix_name = build_display_name(family, "Barstool", chair)
            cid = category_id_for_type(categories_by_slug, "barstool")
            if cid:
                fix_category = {"category_id": cid, "category_slug": "barstools"}

        if expected == "barstool" and scan_type == "chair" and not model_has_barstool_scan(scans):
            expected = "chair"
            issues.append("chair_scans_only_not_barstool")
            family, _ = resolve_family_name(chair, pdf_families, parsed_pdfs)
            fix_name = build_display_name(family, "Chair", chair)
            cid = category_id_for_type(categories_by_slug, "chair")
            if cid:
                fix_category = {"category_id": cid, "category_slug": "chairs"}

        if current_scan and (expected, scan_type) in TYPE_CONFLICTS:
            issues.append(f"scan_{scan_type}_expected_{expected}")
            replacement = pick_scan_for_type(mn, chair.model_suffix, scans, expected)
            if replacement and replacement != current_scan:
                fix_image = {
                    "action": "swap_primary_scan",
                    "old_scan": str(current_scan),
                    "new_scan": str(replacement),
                }
            elif replacement is None:
                fix_image = {"action": "clear_primary", "reason": "no_suitable_scan"}
            else:
                fix_image = {"action": "clear_primary", "reason": "only_conflicting_scans"}

        if not current_scan and primary_url and scans:
            pclass = classify_url(primary_url, mn, scan_index)
            if pclass not in ("scan", "null") and expected in ("chair", "barstool", "table_base", "table_top"):
                replacement = pick_scan_for_type(mn, chair.model_suffix, scans, expected)
                if replacement:
                    issues.append(f"non_scan_primary_{pclass}")
                    fix_image = {
                        "action": "swap_primary_scan",
                        "old_primary": primary_url,
                        "new_scan": str(replacement),
                    }

        mn_stripped = mn.strip()
        if mn_stripped.startswith("8") and name_type == "booth":
            target_slug = "booths-banquettes"
            if chair.category and chair.category.slug != target_slug:
                issues.append("booth_model_wrong_category")
                cid = category_id_for_type(categories_by_slug, "booth")
                if cid:
                    fix_category = {"category_id": cid, "category_slug": target_slug}

        if name_type == "booth" and cat_type == "barstool":
            issues.append("booth_name_barstool_category")
            cid = category_id_for_type(categories_by_slug, "booth")
            if cid:
                fix_category = {"category_id": cid, "category_slug": "booths-banquettes"}

        if name_type and cat_type and name_type != cat_type:
            if not (name_type == "booth" and cat_type == "chair" and mn_stripped.startswith("8")):
                if name_type != expected and cat_type == expected:
                    issues.append(f"name_{name_type}_cat_{cat_type}")
                    label = product_type_label(name_type)
                    family, _ = resolve_family_name(chair, pdf_families, parsed_pdfs)
                    fix_name = build_display_name(family, label, chair)
                    cid = category_id_for_type(categories_by_slug, name_type)
                    if cid and not fix_category:
                        fix_category = {
                            "category_id": cid,
                            "category_slug": CATEGORY_SLUG_FOR_TYPE.get(
                                {
                                    "chair": "chairs",
                                    "barstool": "barstools",
                                    "table_top": "table",
                                    "table_base": "table-bases",
                                    "booth": "booths-banquettes",
                                }.get(name_type, ""),
                                "",
                            ),
                        }

        if not issues:
            plan["unchanged"].append({"id": chair.id, "model": mn})
            continue

        entry: Dict[str, Any] = {
            "id": chair.id,
            "model_number": mn,
            "model_suffix": chair.model_suffix,
            "name": chair.name,
            "category": chair.category.slug if chair.category else None,
            "expected_type": expected,
            "scan_type": scan_type,
            "primary_scan": current_scan.name if current_scan else None,
            "issues": issues,
        }
        if fix_image:
            entry["fix_image"] = fix_image
        if fix_name and fix_name != (chair.name or "").strip():
            entry["fix_name"] = {"old_name": chair.name, "new_name": fix_name}
        if fix_category:
            entry["fix_category"] = fix_category

        if not fix_image and not fix_name and not fix_category:
            plan["ambiguous"].append({**entry, "note": "issues_without_safe_fix"})
        else:
            plan["fixes"].append(entry)

    plan["summary"] = {
        "active_with_primary": sum(
            1 for c in chairs if c.is_active and c.primary_image_url
        ),
        "fixes": len(plan["fixes"]),
        "fix_image": sum(1 for f in plan["fixes"] if f.get("fix_image")),
        "fix_name": sum(1 for f in plan["fixes"] if f.get("fix_name")),
        "fix_category": sum(1 for f in plan["fixes"] if f.get("fix_category")),
        "ambiguous": len(plan["ambiguous"]),
        "unchanged": len(plan["unchanged"]),
    }
    return plan


async def load_context(chairs: List[Chair]) -> Tuple[
    Dict[str, Category],
    Dict[int, Category],
    Dict[int, ProductSubcategory],
    Dict[str, str],
    Dict[str, Dict[str, Any]],
]:
    models = {c.model_number for c in chairs if c.is_active and c.model_number}
    pdf_families = build_pdf_family_index(CATALOG_PDF)
    parsed = parse_pdfs_for_models(CATALOG_PDF, models) if CATALOG_PDF.is_dir() else {}
    async with AsyncSessionLocal() as db:
        categories = (await db.execute(select(Category))).scalars().all()
        subcategories = (await db.execute(select(ProductSubcategory))).scalars().all()
    by_slug = {c.slug: c for c in categories}
    return (
        by_slug,
        {c.id: c for c in categories},
        {s.id: s for s in subcategories},
        pdf_families,
        parsed,
    )


async def apply_plan(plan: Dict[str, Any], uploads_dir: Path) -> Dict[str, Any]:
    applied: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []

    async with AsyncSessionLocal() as db:
        for item in plan.get("fixes", []):
            chair = (
                await db.execute(
                    select(Chair)
                    .where(Chair.id == item["id"])
                    .options(
                        selectinload(Chair.category),
                        selectinload(Chair.family),
                    )
                )
            ).scalar_one_or_none()
            if not chair:
                errors.append({"id": item["id"], "error": "not_found"})
                continue

            before = {
                "name": chair.name,
                "category_id": chair.category_id,
                "primary_image_url": chair.primary_image_url,
            }
            update: Dict[str, Any] = {}
            log_entry: Dict[str, Any] = {
                "id": chair.id,
                "model_number": chair.model_number,
                "issues": item.get("issues"),
                "before": before,
                "changes": {},
            }

            try:
                if item.get("fix_category"):
                    update["category_id"] = item["fix_category"]["category_id"]
                    log_entry["changes"]["category"] = item["fix_category"]

                if item.get("fix_name"):
                    update["name"] = item["fix_name"]["new_name"]
                    log_entry["changes"]["name"] = item["fix_name"]

                fix_image = item.get("fix_image") or {}
                if fix_image.get("action") == "swap_primary_scan":
                    src = Path(fix_image["new_scan"])
                    if src.is_file():
                        url = copy_asset_to_uploads(src, uploads_dir, chair.model_number)
                        images = merge_gallery(chair, url, [], fix_image.get("old_primary"))
                        update["primary_image_url"] = url
                        update["thumbnail"] = url
                        update["images"] = images
                        log_entry["changes"]["primary_image"] = {
                            "old": before["primary_image_url"],
                            "new": url,
                            "scan": str(src),
                        }
                elif fix_image.get("action") == "clear_primary":
                    images = merge_gallery(chair, None, [], chair.primary_image_url)
                    update["primary_image_url"] = None
                    update["thumbnail"] = None
                    update["images"] = images
                    log_entry["changes"]["primary_image"] = {
                        "old": before["primary_image_url"],
                        "new": None,
                        "reason": fix_image.get("reason"),
                    }

                if update:
                    await AdminService.update_product(db, chair.id, update)
                    log_entry["after"] = {
                        "name": update.get("name", chair.name),
                        "category_id": update.get("category_id", chair.category_id),
                        "primary_image_url": update.get(
                            "primary_image_url", chair.primary_image_url
                        ),
                    }
                    applied.append(log_entry)
                    logger.info(
                        "Fixed %s (%s): %s",
                        chair.model_number,
                        chair.id,
                        list(log_entry["changes"].keys()),
                    )
            except Exception as e:
                errors.append({"id": item["id"], "model": item.get("model_number"), "error": str(e)})

    result = {
        "plan_summary": plan.get("summary"),
        "applied_count": len(applied),
        "error_count": len(errors),
        "applied": applied,
        "errors": errors,
        "ambiguous": plan.get("ambiguous"),
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }
    OUTPUT.mkdir(parents=True, exist_ok=True)
    LOG_PATH.write_text(json.dumps(result, indent=2, default=str))
    return result


async def main_async(args: argparse.Namespace) -> None:
    scan_index = index_by_model(SCANS_DIR)

    async with AsyncSessionLocal() as db:
        chairs = (
            await db.execute(
                select(Chair).options(
                    selectinload(Chair.category),
                    selectinload(Chair.family),
                    selectinload(Chair.subcategory),
                )
            )
        ).scalars().all()

    by_slug, cat_by_id, sub_by_id, pdf_families, parsed = await load_context(chairs)
    plan = build_plan(
        chairs, scan_index, by_slug, cat_by_id, sub_by_id, pdf_families, parsed
    )

    plan_path = OUTPUT / f"type_mismatch_fix_plan_{int(time.time())}.json"
    OUTPUT.mkdir(parents=True, exist_ok=True)
    plan_path.write_text(json.dumps(plan, indent=2, default=str))

    s = plan["summary"]
    logger.info(
        "Plan: fixes=%s image=%s name=%s category=%s ambiguous=%s -> %s",
        s["fixes"],
        s["fix_image"],
        s["fix_name"],
        s["fix_category"],
        s["ambiguous"],
        plan_path,
    )
    for item in plan["fixes"][:15]:
        logger.info(
            "  %s %s issues=%s changes=%s",
            item["model_number"],
            item.get("name"),
            item.get("issues"),
            [
                k
                for k in ("fix_image", "fix_name", "fix_category")
                if item.get(k)
            ],
        )

    if args.command == "plan":
        return

    uploads = resolve_uploads_dir(args.uploads_dir)
    result = await apply_plan(plan, uploads)
    logger.info(
        "Applied %s fixes, %s errors. Log: %s",
        result["applied_count"],
        result["error_count"],
        LOG_PATH,
    )


def main() -> None:
    ap = argparse.ArgumentParser(description="Fix product type / image mismatches")
    ap.add_argument("command", choices=["plan", "apply"])
    ap.add_argument("--env-file", nargs="?", const="backend/.env.production")
    ap.add_argument("--uploads-dir", default=None)
    args = ap.parse_args()
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
