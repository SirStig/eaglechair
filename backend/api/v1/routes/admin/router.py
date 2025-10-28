"""
Admin Router

Aggregates all admin route modules
"""

from fastapi import APIRouter

from backend.api.v1.routes.admin import (
    catalog,
    categories,
    companies,
    dashboard,
    products,
    quotes,
)

router = APIRouter(prefix="/admin", tags=["Admin"])

# Include admin route modules
router.include_router(products.router, prefix="/products", tags=["Admin - Products"])
router.include_router(companies.router, prefix="/companies", tags=["Admin - Companies"])
router.include_router(quotes.router, prefix="/quotes", tags=["Admin - Quotes"])
router.include_router(dashboard.router, prefix="/dashboard", tags=["Admin - Dashboard"])
router.include_router(catalog.router, prefix="/catalog", tags=["Admin - Catalog"])
router.include_router(categories.router, prefix="/categories", tags=["Admin - Categories"])
