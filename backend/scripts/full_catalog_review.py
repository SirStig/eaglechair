"""
Full-catalog review: every active product — category, subcategory, name from scans + PDFs.

Usage:
  python -m backend.scripts.full_catalog_review plan --env-file backend/.env.production
  python -m backend.scripts.full_catalog_review apply --env-file backend/.env.production
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

ASSETS = Path("/home/jkac/Documents/Eagel Chair Assets")
SCANS_DIR = ASSETS / "CMYK-scans-converted"
CATALOG_DIR = ASSETS / "catalog pages 4 email"
OUTPUT = project_root / "backend/scripts/output"
PLAN_PATH = OUTPUT / "full_catalog_review_plan.json"
LOG_PATH = OUTPUT / "full_catalog_review_log.json"

SKIP_TOKENS = frozenset({
    "cat", "4mail", "mail", "compressed", "digital", "outdoor", "min", "special",
    "pdf", "vjune", "score", "order", "selector", "email", "min", "vjune", "puffs",
    "drums", "boxes", "benches", "ottomans", "booth", "banquette", "cafe", "shop",
    "series", "profiles", "upholstered",
})

TYPE_TO_SLUG = {
    "chair": "chairs",
    "barstool": "barstools",
    "table_top": "table",
    "table_base": "table-bases",
    "booth": "booths-banquettes",
}

LABEL = {
    "chairs": "Chair",
    "barstools": "Barstool",
    "table": "Table Top",
    "table-bases": "Table Base",
    "booths-banquettes": "Booth",
}

REAL_TABLE_BASES = frozenset({"6810", "4062", "4065", "5005", "5008", "5603"})

MANUAL_TYPE: Dict[str, str] = {
    "5027": "barstool",
    "5222": "barstool",
    "5546": "barstool",
    "5576": "barstool",
    "4245": "barstool",
    "4247": "barstool",
    "4248": "barstool",
    "3546": "barstool",
    "5001": "barstool",
    "5006": "barstool",
    "5242": "barstool",
    "5246": "barstool",
    "5440": "barstool",
    "5646": "barstool",
    "5880": "barstool",
    "6503": "barstool",
    "6546": "barstool",
    "6554": "barstool",
    "6556": "barstool",
    "6808": "barstool",
    "7310": "barstool",
    "7807": "barstool",
    "4546": "barstool",
    "5880": "barstool",
    "6810": "table_base",
    "4062": "table_base",
    "4065": "table_base",
    "5005": "table_base",
    "5008": "table_base",
    "5603": "table_base",
}

MANUAL_FAMILY: Dict[str, str] = {
    "3291": "Route 66",
    "3501": "Scranton Shop",
    "4501": "Scranton Shop",
    "5105": "Cafe Vienna",
    "5160": "Cafe Innsbruck",
    "6160": "Cafe Innsbruck",
    "6080": "Bohemian Bistro & Tavern",
    "6390": "Bohemian Bistro & Tavern",
    "5035": "Valencia",
    "5022": "Bellagio",
    "5015": "New Orleans",
    "4004": "Milano",
    "4008": "Milano",
    "6440": "Seville",
    "6880": "Ocho",
    "6646": "Macerano",
    "5880": "Ocho",
    "5646": "Macerano",
    "6546": "Torquato",
    "8304": "Lavaca",
    "5242": "Modena",
    "5440": "Seville",
    "404": "Anastasia",
    "T304": "Tarte",
    "T700": "Dania",
    "6810": "Ellipto",
    "5246": "Abruzzo",
    "5247": "Izumo",
    "5028": "Pretzel",
    "6610": "Valencia",
}

BARSTOOL_SCAN = re.compile(r"bar\s*stool|barstool", re.I)
BOOTH_SCAN = re.compile(r"\bbooth\b|banquette", re.I)
TABLE_TOP_SCAN = re.compile(
    r"table\s*top|tabletop|30x30|wood\s*edge|laminated\s*cube|custom\s*table|woodedge",
    re.I,
)
TABLE_BASE_SCAN = re.compile(
    r"table\s*base|\.base\.|pedestal|pretzel\s*base|ellipto|barrel\s*base|cast\s*iron\s*base",
    re.I,
)
CHAIR_SCAN = re.compile(
    r"style\s*back|\bback\b|arm\s*chair|side\s*chair|dining\s*chair|\bchair\b|upholstered",
    re.I,
)
OUTDOOR_PDF = re.compile(r"outdoor", re.I)
BOOTH_MODEL = re.compile(r"^8\d{3}$")
TABLE_SERIES = re.compile(r"^\d{2,3}$")


def _load_env(path: str) -> None:
    env_path = project_root / path if not os.path.isabs(path) else Path(path)
    if env_path.is_file():
        from dotenv import load_dotenv

        load_dotenv(env_path, override=True)


def models_from_pdf_name(name: str) -> List[str]:
    out: List[str] = []
    if re.search(r"cat\.booth\.", name, re.I):
        for m in re.finditer(r"\.(\d{4})\.", name):
            y = int(m.group(1))
            if not (2010 <= y <= 2035):
                out.append(m.group(1))
        for m in re.finditer(r"booth\.(\d{4})\.", name, re.I):
            out.append(m.group(1))
        if out:
            return out
    m = re.search(r"cat\.([\d\-A-Za-z.]+?)\.", name, re.I)
    if not m:
        return out
    for part in re.split(r"[-.]", m.group(1)):
        if len(part) == 4 and part.isdigit() and not (2010 <= int(part) <= 2035):
            out.append(part)
        elif len(part) == 3 and part.isdigit():
            out.append(part)
    return out


FAMILY_RE = re.compile(
    r"cat\.[\d\-A-Za-z.\s]+\.(.+?)\.(?:\d{4}|4mail|outdoor|compressed|digital|mail|min|vjune|special|score|email)",
    re.I,
)


def family_from_pdf_path(pdf_path: str) -> Optional[str]:
    stem = Path(pdf_path).stem
    m = FAMILY_RE.search(stem)
    if m:
        fam = re.sub(r"\s+", " ", m.group(1).strip())
        fam = re.sub(r"\s+\d{4}$", "", fam).strip()
        if fam and fam.lower() not in SKIP_TOKENS and not fam.isdigit() and len(fam) < 48:
            return fam
    m2 = re.match(r"cat\.([^.]+)\.(.+)$", stem, re.I)
    if not m2:
        return None
    for p in m2.group(2).replace("-", ".").split("."):
        if not p:
            continue
        if p.isdigit() and len(p) == 4 and 2010 <= int(p) <= 2035:
            break
        if p.lower() in SKIP_TOKENS:
            continue
        if re.match(r"^[A-Za-z]", p) and len(p) > 1:
            return p
    return None


def booth_family_from_pdf(path: str) -> Optional[str]:
    stem = Path(path).stem
    if "booth" not in stem.lower():
        return None
    m_series = re.search(
        r"cat\.booth\.\d+\.series\.([A-Za-z][A-Za-z\s&]+?)\.(?:\d{4}|4mail|mail|compressed)",
        stem,
        re.I,
    )
    if m_series:
        fam = re.sub(r"\s+", " ", m_series.group(1).strip())
        if fam.lower() not in SKIP_TOKENS:
            return fam
    m = re.search(
        r"cat\.booth\.\d+\.([A-Za-z][A-Za-z\s&]+?)\.(?:\d{4}|4mail|mail|compressed|4email)",
        stem,
        re.I,
    )
    if m:
        fam = re.sub(r"\s+", " ", m.group(1).strip())
        if fam.lower() not in SKIP_TOKENS:
            return fam
    m2 = re.search(r"cat\.booth\.(\d+)\.([A-Za-z][^.]+)\.", stem, re.I)
    if m2:
        fam = re.sub(r"\s+", " ", m2.group(2).strip())
        if fam.lower() not in SKIP_TOKENS:
            return fam
    return None


def load_pdf_family_index() -> Dict[str, str]:
    try:
        from backend.scripts.fix_product_names import build_pdf_family_index

        if CATALOG_DIR.is_dir():
            return build_pdf_family_index(CATALOG_DIR)
    except Exception:
        pass
    return {}


def build_pdf_indexes() -> Tuple[Dict[str, List[str]], Dict[str, str], Dict[str, str]]:
    """model -> pdf paths, model -> best family, model -> booth family."""
    by_model: Dict[str, List[str]] = {}
    family_primary: Dict[str, str] = {}
    booth_family: Dict[str, str] = {}

    if not CATALOG_DIR.is_dir():
        return by_model, family_primary, booth_family

    for pdf in sorted(CATALOG_DIR.glob("*.pdf")):
        name = pdf.name
        models = models_from_pdf_name(name)
        fam = family_from_pdf_path(str(pdf))
        bfam = booth_family_from_pdf(str(pdf))

        for mn in models:
            by_model.setdefault(mn, []).append(str(pdf))
            if "booth" in name.lower() and bfam:
                booth_family[mn] = bfam
            elif "booth" in name.lower() and fam:
                booth_family.setdefault(mn, fam)

        if models and fam:
            lead = models[0]
            family_primary.setdefault(lead, fam)
            for mn in models:
                if mn not in family_primary:
                    family_primary[mn] = fam

    for mn, fam in load_pdf_family_index().items():
        if fam and mn not in family_primary:
            family_primary[mn] = fam

    return by_model, family_primary, booth_family


def pdf_score(mn: str, pdf_path: str) -> int:
    n = Path(pdf_path).name
    if re.search(rf"cat\.{re.escape(mn)}[\.\-]", n, re.I):
        return 100
    if re.search(rf"[\.\-]{re.escape(mn)}[\.\-]", n, re.I):
        return 70
    return 20


def resolve_pdf_family(
    mn: str, pdf_paths: List[str], booth_fams: Dict[str, str]
) -> Tuple[Optional[str], bool]:
    outdoor = False
    if mn in booth_fams and booth_fams[mn]:
        return booth_fams[mn], outdoor
    if not pdf_paths:
        return None, outdoor
    ranked = sorted(pdf_paths, key=lambda p: pdf_score(mn, p), reverse=True)
    best = ranked[0]
    if OUTDOOR_PDF.search(best):
        outdoor = True
    if pdf_score(mn, best) < 40:
        return None, outdoor
    fam = family_from_pdf_path(best)
    return fam, outdoor


def classify_from_scans(mn: str, scans: List[Path], current_name: str = "") -> Tuple[str, List[str]]:
    if BOOTH_MODEL.match(mn):
        return "booth", ["model:8xxx"]
    if mn in REAL_TABLE_BASES:
        return "table_base", ["model:real_table_base"]
    if TABLE_SERIES.match(mn) and mn.isdigit() and int(mn) < 400:
        return "table_top", ["model:3digit_table"]

    evidence: List[str] = []
    has_barstool = any(BARSTOOL_SCAN.search(p.name) for p in scans)
    has_table_top = any(
        TABLE_TOP_SCAN.search(p.name) and not CHAIR_SCAN.search(p.name) for p in scans
    )
    has_table_base = any(
        TABLE_BASE_SCAN.search(p.name) and not CHAIR_SCAN.search(p.name) for p in scans
    )
    has_booth = any(BOOTH_SCAN.search(p.name) for p in scans)
    has_chair = any(CHAIR_SCAN.search(p.name) for p in scans)

    if has_barstool:
        evidence.append("scan:explicit_barstool")
        return "barstool", evidence
    if has_table_base and not has_chair:
        return "table_base", ["scan:table_base"]
    if has_table_top and not has_chair:
        return "table_top", ["scan:table_top"]
    if has_booth:
        return "booth", ["scan:booth"]

    name_l = (current_name or "").lower()
    if "barstool" in name_l:
        return "barstool", ["name:barstool"]
    if "booth" in name_l:
        return "booth", ["name:booth"]
    if "table top" in name_l or re.search(r"\btable\b", name_l) and "base" not in name_l:
        return "table_top", ["name:table"]
    if "table base" in name_l and mn in REAL_TABLE_BASES:
        return "table_base", ["name:table_base"]

    if has_chair:
        return "chair", ["scan:chair"]
    if not scans:
        return "chair", ["no_scan_default_chair"]
    return "chair", ["scan:neutral"]


SCAN_FAMILY_ALLOW = frozenset({
    "ellipto", "barrel", "rustic", "modena", "seville", "tarte", "dania",
    "anastasia", "la grange", "desoto", "lavaca", "matagorda", "sasebo", "bellville",
    "miami beach", "bandera", "lampasas", "sabine", "laredo", "lanzac", "craftsman",
    "fonzac", "montrose", "edinburg", "statton", "plateau", "monticello", "cavolino",
    "caserta", "saray", "rombus", "macerano", "torquato", "ocho", "abruzzo", "izumo",
    "alita", "ephyra", "odo", "normandie", "milano", "bellagio", "valencia",
})

SCAN_COLOR_WORDS = frozenset({
    "black", "blue", "gray", "grey", "walnut", "cherry", "antique", "antiqued",
    "yellow", "green", "red", "white", "bronze", "chrome", "fabric", "leather",
    "raw", "dark", "light", "mango", "gray", "seat", "suspension", "corrugated",
    "omega", "counter", "full", "also", "aka", "bw", "ns", "bltex", "bomo", "boma",
    "escada", "ostrich", "tiburon", "tanaga", "kennedy", "arcona", "bohemian",
})


def family_from_scans(mn: str, scans: List[Path]) -> Optional[str]:
    for p in scans:
        n = p.name
        if mn not in n and not n.startswith(f"{mn}-") and not n.startswith(f"{mn}."):
            continue
        patterns: List[Tuple[str, int]] = [
            (r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+barstool", 1),
            (r"(\d{4})[A-Z.]*\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b", 2),
            (r"(Ellipto|Modena|Seville|Tarte|Dania|Anastasia|La\s*Grange|DeSoto)", 1),
        ]
        for pat, grp in patterns:
            m = re.search(pat, n, re.I)
            if not m:
                continue
            fam = re.sub(r"\s+", " ", m.group(grp).strip()).title()
            key = fam.lower()
            if key in SKIP_TOKENS or key in SCAN_COLOR_WORDS:
                continue
            if key not in SCAN_FAMILY_ALLOW and grp == 2:
                continue
            if key in SCAN_FAMILY_ALLOW or grp == 1:
                return fam
    return None


def family_from_existing_name(name: str, cat_slug: str) -> Optional[str]:
    if not name:
        return None
    label = LABEL.get(cat_slug, "")
    m = re.match(
        rf"^(.+?)\s+{re.escape(label)}$",
        name.strip(),
        re.I,
    )
    if not m:
        return None
    fam = m.group(1).strip()
    if fam.isdigit() or fam.lower() in SKIP_TOKENS:
        return None
    if re.match(r"^(Wood|Metal|Outdoor|Upholstered|Lounge|Arm|Swivel|Backless)\s", fam, re.I):
        return None
    return fam


def name_quality(name: str, cat_slug: str) -> int:
    fam = family_from_existing_name(name, cat_slug)
    if fam:
        return 50 + len(fam)
    if re.match(r"^\d{4}\s", name or ""):
        return 5
    return 10


def build_name(mn: str, cat_slug: str, family: Optional[str], suffix: Optional[str]) -> str:
    label = LABEL[cat_slug]
    if cat_slug == "table":
        return f"{mn} Table Top"
    if cat_slug == "booths-banquettes":
        if family and family != mn:
            return f"{family} Booth" if "booth" not in family.lower() else family
        return f"{mn} Booth"
    if cat_slug == "table-bases":
        if family and family.lower() == "ellipto":
            return "Ellipto Table Base"
        if family and not family.isdigit():
            return f"{family} Table Base"
        return f"{mn} Table Base"
    suf = (suffix or "").strip()
    if family and not family.isdigit() and family != mn:
        if label.lower() in family.lower():
            return family
        return f"{family} {label}"
    if suf:
        return f"{mn}{suf} {label}"
    return f"{mn} {label}"


def resolve_subcategory(
    cat_slug: str, outdoor: bool, product_type: str, scans: List[Path], subs: Dict
) -> Optional[str]:
    cat_subs = subs.get(cat_slug, {})
    if outdoor:
        m = {
            "chairs": "outdoor-chairs",
            "barstools": "outdoor-barstools",
            "table": "outdoor-table-tops",
            "booths-banquettes": "outdoor-booths",
        }
        if m.get(cat_slug) in cat_subs:
            return m[cat_slug]
    if product_type == "barstool" and "wood-barstools" in cat_subs:
        return "wood-barstools"
    if product_type == "table_top" and "indoor-table-tops" in cat_subs:
        return "indoor-table-tops"
    if product_type == "table_base" and "metal-table-bases" in cat_subs:
        return "metal-table-bases"
    if product_type == "chair":
        if any(re.search(r"metal", p.name, re.I) for p in scans) and "metal-chairs" in cat_subs:
            return "metal-chairs"
        if "wood-chairs" in cat_subs:
            return "wood-chairs"
    if product_type == "booth" and "upholstered-booths" in cat_subs:
        return "upholstered-booths"
    return None


async def build_plan() -> Dict[str, Any]:
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from backend.database.base import AsyncSessionLocal
    from backend.models.chair import Category, Chair, ProductSubcategory
    from backend.scripts.fix_scan_only_images import index_by_model

    pdf_by_model, pdf_family, booth_family = build_pdf_indexes()
    scan_index = index_by_model(SCANS_DIR)

    changes: List[Dict[str, Any]] = []

    async with AsyncSessionLocal() as db:
        cats = {c.id: c for c in (await db.execute(select(Category))).scalars().all()}
        subs_by_slug: Dict[str, Dict[str, ProductSubcategory]] = {}
        for s in (await db.execute(select(ProductSubcategory))).scalars().all():
            c = cats[s.category_id]
            subs_by_slug.setdefault(c.slug, {})[s.slug] = s

        chairs = (
            await db.execute(
                select(Chair).where(Chair.is_active == True).order_by(Chair.model_number)
            )
        ).scalars().all()

        for ch in chairs:
            mn = (ch.model_number or "").strip()
            scans = scan_index.get(mn, [])
            pdfs = pdf_by_model.get(mn, [])

            product_type, scan_ev = classify_from_scans(mn, scans, ch.name or "")
            if mn in MANUAL_TYPE:
                product_type = MANUAL_TYPE[mn]
                scan_ev.append(f"manual_type:{product_type}")
            if (ch.model_suffix or "").upper() in ("PF", "PB", "PBN", "PBF", "BS") and product_type == "chair":
                product_type = "barstool"
                scan_ev.append("suffix:barstool")
            pdf_fam, outdoor = resolve_pdf_family(mn, pdfs, booth_family)
            scan_fam = family_from_scans(mn, scans)

            if BOOTH_MODEL.match(mn):
                product_type = "booth"
            if product_type == "table_base" and mn not in REAL_TABLE_BASES:
                product_type = "chair"
                scan_ev.append("override:not_real_table_base")

            cat_slug = TYPE_TO_SLUG[product_type]
            old_cat = cats[ch.category_id].slug
            old_sub = None
            if ch.subcategory_id:
                for slug, sub in subs_by_slug.get(old_cat, {}).items():
                    if sub.id == ch.subcategory_id:
                        old_sub = slug
                        break

            existing_fam = family_from_existing_name(ch.name or "", old_cat)
            family = (
                MANUAL_FAMILY.get(mn)
                or booth_family.get(mn)
                or pdf_fam
                or scan_fam
                or existing_fam
            )
            if product_type == "booth" and booth_family.get(mn):
                bf = booth_family[mn]
                if bf and bf.lower() not in SKIP_TOKENS:
                    family = bf

            new_name = build_name(mn, cat_slug, family, ch.model_suffix)
            sub_slug = resolve_subcategory(cat_slug, outdoor, product_type, scans, subs_by_slug)

            cat_changed = cat_slug != old_cat
            sub_changed = sub_slug != old_sub
            name_changed = new_name != ch.name
            if name_changed and name_quality(ch.name or "", old_cat) > name_quality(new_name, cat_slug):
                new_name = ch.name
                name_changed = False

            if not (cat_changed or name_changed or sub_changed):
                continue

            changes.append(
                {
                    "id": ch.id,
                    "model_number": mn,
                    "old_name": ch.name,
                    "new_name": new_name,
                    "old_category": old_cat,
                    "new_category": cat_slug,
                    "old_subcategory": old_sub,
                    "new_subcategory": sub_slug,
                    "product_type": product_type,
                    "family": family,
                    "outdoor": outdoor,
                    "evidence": scan_ev[:8],
                    "has_scan": bool(scans),
                    "pdf_count": len(pdfs),
                }
            )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_active": len(chairs),
        "changes": changes,
        "change_count": len(changes),
    }


async def apply_plan(plan: Dict[str, Any]) -> int:
    from sqlalchemy import select

    from backend.database.base import AsyncSessionLocal
    from backend.models.chair import Category, Chair, ProductSubcategory

    async with AsyncSessionLocal() as db:
        cats_list = (await db.execute(select(Category))).scalars().all()
        cats = {c.slug: c for c in cats_list}
        cats_by_id = {c.id: c for c in cats_list}
        subs = {}
        for s in (await db.execute(select(ProductSubcategory))).scalars().all():
            c = cats_by_id[s.category_id]
            subs[(c.slug, s.slug)] = s

        applied = 0
        for item in plan["changes"]:
            ch = await db.get(Chair, item["id"])
            if not ch or not ch.is_active:
                continue
            ch.name = item["new_name"]
            ch.category_id = cats[item["new_category"]].id
            if item.get("new_subcategory"):
                sub = subs.get((item["new_category"], item["new_subcategory"]))
                ch.subcategory_id = sub.id if sub else None
            else:
                ch.subcategory_id = None
            applied += 1
        await db.commit()
    return applied


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["plan", "apply"])
    parser.add_argument("--env-file", default="backend/.env.production")
    args = parser.parse_args()
    _load_env(args.env_file)

    if args.action == "plan":
        plan = asyncio.run(build_plan())
        OUTPUT.mkdir(parents=True, exist_ok=True)
        PLAN_PATH.write_text(json.dumps(plan, indent=2))
        LOG_PATH.write_text(json.dumps(plan, indent=2))
        print(f"Active: {plan['total_active']}, changes: {plan['change_count']}")
        dist_old = Counter(c["old_category"] for c in plan["changes"])
        dist_new = Counter(c["new_category"] for c in plan["changes"])
        print("category moves from:", dict(dist_old))
        print("category moves to:", dict(dist_new))
    else:
        plan = json.loads(PLAN_PATH.read_text())
        n = asyncio.run(apply_plan(plan))
        print(f"Applied {n} updates")


if __name__ == "__main__":
    main()
