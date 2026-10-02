"""
Admin Router

Aggregates all admin route modules
"""

from fastapi import APIRouter, Depends, Request

from backend.api.v1.routes.admin import (
    ai_chat,
    catalog,
    catalog_builder,
    categories,
    colors,
    companies,
    dashboard,
    emails,
    exports,
    families,
    finishes,
    inquiries,
    pricing_tiers,
    products,
    quotes,
    register,
    subcategories,
    upholsteries,
    upload,
)

from backend.services.catalog_cache import bump_catalog_version

# Admin sections whose writes never change public catalog data
_NON_CATALOG_SECTIONS = ("/companies", "/quotes", "/dashboard", "/emails", "/ai", "/catalog-builder", "/exports")


async def _bump_catalog_version_after_write(request: Request):
    """
    After a successful admin write to catalog data, bump the catalog version
    so the public response cache, search index and option map refresh.
    """
    yield
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    path = request.url.path
    section = path.split("/admin", 1)[-1]
    if not section.startswith(_NON_CATALOG_SECTIONS):
        await bump_catalog_version()


router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[Depends(_bump_catalog_version_after_write)],
)

# Include admin route modules
router.include_router(products.router, prefix="/products", tags=["Admin - Products"])
router.include_router(companies.router, prefix="/companies", tags=["Admin - Companies"])
router.include_router(quotes.router, prefix="/quotes", tags=["Admin - Quotes"])
router.include_router(upholsteries.router, prefix="/upholsteries", tags=["Admin - Upholsteries"])
router.include_router(subcategories.router, prefix="/subcategories", tags=["Admin - Subcategories"])
router.include_router(families.router, prefix="/families", tags=["Admin - Families"])
router.include_router(finishes.router, prefix="/finishes", tags=["Admin - Finishes"])
router.include_router(colors.router, prefix="/colors", tags=["Admin - Colors"])
router.include_router(dashboard.router, prefix="/dashboard", tags=["Admin - Dashboard"])
router.include_router(catalog.router, prefix="/catalog", tags=["Admin - Catalog"])
router.include_router(categories.router, prefix="/categories", tags=["Admin - Categories"])
router.include_router(pricing_tiers.router, prefix="/pricing-tiers", tags=["Admin - Pricing Tiers"])
router.include_router(upload.router, prefix="/upload", tags=["Admin - Upload"])
router.include_router(catalog_builder.router, prefix="/catalog-builder", tags=["Admin - Catalog Builder"])
router.include_router(exports.router, prefix="/exports", tags=["Admin - Exports"])
router.include_router(register.router, prefix="/register", tags=["Admin - Product Register"])
router.include_router(emails.router, prefix="/emails", tags=["Admin - Email Templates"])
router.include_router(inquiries.router, prefix="/inquiries", tags=["Admin - Inquiries"])
router.include_router(ai_chat.router, prefix="/ai", tags=["Admin - AI Chat"])
