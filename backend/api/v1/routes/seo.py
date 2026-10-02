"""
SEO Routes

XML sitemap of every public page, with product images (Google image sitemap
extension). URLs come from the same helpers as the prerendered page shells
(services/seo_prerender.py), so the sitemap, canonicals and in-app links
always agree. The prerender job also writes the same XML to the site's own
/sitemap.xml, which robots.txt points to.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.base import get_db
from backend.services.seo_prerender import load_snapshot, render_sitemap

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/seo", tags=["SEO"])


@router.get("/sitemap.xml", response_class=Response)
async def get_sitemap(db: AsyncSession = Depends(get_db)):
    """Sitemap of the home page, static pages, categories, families and products."""
    try:
        xml = render_sitemap(await load_snapshot(db))
    except Exception as e:
        logger.error(f"Error generating sitemap: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error generating sitemap")
    return Response(
        content=xml,
        media_type="application/xml",
        headers={"Cache-Control": "public, max-age=3600"},
    )
