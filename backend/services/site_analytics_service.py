"""
Site Analytics Service

Records anonymous engagement events from the public site (page views, product
views, downloads, searches, quote-cart and form activity, materials and
catalog interest, time on page) and aggregates them for the admin Analytics
page, the per-product panel and the weekly digest.
"""

import ipaddress
import logging
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Mapping, Optional, Tuple
from urllib.parse import urlparse

from sqlalchemy import and_, case, distinct, func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import settings
from backend.models.analytics import AnalyticsEvent
from backend.models.analytics import AnalyticsEventType as T
from backend.models.chair import Chair
from backend.models.quote import Quote, QuoteItem
from backend.services.analytics_pages import describe_pages, is_public_page

logger = logging.getLogger(__name__)

# Crawlers, link unfurlers, headless browsers and vulnerability scanners would
# otherwise dominate the numbers on a low-traffic B2B site
_BOT_UA = re.compile(
    r"bot|crawl|spider|slurp|scrape|headless|lighthouse|pagespeed|preview|"
    r"facebookexternalhit|embedly|python-requests|curl|wget|httpclient|phantom|playwright|puppeteer|"
    r"scanner|nikto|sqlmap|nmap|masscan|zgrab|nuclei|go-http-client|okhttp|libwww|java/",
    re.IGNORECASE,
)
_TABLET_UA = re.compile(r"ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))", re.IGNORECASE)
_MOBILE_UA = re.compile(r"mobi|iphone|ipod|android|blackberry|opera mini|iemobile", re.IGNORECASE)
_ID_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")
_COUNTRY_RE = re.compile(r"^[A-Z]{2}$")

ACTIVE_WINDOW_MINUTES = 5
MAX_ENGAGED_SECONDS = 30 * 60

_REQUIRES_PRODUCT = {T.PRODUCT_VIEW, T.CART_ADD, T.CART_REMOVE, T.PRODUCT_INTERACTION}
_REQUIRES_LABEL = {T.SEARCH, T.MATERIAL_VIEW, T.PRODUCT_INTERACTION, T.CATALOG_READ, T.FILTER, T.REP_SEARCH}

# Product interest score weights: a quote line says far more than a view
INTEREST_WEIGHTS = {"views": 1, "downloads": 3, "cart_adds": 5, "quotes": 10}

_EMPTY_PRODUCT_STATS = {"views": 0, "visitors": 0, "downloads": 0, "cart_adds": 0, "interactions": 0, "quotes": 0}


def _clip(value: Optional[str], length: int) -> Optional[str]:
    if value is None:
        return None
    value = str(value).strip()
    return value[:length] or None


def _int(value: Any, low: int, high: int) -> Optional[int]:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    value = int(value)
    return value if low <= value <= high else None


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
        url = url or ""
        # FRONTEND_URL may be a bare host ("joshua.eaglechair.com")
        host = (urlparse(url if "//" in url else f"//{url}").hostname or "").lower()
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


# ----------------------------------------------------------------------
# Location (country / region only; the IP is never stored)
# ----------------------------------------------------------------------

_COUNTRY_HEADERS = ("cf-ipcountry", "cloudfront-viewer-country", "x-country-code", "x-geo-country")
_geo_reader = None
_geo_loaded = False


def _geoip_reader():
    global _geo_reader, _geo_loaded
    if not _geo_loaded:
        _geo_loaded = True
        if settings.GEOIP_DB_PATH:
            try:
                import geoip2.database

                _geo_reader = geoip2.database.Reader(settings.GEOIP_DB_PATH)
            except Exception as exc:
                logger.warning(f"GeoIP database unavailable ({exc}); locations come from CDN headers only")
    return _geo_reader


def client_ip(headers: Mapping[str, str], peer: Optional[str]) -> Optional[str]:
    forwarded = headers.get("x-forwarded-for")
    candidate = forwarded.split(",")[0].strip() if forwarded else headers.get("x-real-ip") or peer
    try:
        return str(ipaddress.ip_address(candidate)) if candidate else None
    except ValueError:
        return None


