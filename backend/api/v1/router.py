"""
API v1 Main Router

Aggregates all v1 route modules
"""

from fastapi import APIRouter

from backend.api.v1.routes import auth, products, quotes, content
from backend.api.v1.routes.admin.router import router as admin_router


router = APIRouter()

# Include authentication routes
router.include_router(auth.router)

# Include product catalog routes
router.include_router(products.router)

# Include quote and cart routes
router.include_router(quotes.router)

# Include content routes (FAQ, team, contact, catalogs, feedback)
router.include_router(content.router)

# Include admin routes
router.include_router(admin_router)

