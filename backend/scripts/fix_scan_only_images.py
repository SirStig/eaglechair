"""
Primary images: CMYK-scans-converted only (*-0.png preferred).
Install / catalog / booth never as primary; installs go to gallery.
No scan => null primary (no install placeholder on product card).

Usage:
  python -m backend.scripts.fix_scan_only_images plan --env-file backend/.env.production
  python -m backend.scripts.fix_scan_only_images apply --env-file backend/.env.production
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
    env_arg = sys.argv[idx + 1] if idx + 1 < len(sys.argv) and not sys.argv[idx + 1].startswith("-") else "backend/.env.production"
    env_path = project_root / env_arg if not os.path.isabs(env_arg) else Path(env_arg)
    if env_path.is_file():
        from dotenv import load_dotenv
        load_dotenv(env_path, override=True)

from sqlalchemy import select

from backend.core.config import settings
from backend.database.base import AsyncSessionLocal
from backend.models.chair import Chair
from backend.scripts.catalog_sync_utils import (
    BOOTH_IMAGE_BY_MODEL,
    copy_asset_to_uploads,
)
from backend.services.admin_service import AdminService

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

ASSETS_ROOT = Path("/home/jkac/Documents/Eagel Chair Assets")
SCANS_DIR = ASSETS_ROOT / "CMYK-scans-converted"
INSTALLS_DIR = ASSETS_ROOT / "CMYK-installs-converted"
OUTPUT = project_root / "backend" / "scripts" / "output"
LOG_PATH = OUTPUT / "primary_gallery_fix_log.json"

INSTALL_URL_PAT = re.compile(r"install", re.I)
CATALOG_URL_PAT = re.compile(
    r"boothilicious|manual_page|_page\d|page\dimage|sunray_page|ephyra|pretzel|harlequin",
    re.I,
)
MODEL_IN_STEM = re.compile(r"\b(\d{4})\b")

MODEL_PREFIX = re.compile(r"^(\d{4})([A-Z][\w.-]*)?", re.I)
MAX_GALLERY_INSTALLS = 4


def resolve_uploads_dir(cli: Optional[str]) -> Path:
    if cli:
        return Path(cli).resolve()
    fp = Path(settings.FRONTEND_PATH)
    if fp.is_absolute() and (fp / "uploads").exists():
        return fp / "uploads"
    p = project_root / "uploads"
    p.mkdir(parents=True, exist_ok=True)
    return p


def index_by_model(folder: Path, require_install: bool = False) -> Dict[str, List[Path]]:
    by_base: Dict[str, List[Path]] = {}
    if not folder.is_dir():
        return by_base
    for path in folder.iterdir():
        if not path.is_file():
            continue
        if path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
            continue
        if require_install and "install" not in path.name.lower():
            continue
        stem = path.stem.replace(" ", "")
        m = MODEL_PREFIX.match(stem)
        if m:
            base = m.group(1)
            if base.isdigit() and 2010 <= int(base) <= 2030:
                continue
            by_base.setdefault(base, []).append(path)
            continue
        for match in MODEL_IN_STEM.finditer(stem):
            base = match.group(1)
            if 2010 <= int(base) <= 2030:
                continue
            if require_install and base not in path.name:
                continue
            by_base.setdefault(base, []).append(path)
    return by_base


def pick_best_scan(model_number: str, model_suffix: Optional[str], scans: List[Path]) -> Optional[Path]:
    if not scans:
        return None
    mn = (model_number or "").strip()
    suffix = (model_suffix or "").strip().upper()

    def score(p: Path) -> Tuple[int, int, str]:
        name = p.name.lower()
        stem = p.stem.replace(" ", "")
        s = 0
        if stem.startswith(mn):
            s += 50
        elif mn in stem:
            s += 25
        if suffix and suffix.lower() in name:
            s += 20
        if name.endswith("-0.png"):
            s += 50
        elif name.endswith("-0.jpg"):
            s += 35
        if "install" in name:
            s -= 80
        if "banquette" in name and "booth" not in (model_number or ""):
            s -= 15
        return (s, -len(name), name)

    best = max(scans, key=score)
    return best if score(best)[0] >= 20 else None


def pick_install_shots(model_number: str, installs: List[Path], limit: int = MAX_GALLERY_INSTALLS) -> List[Path]:
    mn = (model_number or "").strip()
    candidates = []
    for p in installs:
        if mn in p.stem or p.stem.startswith(mn):
            candidates.append(p)
    if not candidates:
        candidates = [p for p in installs if mn in p.name]
    if not candidates:
        return []

    def score(p: Path) -> Tuple[int, str]:
        n = p.name.lower()
        s = 0
        if "install" in n:
            s += 30
        if mn in p.stem[:8]:
            s += 20
        return (s, p.name)

    candidates.sort(key=score, reverse=True)
    seen = set()
    out = []
    for p in candidates:
        if p in seen:
            continue
        seen.add(p)
        out.append(p)
        if len(out) >= limit:
            break
    return out


def upload_stem_from_url(url: str) -> str:
    if not url:
        return ""
    name = Path(url.split("?")[0]).name
    name = re.sub(r"\.(webp|png|jpg|jpeg)$", "", name, flags=re.I)
    parts = name.split("_")
    if len(parts) >= 3 and parts[-1].isdigit():
        return "_".join(parts[1:-1])
    if len(parts) >= 2:
        return "_".join(parts[1:])
    return name


def scan_stem_matches_upload(scan: Path, upload_stem: str) -> bool:
    if not upload_stem:
        return False
    safe_scan = re.sub(r"[^a-zA-Z0-9._-]+", "_", scan.stem)[:80].lower()
    us = upload_stem.lower()
    return safe_scan in us or us in safe_scan or scan.stem.lower().replace(" ", "_") in us


def classify_url(url: str, model_number: str, scan_index: Dict[str, List[Path]]) -> str:
    if not url:
        return "null"
    if "wp-content" in url:
        return "wordpress"
    fn = url.split("/")[-1].lower()
    if model_number in BOOTH_IMAGE_BY_MODEL and "boothilicious" in fn:
        return "booth"
    if CATALOG_URL_PAT.search(fn):
        return "catalog"
    if INSTALL_URL_PAT.search(fn):
        return "install"
    scans = scan_index.get(model_number or "", [])
    stem = upload_stem_from_url(url)
    for scan in scans:
        if scan_stem_matches_upload(scan, stem):
            return "scan"
    if scans and not CATALOG_URL_PAT.search(fn) and not INSTALL_URL_PAT.search(fn):
        return "other_upload"
    if scans:
        return "non_scan_upload"
    return "unknown_upload"


def parse_gallery(images: Any) -> List[Dict[str, Any]]:
    if not images:
        return []
    if isinstance(images, str):
        try:
            images = json.loads(images)
        except json.JSONDecodeError:
            return []
    if not isinstance(images, list):
        return []
    out = []
    for i, item in enumerate(images):
        if isinstance(item, str):
            out.append({"url": item, "type": "gallery", "order": i + 1, "alt": ""})
        elif isinstance(item, dict) and item.get("url"):
            out.append(dict(item))
    return out


def gallery_urls_set(gallery: List[Dict[str, Any]]) -> set:
    return {g["url"] for g in gallery if g.get("url")}


def build_plan(chairs: List[Chair]) -> Dict[str, Any]:
    scan_index = index_by_model(SCANS_DIR)
    install_index = index_by_model(INSTALLS_DIR, require_install=False)

    plan: Dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "rules": {
            "primary": "CMYK-scans-converted *-0.png only",
            "no_scan_primary": "null",
            "installs": "gallery only",
        },
        "before": {
            "scan_primary": 0,
            "wrong_primary": 0,
            "null_primary": 0,
        },
        "actions": [],
        "null_primary_skus": [],
        "gallery_only": [],
    }

    for chair in chairs:
        if not chair.is_active:
            continue

        mn = chair.model_number or ""
        primary_url = chair.primary_image_url or ""
        pclass = classify_url(primary_url, mn, scan_index)

        if pclass == "scan":
            plan["before"]["scan_primary"] += 1
            scans = scan_index.get(mn, [])
            installs = pick_install_shots(mn, install_index.get(mn, []))
            if installs:
                plan["actions"].append(
                    {
                        "id": chair.id,
                        "model": mn,
                        "action": "add_gallery_installs_only",
                        "primary_class": pclass,
                        "install_files": [str(p) for p in installs],
                    }
                )
            continue

        if pclass == "null":
            plan["before"]["null_primary"] += 1
        else:
            plan["before"]["wrong_primary"] += 1

        scans = scan_index.get(mn, [])
        best_scan = pick_best_scan(mn, chair.model_suffix, scans)
        installs = pick_install_shots(mn, install_index.get(mn, []))

        gallery = parse_gallery(chair.images)
        existing_urls = gallery_urls_set(gallery)

        move_primary_to_gallery = None
        if primary_url and pclass in ("install", "catalog", "booth", "wordpress", "non_scan_upload", "other_upload", "unknown_upload"):
            if primary_url not in existing_urls:
                move_primary_to_gallery = primary_url

        if best_scan:
            plan["actions"].append(
                {
                    "id": chair.id,
                    "model": mn,
                    "name": chair.name,
                    "action": "set_scan_primary",
                    "old_primary": primary_url or None,
                    "old_class": pclass,
                    "new_scan": str(best_scan),
                    "install_files": [str(p) for p in installs],
                    "move_primary_to_gallery": move_primary_to_gallery,
                }
            )
        else:
            plan["null_primary_skus"].append(
                {"id": chair.id, "model": mn, "name": chair.name, "old_class": pclass, "old_primary": primary_url or None}
            )
            plan["actions"].append(
                {
                    "id": chair.id,
                    "model": mn,
                    "name": chair.name,
                    "action": "clear_primary",
                    "old_primary": primary_url or None,
                    "old_class": pclass,
                    "install_files": [str(p) for p in installs],
                    "move_primary_to_gallery": move_primary_to_gallery,
                }
            )

    plan["summary"] = {
        "active": plan["before"]["scan_primary"] + plan["before"]["wrong_primary"] + plan["before"]["null_primary"],
        "actions": len(plan["actions"]),
        "set_scan_primary": sum(1 for a in plan["actions"] if a["action"] == "set_scan_primary"),
        "clear_primary": sum(1 for a in plan["actions"] if a["action"] == "clear_primary"),
        "gallery_install_only": sum(1 for a in plan["actions"] if a["action"] == "add_gallery_installs_only"),
        "null_primary_after": len(plan["null_primary_skus"]),
    }
    return plan


def merge_gallery(
    chair: Chair,
    primary_url: Optional[str],
    gallery_entries: List[Dict[str, Any]],
    move_url: Optional[str],
) -> List[Dict[str, Any]]:
    gallery = parse_gallery(chair.images)
    urls = gallery_urls_set(gallery)

    if move_url and move_url not in urls:
        gallery.append(
            {
                "url": move_url,
                "type": "gallery",
                "order": len(gallery) + 1,
                "alt": f"{chair.name or chair.model_number} - install",
            }
        )
        urls.add(move_url)

    order = len(gallery) + 1
    for entry in gallery_entries:
        if entry["url"] not in urls and entry["url"] != primary_url:
            entry["order"] = order
            gallery.append(entry)
            urls.add(entry["url"])
            order += 1

    if primary_url:
        side = {
            "url": primary_url,
            "type": "side",
            "order": 0,
            "alt": chair.name or chair.model_number,
        }
        gallery = [side] + [g for g in gallery if g.get("url") != primary_url or g.get("type") != "side"]
    else:
        gallery = [g for g in gallery if g.get("type") != "side"]

    gallery.sort(key=lambda g: g.get("order", 99))
    return gallery


async def apply_plan(plan: Dict[str, Any], uploads_dir: Path) -> Dict[str, Any]:
    results = {
        "set_scan_primary": [],
        "clear_primary": [],
        "gallery_installs_added": 0,
        "errors": [],
    }

    async with AsyncSessionLocal() as db:
        for item in plan.get("actions", []):
            chair = (
                await db.execute(select(Chair).where(Chair.id == item["id"]))
            ).scalar_one_or_none()
            if not chair:
                continue

            gallery_new: List[Dict[str, Any]] = []
            for ipath in item.get("install_files") or []:
                src = Path(ipath)
                if not src.is_file():
                    continue
                try:
                    url = copy_asset_to_uploads(src, uploads_dir, chair.model_number)
                    gallery_new.append(
                        {
                            "url": url,
                            "type": "gallery",
                            "order": 0,
                            "alt": f"{chair.name or chair.model_number} - install",
                        }
                    )
                    results["gallery_installs_added"] += 1
                except Exception as e:
                    results["errors"].append({"id": item["id"], "install": str(src), "error": str(e)})

            try:
                if item["action"] == "add_gallery_installs_only":
                    if not gallery_new:
                        continue
                    images = merge_gallery(chair, chair.primary_image_url, gallery_new, None)
                    await AdminService.update_product(db, chair.id, {"images": images})
                    results["set_scan_primary"].append({"id": chair.id, "model": chair.model_number, "note": "gallery_only"})
                    continue

                primary_url: Optional[str] = None
                if item["action"] == "set_scan_primary":
                    src = Path(item["new_scan"])
                    primary_url = copy_asset_to_uploads(src, uploads_dir, chair.model_number)

                move = item.get("move_primary_to_gallery")
                images = merge_gallery(chair, primary_url, gallery_new, move)

                update: Dict[str, Any] = {
                    "primary_image_url": primary_url,
                    "thumbnail": primary_url,
                    "images": images,
                }
                await AdminService.update_product(db, chair.id, update)

                bucket = "set_scan_primary" if primary_url else "clear_primary"
                results[bucket].append(
                    {
                        "id": chair.id,
                        "model": chair.model_number,
                        "old_class": item.get("old_class"),
                        "new_primary": primary_url,
                        "gallery_added": len(gallery_new),
                    }
                )
                logger.info(
                    "%s id=%s model=%s primary=%s gallery+%s",
                    item["action"],
                    chair.id,
                    chair.model_number,
                    "scan" if primary_url else "NULL",
                    len(gallery_new),
                )
            except Exception as e:
                results["errors"].append({"id": item["id"], "error": str(e)})

    after = {"scan_primary": 0, "wrong_primary": 0, "null_primary": 0}
    async with AsyncSessionLocal() as db:
        chairs = (await db.execute(select(Chair).where(Chair.is_active == True))).scalars().all()
        scan_index = index_by_model(SCANS_DIR)
        for chair in chairs:
            pclass = classify_url(chair.primary_image_url or "", chair.model_number or "", scan_index)
            if pclass == "scan":
                after["scan_primary"] += 1
            elif pclass == "null":
                after["null_primary"] += 1
            else:
                after["wrong_primary"] += 1

    log = {
        "plan_before": plan.get("before"),
        "plan_summary": plan.get("summary"),
        "after": after,
        "results": results,
        "null_primary_skus": plan.get("null_primary_skus"),
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }
    OUTPUT.mkdir(parents=True, exist_ok=True)
    LOG_PATH.write_text(json.dumps(log, indent=2, default=str))
    return log


async def main_async(args: argparse.Namespace) -> None:
    async with AsyncSessionLocal() as db:
        chairs = (await db.execute(select(Chair))).scalars().all()

    plan = build_plan(chairs)
    plan_path = OUTPUT / f"primary_gallery_fix_plan_{int(time.time())}.json"
    OUTPUT.mkdir(parents=True, exist_ok=True)
    plan_path.write_text(json.dumps(plan, indent=2, default=str))

    logger.info(
        "Before: scan_primary=%s wrong_primary=%s null_primary=%s",
        plan["before"]["scan_primary"],
        plan["before"]["wrong_primary"],
        plan["before"]["null_primary"],
    )
    logger.info(
        "Actions: set_scan=%s clear=%s gallery_install_only=%s -> %s",
        plan["summary"]["set_scan_primary"],
        plan["summary"]["clear_primary"],
        plan["summary"]["gallery_install_only"],
        plan_path,
    )

    if args.command == "plan":
        for a in plan["actions"][:12]:
            if a["action"] != "add_gallery_installs_only":
                logger.info("  %s %s %s", a["action"], a["model"], a.get("old_class"))
        return

    uploads = resolve_uploads_dir(args.uploads_dir)
    log = await apply_plan(plan, uploads)
    logger.info(
        "After: scan=%s wrong=%s null=%s | gallery_installs_added=%s | log=%s",
        log["after"]["scan_primary"],
        log["after"]["wrong_primary"],
        log["after"]["null_primary"],
        log["results"]["gallery_installs_added"],
        LOG_PATH,
    )


def main() -> None:
    ap = argparse.ArgumentParser(description="Scan-only primary + install gallery")
    ap.add_argument("command", choices=["plan", "apply"])
    ap.add_argument("--env-file", nargs="?", const="backend/.env.production")
    ap.add_argument("--uploads-dir", default=None)
    args = ap.parse_args()
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
