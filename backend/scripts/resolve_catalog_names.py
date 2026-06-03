"""
Resolve display names from catalog PDF filenames (model-specific PDF wins).
Used for manual review pass — only applies when confidence is high.

Usage:
  python -m backend.scripts.resolve_catalog_names plan --env-file backend/.env.production
  python -m backend.scripts.resolve_catalog_names apply --env-file backend/.env.production
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

CATALOG = Path("/home/jkac/Documents/Eagel Chair Assets/catalog pages 4 email")
OUTPUT = project_root / "backend/scripts/output/resolve_catalog_names_plan.json"

FAMILY_RE = re.compile(
    r"cat\.[\d\-A-Za-z.]+\.(.+?)\.(?:\d{4}|4mail|outdoor|compressed|digital|mail|min|vjune|special|score)",
    re.I,
)
MODEL_IN_CHUNK = re.compile(r"(?:^|[.\-])(\d{3,4})(?:[.\-]|$)")

TYPE_BY_CAT = {
    "chairs": "Chair",
    "barstools": "Barstool",
    "table": "Table Top",
    "table-bases": "Table Base",
    "booths-banquettes": "Booth",
}

JUNK_FAMILIES = frozenset({
    "booth", "outdoor", "poster", "cat", "compressed", "mail", "special", "order",
    "bistro", "tavern", "cafe", "shop", "classic", "wine", "cellar",
})

MANUAL_FAMILY: Dict[str, str] = {
    "4247": "Alita",
    "4248": "Alita",
    "5440": "BNs",
    "6503": "6503",
    "6556": "6556",
    "7807": "7807",
    "3291": "Route 66",
    "3501": "Scranton Shop",
    "4501": "Scranton Shop",
    "5105": "Cafe Vienna",
    "5160": "Cafe Innsbruck",
    "6160": "Cafe Innsbruck",
    "5382": "ChopHouse",
    "6382": "ChopHouse",
    "6080": "Bohemian Bistro & Tavern",
    "6390": "Bohemian Bistro & Tavern",
    "6220": "Treviso",
    "6536": "Omega",
    "6646": "Macerano",
    "6880": "Ocho",
    "5576": "Avignon",
}


def _load_env() -> None:
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


def family_from_pdf(path: str) -> Optional[str]:
    stem = Path(path).stem
    m = FAMILY_RE.search(stem)
    if m:
        fam = re.sub(r"\s+", " ", m.group(1).strip())
        fam = re.sub(r"\s+\d{4}$", "", fam).strip()
        if fam and fam.lower() not in JUNK_FAMILIES and len(fam) < 40:
            if not fam.isdigit():
                return fam
    parts = re.sub(r"[-_]", ".", stem).split(".")
    candidates = []
    for p in parts:
        if not p or p.isdigit() or (len(p) == 4 and p.isdigit()):
            continue
        if p.lower() in JUNK_FAMILIES:
            continue
        if re.match(r"^[A-Za-z]", p) and len(p) > 2:
            candidates.append(p)
    if candidates:
        return max(candidates, key=len)
    return None


def score_pdf_for_model(mn: str, pdf_path: str) -> int:
    name = Path(pdf_path).name
    stem = Path(pdf_path).stem
    score = 0
    if re.search(rf"cat\.{re.escape(mn)}[\.\-]", name, re.I):
        score += 80
    if re.search(rf"[\.\-]{re.escape(mn)}[\.\-]", name, re.I):
        score += 60
    if re.search(rf"[\.\-]{re.escape(mn)}$", stem, re.I):
        score += 50
    if mn in name:
        score += 20
    return score


def resolve_family(mn: str, pdf_paths: List[str]) -> Tuple[Optional[str], Optional[str], int]:
    if mn in MANUAL_FAMILY:
        return MANUAL_FAMILY[mn], "manual", 100
    if not pdf_paths:
        return None, None, 0
    ranked = sorted(
        ((score_pdf_for_model(mn, p), p) for p in pdf_paths),
        reverse=True,
    )
    best_score, best_path = ranked[0]
    if best_score < 40:
        return None, best_path, best_score
    fam = family_from_pdf(best_path)
    return fam, best_path, best_score


def build_display_name(mn: str, cat_slug: str, family: Optional[str]) -> str:
    ptype = TYPE_BY_CAT.get(cat_slug, "Chair")
    if cat_slug == "table":
        return f"{mn} Table Top"
    if cat_slug == "booths-banquettes":
        return f"{mn} Booth"
    if cat_slug == "table-bases":
        if family and family.lower() == "ellipto":
            return "Ellipto Table Base"
        return f"{family} Table Base" if family and not family.isdigit() else f"{mn} Table Base"
    if family:
        if family.lower().endswith(ptype.lower()):
            return family
        if ptype.lower() in family.lower():
            return family
        if family.isdigit() or family == mn:
            return f"{mn} {ptype}"
        return f"{family} {ptype}"
    return f"{mn} {ptype}"


async def build_plan() -> Dict[str, Any]:
    from sqlalchemy import select

    from backend.database.base import AsyncSessionLocal
    from backend.models.chair import Category, Chair
    from backend.scripts.catalog_sync_utils import index_catalog_pdf_filenames

    pdf_idx = index_catalog_pdf_filenames(CATALOG)
    plan: List[Dict[str, Any]] = []

    async with AsyncSessionLocal() as db:
        cats = {c.id: c for c in (await db.execute(select(Category))).scalars().all()}
        chairs = (
            await db.execute(select(Chair).where(Chair.is_active == True))
        ).scalars().all()

        for ch in chairs:
            mn = ch.model_number
            cat_slug = cats[ch.category_id].slug
            entry = pdf_idx.get(mn, {})
            paths = entry.get("pdf_paths") or []
            fam, pdf, score = resolve_family(mn, paths)
            if score < 40 and not fam:
                continue
            new_name = build_display_name(mn, cat_slug, fam)
            if new_name == ch.name:
                continue
            plan.append(
                {
                    "id": ch.id,
                    "model_number": mn,
                    "old_name": ch.name,
                    "new_name": new_name,
                    "category_slug": cat_slug,
                    "family": fam,
                    "pdf": Path(pdf).name if pdf else None,
                    "confidence_score": score,
                }
            )

    return {"changes": plan, "count": len(plan)}


async def apply_plan(plan: Dict[str, Any]) -> int:
    from sqlalchemy import select

    from backend.database.base import AsyncSessionLocal
    from backend.models.chair import Chair

    applied = 0
    async with AsyncSessionLocal() as db:
        for item in plan["changes"]:
            ch = await db.get(Chair, item["id"])
            if ch and ch.is_active:
                ch.name = item["new_name"]
                applied += 1
        await db.commit()
    return applied


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["plan", "apply"])
    parser.add_argument("--env-file", default="backend/.env.production")
    args, _ = parser.parse_known_args()
    env_path = project_root / args.env_file if not os.path.isabs(args.env_file) else Path(args.env_file)
    if env_path.is_file():
        from dotenv import load_dotenv

        load_dotenv(env_path, override=True)

    if args.action == "plan":
        plan = asyncio.run(build_plan())
        OUTPUT.write_text(json.dumps(plan, indent=2))
        print(f"Planned {plan['count']} name updates -> {OUTPUT}")
        for c in plan["changes"][:25]:
            print(f"  {c['model_number']}: {c['old_name']!r} -> {c['new_name']!r} ({c['family']}, score={c['confidence_score']})")
    else:
        if not OUTPUT.is_file():
            print("Run plan first")
            sys.exit(1)
        plan = json.loads(OUTPUT.read_text())
        n = asyncio.run(apply_plan(plan))
        print(f"Applied {n} name updates")


if __name__ == "__main__":
    main()
