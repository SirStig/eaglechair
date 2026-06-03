"""
Fix chair display names in production: family + product type, not generic Model NNNN.

Usage:
  python -m backend.scripts.fix_product_names plan --env-file backend/.env.production
  python -m backend.scripts.fix_product_names apply --env-file backend/.env.production
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

from backend.database.base import AsyncSessionLocal
from backend.models.chair import Category, Chair, ProductFamily, ProductSubcategory
from backend.scripts.catalog_sync_utils import index_catalog_pdf_filenames, parse_pdfs_for_models
from backend.scripts.migrations.catalog_fill_utils import family_name_from_pdf_path
from backend.services.admin_service import AdminService

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

ASSETS_ROOT = Path("/home/jkac/Documents/Eagel Chair Assets")
CATALOG_PDF = ASSETS_ROOT / "catalog pages 4 email"
OUTPUT = project_root / "backend" / "scripts" / "output"
LOG_PATH = OUTPUT / "name_fix_log.json"

PRODUCT_TYPE_RE = re.compile(
    r"\b(Chair|Barstool|Booth|Banquette|Table|Stool|Bench|Ottoman|"
    r"Table Base|Cast Iron Base|Loveseat)\b",
    re.I,
)
GENERIC_MODEL_RE = re.compile(r"^(?:\w+\s+)?Model\s+[\w.-]+$", re.I)
FAMILY_MODEL_RE = re.compile(r"^(.+?)\s+Model\s+(\d[\w.-]*)$", re.I)
FAMILY_FROM_PDF_RE = re.compile(
    r"cat\.[\d\-A-Za-z.]+\.(.+?)\.(?:\d{4}|4mail|outdoor|compressed|digital|mail|min\.|vjune|special)",
    re.I,
)
JUNK_FAMILY_PREFIXES = frozenset({"booth", "poster", "heads", "model", "outdoor"})

PRODUCT_TYPE_WORDS = (
    "Cast Iron Base",
    "Table Base",
    "Barstool",
    "Banquette",
    "Loveseat",
    "Ottoman",
    "Booth",
    "Chair",
    "Table",
    "Stool",
    "Bench",
)

CATEGORY_PRODUCT_TYPE: Dict[str, str] = {
    "chairs": "Chair",
    "barstools": "Barstool",
    "table": "Table",
    "table-bases": "Table Base",
    "benches-ottomans": "Bench",
    "booths-banquettes": "Booth",
    "outdoor-patio": "Chair",
    "cast-iron-bases": "Cast Iron Base",
}

SUBCATEGORY_PRODUCT_TYPE: Dict[str, str] = {
    "ottomans": "Ottoman",
    "benches": "Bench",
    "banquettes": "Banquette",
    "settee-booths": "Booth",
    "upholstered-booths": "Booth",
    "wood-booths": "Booth",
    "outdoor-booths": "Booth",
}


def family_from_pdf_filename(pdf_path: str) -> Optional[str]:
    stem = Path(pdf_path).stem
    m = FAMILY_FROM_PDF_RE.search(stem)
    if m:
        fam = re.sub(r"\s+", " ", m.group(1).strip())
        if fam and fam.lower() not in JUNK_FAMILY_PREFIXES:
            return fam
    raw = family_name_from_pdf_path(pdf_path)
    if raw and not raw.startswith("cat.") and len(raw) < 48:
        if raw.lower() not in JUNK_FAMILY_PREFIXES:
            return raw
    return None


def _family_name_score(name: str) -> int:
    n = (name or "").strip()
    if not n or n.startswith("cat."):
        return -100
    if n.isdigit() or re.fullmatch(r"\d{4}", n):
        return -50
    if n.lower() in JUNK_FAMILY_PREFIXES:
        return -50
    return len(n)


def build_pdf_family_index(pdf_dir: Path) -> Dict[str, str]:
    by_model: Dict[str, Tuple[int, str]] = {}
    if not pdf_dir.is_dir():
        return {}
    filename_index = index_catalog_pdf_filenames(pdf_dir)
    for model, entry in filename_index.items():
        candidates: List[str] = []
        raw = (entry.get("family_name") or "").strip()
        if raw:
            candidates.append(raw)
        for pdf in entry.get("pdf_paths") or []:
            better = family_from_pdf_filename(pdf)
            if better:
                candidates.append(better)
        best = max(candidates, key=_family_name_score, default="")
        if _family_name_score(best) > -50:
            by_model[model] = best
    return by_model


def clean_db_family_name(name: str) -> str:
    n = (name or "").strip()
    n = re.sub(r"\s+Family\s*$", "", n, flags=re.I)
    return n


def is_series_family(name: str) -> bool:
    return bool(re.search(r"\bSeries\s*$", name, re.I))


def is_usable_family(family: str, model_number: str) -> bool:
    if not family or family.lower() in JUNK_FAMILY_PREFIXES:
        return False
    if family.strip() == (model_number or "").strip():
        return False
    if is_series_family(family):
        return False
    if re.fullmatch(r"\d+", family):
        return False
    return True


def product_type_for_chair(
    chair: Chair,
    category_by_id: Dict[int, Category],
    subcategory_by_id: Dict[int, ProductSubcategory],
) -> str:
    cat = category_by_id.get(chair.category_id)
    slug = (cat.slug if cat else "") or "chairs"
    if chair.subcategory_id:
        sub = subcategory_by_id.get(chair.subcategory_id)
        if sub and sub.slug in SUBCATEGORY_PRODUCT_TYPE:
            return SUBCATEGORY_PRODUCT_TYPE[sub.slug]
    return CATEGORY_PRODUCT_TYPE.get(slug, "Chair")


def resolve_family_name(
    chair: Chair,
    pdf_families: Dict[str, str],
    parsed_pdfs: Dict[str, Dict[str, Any]],
) -> Tuple[Optional[str], str]:
    mn = (chair.model_number or "").strip()
    if chair.family:
        fam = clean_db_family_name(chair.family.name)
        if is_usable_family(fam, mn):
            return fam, "db_family"

    fam = pdf_families.get(mn)
    if fam and is_usable_family(fam, mn):
        return fam, "pdf_filename"

    rec = parsed_pdfs.get(mn) or {}
    fam = (rec.get("family_name") or "").strip()
    if fam and not fam.startswith("cat."):
        if is_usable_family(fam, mn):
            return fam, "pdf_parse"

    m = FAMILY_MODEL_RE.match((chair.name or "").strip())
    if m:
        fam = m.group(1).strip()
        if fam.lower() in JUNK_FAMILY_PREFIXES:
            return None, "junk_prefix_in_name"
        if is_usable_family(fam, mn):
            return fam, "parsed_current_name"

    return None, "no_family"


def format_suffix(suffix: Optional[str]) -> str:
    s = (suffix or "").strip()
    if not s:
        return ""
    return s if s.startswith(("-", ".")) else s


def strip_trailing_product_type(text: str) -> str:
    n = (text or "").strip()
    for word in PRODUCT_TYPE_WORDS:
        if re.search(rf"\b{re.escape(word)}\s*$", n, re.I):
            return re.sub(rf"\s+{re.escape(word)}\s*$", "", n, flags=re.I).strip()
    return n


def build_display_name(
    family: Optional[str],
    product_type: str,
    chair: Chair,
) -> str:
    mn = (chair.model_number or "").strip()
    suffix = format_suffix(chair.model_suffix)
    cat_slug = ""
    if chair.category:
        cat_slug = chair.category.slug or ""

    if cat_slug == "booths-banquettes" or (
        mn.isdigit() and mn.startswith("8") and len(mn) == 4
    ):
        return f"{mn} Booth"

    if family:
        current = (chair.name or "").strip()
        if current and re.sub(r"\s+", "", current).lower() == re.sub(
            r"\s+", "", family
        ).lower():
            return f"{current} {product_type}".strip()
        base = strip_trailing_product_type(family)
        return f"{base} {product_type}".strip()

    full_model = f"{mn}{suffix}".strip() if suffix else mn
    return f"{full_model} {product_type}".strip()


def is_bad_name(name: str) -> bool:
    n = (name or "").strip()
    if not n:
        return True
    if GENERIC_MODEL_RE.match(n):
        return True
    if FAMILY_MODEL_RE.match(n):
        return True
    if n.lower().startswith(("booth model", "poster model")):
        return True
    if re.match(r"^outdoor\s+", n, re.I):
        return True
    if not PRODUCT_TYPE_RE.search(n):
        return True
    return False


def is_good_name(name: str) -> bool:
    return not is_bad_name(name)


def build_name_plan(
    chairs: List[Chair],
    pdf_families: Dict[str, str],
    parsed_pdfs: Dict[str, Dict[str, Any]],
    category_by_id: Dict[int, Category],
    subcategory_by_id: Dict[int, ProductSubcategory],
) -> Dict[str, Any]:
    plan: Dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "rules": "family + product type; booths use model + Booth; else model+suffix + type",
        "renames": [],
        "unchanged_good": [],
        "unchanged_same": [],
        "unresolved": [],
    }

    for chair in chairs:
        if not chair.is_active:
            continue
        current = (chair.name or "").strip()
        if is_good_name(current):
            plan["unchanged_good"].append(
                {"id": chair.id, "model": chair.model_number, "name": current}
            )
            continue

        product_type = product_type_for_chair(chair, category_by_id, subcategory_by_id)
        family, family_source = resolve_family_name(chair, pdf_families, parsed_pdfs)
        proposed = build_display_name(family, product_type, chair)

        if proposed == current:
            plan["unchanged_same"].append(
                {"id": chair.id, "model": chair.model_number, "name": current}
            )
            continue

        entry = {
            "id": chair.id,
            "model_number": chair.model_number,
            "model_suffix": chair.model_suffix,
            "category": chair.category.name if chair.category else None,
            "old_name": current,
            "new_name": proposed,
            "family": family,
            "family_source": family_source,
            "product_type": product_type,
        }

        if not family and family_source == "no_family" and product_type in ("Chair", "Barstool"):
            if not pdf_families.get(chair.model_number or "") and not parsed_pdfs.get(
                chair.model_number or ""
            ):
                entry["note"] = "no_pdf_family_used_model_and_type"
                plan["unresolved"].append(entry)

        plan["renames"].append(entry)

    plan["summary"] = {
        "active": sum(1 for c in chairs if c.is_active),
        "unchanged_good": len(plan["unchanged_good"]),
        "unchanged_same": len(plan["unchanged_same"]),
        "to_rename": len(plan["renames"]),
        "unresolved": len(plan["unresolved"]),
    }
    return plan


async def load_catalog_context(
    chairs: List[Chair],
) -> Tuple[Dict[str, str], Dict[str, Dict[str, Any]], Dict[int, Category], Dict[int, ProductSubcategory]]:
    models = {c.model_number for c in chairs if c.is_active and c.model_number}
    pdf_families = build_pdf_family_index(CATALOG_PDF)
    parsed = parse_pdfs_for_models(CATALOG_PDF, models) if CATALOG_PDF.is_dir() else {}
    async with AsyncSessionLocal() as db:
        categories = (await db.execute(select(Category))).scalars().all()
        subcategories = (await db.execute(select(ProductSubcategory))).scalars().all()
    return (
        pdf_families,
        parsed,
        {c.id: c for c in categories},
        {s.id: s for s in subcategories},
    )


async def apply_plan(plan: Dict[str, Any]) -> Dict[str, Any]:
    results: Dict[str, Any] = {"applied": [], "errors": [], "skipped": []}
    async with AsyncSessionLocal() as db:
        for item in plan.get("renames", []):
            chair = (
                await db.execute(select(Chair).where(Chair.id == item["id"]))
            ).scalar_one_or_none()
            if not chair:
                results["skipped"].append({"id": item["id"], "reason": "not_found"})
                continue
            if (chair.name or "").strip() == item["new_name"]:
                continue
            try:
                await AdminService.update_product(db, chair.id, {"name": item["new_name"]})
                results["applied"].append(item)
                logger.info(
                    "Renamed id=%s %s: %r -> %r",
                    chair.id,
                    chair.model_number,
                    item["old_name"],
                    item["new_name"],
                )
            except Exception as e:
                results["errors"].append({"id": item["id"], "error": str(e)})

    log = {
        "plan_summary": plan.get("summary"),
        "applied_count": len(results["applied"]),
        "error_count": len(results["errors"]),
        "renames_sample": results["applied"][:25],
        "unresolved": plan.get("unresolved"),
        "errors": results["errors"],
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }
    OUTPUT.mkdir(parents=True, exist_ok=True)
    LOG_PATH.write_text(json.dumps(log, indent=2, default=str))
    return results


async def main_async(args: argparse.Namespace) -> None:
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

    pdf_families, parsed, cat_by_id, sub_by_id = await load_catalog_context(chairs)
    plan = build_name_plan(chairs, pdf_families, parsed, cat_by_id, sub_by_id)

    plan_path = OUTPUT / f"name_fix_plan_{int(time.time())}.json"
    OUTPUT.mkdir(parents=True, exist_ok=True)
    plan_path.write_text(json.dumps(plan, indent=2, default=str))

    s = plan["summary"]
    logger.info(
        "Plan: active=%s good=%s to_rename=%s unresolved=%s -> %s",
        s["active"],
        s["unchanged_good"],
        s["to_rename"],
        s["unresolved"],
        plan_path,
    )
    for item in plan["renames"][:12]:
        logger.info(
            "  %s %s [%s]: %r -> %r",
            item["model_number"],
            item.get("family_source"),
            item.get("product_type"),
            item["old_name"],
            item["new_name"],
        )

    if args.command == "plan":
        return

    if args.command == "apply":
        results = await apply_plan(plan)
        logger.info(
            "Applied %s renames, %s errors. Log: %s",
            len(results["applied"]),
            len(results["errors"]),
            LOG_PATH,
        )


def main() -> None:
    ap = argparse.ArgumentParser(description="Fix product display names")
    ap.add_argument("command", choices=["plan", "apply"])
    ap.add_argument("--env-file", nargs="?", const="backend/.env.production")
    args = ap.parse_args()
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
