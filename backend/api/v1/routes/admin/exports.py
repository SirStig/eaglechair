"""
Admin Product Export Routes

Downloads of the whole product base: an Excel workbook (products +
variations) and a contents-style product index PDF in the catalog design.
"""

from datetime import date

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from backend.api.dependencies import get_current_admin
from backend.database.base import get_db
from backend.models.company import AdminUser
from backend.services.catalog_pdf.data import load_products
from backend.services.catalog_pdf.renderer import render_product_index
from backend.services.product_export_service import build_workbook, index_groups

router = APIRouter()

XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _download(content: bytes, media_type: str, filename: str) -> Response:
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store"},
    )


@router.get("/products.xlsx", summary="Export products and variations (Excel)")
async def export_products_xlsx(
    include_inactive: bool = True,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    products = await load_products(db, include_inactive=include_inactive)
    content = await run_in_threadpool(build_workbook, products)
    return _download(content, XLSX_TYPE, f"Eagle Chair Products {date.today().isoformat()}.xlsx")


@router.get("/product-index.pdf", summary="Export the product index (PDF)")
async def export_product_index(
    include_inactive: bool = False,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    products = await load_products(db, include_inactive=include_inactive)
    content = await run_in_threadpool(
        render_product_index, index_groups(products), "Product Index", str(date.today().year)
    )
    return _download(content, "application/pdf", f"Eagle Chair Product Index {date.today().isoformat()}.pdf")
