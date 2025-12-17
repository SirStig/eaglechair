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
    dashboard,
    products,
    quotes,
    seo,
)
from backend.api.v1.routes.admin.router import router as admin_router

router = APIRouter()

# Include authentication routes
router.include_router(auth.router)

# Include product catalog routes
router.include_router(products.router)

# Include dashboard routes at /dashboard (frontend expects /api/v1/dashboard/*)
router.include_router(dashboard.router, prefix="/dashboard")

# Include quote and cart routes with /quotes prefix
router.include_router(quotes.router, prefix="/quotes")

# Include content routes (FAQ, team, contact, catalogs, feedback)
router.include_router(content.router, prefix="/content")

# Include CMS content routes (hero slides, features, values, milestones, etc.)
router.include_router(cms_content.router, prefix="/content")

# Include CMS admin routes (admin-only content management with static export)
router.include_router(cms_admin.router)

# Include SEO routes (sitemap, meta tags)
router.include_router(seo.router)

# Include admin routes
router.include_router(admin_router)

