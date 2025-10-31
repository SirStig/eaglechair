"""
Admin Router

Aggregates all admin route modules
"""

from fastapi import APIRouter

from backend.api.v1.routes.admin import (
    catalog,
    categories,
    colors,
    companies,
    dashboard,
    families,
    finishes,
    products,
    quotes,
    subcategories,
    upholsteries,
    upload,
    virtual_catalog,
)

router = APIRouter(prefix="/admin", tags=["Admin"])

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
router.include_router(upload.router, prefix="/upload", tags=["Admin - Upload"])
router.include_router(virtual_catalog.router, prefix="/virtual-catalog", tags=["Admin - Virtual Catalog"])
