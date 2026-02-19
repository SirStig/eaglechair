"""
Fill product fields from catalog PDFs and price XLS: descriptions (via Gemini), dimensions, LIST price.
Run on one PDF or a few products first; then full dry run. Images and families are left for manual work.

Usage:
  python -m backend.scripts.migrations.fill_products_from_catalog --pdf-dir "/path/to/catalog pages 4 email" --xls "woodchairs&barstools 2024.Jan.xls" [--dry-run]
  Use --env-file frontend/.env.production to point at production DB.
  Use --default-category-slug chairs (or --default-category-id N) when creating new products.

Requires: GEMINI_API_KEY in env for description/feature generation. Use --skip-llm to only fill dimensions/price.
"""

import argparse
import asyncio
import logging
import os
import re
import sys
from pathlib import Path
from typing import Optional

project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

if "--env-file" in sys.argv:
    idx = sys.argv.index("--env-file")
    if idx + 1 < len(sys.argv):
        env_path = sys.argv[idx + 1]
        env_path = os.path.join(project_root, env_path) if not os.path.isabs(env_path) else env_path
        env_path = os.path.abspath(env_path)
        os.environ["FILL_SCRIPT_ENV_FILE"] = env_path
        from dotenv import load_dotenv
        load_dotenv(env_path, override=True)

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.base import AsyncSessionLocal
from backend.models.chair import Category, Chair
from backend.scripts.migrations.catalog_fill_utils import (
    load_xls_prices,
    parse_pdf_for_fill,
)
from backend.services.admin_service import AdminService

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def _dims_to_update(dims: dict) -> dict:
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


def _slug_from_family_and_model(family_name: str, base_model: str) -> str:
    safe = re.sub(r"[^a-z0-9]+", "-", (family_name or "").lower()).strip("-")[:24]
    return f"model-{base_model}-{safe}" if safe else f"model-{base_model}"


async def _resolve_default_category(db: AsyncSession, default_category_id: Optional[int], default_category_slug: Optional[str]) -> Optional[int]:
    if default_category_id:
        r = await db.execute(select(Category).where(Category.id == default_category_id))
        if r.scalar_one_or_none():
            return default_category_id
    if default_category_slug:
        r = await db.execute(select(Category).where(Category.slug == default_category_slug.strip()))
        cat = r.scalar_one_or_none()
        if cat:
            return cat.id
    return None


def _log_full_payload(base_model: str, chair, rec: dict, update_data: dict) -> None:
    logger.info("")
    logger.info("========== DRY-RUN PAYLOAD (would update chair id=%s) ==========", chair.id)
    logger.info("model_number (from PDF): %s", base_model)
    logger.info("current name in DB: %s", getattr(chair, "name", None))
    variations = rec.get("variations") or []
    if variations:
        logger.info("variations (from PDF): %s", [v.get("full_model") for v in variations])
    logger.info("family_name (from PDF filename): %s", rec.get("family_name"))
    if update_data.get("base_price") is not None:
        logger.info("base_price (LIST, cents): %s  ($%.2f)", update_data["base_price"], update_data["base_price"] / 100)
    for key in ("width", "depth", "height", "seat_width", "seat_depth", "seat_height", "weight", "upholstery_amount"):
        if update_data.get(key) is not None:
            logger.info("%s: %s", key, update_data[key])
    if update_data.get("short_description"):
        logger.info("short_description:\n  %s", update_data["short_description"].replace("\n", "\n  "))
    if update_data.get("full_description"):
        logger.info("full_description:\n  %s", update_data["full_description"].replace("\n", "\n  "))
    if update_data.get("features"):
        logger.info("features (%s items): %s", len(update_data["features"]), update_data["features"])
    logger.info("========== END PAYLOAD ==========")
    logger.info("")


