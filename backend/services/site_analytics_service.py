"""
Site Analytics Service

Records anonymous engagement events from the public site (page views, product
views, downloads, searches) and aggregates them for the admin Analytics page.
"""

import logging
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from sqlalchemy import case, distinct, func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import settings
from backend.models.analytics import AnalyticsEvent, AnalyticsEventType
from backend.models.chair import Chair
from backend.models.quote import Quote

logger = logging.getLogger(__name__)

# Crawlers, link unfurlers and headless browsers would otherwise dominate the
# numbers on a low-traffic B2B site
_BOT_UA = re.compile(
    r"bot|crawl|spider|slurp|scrape|headless|lighthouse|pagespeed|preview|"
    r"facebookexternalhit|embedly|python-requests|curl|wget|httpclient|phantom|playwright|puppeteer",
    re.IGNORECASE,
)
_TABLET_UA = re.compile(r"ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))", re.IGNORECASE)
_MOBILE_UA = re.compile(r"mobi|iphone|ipod|android|blackberry|opera mini|iemobile", re.IGNORECASE)
_ID_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")

ACTIVE_WINDOW_MINUTES = 5


def _clip(value: Optional[str], length: int) -> Optional[str]:
    if value is None:
        return None
    value = str(value).strip()
    return value[:length] or None


def is_bot(user_agent: Optional[str]) -> bool:
    return not user_agent or bool(_BOT_UA.search(user_agent))


def device_from_user_agent(user_agent: Optional[str]) -> str:
    ua = user_agent or ""
    if _TABLET_UA.search(ua):
        return "tablet"
    if _MOBILE_UA.search(ua):
        return "mobile"
    return "desktop"


def _own_hosts() -> set[str]:
    hosts = set()
    for url in (settings.SITE_URL, settings.FRONTEND_URL):
        host = (urlparse(url or "").hostname or "").lower()
        if host:
            hosts.add(host)
            hosts.add(host.removeprefix("www."))
    return hosts


def referrer_host(referrer: Optional[str], request_host: Optional[str] = None) -> Optional[str]:
    """External referrer hostname, or None for direct / internal navigation."""
    if not referrer:
        return None
    host = (urlparse(referrer).hostname or "").lower()
    if not host:
        return None
    own = _own_hosts()
    if request_host:
        own.add(request_host.split(":")[0].lower())
    if host in own or host.removeprefix("www.") in own:
        return None
    return host.removeprefix("www.")[:255]


def normalize_path(path: Optional[str]) -> Optional[str]:
    """Strip query string / fragment so ?page=2 doesn't split a page's views."""
    if not path:
        return None
    path = path.split("?", 1)[0].split("#", 1)[0]
    if len(path) > 1:
        path = path.rstrip("/")
    return path[:512] or "/"


def _count_of(event_type: str):
    return func.sum(case((AnalyticsEvent.event_type == event_type, 1), else_=0))


