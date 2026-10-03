"""
Analytics Routes - API v1

Public, unauthenticated ingest for anonymous site analytics events. The
browser batches events and sends them with navigator.sendBeacon, so this
always answers 204 and never reports validation detail back.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.base import get_db
from backend.services.site_analytics_service import SiteAnalyticsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["Analytics"])

MAX_EVENTS_PER_BATCH = 25


class AnalyticsEventIn(BaseModel):
    type: str = Field(..., max_length=32)
    visitor_id: str = Field(..., max_length=64)
    session_id: str = Field(..., max_length=64)
    path: Optional[str] = Field(None, max_length=2048)
    referrer: Optional[str] = Field(None, max_length=2048)
    product_id: Optional[int] = None
    resource_type: Optional[str] = Field(None, max_length=64)
    resource_url: Optional[str] = Field(None, max_length=2048)
    label: Optional[str] = Field(None, max_length=512)


class AnalyticsBatchIn(BaseModel):
    events: List[AnalyticsEventIn] = Field(..., max_length=MAX_EVENTS_PER_BATCH)


@router.post(
    "/events",
    status_code=204,
    summary="Record site analytics events",
    description="Anonymous page view / product view / download / search events from the public site",
)
async def record_events(
    batch: AnalyticsBatchIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    # Staff browsing the site shouldn't inflate the numbers
    if request.cookies.get("session_token") and request.cookies.get("admin_token"):
        return Response(status_code=204)

    try:
        await SiteAnalyticsService.record_events(
            db,
            [event.model_dump() for event in batch.events],
            user_agent=request.headers.get("user-agent"),
            request_host=request.headers.get("host"),
        )
    except Exception as exc:  # analytics must never break the site
        logger.warning(f"Failed to record analytics events: {exc}")
        await db.rollback()
    return Response(status_code=204)