async def run(
    pdf_dir: Optional[str],
    xls_path: str,
    limit_pdfs: int,
    limit_products: int,
    dry_run: bool,
    skip_llm: bool,
    model_number_filter: Optional[str],
    model_col: int,
    list_price_col: int,
    xls_skip_header: bool,
    xls_start_row: Optional[int],
    gemini_api_key: Optional[str],
    pdf_prefix: Optional[str],
    pdf_file: Optional[str],
    verbose: bool,
    default_category_id: Optional[int],
    default_category_slug: Optional[str],
    create_if_missing: bool,
) -> None:
    if pdf_file:
        p = Path(pdf_file)
        if not p.is_file():
            logger.error("PDF file does not exist: %s", pdf_file)
            sys.exit(1)
        pdfs = [p]
        logger.info("Using single PDF: %s", p.name)
    else:
        if not pdf_dir:
            logger.error("Provide --pdf-dir or --pdf")
            sys.exit(1)
        pdf_dir_path = Path(pdf_dir)
        if not pdf_dir_path.is_dir():
            logger.error("PDF dir does not exist: %s", pdf_dir)
            sys.exit(1)
        pdf_prefix = (pdf_prefix or "").strip().lower()
        all_pdfs = sorted(pdf_dir_path.glob("*.pdf"))
        if pdf_prefix:
            all_pdfs = [p for p in all_pdfs if p.name.lower().startswith(pdf_prefix)]
        pdfs = all_pdfs[:limit_pdfs]
        if not pdfs:
            logger.error("No PDFs found in %s (prefix=%r)", pdf_dir, pdf_prefix or "(any)")
            sys.exit(1)
        logger.info("Using %s PDFs (prefix=%r)", len(pdfs), pdf_prefix or "(any)")

    logger.info("Loading prices from %s (model col=%s, list price col=%s)", xls_path, model_col, list_price_col)
    try:
        start_row_0 = (xls_start_row - 1) if xls_start_row is not None else None
        prices = load_xls_prices(
            xls_path,
            model_column=model_col,
            list_price_column=list_price_col,
            skip_header=xls_skip_header if start_row_0 is None else False,
            price_in_dollars=True,
            start_row=start_row_0,
        )
    except Exception as e:
        logger.error("Failed to load XLS: %s", e)
        sys.exit(1)
    logger.info("Loaded %s model->price entries", len(prices))

    all_products: list = []
    for pdf_path in pdfs:
        recs = parse_pdf_for_fill(str(pdf_path))
        all_products.extend(recs)
        logger.info("PDF %s: %s product records", pdf_path.name, len(recs))

    seen_base = set()
    unique_products: list = []
    for rec in all_products:
        base = rec["base_model"]
        if base in seen_base:
            continue
        seen_base.add(base)
        unique_products.append(rec)
    if not pdf_file:
        unique_products = unique_products[:limit_products]
    logger.info("Processing %s unique base models (limit %s)", len(unique_products), limit_products)

    if model_number_filter:
        unique_products = [r for r in unique_products if r["base_model"] == model_number_filter]
        if not unique_products:
            logger.error("No product with model_number %s in parsed PDFs", model_number_filter)
            sys.exit(1)
        logger.info("Filtered to model_number %s", model_number_filter)

    if not skip_llm and not os.environ.get("GEMINI_API_KEY") and not gemini_api_key:
        logger.warning("GEMINI_API_KEY not set; use --skip-llm to fill only dimensions/price, or set the key for descriptions.")

    async with AsyncSessionLocal() as db:
        default_cat_id = await _resolve_default_category(db, default_category_id, default_category_slug)
        if create_if_missing and not default_cat_id:
            logger.warning("--create-if-missing set but no default category (use --default-category-id or --default-category-slug); will skip creates.")

        updated = 0
        created = 0
        skipped_no_db = 0
        for rec in unique_products:
            base_model = rec["base_model"]
            family_name = rec.get("family_name") or ""

            result = await db.execute(select(Chair).where(Chair.model_number == base_model))
            chair = result.scalar_one_or_none()

            update_data: dict = {}
            dims = _dims_to_update(rec.get("dimensions") or {})
            update_data.update(dims)
            price_cents = prices.get(base_model) or prices.get(str(base_model))
            if price_cents is not None:
                update_data["base_price"] = price_cents
            else:
                update_data.setdefault("base_price", 0)

            if not skip_llm:
                from backend.scripts.migrations.gemini_descriptions import generate_descriptions
                gen = generate_descriptions(rec, api_key=gemini_api_key or os.environ.get("GEMINI_API_KEY"))
                if gen.get("short_description"):
                    update_data["short_description"] = gen["short_description"]
                if gen.get("full_description"):
                    update_data["full_description"] = gen["full_description"]
                if gen.get("features"):
                    update_data["features"] = gen["features"]

            if not chair:
                if not create_if_missing or not default_cat_id:
                    skipped_no_db += 1
                    logger.info("  [skip] %s not in DB", base_model)
                    continue
                slug = _slug_from_family_and_model(family_name, base_model)
                existing = (await db.execute(select(Chair).where(Chair.slug == slug))).scalar_one_or_none()
                if existing:
                    slug = f"model-{base_model}-{len(unique_products)}"
                create_data = {
                    "name": f"{family_name} Model {base_model}".strip() or f"Model {base_model}",
                    "model_number": base_model,
                    "slug": slug,
                    "category_id": default_cat_id,
                    "base_price": update_data.get("base_price", 0),
                    "stock_status": "instock",
                    "is_active": True,
                    "short_description": update_data.get("short_description"),
                    "full_description": update_data.get("full_description"),
                    "features": update_data.get("features"),
                    "width": update_data.get("width"),
                    "depth": update_data.get("depth"),
                    "height": update_data.get("height"),
                    "seat_width": update_data.get("seat_width"),
                    "seat_depth": update_data.get("seat_depth"),
                    "seat_height": update_data.get("seat_height"),
                    "weight": update_data.get("weight"),
                    "upholstery_amount": update_data.get("upholstery_amount"),
                }
                variations = rec.get("variations") or []
                create_data["variations"] = [{"sku": v["full_model"], "price_adjustment": 0} for v in variations if v.get("full_model") and v["full_model"] != base_model]
                if dry_run:
                    logger.info("  [dry-run] would create %s slug=%s category_id=%s", base_model, slug, default_cat_id)
                    if verbose:
                        logger.info("    name=%s base_price=%s variations=%s", create_data["name"], create_data["base_price"], create_data["variations"])
                    created += 1
                else:
                    try:
                        new_chair = await AdminService.create_product(db, create_data)
                        created += 1
                        logger.info("  created %s (id=%s)", base_model, new_chair.id)
                    except Exception as e:
                        logger.error("  failed to create %s: %s", base_model, e)
                continue

            if dry_run:
                if verbose:
                    _log_full_payload(base_model, chair, rec, update_data)
                else:
                    logger.info("  [dry-run] %s (id=%s): %s", base_model, chair.id, list(update_data.keys()))
                updated += 1
                continue

            await AdminService.update_product(db, chair.id, update_data)
            updated += 1
            logger.info("  updated %s (id=%s)", base_model, chair.id)

        logger.info("Done: %s updated, %s created, %s skipped (not in DB)", updated, created, skipped_no_db)


