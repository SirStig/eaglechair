"""
API v1 Main Router

Aggregates all v1 route modules
"""

from fastapi import APIRouter

from backend.api.v1.routes import (
    auth,
    cms_admin,
    cms_content,
    content,
    products,
    quotes,
    upload,
)
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

# Include CMS content routes (hero slides, features, values, milestones, etc.)
router.include_router(cms_content.router)

# Include CMS admin routes (admin-only content management with static export)
router.include_router(cms_admin.router)

# Include upload routes
router.include_router(upload.router)

# Include admin routes
router.include_router(admin_router)

