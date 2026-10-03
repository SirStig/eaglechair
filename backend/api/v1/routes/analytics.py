"""
Analytics Routes - API v1

Public, unauthenticated ingest for anonymous site analytics events. The
browser batches events and sends them with fetch keepalive, so this
always answers 204 and never reports validation detail back.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.base import get_db
from backend.services.site_analytics_service import (
    SiteAnalyticsService,
    client_ip,
    resolve_location,
)

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
    # Floats accepted so one odd number can't fail the whole batch; the
    # service range-checks and truncates
    value: Optional[float] = None
    depth: Optional[float] = None
    utm_source: Optional[str] = Field(None, max_length=255)
    utm_medium: Optional[str] = Field(None, max_length=255)
    utm_campaign: Optional[str] = Field(None, max_length=255)


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
    # Staff browsing the site is stored but flagged, so reports leave it out
    # by default and can still show it on request
    is_staff = bool(request.cookies.get("session_token") and request.cookies.get("admin_token"))
    peer = request.client.host if request.client else None
    country, region = resolve_location(request.headers, client_ip(request.headers, peer))

    try:
        await SiteAnalyticsService.record_events(
            db,
            [event.model_dump() for event in batch.events],
            user_agent=request.headers.get("user-agent"),
            request_host=request.headers.get("host"),
            is_staff=is_staff,
            country=country,
            region=region,
        )
    except Exception as exc:  # analytics must never break the site
        logger.warning(f"Failed to record analytics events: {exc}")
        await db.rollback()
    return Response(status_code=204)
