import io
import re
import time
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from backend.api.v1.routes.admin.upload import detect_mime_from_content, process_image_to_webp
from backend.models.chair import Chair
from backend.scripts.migrations.catalog_fill_utils import (
    family_name_from_pdf_path,
    parse_pdf_for_fill,
)

BOOTH_IMAGE_BY_MODEL: Dict[str, str] = {
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

ASSET_IMAGE_DIRS = (
    "CMYK-scans-converted",
    "CMYK-installs-converted",
    "Boothilicious_2024_images",
)

MODEL_IN_FILENAME = re.compile(r"\b(\d{4})([A-Z][\w.-]*)?\b")
MODELS_IN_CAT_PDF = re.compile(r"cat\.([\d\-]+)", re.IGNORECASE)
YEAR_MODEL = re.compile(r"^20\d{2}$")
NON_PRODUCT_MODELS = frozenset({"TR", "T", "TP", "TCB", "TCD", "TUL", "TDAS", "ADD-ON", "ADD ON"})


def normalize_model(model: str) -> str:
    return str(model or "").strip().upper()


def models_from_catalog_pdf_name(pdf_path: Path) -> List[str]:
    m = MODELS_IN_CAT_PDF.search(pdf_path.name)
    if not m:
        return []
    chunk = m.group(1)
    out = []
    for part in re.split(r"[-\s]+", chunk):
        part = part.strip()
        if len(part) == 4 and part.isdigit():
            year = int(part)
            if 2010 <= year <= 2030:
                continue
            out.append(part)
    return out


def index_asset_images(assets_root: Path) -> Dict[str, List[Path]]:
    by_base: Dict[str, List[Path]] = defaultdict(list)
    for sub in ASSET_IMAGE_DIRS:
        folder = assets_root / sub
        if not folder.is_dir():
            continue
        for path in folder.iterdir():
            if not path.is_file():
                continue
            if path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
                continue
            stem = path.stem.replace(" ", "")
            for match in MODEL_IN_FILENAME.finditer(stem):
                base = match.group(1)
                if base.isdigit() and 2010 <= int(base) <= 2030:
                    continue
                by_base[base].append(path)
    return dict(by_base)


def pick_best_asset_image(paths: List[Path]) -> Optional[Path]:
    if not paths:
        return None

    def score(p: Path) -> Tuple[int, int, str]:
        name = p.name.lower()
        s = 0
        if "cmyk-scans" in str(p).lower():
            s += 40
        if name.endswith("-0.png") or name.endswith("-0.jpg") or name.endswith("-0.webp"):
            s += 30
        if "install" in str(p).lower():
            s -= 10
        if "v12" in name or "v42" in name:
            s += 5
        return (s, -len(name), name)

    return max(paths, key=score)


def classify_junk(chair: Chair) -> Optional[str]:
    mn = normalize_model(chair.model_number)
    name = (chair.name or "").strip()
    slug = chair.slug or ""
    has_img = bool(chair.primary_image_url)
    price = chair.base_price or 0
    desc_len = len((chair.full_description or "") + (chair.short_description or ""))

    if mn in NON_PRODUCT_MODELS or mn.replace("-", " ") in NON_PRODUCT_MODELS:
        return "non-product-code"
    if YEAR_MODEL.match(mn) and re.match(rf"^(?:\w+\s+)?Model\s+{re.escape(mn)}$", name, re.I):
        return "year-false-positive"
    if slug == "model-2024" and mn == "2024":
        return "year-false-positive"
    return None


def chair_keep_score(chair: Chair) -> int:
    score = 0
    if chair.primary_image_url:
        score += 50
    if (chair.base_price or 0) > 0:
        score += 30
    if chair.family_id:
        score += 10
    if chair.full_description or chair.short_description:
        score += 10
    if chair.slug and not chair.slug.startswith("model-"):
        score += 15
    name = (chair.name or "").lower()
    if name and not re.match(r"^(?:\w+\s+)?model\s+[\w-]+$", name):
        score += 20
    return score


def find_duplicate_groups(chairs: List[Chair]) -> List[List[Chair]]:
    groups: Dict[Tuple[str, str], List[Chair]] = defaultdict(list)
    for c in chairs:
        key = (normalize_model(c.model_number), (c.model_suffix or "").strip().upper())
        groups[key].append(c)
    return [sorted(g, key=lambda x: -chair_keep_score(x)) for g in groups.values() if len(g) > 1]


def copy_asset_to_uploads(
    src: Path,
    uploads_dir: Path,
    model_number: str,
) -> str:
    content = src.read_bytes()
    mime = detect_mime_from_content(content, src.name) or "image/png"
    processed, ext = process_image_to_webp(content, mime)
    dest_dir = uploads_dir / "images" / "products"
    dest_dir.mkdir(parents=True, exist_ok=True)
    safe = re.sub(r"[^a-zA-Z0-9._-]+", "_", src.stem)[:80]
    filename = f"{model_number}_{safe}_{int(time.time())}{ext}"
    dest = dest_dir / filename
    dest.write_bytes(processed)
    return f"/uploads/images/products/{filename}"


def build_images_json(url: str, alt: str) -> List[Dict[str, Any]]:
    return [{"url": url, "type": "side", "order": 1, "alt": alt}]


def index_catalog_pdf_filenames(pdf_dir: Path) -> Dict[str, Dict[str, Any]]:
    by_model: Dict[str, Dict[str, Any]] = {}
    for pdf in sorted(pdf_dir.glob("*.pdf")):
        family = family_name_from_pdf_path(str(pdf))
        for base in models_from_catalog_pdf_name(pdf):
            entry = by_model.setdefault(base, {"family_name": family, "pdf_paths": []})
            entry["pdf_paths"].append(str(pdf))
            if not entry.get("family_name"):
                entry["family_name"] = family
    return by_model


def parse_pdfs_for_models(pdf_dir: Path, model_numbers: set[str]) -> Dict[str, Dict[str, Any]]:
    filename_index = index_catalog_pdf_filenames(pdf_dir)
    by_model: Dict[str, Dict[str, Any]] = {}
    pdfs_to_parse: set[Path] = set()
    for mn in model_numbers:
        entry = filename_index.get(mn)
        if entry:
            by_model[mn] = dict(entry)
            for p in entry.get("pdf_paths") or []:
                pdfs_to_parse.add(Path(p))
        for base, entry in filename_index.items():
            if mn == base:
                by_model.setdefault(mn, dict(entry))
                for p in entry.get("pdf_paths") or []:
                    pdfs_to_parse.add(Path(p))

    for pdf in sorted(pdfs_to_parse):
        family = family_name_from_pdf_path(str(pdf))
        for rec in parse_pdf_for_fill(str(pdf)):
            base = rec["base_model"]
            if base not in model_numbers and base not in by_model:
                continue
            existing = by_model.get(base, {"family_name": family, "pdf_paths": [str(pdf)]})
            existing.update(rec)
            if not existing.get("family_name"):
                existing["family_name"] = family
            by_model[base] = existing
    return by_model


def dims_to_update(dims: dict) -> dict:
    out = {}
    for key, db_key in [
        ("width", "width"),
        ("depth", "depth"),
        ("height", "height"),
        ("seat_width", "seat_width"),
        ("seat_depth", "seat_depth"),
        ("seat_height", "seat_height"),
        ("weight", "weight"),
        ("yardage", "upholstery_amount"),
    ]:
        if dims.get(key) is not None:
            out[db_key] = float(dims[key])
    return out


def variations_from_pdf_record(rec: Dict[str, Any], base_model: str) -> List[Dict[str, Any]]:
    out = []
    for v in rec.get("variations") or []:
        full = v.get("full_model")
        if not full or full == base_model:
            continue
        out.append({"sku": full, "price_adjustment": 0})
    return out