def main() -> None:
    ap = argparse.ArgumentParser(description="Fill products from catalog PDFs + XLS (descriptions via Gemini)")
    ap.add_argument("--pdf-dir", default=None, help="Directory containing family catalog PDFs (required unless --pdf)")
    ap.add_argument("--pdf", default=None, help="Single PDF file path (e.g. for one family catalog)")
    ap.add_argument("--xls", required=True, help="Path to .xls file with LIST prices")
    ap.add_argument("--limit-pdfs", type=int, default=1, help="Max PDFs to process (default 1 for testing)")
    ap.add_argument("--limit-products", type=int, default=5, help="Max unique products to update (default 5)")
    ap.add_argument("--dry-run", action="store_true", help="Do not write to DB")
    ap.add_argument("--skip-llm", action="store_true", help="Only fill dimensions/price, no Gemini descriptions")
    ap.add_argument("--model-number", default=None, help="Only process this base model number")
    ap.add_argument("--model-col", type=int, default=1, help="XLS column index for model number (0-based; default 1)")
    ap.add_argument("--list-price-col", type=int, default=9, help="XLS column index for LIST price (0-based; default 9)")
    ap.add_argument("--no-xls-header", action="store_true", help="XLS has no header row")
    ap.add_argument("--xls-start-row", type=int, default=13, help="First data row in XLS (1-based; default 13 for woodchairs file)")
    ap.add_argument("--gemini-api-key", default=None, help="Gemini API key (or set GEMINI_API_KEY)")
    ap.add_argument("--pdf-prefix", default="cat", help="Only use PDFs whose filename starts with this (default: cat)")
    ap.add_argument("--verbose", action="store_true", help="In dry-run, print full payload (price, descriptions, features, etc.)")
    ap.add_argument("--env-file", default=None, help="Load env from this path (e.g. frontend/.env.production) for DATABASE_URL")
    ap.add_argument("--default-category-id", type=int, default=None, help="Default category ID when creating new products")
    ap.add_argument("--default-category-slug", default="chairs", help="Default category slug when creating (default: chairs)")
    ap.add_argument("--create-if-missing", action="store_true", help="Create a new product when model_number is not in DB")
    args = ap.parse_args()

    asyncio.run(
        run(
            pdf_dir=args.pdf_dir,
            xls_path=args.xls,
            limit_pdfs=args.limit_pdfs,
            limit_products=args.limit_products,
            dry_run=args.dry_run,
            skip_llm=args.skip_llm,
            model_number_filter=args.model_number,
            model_col=args.model_col,
            list_price_col=args.list_price_col,
            xls_skip_header=not args.no_xls_header,
            xls_start_row=args.xls_start_row,
            gemini_api_key=args.gemini_api_key,
            pdf_prefix=args.pdf_prefix,
            pdf_file=args.pdf,
            verbose=args.verbose,
            default_category_id=args.default_category_id,
            default_category_slug=args.default_category_slug,
            create_if_missing=args.create_if_missing,
        )
    )


if __name__ == "__main__":
    main()
