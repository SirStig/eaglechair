"""
Admin Dashboard Routes

Admin-only endpoints for dashboard and analytics
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_admin
from backend.core.exceptions import EagleChairException
from backend.database.base import get_db
from backend.models.company import AdminUser
from backend.services.analytics_service import AnalyticsService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin - Dashboard"])


@router.get(
    "/stats",
    summary="Get dashboard statistics (Admin)",
    description="Retrieve dashboard statistics and recent activity"
)
async def get_dashboard_stats(
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Get dashboard statistics including counts and recent activity.
    
    **Admin only** - Requires admin authentication.
    """
    logger.info(f"Admin {admin.username} fetching dashboard statistics")
    
    try:
        stats = await AnalyticsService.get_dashboard_stats(db=db)
        return JSONResponse(content=stats)

    except EagleChairException as exc:
        logger.error(f"Dashboard stats error ({exc.error_code}): {exc.message}")
        raise exc
    except Exception as e:
        logger.error(f"Error fetching dashboard stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch dashboard statistics") from e


@router.get(
    "/analytics/popular-products",
    summary="Get popular products (Admin)",
    description="Retrieve most popular products based on quote requests"
)
async def get_popular_products(
    limit: int = Query(10, ge=1, le=50),
    days: int = Query(None, ge=1, le=365),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get most popular products by quote count"""
    try:
        products = await AnalyticsService.get_popular_products(db=db, limit=limit, days=days)
        return {"items": products}
    except Exception as e:
        logger.error(f"Error fetching popular products: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch popular products") from e


@router.get(
    "/analytics/category-stats",
    summary="Get category statistics (Admin)",
    description="Retrieve statistics by product category"
)
async def get_category_stats(
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get product statistics by category"""
    try:
        stats = await AnalyticsService.get_category_stats(db=db)
        return {"items": stats}
    except Exception as e:
        logger.error(f"Error fetching category stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch category stats") from e


@router.get(
    "/analytics/quote-trends",
    summary="Get quote trends (Admin)",
    description="Retrieve quote trends over time"
)
async def get_quote_trends(
    days: int = Query(30, ge=7, le=365),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get quote trends over specified time period"""
    try:
        trends = await AnalyticsService.get_quote_trends(db=db, days=days)
        return trends
    except Exception as e:
        logger.error(f"Error fetching quote trends: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch quote trends") from e


@router.get(
    "/analytics/conversion-rates",
    summary="Get conversion rates (Admin)",
    description="Calculate various conversion rates"
)
async def get_conversion_rates(
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get quote conversion rates"""
    try:
        rates = await AnalyticsService.get_conversion_rates(db=db)
        return rates
    except Exception as e:
        logger.error(f"Error fetching conversion rates: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch conversion rates") from e


@router.get(
    "/analytics/top-customers",
    summary="Get top customers (Admin)",
    description="Retrieve top customers by various metrics"
)
async def get_top_customers(
    limit: int = Query(10, ge=1, le=50),
    by: str = Query("quote_count", regex="^(quote_count|total_value|accepted_quotes)$"),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get top customers by specified metric"""
    try:
        customers = await AnalyticsService.get_top_customers(db=db, limit=limit, by=by)
        return {"items": customers}
    except Exception as e:
        logger.error(f"Error fetching top customers: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch top customers") from e


@router.get(
    "/analytics/average-values",
    summary="Get average quote values (Admin)",
    description="Calculate average quote values"
)
async def get_average_values(
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get average quote values"""
    try:
        averages = await AnalyticsService.get_average_quote_value(db=db)
        return averages
    except Exception as e:
        logger.error(f"Error fetching average values: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch average values") from e
