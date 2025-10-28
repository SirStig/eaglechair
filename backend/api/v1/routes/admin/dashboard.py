"""
Admin Dashboard Routes

Admin-only endpoints for dashboard and analytics
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_admin
from backend.api.v1.schemas.admin import DashboardStatsResponse
from backend.core.exceptions import EagleChairException
from backend.database.base import get_db
from backend.models.company import AdminUser
from backend.services.admin_service import AdminService

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
        stats = await AdminService.get_dashboard_stats(db=db)
        return stats

    except EagleChairException as exc:
        logger.error(f"Dashboard stats error ({exc.error_code}): {exc.message}")
        raise exc
    except Exception as e:
        logger.error(f"Error fetching dashboard stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch dashboard statistics") from e
