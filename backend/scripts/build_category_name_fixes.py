"""
Build manual_review_decisions entries from catalog PDF filenames (not DB categories).
Human-reviewed rules: PDF family + category slug => display name.

Usage:
  python -m backend.scripts.build_category_name_fixes
"""

from __future__ import annotations

import json
import re
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent.parent
DECISIONS = project_root / "backend/scripts/output/manual_review_decisions.json"
CATALOG = Path("/home/jkac/Documents/Eagel Chair Assets/catalog pages 4 email")
BASELINE = project_root / "backend/scripts/output/manual_review_baseline.json"

from backend.scripts.catalog_sync_utils import index_catalog_pdf_filenames
from backend.scripts.fix_product_names import build_pdf_family_index, family_from_pdf_filename

TYPE_BY_CAT = {
    "chairs": "Chair",
    "barstools": "Barstool",
    "table": "Table Top",
    "table-bases": "Table Base",
    "booths-banquettes": "Booth",
    "benches-ottomans": "Bench",
}

SUB_BY_CAT = {
    "chairs": "wood-chairs",
    "barstools": "wood-barstools",
    "table": "indoor-table-tops",
    "table-bases": "metal-table-bases",
    "booths-banquettes": "upholstered-booths",
}

MANUAL = {
    "5576": {
        "name": "Avignon Barstool",
        "category_slug": "barstools",
        "subcategory_slug": "wood-barstools",
        "notes": "CMYK scan: Avignon channel back barstool; was BX Chair in chairs",
    },
    "6546": {"subcategory_slug": "wood-barstools", "notes": "Fix subcategory: was wood-chairs under barstools"},
    "6808": {"subcategory_slug": "wood-barstools", "notes": "Fix subcategory: was wood-chairs under barstools"},
}


def clean_family(raw: str) -> str:
    n = re.sub(r"\s+", " ", (raw or "").strip())
    n = re.sub(r"\s+Family\s*$", "", n, flags=re.I)
    if n.lower().startswith("cat."):
        return ""
    if len(n) > 40 or n.lower() in ("booth", "outdoor", "poster"):
        return ""
    return n


def target_name(model: str, cat_slug: str, pdf_fam: str) -> str:
    if model in MANUAL and "name" in MANUAL[model]:
        return MANUAL[model]["name"]
    ptype = TYPE_BY_CAT.get(cat_slug, "Chair")
    if cat_slug == "table":
        return f"{model} Table Top"
    if cat_slug == "table-bases":
        if pdf_fam and pdf_fam.lower() not in ("ellipto",):
            return f"{pdf_fam} Table Base"
        return f"{model} Table Base" if not pdf_fam else f"{pdf_fam} Table Base"
    if cat_slug == "booths-banquettes":
        return f"{model} Booth"
    fam = clean_family(pdf_fam)
    if fam:
        if fam.lower().endswith(ptype.lower()):
            return fam
        if ptype.lower() in fam.lower():
            return fam
        return f"{fam} {ptype}"
    return f"{model} {ptype}"


def main() -> None:
    baseline = json.loads(BASELINE.read_text())
    pdf_idx = index_catalog_pdf_filenames(CATALOG)
    pdf_fam = build_pdf_family_index(CATALOG)

    data = json.loads(DECISIONS.read_text()) if DECISIONS.is_file() else {"method": "", "reviews": []}
    existing = {r["model_number"] for r in data.get("reviews", []) if r.get("status") != "applied"}
    applied = {r["model_number"] for r in data.get("reviews", []) if r.get("status") == "applied"}

    new_reviews = []
    for row in baseline:
        mn = row["model"]
        cat = row["category"]
        cur_name = row["name"]
        fam_raw = pdf_fam.get(mn) or (pdf_idx.get(mn) or {}).get("family_name") or ""
        want_name = target_name(mn, cat, fam_raw)
        fixes = {}
        notes_parts = []

        if mn in MANUAL:
            fixes.update({k: v for k, v in MANUAL[mn].items() if k != "notes"})
            notes_parts.append(MANUAL[mn].get("notes", ""))

        if want_name != cur_name:
            fixes["name"] = want_name
            notes_parts.append(f"PDF/catalog: {fam_raw or 'series table'}")

        if cat in SUB_BY_CAT and mn not in applied:
            sub = SUB_BY_CAT[cat]
            if mn in ("6546", "6808") or (cat == "table" and row.get("sub") != sub):
                fixes.setdefault("subcategory_slug", sub)
            elif cat == "table" and not row.get("sub"):
                fixes["subcategory_slug"] = sub

        if not fixes:
            continue
        if mn in existing:
            continue

        new_reviews.append(
            {
                "model_number": mn,
                "reviewer_notes": "; ".join(n for n in notes_parts if n) or f"Align name to {want_name}",
                "fixes": fixes,
            }
        )

    data["reviews"].extend(new_reviews)
    DECISIONS.write_text(json.dumps(data, indent=2))
    print(f"Added {len(new_reviews)} pending name/category reviews")


if __name__ == "__main__":
    main()