class SiteAnalyticsService:
    """Ingest and reporting for anonymous site analytics."""

    # ------------------------------------------------------------------
    # Ingest
    # ------------------------------------------------------------------

    @staticmethod
    async def record_events(
        db: AsyncSession,
        events: List[Dict[str, Any]],
        *,
        user_agent: Optional[str],
        request_host: Optional[str] = None,
    ) -> int:
        """Validate and store a batch of events. Returns how many were stored."""
        if is_bot(user_agent):
            return 0

        device = device_from_user_agent(user_agent)
        now = datetime.utcnow()
        rows = []
        for event in events:
            event_type = event.get("type")
            visitor_id = event.get("visitor_id") or ""
            session_id = event.get("session_id") or ""
            if event_type not in AnalyticsEventType.ALL:
                continue
            if not _ID_RE.match(visitor_id) or not _ID_RE.match(session_id):
                continue

            path = normalize_path(event.get("path"))
            if path and path.startswith("/admin"):
                continue

            product_id = event.get("product_id")
            if not isinstance(product_id, int) or isinstance(product_id, bool) or product_id <= 0:
                product_id = None
            if event_type == AnalyticsEventType.PRODUCT_VIEW and product_id is None:
                continue

            label = _clip(event.get("label"), 255)
            if event_type == AnalyticsEventType.SEARCH:
                if not label:
                    continue
                label = label.lower()

            resource_url = _clip(event.get("resource_url"), 512)
            if event_type == AnalyticsEventType.DOWNLOAD and not (resource_url or label):
                continue

            rows.append({
                "event_type": event_type,
                "visitor_id": visitor_id,
                "session_id": session_id,
                "path": path,
                "referrer": referrer_host(event.get("referrer"), request_host),
                "device": device,
                "product_id": product_id,
                "resource_type": _clip(event.get("resource_type"), 32),
                "resource_url": resource_url,
                "label": label,
                "created_at": now,
                "updated_at": now,
            })

        if not rows:
            return 0
        await db.execute(insert(AnalyticsEvent), rows)
        await db.commit()
        return len(rows)

    # ------------------------------------------------------------------
    # Reporting
    # ------------------------------------------------------------------

    @staticmethod
    async def _period_totals(db: AsyncSession, start: datetime, end: datetime) -> Dict[str, Any]:
        E = AnalyticsEvent
        in_range = (E.created_at >= start, E.created_at < end)

        row = (await db.execute(
            select(
                _count_of(AnalyticsEventType.PAGE_VIEW).label("page_views"),
                _count_of(AnalyticsEventType.PRODUCT_VIEW).label("product_views"),
                _count_of(AnalyticsEventType.DOWNLOAD).label("downloads"),
                _count_of(AnalyticsEventType.SEARCH).label("searches"),
                func.count(distinct(E.visitor_id)).label("visitors"),
                func.count(distinct(E.session_id)).label("sessions"),
            ).where(*in_range)
        )).one()

        # Bounce = session with exactly one page view and nothing else
        per_session = (
            select(E.session_id, func.count().label("n"))
            .where(*in_range)
            .group_by(E.session_id)
            .subquery()
        )
        bounced = (await db.execute(
            select(func.count()).select_from(per_session).where(per_session.c.n == 1)
        )).scalar() or 0

        # Quotes are the conversion signal for this traffic (accounts are off)
        quote_requests = (await db.execute(
            select(func.count(Quote.id)).where(Quote.created_at >= start, Quote.created_at < end)
        )).scalar() or 0

        sessions = int(row.sessions or 0)
        page_views = int(row.page_views or 0)
        return {
            "page_views": page_views,
            "product_views": int(row.product_views or 0),
            "downloads": int(row.downloads or 0),
            "searches": int(row.searches or 0),
            "visitors": int(row.visitors or 0),
            "sessions": sessions,
            "pages_per_session": round(page_views / sessions, 2) if sessions else 0,
            "bounce_rate": round(bounced / sessions * 100, 1) if sessions else 0,
            "quote_requests": int(quote_requests),
        }

    @staticmethod
    async def get_overview(db: AsyncSession, days: int = 30, limit: int = 10) -> Dict[str, Any]:
        """Everything the admin Analytics page needs for one date range."""
        E = AnalyticsEvent
        now = datetime.utcnow()
        start = now - timedelta(days=days)
        prev_start = start - timedelta(days=days)
        in_range = (E.created_at >= start, E.created_at < now)

        current = await SiteAnalyticsService._period_totals(db, start, now)
        previous = await SiteAnalyticsService._period_totals(db, prev_start, start)

        active_now = (await db.execute(
            select(func.count(distinct(E.visitor_id)))
            .where(E.created_at >= now - timedelta(minutes=ACTIVE_WINDOW_MINUTES))
        )).scalar() or 0

        # Daily series (UTC days), zero-filled so charts have no gaps
        day = func.date(E.created_at)
        series_rows = (await db.execute(
            select(
                day.label("day"),
                _count_of(AnalyticsEventType.PAGE_VIEW).label("page_views"),
                _count_of(AnalyticsEventType.PRODUCT_VIEW).label("product_views"),
                _count_of(AnalyticsEventType.DOWNLOAD).label("downloads"),
                func.count(distinct(E.visitor_id)).label("visitors"),
            )
            .where(*in_range)
            .group_by(day)
        )).all()
        by_day = {str(r.day)[:10]: r for r in series_rows}
        timeseries = []
        for offset in range(days, -1, -1):
            key = (now - timedelta(days=offset)).strftime("%Y-%m-%d")
            r = by_day.get(key)
            timeseries.append({
                "date": key,
                "page_views": int(r.page_views or 0) if r else 0,
                "product_views": int(r.product_views or 0) if r else 0,
                "downloads": int(r.downloads or 0) if r else 0,
                "visitors": int(r.visitors or 0) if r else 0,
            })

        top_pages = [
            {"path": r.path, "views": int(r.views), "visitors": int(r.visitors)}
            for r in (await db.execute(
                select(E.path, func.count().label("views"), func.count(distinct(E.visitor_id)).label("visitors"))
                .where(*in_range, E.event_type == AnalyticsEventType.PAGE_VIEW, E.path.isnot(None))
                .group_by(E.path)
                .order_by(func.count().desc())
                .limit(limit)
            )).all()
        ]

        product_views = _count_of(AnalyticsEventType.PRODUCT_VIEW)
        product_rows = (await db.execute(
            select(
                E.product_id,
                product_views.label("views"),
                func.count(distinct(case(
                    (E.event_type == AnalyticsEventType.PRODUCT_VIEW, E.visitor_id)
                ))).label("visitors"),
                _count_of(AnalyticsEventType.DOWNLOAD).label("downloads"),
            )
            .where(*in_range, E.product_id.isnot(None))
            .group_by(E.product_id)
            .order_by(product_views.desc())
            .limit(limit)
        )).all()
        product_ids = [r.product_id for r in product_rows]
        products = {}
        if product_ids:
            products = {
                p.id: p for p in (await db.execute(
                    select(Chair.id, Chair.name, Chair.model_number, Chair.slug, Chair.primary_image_url)
                    .where(Chair.id.in_(product_ids))
                )).all()
            }
        top_products = []
        for r in product_rows:
            p = products.get(r.product_id)
            top_products.append({
                "product_id": r.product_id,
                "name": p.name if p else f"Deleted product #{r.product_id}",
                "model_number": p.model_number if p else None,
                "slug": p.slug if p else None,
                "image_url": p.primary_image_url if p else None,
                "views": int(r.views or 0),
                "visitors": int(r.visitors or 0),
                "downloads": int(r.downloads or 0),
            })

        top_downloads = [
            {
                "label": r.label,
                "resource_type": r.resource_type,
                "resource_url": r.resource_url,
                "downloads": int(r.downloads),
                "visitors": int(r.visitors),
            }
            for r in (await db.execute(
                select(
                    E.resource_url,
                    func.max(E.label).label("label"),
                    func.max(E.resource_type).label("resource_type"),
                    func.count().label("downloads"),
                    func.count(distinct(E.visitor_id)).label("visitors"),
                )
                .where(*in_range, E.event_type == AnalyticsEventType.DOWNLOAD)
                .group_by(E.resource_url)
                .order_by(func.count().desc())
                .limit(limit)
            )).all()
        ]

        downloads_by_type = [
            {"type": r.resource_type or "other", "downloads": int(r.downloads)}
            for r in (await db.execute(
                select(E.resource_type, func.count().label("downloads"))
                .where(*in_range, E.event_type == AnalyticsEventType.DOWNLOAD)
                .group_by(E.resource_type)
                .order_by(func.count().desc())
            )).all()
        ]

        # The tracker only sends a referrer on a session's landing page view,
        # so attribute each session to its (single) non-null referrer
        session_refs = (
            select(E.session_id, func.max(E.referrer).label("referrer"))
            .where(*in_range, E.event_type == AnalyticsEventType.PAGE_VIEW)
            .group_by(E.session_id)
            .subquery()
        )
        referrers = [
            {"source": r.referrer or "Direct / none", "sessions": int(r.sessions)}
            for r in (await db.execute(
                select(session_refs.c.referrer, func.count().label("sessions"))
                .group_by(session_refs.c.referrer)
                .order_by(func.count().desc())
                .limit(limit)
            )).all()
        ]

        devices = [
            {"device": r.device or "unknown", "visitors": int(r.visitors)}
            for r in (await db.execute(
                select(E.device, func.count(distinct(E.visitor_id)).label("visitors"))
                .where(*in_range)
                .group_by(E.device)
                .order_by(func.count(distinct(E.visitor_id)).desc())
            )).all()
        ]

        top_searches = [
            {"query": r.label, "searches": int(r.searches)}
            for r in (await db.execute(
                select(E.label, func.count().label("searches"))
                .where(*in_range, E.event_type == AnalyticsEventType.SEARCH)
                .group_by(E.label)
                .order_by(func.count().desc())
                .limit(limit)
            )).all()
        ]

        return {
            "days": days,
            "generated_at": now.isoformat() + "Z",
            "active_now": int(active_now),
            "totals": current,
            "previous": previous,
            "timeseries": timeseries,
            "top_pages": top_pages,
            "top_products": top_products,
            "top_downloads": top_downloads,
            "downloads_by_type": downloads_by_type,
            "referrers": referrers,
            "devices": devices,
            "top_searches": top_searches,
        }