def resolve_location(headers: Mapping[str, str], ip: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    """(ISO country code, region name) from a CDN header or the GeoIP database."""
    for name in _COUNTRY_HEADERS:
        code = (headers.get(name) or "").strip().upper()
        if _COUNTRY_RE.match(code) and code not in ("XX", "T1"):
            return code, _clip(headers.get("cf-region") or headers.get("x-geo-region"), 64)
    reader = _geoip_reader()
    if not reader or not ip:
        return None, None
    try:
        parsed = ipaddress.ip_address(ip)
        if parsed.is_private or parsed.is_loopback:
            return None, None
        try:
            hit = reader.city(ip)
            region = hit.subdivisions.most_specific.name if hit.subdivisions else None
        except Exception:
            hit = reader.country(ip)
            region = None
        code = hit.country.iso_code
        return (code if code and _COUNTRY_RE.match(code) else None), _clip(region, 64)
    except Exception:
        return None, None


# ----------------------------------------------------------------------
# Query helpers
# ----------------------------------------------------------------------

def _count_of(event_type: str):
    return func.sum(case((AnalyticsEvent.event_type == event_type, 1), else_=0))


def _sessions_where(*conditions):
    return func.count(distinct(case((and_(*conditions), AnalyticsEvent.session_id))))


def _visitors_of(event_type: str):
    return func.count(distinct(case((AnalyticsEvent.event_type == event_type, AnalyticsEvent.visitor_id))))


def _scope(start: datetime, end: datetime, include_staff: bool) -> tuple:
    E = AnalyticsEvent
    conditions = (E.created_at >= start, E.created_at < end)
    if not include_staff:
        conditions += (E.is_staff.is_(False),)
    return conditions


def _page_visits(scope: tuple, paths: Optional[List[str]] = None):
    """
    One row per (session, page): engaged seconds summed and deepest scroll.
    The tracker may report one visit in several pieces (tab hidden and
    shown again), so averages are taken over visits, not raw pings.
    """
    E = AnalyticsEvent
    where = [*scope, E.event_type == T.ENGAGEMENT]
    if paths is not None:
        where.append(E.path.in_(paths))
    return (
        select(E.session_id, E.path, func.sum(E.value).label("seconds"), func.max(E.depth).label("depth"))
        .where(*where)
        .group_by(E.session_id, E.path)
        .subquery()
    )


def _round(value, digits=1) -> float:
    return round(float(value), digits) if value is not None else 0


def _zero_filled(days: int, now: datetime, by_day: Dict[str, Any], fields: Tuple[str, ...]) -> List[Dict[str, Any]]:
    series = []
    for offset in range(days, -1, -1):
        key = (now - timedelta(days=offset)).strftime("%Y-%m-%d")
        r = by_day.get(key)
        series.append({"date": key, **{f: int(getattr(r, f) or 0) if r else 0 for f in fields}})
    return series


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
        is_staff: bool = False,
        country: Optional[str] = None,
        region: Optional[str] = None,
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
            if event_type not in T.ALL:
                continue
            if not _ID_RE.match(visitor_id) or not _ID_RE.match(session_id):
                continue

            # Only real public pages: scanner probes (/wp-login.php, /.env),
            # 404s and admin pages are never recorded
            path = normalize_path(event.get("path"))
            if not is_public_page(path):
                continue

            product_id = _int(event.get("product_id"), 1, 2**31 - 1)
            if event_type in _REQUIRES_PRODUCT and product_id is None:
                continue

            label = _clip(event.get("label"), 255)
            if event_type in _REQUIRES_LABEL and not label:
                continue
            if event_type == T.SEARCH:
                label = label.lower()

            value = _int(event.get("value"), 0, 1_000_000)
            depth = None
            if event_type in (T.ENGAGEMENT, T.CATALOG_READ):
                value = _int(event.get("value"), 1, MAX_ENGAGED_SECONDS)
                if value is None:
                    continue
                if event_type == T.ENGAGEMENT:
                    depth = _int(event.get("depth"), 0, 100)

            resource_url = _clip(event.get("resource_url"), 512)
            if event_type == T.DOWNLOAD and not (resource_url or label):
                continue

            # Campaign tags belong to the session's landing page view only
            is_page_view = event_type == T.PAGE_VIEW
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
                "value": value,
                "depth": depth,
                "country": country,
                "region": region,
                "utm_source": _clip(event.get("utm_source"), 100) if is_page_view else None,
                "utm_medium": _clip(event.get("utm_medium"), 100) if is_page_view else None,
                "utm_campaign": _clip(event.get("utm_campaign"), 150) if is_page_view else None,
                "is_staff": is_staff,
                "created_at": now,
                "updated_at": now,
            })

        if not rows:
            return 0
        await db.execute(insert(AnalyticsEvent), rows)
        await db.commit()
        return len(rows)

    # ------------------------------------------------------------------
    # Reporting helpers
    # ------------------------------------------------------------------

    @staticmethod
    async def _period_totals(db: AsyncSession, scope: tuple, start: datetime, end: datetime) -> Dict[str, Any]:
        E = AnalyticsEvent
        row = (await db.execute(
            select(
                _count_of(T.PAGE_VIEW).label("page_views"),
                _count_of(T.PRODUCT_VIEW).label("product_views"),
                _count_of(T.DOWNLOAD).label("downloads"),
                _count_of(T.SEARCH).label("searches"),
                _count_of(T.CART_ADD).label("cart_adds"),
                _count_of(T.QUOTE_START).label("quote_starts"),
                _count_of(T.QUOTE_SUBMIT).label("quote_submits"),
                _count_of(T.CONTACT_SUBMIT).label("contact_submits"),
                _count_of(T.REP_SEARCH).label("rep_searches"),
                func.sum(case((and_(E.event_type == T.SEARCH, E.value == 0), 1), else_=0)).label("zero_result_searches"),
                func.count(distinct(E.visitor_id)).label("visitors"),
                func.count(distinct(E.session_id)).label("sessions"),
            ).where(*scope)
        )).one()

        visits = _page_visits(scope)
        engagement = (await db.execute(select(func.avg(visits.c.seconds), func.avg(visits.c.depth)))).one()

        # Bounce = session with a single interaction (time-on-page pings don't count)
        per_session = (
            select(E.session_id, func.count().label("n"))
            .where(*scope, E.event_type != T.ENGAGEMENT)
            .group_by(E.session_id)
            .subquery()
        )
        bounced = (await db.execute(
            select(func.count()).select_from(per_session).where(per_session.c.n == 1)
        )).scalar() or 0

        # Quotes are the conversion for this traffic (accounts are off)
        quote_requests = (await db.execute(
            select(func.count(Quote.id)).where(Quote.created_at >= start, Quote.created_at < end)
        )).scalar() or 0

        sessions = int(row.sessions or 0)
        page_views = int(row.page_views or 0)
        totals = {
            key: int(getattr(row, key) or 0)
            for key in (
                "product_views", "downloads", "searches", "zero_result_searches", "cart_adds",
                "quote_starts", "quote_submits", "contact_submits", "rep_searches", "visitors",
            )
        }
        return {
            **totals,
            "page_views": page_views,
            "sessions": sessions,
            "pages_per_session": round(page_views / sessions, 2) if sessions else 0,
            "bounce_rate": round(bounced / sessions * 100, 1) if sessions else 0,
            "avg_engaged_seconds": _round(engagement[0], 0),
            "avg_scroll_depth": _round(engagement[1], 0),
            "quote_requests": int(quote_requests),
        }

    @staticmethod
    async def _funnel(db: AsyncSession, scope: tuple) -> List[Dict[str, Any]]:
        """Sessions reaching each step on the way to a quote request."""
        E = AnalyticsEvent
        row = (await db.execute(
            select(
                func.count(distinct(E.session_id)).label("visited"),
                _sessions_where(E.event_type == T.PRODUCT_VIEW).label("viewed_product"),
                _sessions_where(E.event_type == T.CART_ADD).label("added_to_quote"),
                _sessions_where(E.event_type == T.PAGE_VIEW, E.path == "/quote-request").label("opened_form"),
                _sessions_where(E.event_type == T.QUOTE_START).label("started_form"),
                _sessions_where(E.event_type == T.QUOTE_SUBMIT).label("submitted"),
            ).where(*scope)
        )).one()
        steps = [
            ("visited", "Visited the site"),
            ("viewed_product", "Viewed a product"),
            ("added_to_quote", "Added to quote cart"),
            ("opened_form", "Opened the quote form"),
            ("started_form", "Started filling it in"),
            ("submitted", "Submitted a quote request"),
        ]
        return [{"key": key, "label": label, "sessions": int(getattr(row, key) or 0)} for key, label in steps]

    @staticmethod
    async def _named_pages(db: AsyncSession, rows: List[Dict[str, Any]], limit: int) -> List[Dict[str, Any]]:
        """Attach page titles and drop paths that don't resolve to a real page."""
        names = await describe_pages(db, [r["path"] for r in rows])
        named = []
        for r in rows:
            info = names.get(r["path"])
            if not info or not info["exists"]:
                continue
            named.append({**r, "title": info["title"], "kind": info["kind"]})
            if len(named) >= limit:
                break
        return named

    @staticmethod
    async def _labels(
        db: AsyncSession, scope: tuple, event_type: str, limit: int, *, extra=(), by_type: bool = False
    ) -> List[Dict[str, Any]]:
        """Most common labels for one event type, with distinct visitors."""
        E = AnalyticsEvent
        columns = [E.label] + ([E.resource_type] if by_type else [])
        rows = (await db.execute(
            select(*columns, func.count().label("count"), func.count(distinct(E.visitor_id)).label("visitors"))
            .where(*scope, E.event_type == event_type, E.label.isnot(None), *extra)
            .group_by(*columns)
            .order_by(func.count().desc())
            .limit(limit)
        )).all()
        return [
            {
                "label": r.label,
                **({"type": r.resource_type or "other"} if by_type else {}),
                "count": int(r.count),
                "visitors": int(r.visitors),
            }
            for r in rows
        ]

    @staticmethod
    async def _product_stats(
        db: AsyncSession, scope: tuple, start: datetime, end: datetime, product_ids: Optional[List[int]] = None
    ) -> Dict[int, Dict[str, int]]:
        """Per-product views, visitors, downloads, cart adds, quotes and interest score."""
        E = AnalyticsEvent
        where = [*scope, E.product_id.isnot(None)]
        if product_ids is not None:
            where.append(E.product_id.in_(product_ids))
        stats: Dict[int, Dict[str, int]] = {}
        for r in (await db.execute(
            select(
                E.product_id,
                _count_of(T.PRODUCT_VIEW).label("views"),
                _visitors_of(T.PRODUCT_VIEW).label("visitors"),
                _count_of(T.DOWNLOAD).label("downloads"),
                _count_of(T.CART_ADD).label("cart_adds"),
                _count_of(T.PRODUCT_INTERACTION).label("interactions"),
            ).where(*where).group_by(E.product_id)
        )).all():
            stats[r.product_id] = {
                **{k: int(getattr(r, k) or 0) for k in ("views", "visitors", "downloads", "cart_adds", "interactions")},
                "quotes": 0,
            }

        quote_where = [Quote.created_at >= start, Quote.created_at < end]
        if product_ids is not None:
            quote_where.append(QuoteItem.product_id.in_(product_ids))
        for r in (await db.execute(
            select(QuoteItem.product_id, func.count(distinct(Quote.id)).label("quotes"))
            .join(Quote, Quote.id == QuoteItem.quote_id)
            .where(*quote_where)
            .group_by(QuoteItem.product_id)
        )).all():
            stats.setdefault(r.product_id, dict(_EMPTY_PRODUCT_STATS))["quotes"] = int(r.quotes or 0)

        for entry in stats.values():
            entry["interest_score"] = sum(entry[k] * w for k, w in INTEREST_WEIGHTS.items())
        return stats

    @staticmethod
    async def _content_gaps(db: AsyncSession, stats: Dict[int, Dict[str, int]], limit: int) -> Dict[str, Any]:
        """Viewed products missing downloadable files, and products nobody viewed."""
        viewed_ids = [pid for pid, s in stats.items() if s["views"] > 0]
        missing_files = []
        if viewed_ids:
            rows = (await db.execute(
                select(
                    Chair.id, Chair.name, Chair.model_number, Chair.slug,
                    Chair.spec_sheet_url, Chair.cad_file_url, Chair.dimensional_drawing_url,
                ).where(Chair.id.in_(viewed_ids), Chair.is_active.is_(True))
            )).all()
            for r in rows:
                missing = [
                    name for name, url in (
                        ("spec_sheet", r.spec_sheet_url),
                        ("cad", r.cad_file_url),
                        ("line_drawing", r.dimensional_drawing_url),
                    ) if not url
                ]
                if missing:
                    missing_files.append({
                        "product_id": r.id,
                        "name": r.name,
                        "model_number": r.model_number,
                        "slug": r.slug,
                        "views": stats[r.id]["views"],
                        "missing": missing,
                    })
            missing_files.sort(key=lambda m: m["views"], reverse=True)

        unseen = select(Chair.id).where(Chair.is_active.is_(True))
        if viewed_ids:
            unseen = unseen.where(Chair.id.notin_(viewed_ids))
        never_viewed_count = (await db.execute(select(func.count()).select_from(unseen.subquery()))).scalar() or 0
        never_viewed = [
            {"product_id": r.id, "name": r.name, "model_number": r.model_number, "slug": r.slug}
            for r in (await db.execute(
                select(Chair.id, Chair.name, Chair.model_number, Chair.slug)
                .where(Chair.id.in_(unseen))
                .order_by(Chair.name)
                .limit(limit)
            )).all()
        ]
        return {
            "missing_files": missing_files[:limit],
            "missing_files_count": len(missing_files),
            "never_viewed": never_viewed,
            "never_viewed_count": int(never_viewed_count),
        }

    # ------------------------------------------------------------------
    # Overview report
    # ------------------------------------------------------------------

    @staticmethod
    async def get_overview(
        db: AsyncSession, days: int = 30, limit: int = 10, include_staff: bool = False
    ) -> Dict[str, Any]:
        """Everything the admin Analytics page needs for one date range."""
        E = AnalyticsEvent
        S = SiteAnalyticsService
        now = datetime.utcnow()
        start = now - timedelta(days=days)
        prev_start = start - timedelta(days=days)
        scope = _scope(start, now, include_staff)

        current = await S._period_totals(db, scope, start, now)
        previous = await S._period_totals(db, _scope(prev_start, start, include_staff), prev_start, start)

        active_now = (await db.execute(
            select(func.count(distinct(E.visitor_id))).where(
                *_scope(now - timedelta(minutes=ACTIVE_WINDOW_MINUTES), now + timedelta(seconds=1), include_staff)
            )
        )).scalar() or 0

        staff_events = 0
        if not include_staff:
            staff_events = (await db.execute(
                select(func.count()).where(E.created_at >= start, E.created_at < now, E.is_staff.is_(True))
            )).scalar() or 0

        # Daily series (UTC days), zero-filled so charts have no gaps
        day = func.date(E.created_at)
        series_fields = ("page_views", "product_views", "downloads", "cart_adds", "visitors")
        series_rows = (await db.execute(
            select(
                day.label("day"),
                _count_of(T.PAGE_VIEW).label("page_views"),
                _count_of(T.PRODUCT_VIEW).label("product_views"),
                _count_of(T.DOWNLOAD).label("downloads"),
                _count_of(T.CART_ADD).label("cart_adds"),
                func.count(distinct(E.visitor_id)).label("visitors"),
            ).where(*scope).group_by(day)
        )).all()
        timeseries = _zero_filled(days, now, {str(r.day)[:10]: r for r in series_rows}, series_fields)

        # Pages, with time on page; over-fetch since dead paths are dropped
        fetch = limit * 3 + 10
        page_rows = [
            {"path": r.path, "views": int(r.views), "visitors": int(r.visitors)}
            for r in (await db.execute(
                select(E.path, func.count().label("views"), func.count(distinct(E.visitor_id)).label("visitors"))
                .where(*scope, E.event_type == T.PAGE_VIEW, E.path.isnot(None))
                .group_by(E.path)
                .order_by(func.count().desc())
                .limit(fetch)
            )).all()
        ]
        engagement_by_path = {}
        if page_rows:
            visits = _page_visits(scope, paths=[p["path"] for p in page_rows])
            engagement_by_path = {
                r.path: r for r in (await db.execute(
                    select(
                        visits.c.path,
                        func.avg(visits.c.seconds).label("seconds"),
                        func.avg(visits.c.depth).label("depth"),
                    ).group_by(visits.c.path)
                )).all()
            }
        for p in page_rows:
            eng = engagement_by_path.get(p["path"])
            p["avg_seconds"] = _round(eng.seconds, 0) if eng else None
            p["avg_depth"] = _round(eng.depth, 0) if eng and eng.depth is not None else None
        top_pages = await S._named_pages(db, page_rows, limit)

        async def edge_pages(pick):
            """Landing (min id) or exit (max id) page of each session."""
            ids = (
                select(pick(E.id).label("eid"))
                .where(*scope, E.event_type == T.PAGE_VIEW)
                .group_by(E.session_id)
                .subquery()
            )
            rows = [
                {"path": r.path, "sessions": int(r.sessions)}
                for r in (await db.execute(
                    select(E.path, func.count().label("sessions"))
                    .join(ids, E.id == ids.c.eid)
                    .group_by(E.path)
                    .order_by(func.count().desc())
                    .limit(fetch)
                )).all()
            ]
            return await S._named_pages(db, rows, limit)

        # Products ranked by interest score
        stats = await S._product_stats(db, scope, start, now)
        top_ids = sorted(stats, key=lambda pid: (stats[pid]["interest_score"], stats[pid]["views"]), reverse=True)[:limit]
        products = {}
        if top_ids:
            products = {
                p.id: p for p in (await db.execute(
                    select(Chair.id, Chair.name, Chair.model_number, Chair.slug, Chair.primary_image_url)
                    .where(Chair.id.in_(top_ids))
                )).all()
            }
        top_products = []
        for pid in top_ids:
            p = products.get(pid)
            top_products.append({
                "product_id": pid,
                "name": p.name if p else f"Deleted product #{pid}",
                "model_number": p.model_number if p else None,
                "slug": p.slug if p else None,
                "image_url": p.primary_image_url if p else None,
                **stats[pid],
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
                .where(*scope, E.event_type == T.DOWNLOAD)
                .group_by(E.resource_url)
                .order_by(func.count().desc())
                .limit(limit)
            )).all()
        ]

        downloads_by_type = [
            {"type": r.resource_type or "other", "downloads": int(r.downloads)}
            for r in (await db.execute(
                select(E.resource_type, func.count().label("downloads"))
                .where(*scope, E.event_type == T.DOWNLOAD)
                .group_by(E.resource_type)
                .order_by(func.count().desc())
            )).all()
        ]

        # The tracker only sends a referrer on a session's landing page view,
        # so attribute each session to its (single) non-null referrer
        session_refs = (
            select(E.session_id, func.max(E.referrer).label("referrer"))
            .where(*scope, E.event_type == T.PAGE_VIEW)
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

        campaign_sessions = func.count(distinct(E.session_id))
        campaigns = [
            {"source": r.utm_source, "medium": r.utm_medium, "campaign": r.utm_campaign, "sessions": int(r.sessions)}
            for r in (await db.execute(
                select(E.utm_source, E.utm_medium, E.utm_campaign, campaign_sessions.label("sessions"))
                .where(*scope, E.event_type == T.PAGE_VIEW, E.utm_source.isnot(None))
                .group_by(E.utm_source, E.utm_medium, E.utm_campaign)
                .order_by(campaign_sessions.desc())
                .limit(limit)
            )).all()
        ]

        unique_visitors = func.count(distinct(E.visitor_id))
        devices = [
            {"device": r.device or "unknown", "visitors": int(r.visitors)}
            for r in (await db.execute(
                select(E.device, unique_visitors.label("visitors"))
                .where(*scope)
                .group_by(E.device)
                .order_by(unique_visitors.desc())
            )).all()
        ]
        countries = [
            {"country": r.country, "visitors": int(r.visitors)}
            for r in (await db.execute(
                select(E.country, unique_visitors.label("visitors"))
                .where(*scope, E.country.isnot(None))
                .group_by(E.country)
                .order_by(unique_visitors.desc())
                .limit(limit)
            )).all()
        ]
        regions = [
            {"country": r.country, "region": r.region, "visitors": int(r.visitors)}
            for r in (await db.execute(
                select(E.country, E.region, unique_visitors.label("visitors"))
                .where(*scope, E.region.isnot(None))
                .group_by(E.country, E.region)
                .order_by(unique_visitors.desc())
                .limit(limit)
            )).all()
        ]

        # Catalog reading time: seconds each session spent with a catalog open
        # (summed, since one read can be reported in pieces)
        per_reader = (
            select(E.label, E.session_id, func.sum(E.value).label("seconds"))
            .where(*scope, E.event_type == T.CATALOG_READ)
            .group_by(E.label, E.session_id)
            .subquery()
        )
        catalogs = [
            {
                "label": r.label,
                "readers": int(r.readers),
                "avg_seconds": _round(r.avg_seconds, 0),
                "total_seconds": int(r.total_seconds or 0),
            }
            for r in (await db.execute(
                select(
                    per_reader.c.label,
                    func.count().label("readers"),
                    func.avg(per_reader.c.seconds).label("avg_seconds"),
                    func.sum(per_reader.c.seconds).label("total_seconds"),
                )
                .group_by(per_reader.c.label)
                .order_by(func.count().desc())
                .limit(limit)
            )).all()
        ]

        searches = await S._labels(db, scope, T.SEARCH, limit)
        zero_results = await S._labels(db, scope, T.SEARCH, limit, extra=(E.value == 0,))

        return {
            "days": days,
            "generated_at": now.isoformat() + "Z",
            "include_staff": include_staff,
            "staff_events_excluded": int(staff_events),
            "active_now": int(active_now),
            "totals": current,
            "previous": previous,
            "timeseries": timeseries,
            "funnel": await S._funnel(db, scope),
            "top_pages": top_pages,
            "entry_pages": await edge_pages(func.min),
            "exit_pages": await edge_pages(func.max),
            "top_products": top_products,
            "interest_weights": INTEREST_WEIGHTS,
            "content_gaps": await S._content_gaps(db, stats, limit),
            "top_downloads": top_downloads,
            "downloads_by_type": downloads_by_type,
            "referrers": referrers,
            "campaigns": campaigns,
            "devices": devices,
            "countries": countries,
            "regions": regions,
            "top_searches": [{"query": r["label"], "searches": r["count"]} for r in searches],
            "zero_result_searches": [{"query": r["label"], "searches": r["count"]} for r in zero_results],
            "filters": await S._labels(db, scope, T.FILTER, limit),
            "materials": await S._labels(db, scope, T.MATERIAL_VIEW, limit, by_type=True),
            "product_interactions": await S._labels(db, scope, T.PRODUCT_INTERACTION, limit, by_type=True),
            "catalogs": catalogs,
            "rep_searches": await S._labels(db, scope, T.REP_SEARCH, limit),
            "contact_submits": await S._labels(db, scope, T.CONTACT_SUBMIT, limit),
        }

    # ------------------------------------------------------------------
    # Single product report
    # ------------------------------------------------------------------

    @staticmethod
    async def get_product_report(
        db: AsyncSession, product_id: int, days: int = 30, include_staff: bool = False, limit: int = 10
    ) -> Optional[Dict[str, Any]]:
        """Engagement for one product over a date range, with the prior period."""
        E = AnalyticsEvent
        S = SiteAnalyticsService
        product = (await db.execute(
            select(
                Chair.id, Chair.name, Chair.model_number, Chair.slug, Chair.primary_image_url,
                Chair.spec_sheet_url, Chair.cad_file_url, Chair.dimensional_drawing_url,
            ).where(Chair.id == product_id)
        )).one_or_none()
        if product is None:
            return None

        now = datetime.utcnow()
        start = now - timedelta(days=days)
        prev_start = start - timedelta(days=days)
        scope = _scope(start, now, include_staff)
        empty = {**_EMPTY_PRODUCT_STATS, "interest_score": 0}

        current = (await S._product_stats(db, scope, start, now, [product_id])).get(product_id, empty)
        previous = (await S._product_stats(
            db, _scope(prev_start, start, include_staff), prev_start, start, [product_id]
        )).get(product_id, empty)
        cart_removes = (await db.execute(
            select(func.count()).where(*scope, E.product_id == product_id, E.event_type == T.CART_REMOVE)
        )).scalar() or 0

        day = func.date(E.created_at)
        series_rows = (await db.execute(
            select(
                day.label("day"),
                _count_of(T.PRODUCT_VIEW).label("views"),
                _count_of(T.DOWNLOAD).label("downloads"),
                _count_of(T.CART_ADD).label("cart_adds"),
            ).where(*scope, E.product_id == product_id).group_by(day)
        )).all()

        product_only = (E.product_id == product_id,)
        return {
            "days": days,
            "product": {
                "id": product.id,
                "name": product.name,
                "model_number": product.model_number,
                "slug": product.slug,
                "image_url": product.primary_image_url,
                "has_spec_sheet": bool(product.spec_sheet_url),
                "has_cad": bool(product.cad_file_url),
                "has_line_drawing": bool(product.dimensional_drawing_url),
            },
            "interest_weights": INTEREST_WEIGHTS,
            "totals": {**current, "cart_removes": int(cart_removes)},
            "previous": previous,
            "timeseries": _zero_filled(
                days, now, {str(r.day)[:10]: r for r in series_rows}, ("views", "downloads", "cart_adds")
            ),
            "downloads": await S._labels(db, scope, T.DOWNLOAD, limit, extra=product_only, by_type=True),
            "interactions": await S._labels(db, scope, T.PRODUCT_INTERACTION, limit, extra=product_only, by_type=True),
        }
