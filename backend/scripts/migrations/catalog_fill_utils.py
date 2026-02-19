"""
Utilities for fill_products_from_catalog: PDF text extraction and XLS price loading.
Reuses extractors from pdf_parser_service; no image extraction or tmp DB.
"""

import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

import pdfplumber

from backend.services.pdf_parser_service import (
    extract_dimensions,
    extract_family_info,
    extract_model_variations,
)

logger = logging.getLogger(__name__)


SKIP_STEM_TOKENS = frozenset({
    "cat", "4mail", "mail", "compressed", "digital", "outdoor", "min", "score",
    "vjune", "special", "order", "selector", "puffs", "drums", "boxes", "benches",
    "ottomans", "compressed", "pdf",
})


def family_name_from_pdf_path(pdf_path: str) -> str:
    stem = Path(pdf_path).stem
    parts = re.sub(r"[-_]", ".", stem).split(".")
    for p in parts:
        if not p:
            continue
        if p.isdigit() or (len(p) == 4 and p.isdigit() and 2000 <= int(p) <= 2030):
            continue
        if p.lower() in SKIP_STEM_TOKENS:
            continue
        if p.isalpha() and len(p) > 1:
            return p
    return stem.replace("_", " ").replace("-", " ").strip() or "Unknown"


def parse_pdf_for_fill(
    pdf_path: str,
    family_name_override: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Parse a catalog PDF for migration: text only, no images. All pages are read.
    Returns one record per base_model with variations merged from all pages,
    family_name (e.g. Abruzzo), dimensions, family_info, and combined full_page_text for LLM.
    Invalid or corrupt PDFs are skipped and return [].
    """
    family_name = family_name_override or family_name_from_pdf_path(pdf_path)
    by_base: Dict[str, Dict[str, Any]] = {}
    all_text_parts: List[str] = []

    try:
        pdf = pdfplumber.open(pdf_path)
    except Exception as e:
        logger.warning("Skipping invalid/corrupt PDF %s: %s", pdf_path, e)
        return []

    try:
        with pdf:
            for page_num, page in enumerate(pdf.pages, start=1):
                text = page.extract_text()
                if not text or not text.strip():
                    continue
                all_text_parts.append(text)
                models = extract_model_variations(text)
                family_info = extract_family_info(text)
                dimensions = extract_dimensions(text)

                base_models: Dict[str, List[Dict]] = {}
                for m in models:
                    base = m["base_model"]
                    if base not in base_models:
                        base_models[base] = []
                    base_models[base].append(m)

                for base_model, variations in base_models.items():
                    if base_model not in by_base:
                        by_base[base_model] = {
                            "base_model": base_model,
                            "family_name": family_name,
                            "variations": [],
                            "dimensions": {},
                            "family_info": family_info,
                            "full_page_text": "",
                            "page_number": page_num,
                        }
                    rec = by_base[base_model]
                    seen_full = {v["full_model"] for v in rec["variations"]}
                    for v in variations:
                        if v["full_model"] not in seen_full:
                            rec["variations"].append(v)
                            seen_full.add(v["full_model"])
                    if dimensions and not rec["dimensions"]:
                        rec["dimensions"] = dimensions
                    if family_info:
                        for k, v in family_info.items():
                            if v and isinstance(v, list):
                                rec["family_info"].setdefault(k, []).extend(v)

        full_text = "\n\n".join(all_text_parts)
        for rec in by_base.values():
            rec["full_page_text"] = full_text
            for k in rec["family_info"]:
                if isinstance(rec["family_info"][k], list):
                    rec["family_info"][k] = list(dict.fromkeys(rec["family_info"][k]))
        return list(by_base.values())
    except Exception as e:
        logger.warning("Skipping PDF (error while parsing) %s: %s", pdf_path, e)
        return []


def load_xls_prices(
    xls_path: str,
    model_column: int = 0,
    list_price_column: int = 1,
    skip_header: bool = True,
    price_in_dollars: bool = True,
    start_row: Optional[int] = None,
) -> Dict[str, int]:
    """
    Load model number -> LIST price (cents) from a .xls file.
    Uses 0-based column indices. If start_row is set, reading starts there; else
    if skip_header, first row is treated as header. If price_in_dollars is True, values are multiplied by 100.
    """
    import xlrd

    out: Dict[str, int] = {}
    wb = xlrd.open_workbook(xls_path)
    sh = wb.sheet_by_index(0)

    if start_row is not None:
        start = start_row
    else:
        start = 1 if skip_header else 0
    for row_idx in range(start, sh.nrows):
        row = sh.row_values(row_idx)
        if model_column >= len(row) or list_price_column >= len(row):
            continue
        model_val = row[model_column]
        price_val = row[list_price_column]
        if model_val is None or model_val == "":
            continue
        if isinstance(model_val, float) and model_val == int(model_val):
            model_str = str(int(model_val))
        else:
            model_str = str(model_val).strip()
        if not model_str:
            continue
        try:
            p = float(price_val)
        except (TypeError, ValueError):
            continue
        cents = int(round(p * 100)) if price_in_dollars else int(p)
        out[model_str] = cents

    return out


def normalize_model_for_lookup(model: str) -> str:
    return str(model).strip()
