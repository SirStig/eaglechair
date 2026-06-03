"""
Full production catalog reclassification from asset evidence (not current categories).

Usage:
  python -m backend.scripts.reclassify_catalog baseline --env-file backend/.env.production
  python -m backend.scripts.reclassify_catalog plan --env-file backend/.env.production
  python -m backend.scripts.reclassify_catalog apply --env-file backend/.env.production
  python -m backend.scripts.reclassify_catalog apply --env-file backend/.env.production --names --images
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
from collections import Counter, defaultdict
from dataclasses import dataclass, field
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

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from backend.core.config import settings
from backend.database.base import AsyncSessionLocal
from backend.models.chair import Category, Chair, ProductFamily, ProductSubcategory
from backend.scripts.catalog_sync_utils import (
    BOOTH_IMAGE_BY_MODEL,
    index_catalog_pdf_filenames,
    normalize_model,
    parse_pdfs_for_models,
)
from backend.scripts.fix_product_names import (
    build_display_name,
    build_name_plan,
    build_pdf_family_index,
    product_type_for_chair,
    resolve_family_name,
)
from backend.scripts.fix_product_type_mismatches import type_from_name
from backend.scripts.fix_product_type_mismatches import (
    classify_scan,
    pick_scan_for_type,
)
from backend.scripts.fix_scan_only_images import (
    build_plan as build_image_plan,
    classify_url,
    copy_asset_to_uploads,
    index_by_model,
    merge_gallery,
    parse_gallery,
    pick_best_scan,
    pick_install_shots,
    resolve_uploads_dir,
)
from backend.services.admin_service import AdminService

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

ASSETS_ROOT = Path("/home/jkac/Documents/Eagel Chair Assets")
SCANS_DIR = ASSETS_ROOT / "CMYK-scans-converted"
INSTALLS_DIR = ASSETS_ROOT / "CMYK-installs-converted"
CATALOG_PDF = ASSETS_ROOT / "catalog pages 4 email"
OUTPUT = project_root / "backend" / "scripts" / "output"
LOG_PATH = OUTPUT / "reclassify_catalog_log.json"
BASELINE_PATH = OUTPUT / "reclassify_catalog_baseline.json"

SCAN_TABLE_TOP = re.compile(
    r"table\s*top|tabletop|cube\s*table|laminated\s*cube|custom\s*table|"
    r"wood\s*edge|30x30|woodedge",
    re.I,
)
SCAN_TABLE_BASE = re.compile(
    r"table\s*base|\.base\.|pedestal|cast\s*iron|pretzel\s*base|ellipto|3030\.40\.base",
    re.I,
)
SCAN_CHAIR = re.compile(
    r"style\s*back|\bback\b|arm\s*chair|side\s*chair|dining\s*chair|\bchair\b|"
    r"upholstered|tufted|nail\s*perimeter|welted\s*back",
    re.I,
)
SCAN_BARSTOOL = re.compile(r"barstool|bar\s*stool", re.I)
SCAN_BOOTH = re.compile(r"booth|banquette", re.I)
SCAN_METAL = re.compile(r"\bmetal\b|steel|aluminum|aluminium", re.I)
SCAN_WOOD = re.compile(r"\bwood\b|beech|walnut|maple|oak\b", re.I)

TABLE_TOP_MODEL_RE = re.compile(r"^\d{2,3}$")
BOOTH_MODEL_RE = re.compile(r"^8\d{3}$")
BARSTOOL_SUFFIX_RE = re.compile(r"^(PB|PF|PBN|PBF|BS)$")
OUTDOOR_PDF_RE = re.compile(r"outdoor", re.I)

TYPE_TO_CATEGORY_SLUG = {
    "chair": "chairs",
    "barstool": "barstools",
    "table_top": "table",
    "table_base": "table-bases",
    "booth": "booths-banquettes",
    "bench": "benches-ottomans",
    "ottoman": "benches-ottomans",
}

CATEGORY_SLUG_TO_LABEL = {
    "chairs": "Chair",
    "barstools": "Barstool",
    "table": "Table",
    "table-bases": "Table Base",
    "booths-banquettes": "Booth",
    "benches-ottomans": "Bench",
    "outdoor-patio": "Chair",
}


@dataclass
class Classification:
    product_type: str
    confidence: str
    evidence: List[str] = field(default_factory=list)
    score: int = 0
    outdoor: bool = False


def classify_scan_enhanced(path: Path) -> str:
    n = path.name
    if SCAN_TABLE_TOP.search(n):
        return "table_top"
    if SCAN_BARSTOOL.search(n):
        return "barstool"
    if SCAN_BOOTH.search(n):
        return "booth"
    if SCAN_TABLE_BASE.search(n) and not SCAN_CHAIR.search(n):
        return "table_base"
    if SCAN_CHAIR.search(n):
        return "chair"
    return classify_scan(path)


def index_scans_extended(scans_dir: Path) -> Dict[str, List[Path]]:
    by_model = index_by_model(scans_dir)
    if not scans_dir.is_dir():
        return by_model
    for path in scans_dir.iterdir():
        if not path.is_file():
            continue
        m = re.match(r"^(\d{2,3})[-\s]", path.name) or re.match(
            r"^(\d{2,3})\s+series", path.name, re.I
        )
        if m:
            base = m.group(1)
            if base.isdigit() and int(base) < 500:
                by_model.setdefault(base, []).append(path)
        m2 = re.match(r"^(\d{4})[-.]", path.name)
        if m2:
            by_model.setdefault(m2.group(1), []).append(path)
    return by_model


def scan_votes(scans: List[Path]) -> Tuple[Optional[str], List[str]]:
    if not scans:
        return None, []
    counts: Counter[str] = Counter()
    evidence: List[str] = []
    for p in scans:
        t = classify_scan_enhanced(p)
        if t == "neutral":
            continue
        counts[t] += 1
        evidence.append(f"scan:{t}:{p.name[:60]}")
    if not counts:
        return None, evidence
    winner, n = counts.most_common(1)[0]
    if n >= 2 or (n == 1 and winner in ("barstool", "booth", "table_top", "table_base")):
        return winner, evidence
    if n == 1:
        return winner, evidence
    return None, evidence


def pdf_hints_for_model(
    model: str, pdf_index: Dict[str, Dict[str, Any]]
) -> Tuple[List[str], bool]:
    entry = pdf_index.get(model, {})
    hints: List[str] = []
    outdoor = False
    for pdf in entry.get("pdf_paths") or []:
        name = Path(pdf).name.lower()
        if OUTDOOR_PDF_RE.search(name):
            outdoor = True
            hints.append(f"pdf:outdoor:{Path(pdf).name[:50]}")
        if "booth" in name or "banquette" in name:
            hints.append(f"pdf:booth:{Path(pdf).name[:50]}")
        if "barstool" in name or re.search(r"\bstool\b", name):
            hints.append(f"pdf:barstool:{Path(pdf).name[:50]}")
        if "table" in name and "base" in name:
            hints.append(f"pdf:table_base:{Path(pdf).name[:50]}")
        elif SCAN_TABLE_TOP.search(name) or (
            "table" in name and "top" in name
        ):
            hints.append(f"pdf:table_top:{Path(pdf).name[:50]}")
        elif "table" in name:
            hints.append(f"pdf:table:{Path(pdf).name[:50]}")
    return hints, outdoor


def model_pattern_type(model: str, suffix: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    mn = normalize_model(model)
    suf = (suffix or "").strip().upper()
    if BOOTH_MODEL_RE.match(mn) or mn in BOOTH_IMAGE_BY_MODEL:
        return "booth", f"model:8xxx:{mn}"
    if TABLE_TOP_MODEL_RE.match(mn) and mn.isdigit() and int(mn) < 280:
        return "table_top", f"model:3digit_table_series:{mn}"
    if BARSTOOL_SUFFIX_RE.match(suf):
        return "barstool", f"model:suffix:{suf}"
    if mn == "6810" or (mn.isdigit() and SCAN_TABLE_BASE.search(mn)):
        pass
    return None, None


def has_table_base_scan(scans: List[Path]) -> bool:
    return any(classify_scan_enhanced(p) == "table_base" for p in scans)


def is_false_table_base(
    model: str, scans: List[Path], name: str
) -> Tuple[bool, List[str]]:
    evidence: List[str] = []
    if has_table_base_scan(scans):
        return False, ["scan:table_base_present"]
    if model == "6810":
        return False, ["model:6810_table_base"]
    mn = normalize_model(model)
    if (
        mn.isdigit()
        and 6000 <= int(mn) <= 6999
        and re.search(r"table\s*base", name or "", re.I)
    ):
        evidence.append("mislabel:6xxx_chair_line_not_base")
        return True, evidence
    if re.search(r"table\s*base", name or "", re.I) and not re.search(
        r"chair|barstool|booth", name or "", re.I
    ):
        evidence.append("mislabel:chair_family_named_table_base")
        return True, evidence
    return False, evidence


def add_vote(
    votes: Counter[str],
    evidence: List[str],
    product_type: str,
    weight: int,
    reason: str,
) -> None:
    votes[product_type] += weight
    evidence.append(f"{reason}(+{weight})")


def classify_product(
    chair: Chair,
    scan_index: Dict[str, List[Path]],
    pdf_index: Dict[str, Dict[str, Any]],
    family_by_id: Dict[int, ProductFamily],
    category_by_id: Dict[int, Category],
) -> Classification:
    mn = normalize_model(chair.model_number)
    scans = scan_index.get(mn, [])
    votes: Counter[str] = Counter()
    evidence: List[str] = []
    outdoor = False

    scan_type, scan_ev = scan_votes(scans)
    evidence.extend(scan_ev)
    if scan_type:
        add_vote(votes, evidence, scan_type, 10, f"scan_vote:{scan_type}")

    pat_type, pat_ev = model_pattern_type(mn, chair.model_suffix)
    if pat_type and pat_ev:
        add_vote(votes, evidence, pat_type, 9, pat_ev)

    pdf_ev, pdf_outdoor = pdf_hints_for_model(mn, pdf_index)
    outdoor = pdf_outdoor
    for ev in pdf_ev:
        evidence.append(ev)
        if ":booth:" in ev:
            add_vote(votes, evidence, "booth", 6, "pdf_booth")
        elif ":barstool:" in ev:
            add_vote(votes, evidence, "barstool", 6, "pdf_barstool")
        elif ":table_base:" in ev:
            add_vote(votes, evidence, "table_base", 6, "pdf_table_base")
        elif ":table_top:" in ev or ":table:" in ev:
            add_vote(votes, evidence, "table_top", 5, "pdf_table")

    if chair.family_id:
        fam = family_by_id.get(chair.family_id)
        fam_cat = category_by_id.get(fam.category_id) if fam and fam.category_id else None
        if fam and fam_cat:
            mapped = {
                "chairs": "chair",
                "barstools": "barstool",
                "table": "table_top",
                "table-bases": "table_base",
                "booths-banquettes": "booth",
            }.get(fam_cat.slug)
            if mapped:
                add_vote(votes, evidence, mapped, 4, f"family_category:{fam.name}")

    false_tb, tb_ev = is_false_table_base(mn, scans, chair.name or "")
    evidence.extend(tb_ev)
    if false_tb:
        add_vote(votes, evidence, "chair", 14, "false_table_base_label")

    name_l = (chair.name or "").lower()
    if "barstool" in name_l or re.search(r"\bstool\b", name_l):
        add_vote(votes, evidence, "barstool", 5, "name:barstool")
    if "booth" in name_l or "banquette" in name_l:
        add_vote(votes, evidence, "booth", 5, "name:booth")
    if re.search(r"\btable\b", name_l) and "base" not in name_l:
        add_vote(votes, evidence, "table_top", 4, "name:table")
    if re.search(r"table\s*base", name_l, re.I) and not false_tb:
        add_vote(votes, evidence, "table_base", 3, "name:table_base")

    if not votes:
        add_vote(votes, evidence, "chair", 1, "default:chair")
        return Classification("chair", "low", evidence, 1, outdoor)

    winner, top_score = votes.most_common(1)[0]
    second = votes.most_common(2)[1][1] if len(votes) > 1 else 0
    margin = top_score - second
    if top_score >= 10 and margin >= 4:
        conf = "high"
    elif top_score >= 6 and margin >= 2:
        conf = "medium"
    else:
        conf = "low"
    return Classification(winner, conf, evidence, top_score, outdoor)


def resolve_subcategory(
    product_type: str,
    outdoor: bool,
    scans: List[Path],
    subcats_by_cat_slug: Dict[str, Dict[str, ProductSubcategory]],
) -> Optional[int]:
    cat_slug = TYPE_TO_CATEGORY_SLUG.get(product_type)
    if not cat_slug:
        return None
    subs = subcats_by_cat_slug.get(cat_slug, {})
    if outdoor:
        key = {
            "chair": "outdoor-chairs",
            "barstool": "outdoor-barstools",
            "table_top": "outdoor-table-tops",
            "booth": "outdoor-booths",
        }.get(product_type)
        if key and key in subs:
            return subs[key].id
    if product_type == "chair" and scans:
        if any(SCAN_METAL.search(p.name) for p in scans) and "metal-chairs" in subs:
            return subs["metal-chairs"].id
        if any(SCAN_WOOD.search(p.name) for p in scans) and "wood-chairs" in subs:
            return subs["wood-chairs"].id
    if product_type == "barstool" and "wood-barstools" in subs:
        return subs["wood-barstools"].id
    if product_type == "table_top" and "indoor-table-tops" in subs:
        return subs["indoor-table-tops"].id
    if product_type == "table_base" and "metal-table-bases" in subs:
        return subs["metal-table-bases"].id
    return None


def category_distribution(chairs: List[Chair]) -> Dict[str, int]:
    dist: Counter[str] = Counter()
    for c in chairs:
        if not c.is_active:
            continue
        slug = c.category.slug if c.category else "unknown"
        dist[slug] += 1
    return dict(dist)


async def load_catalog() -> Tuple[
    List[Chair],
    Dict[str, Category],
    Dict[int, Category],
    Dict[str, Dict[str, ProductSubcategory]],
    Dict[int, ProductFamily],
    Dict[str, List[Path]],
    Dict[str, Dict[str, Any]],
]:
    scan_index = index_scans_extended(SCANS_DIR)
    pdf_index = index_catalog_pdf_filenames(CATALOG_PDF) if CATALOG_PDF.is_dir() else {}

    async with AsyncSessionLocal() as db:
        chairs = (
            await db.execute(
                select(Chair)
                .options(
                    selectinload(Chair.category),
                    selectinload(Chair.subcategory),
                    selectinload(Chair.family),
                )
                .order_by(Chair.model_number, Chair.id)
            )
        ).scalars().all()
        categories = (await db.execute(select(Category))).scalars().all()
        subcategories = (await db.execute(select(ProductSubcategory))).scalars().all()
        families = (await db.execute(select(ProductFamily))).scalars().all()

    by_slug = {c.slug: c for c in categories}
    sub_by_cat: Dict[str, Dict[str, ProductSubcategory]] = defaultdict(dict)
    for s in subcategories:
        cat = next((c for c in categories if c.id == s.category_id), None)
        if cat:
            sub_by_cat[cat.slug][s.slug] = s

    cat_by_id = {c.id: c for c in categories}
    return (
        chairs,
        by_slug,
        cat_by_id,
        dict(sub_by_cat),
        {f.id: f for f in families},
        scan_index,
        pdf_index,
    )


def export_baseline(chairs: List[Chair]) -> Dict[str, Any]:
    active = [c for c in chairs if c.is_active]
    items = []
    for c in active:
        items.append(
            {
                "id": c.id,
                "model_number": c.model_number,
                "model_suffix": c.model_suffix,
                "name": c.name,
                "category_slug": c.category.slug if c.category else None,
                "category_id": c.category_id,
                "subcategory_slug": c.subcategory.slug if c.subcategory else None,
                "subcategory_id": c.subcategory_id,
                "family": c.family.name if c.family else None,
                "family_id": c.family_id,
                "primary_image_url": c.primary_image_url,
                "has_gallery": bool(c.images and c.images != "[]"),
            }
        )
    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "active_count": len(active),
        "category_distribution": category_distribution(active),
        "products": items,
    }


def build_reclassify_plan(
    chairs: List[Chair],
    categories_by_slug: Dict[str, Category],
    category_by_id: Dict[int, Category],
    subcats_by_cat_slug: Dict[str, Dict[str, ProductSubcategory]],
    family_by_id: Dict[int, ProductFamily],
    scan_index: Dict[str, List[Path]],
    pdf_index: Dict[str, Dict[str, Any]],
) -> Dict[str, Any]:
    plan: Dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "evidence_hierarchy": [
            "CMYK scan filename",
            "model patterns (8xxx booth, 3-digit table, suffix)",
            "PDF catalog filename",
            "ProductFamily.category",
            "false table-base name heuristic",
            "display name (weak)",
        ],
        "before_distribution": category_distribution(chairs),
        "changes": [],
        "unchanged": [],
        "low_confidence": [],
    }

    for chair in chairs:
        if not chair.is_active:
            continue
        clf = classify_product(
            chair, scan_index, pdf_index, family_by_id, category_by_id
        )
        target_slug = TYPE_TO_CATEGORY_SLUG.get(clf.product_type, "chairs")
        target_cat = categories_by_slug.get(target_slug)
        if not target_cat:
            plan["low_confidence"].append(
                {
                    "id": chair.id,
                    "model": chair.model_number,
                    "reason": f"unknown_category_slug:{target_slug}",
                }
            )
            continue

        scans = scan_index.get(normalize_model(chair.model_number), [])
        target_sub_id = resolve_subcategory(
            clf.product_type, clf.outdoor, scans, subcats_by_cat_slug
        )

        old_slug = chair.category.slug if chair.category else None
        old_sub = chair.subcategory.slug if chair.subcategory else None
        new_sub_slug = None
        if target_sub_id:
            for slug, subs in subcats_by_cat_slug.items():
                for s_slug, sub in subs.items():
                    if sub.id == target_sub_id:
                        new_sub_slug = s_slug
                        break

        cat_changed = chair.category_id != target_cat.id
        sub_changed = (chair.subcategory_id or None) != (target_sub_id or None)

        entry = {
            "id": chair.id,
            "model_number": chair.model_number,
            "model_suffix": chair.model_suffix,
            "old_name": chair.name,
            "old_category_slug": old_slug,
            "old_subcategory_slug": old_sub,
            "new_category_slug": target_slug,
            "new_category_id": target_cat.id,
            "new_subcategory_slug": new_sub_slug,
            "new_subcategory_id": target_sub_id,
            "product_type": clf.product_type,
            "confidence": clf.confidence,
            "evidence": clf.evidence,
            "outdoor": clf.outdoor,
        }

        if cat_changed or sub_changed:
            plan["changes"].append(entry)
            if clf.confidence == "low":
                plan["low_confidence"].append(entry)
        else:
            plan["unchanged"].append(
                {"id": chair.id, "model": chair.model_number, "category": old_slug}
            )

    plan["after_distribution_estimated"] = _estimate_after_distribution(
        chairs, plan["changes"], categories_by_slug
    )
    plan["summary"] = {
        "active": sum(1 for c in chairs if c.is_active),
        "category_changes": len(plan["changes"]),
        "unchanged": len(plan["unchanged"]),
        "low_confidence": len(plan["low_confidence"]),
        "by_target": Counter(c["new_category_slug"] for c in plan["changes"]),
        "by_confidence": Counter(c["confidence"] for c in plan["changes"]),
    }
    return plan


def _estimate_after_distribution(
    chairs: List[Chair],
    changes: List[Dict[str, Any]],
    categories_by_slug: Dict[str, Category],
) -> Dict[str, int]:
    change_map = {c["id"]: c["new_category_slug"] for c in changes}
    dist: Counter[str] = Counter()
    for ch in chairs:
        if not ch.is_active:
            continue
        slug = change_map.get(ch.id) or (ch.category.slug if ch.category else "unknown")
        dist[slug] += 1
    return dict(dist)


async def apply_category_plan(plan: Dict[str, Any]) -> Dict[str, Any]:
    applied: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []

    async with AsyncSessionLocal() as db:
        for item in plan.get("changes", []):
            chair = (
                await db.execute(select(Chair).where(Chair.id == item["id"]))
            ).scalar_one_or_none()
            if not chair:
                errors.append({"id": item["id"], "error": "not_found"})
                continue
            update: Dict[str, Any] = {"category_id": item["new_category_id"]}
            if item.get("new_subcategory_id") is not None:
                update["subcategory_id"] = item["new_subcategory_id"]
            else:
                update["subcategory_id"] = None
            try:
                await AdminService.update_product(db, chair.id, update)
                applied.append(item)
                logger.info(
                    "Category %s id=%s %s: %s -> %s (%s)",
                    item.get("confidence"),
                    chair.id,
                    chair.model_number,
                    item["old_category_slug"],
                    item["new_category_slug"],
                    "; ".join(item.get("evidence", [])[:2]),
                )
            except Exception as e:
                errors.append({"id": item["id"], "error": str(e)})

    return {"applied": applied, "errors": errors}


NAME_TYPE_TO_LABEL = {
    "chair": "Chair",
    "barstool": "Barstool",
    "table_top": "Table",
    "table_base": "Table Base",
    "booth": "Booth",
    "bench": "Bench",
    "ottoman": "Ottoman",
}


def build_category_name_sync_plan(
    chairs: List[Chair],
    pdf_families: Dict[str, str],
    parsed_pdfs: Dict[str, Dict[str, Any]],
    category_by_id: Dict[int, Category],
    subcategory_by_id: Dict[int, ProductSubcategory],
) -> List[Dict[str, Any]]:
    renames: List[Dict[str, Any]] = []
    for chair in chairs:
        if not chair.is_active:
            continue
        expected = product_type_for_chair(chair, category_by_id, subcategory_by_id)
        got_key = type_from_name(chair.name or "")
        got_label = NAME_TYPE_TO_LABEL.get(got_key or "", "")
        if not got_label or got_label == expected:
            continue
        family, family_source = resolve_family_name(chair, pdf_families, parsed_pdfs)
        proposed = build_display_name(family, expected, chair)
        if proposed == (chair.name or "").strip():
            continue
        renames.append(
            {
                "id": chair.id,
                "model_number": chair.model_number,
                "old_name": chair.name,
                "new_name": proposed,
                "family": family,
                "family_source": family_source,
                "product_type": expected,
                "reason": f"name_type_{got_label}_expected_{expected}",
            }
        )
    return renames


async def run_names_pass(chairs: List[Chair]) -> Dict[str, Any]:
    models = {c.model_number for c in chairs if c.is_active and c.model_number}
    pdf_families = build_pdf_family_index(CATALOG_PDF)
    parsed = parse_pdfs_for_models(CATALOG_PDF, models) if CATALOG_PDF.is_dir() else {}
    async with AsyncSessionLocal() as db:
        categories = (await db.execute(select(Category))).scalars().all()
        subcategories = (await db.execute(select(ProductSubcategory))).scalars().all()
        chairs = (
            await db.execute(
                select(Chair).options(
                    selectinload(Chair.category),
                    selectinload(Chair.family),
                    selectinload(Chair.subcategory),
                )
            )
        ).scalars().all()

    from backend.scripts.fix_product_names import apply_plan as apply_name_plan

    cat_by_id = {c.id: c for c in categories}
    sub_by_id = {s.id: s for s in subcategories}
    plan = build_name_plan(chairs, pdf_families, parsed, cat_by_id, sub_by_id)
    generic_result = await apply_name_plan(plan)

    sync_renames = build_category_name_sync_plan(
        chairs, pdf_families, parsed, cat_by_id, sub_by_id
    )
    synced: List[Dict[str, Any]] = []
    async with AsyncSessionLocal() as db:
        for item in sync_renames:
            chair = (
                await db.execute(select(Chair).where(Chair.id == item["id"]))
            ).scalar_one_or_none()
            if not chair or (chair.name or "").strip() == item["new_name"]:
                continue
            try:
                await AdminService.update_product(db, chair.id, {"name": item["new_name"]})
                synced.append(item)
                logger.info(
                    "Name sync %s: %r -> %r (%s)",
                    chair.model_number,
                    item["old_name"],
                    item["new_name"],
                    item["reason"],
                )
            except Exception as e:
                generic_result.setdefault("errors", []).append(
                    {"id": item["id"], "error": str(e)}
                )

    generic_result["category_sync_renames"] = synced
    generic_result["category_sync_count"] = len(synced)
    generic_result["applied"] = list(generic_result.get("applied", [])) + synced
    generic_result["applied_count"] = len(generic_result["applied"])
    return generic_result


async def run_images_pass(chairs: List[Chair], uploads_dir: Path) -> Dict[str, Any]:
    active = [c for c in chairs if c.is_active]
    plan = build_image_plan(active)
    applied: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []
    scan_index = index_scans_extended(SCANS_DIR)

    async with AsyncSessionLocal() as db:
        for action in plan.get("actions", []):
            if action.get("action") not in ("set_scan_primary", "clear_primary"):
                continue
            chair = (
                await db.execute(select(Chair).where(Chair.id == action["id"]))
            ).scalar_one_or_none()
            if not chair:
                continue
            update: Dict[str, Any] = {}
            try:
                if action["action"] == "set_scan_primary":
                    src = Path(action["new_scan"])
                    expected = {
                        "chairs": "chair",
                        "barstools": "barstool",
                        "table": "table_top",
                        "table-bases": "table_base",
                        "booths-banquettes": "booth",
                    }.get(chair.category.slug if chair.category else "", "chair")
                    scans = scan_index.get(chair.model_number or "", [])
                    pick = pick_scan_for_type(
                        chair.model_number,
                        chair.model_suffix,
                        scans,
                        expected,
                    ) or pick_best_scan(
                        chair.model_number, chair.model_suffix, scans
                    )
                    if not pick or not pick.is_file():
                        pick = src
                    url = copy_asset_to_uploads(pick, uploads_dir, chair.model_number)
                    images = merge_gallery(
                        chair, url, [], action.get("move_primary_to_gallery")
                    )
                    update = {
                        "primary_image_url": url,
                        "thumbnail": url,
                        "images": images,
                    }
                elif action["action"] == "clear_primary":
                    images = merge_gallery(
                        chair, None, [], chair.primary_image_url
                    )
                    update = {
                        "primary_image_url": None,
                        "thumbnail": None,
                        "images": images,
                    }
                if update:
                    await AdminService.update_product(db, chair.id, update)
                    applied.append({"id": chair.id, "model": chair.model_number, **update})
            except Exception as e:
                errors.append({"id": action["id"], "error": str(e)})

    return {
        "image_plan_summary": plan.get("summary"),
        "applied_count": len(applied),
        "errors": errors,
    }


async def audit_distribution() -> Dict[str, int]:
    async with AsyncSessionLocal() as db:
        dist = await db.execute(
            select(Category.slug, func.count(Chair.id))
            .join(Chair, Chair.category_id == Category.id)
            .where(Chair.is_active == True)
            .group_by(Category.slug)
            .order_by(func.count(Chair.id).desc())
        )
        return {slug: cnt for slug, cnt in dist}


def write_log(
    plan: Dict[str, Any],
    category_result: Dict[str, Any],
    name_result: Optional[Dict[str, Any]],
    image_result: Optional[Dict[str, Any]],
    after_dist: Dict[str, int],
    name_changes: List[Dict[str, Any]],
) -> None:
    per_sku: List[Dict[str, Any]] = []
    name_by_id = {n.get("id"): n for n in name_changes if n.get("id")}

    for ch in plan.get("changes", []):
        nid = ch["id"]
        nm = name_by_id.get(nid, {})
        per_sku.append(
            {
                "id": nid,
                "model_number": ch["model_number"],
                "category": {
                    "old": ch["old_category_slug"],
                    "new": ch["new_category_slug"],
                    "confidence": ch["confidence"],
                    "evidence": ch["evidence"],
                },
                "subcategory": {
                    "old": ch.get("old_subcategory_slug"),
                    "new": ch.get("new_subcategory_slug"),
                },
                "name": {
                    "old": ch.get("old_name"),
                    "new": nm.get("new_name") or ch.get("old_name"),
                    "changed": bool(nm.get("new_name")),
                },
            }
        )

    for nid, nm in name_by_id.items():
        if not any(p["id"] == nid for p in per_sku):
            per_sku.append(
                {
                    "id": nid,
                    "model_number": nm.get("model_number"),
                    "category": None,
                    "name": {
                        "old": nm.get("old_name"),
                        "new": nm.get("new_name"),
                        "changed": True,
                    },
                }
            )

    log = {
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "plan_summary": plan.get("summary"),
        "category_apply": {
            "applied": len(category_result.get("applied", [])),
            "errors": category_result.get("errors", []),
        },
        "name_apply": name_result,
        "image_apply": image_result,
        "before_distribution": plan.get("before_distribution"),
        "after_distribution": after_dist,
        "low_confidence_skus": plan.get("low_confidence"),
        "per_sku": per_sku,
    }
    OUTPUT.mkdir(parents=True, exist_ok=True)
    LOG_PATH.write_text(json.dumps(log, indent=2, default=str))


async def main_async(args: argparse.Namespace) -> None:
    (
        chairs,
        categories_by_slug,
        category_by_id,
        subcats_by_cat_slug,
        family_by_id,
        scan_index,
        pdf_index,
    ) = await load_catalog()

    if args.command == "baseline":
        baseline = export_baseline(chairs)
        OUTPUT.mkdir(parents=True, exist_ok=True)
        BASELINE_PATH.write_text(json.dumps(baseline, indent=2, default=str))
        logger.info(
            "Baseline: %s active, distribution=%s -> %s",
            baseline["active_count"],
            baseline["category_distribution"],
            BASELINE_PATH,
        )
        return

    plan = build_reclassify_plan(
        chairs,
        categories_by_slug,
        category_by_id,
        subcats_by_cat_slug,
        family_by_id,
        scan_index,
        pdf_index,
    )
    plan_path = OUTPUT / f"reclassify_catalog_plan_{int(time.time())}.json"
    OUTPUT.mkdir(parents=True, exist_ok=True)
    plan_path.write_text(json.dumps(plan, indent=2, default=str))

    s = plan["summary"]
    logger.info("Plan written: %s", plan_path)
    logger.info(
        "Before: %s | After (est): %s",
        plan["before_distribution"],
        plan["after_distribution_estimated"],
    )
    logger.info(
        "Changes=%s unchanged=%s low_confidence=%s by_target=%s",
        s["category_changes"],
        s["unchanged"],
        s["low_confidence"],
        dict(s["by_target"]),
    )
    for item in plan["changes"][:12]:
        logger.info(
            "  %s %s conf=%s %s -> %s | %s",
            item["model_number"],
            item.get("old_name", "")[:30],
            item["confidence"],
            item["old_category_slug"],
            item["new_category_slug"],
            item["evidence"][:2],
        )

    if args.command == "plan":
        return

    category_result = await apply_category_plan(plan)
    logger.info(
        "Applied %s category changes, %s errors",
        len(category_result["applied"]),
        len(category_result["errors"]),
    )

    name_result = None
    image_result = None
    name_changes: List[Dict[str, Any]] = []

    if args.names:
        chairs_fresh, *_ = await load_catalog()
        name_result = await run_names_pass(chairs_fresh)
        name_changes = name_result.get("applied", [])
        logger.info("Names: applied %s", name_result.get("applied_count"))

    if args.images:
        chairs_fresh, *_ = await load_catalog()
        uploads = resolve_uploads_dir(args.uploads_dir)
        image_result = await run_images_pass(chairs_fresh, uploads)
        logger.info("Images: applied %s", image_result.get("applied_count"))

    after_dist = await audit_distribution()
    logger.info("After distribution: %s", after_dist)
    write_log(plan, category_result, name_result, image_result, after_dist, name_changes)
    logger.info("Log: %s", LOG_PATH)


def main() -> None:
    ap = argparse.ArgumentParser(description="Reclassify full production catalog")
    ap.add_argument("command", choices=["baseline", "plan", "apply"])
    ap.add_argument("--env-file", nargs="?", const="backend/.env.production")
    ap.add_argument("--names", action="store_true", help="After categories, run name fix pass")
    ap.add_argument("--images", action="store_true", help="After categories, fix scan-only images")
    ap.add_argument("--uploads-dir", default=None)
    args = ap.parse_args()
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
