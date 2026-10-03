"""
Weekly analytics digest

Emails staff a one-screen summary of the last 7 days of site analytics every
Monday (ANALYTICS_DIGEST_HOUR_UTC). One send per ISO week across all workers,
claimed with a Redis key; without Redis the scheduled send is skipped (an
admin can still send one from the Analytics page).
"""

import asyncio
import html
import logging
from datetime import datetime
from typing import Any, Dict, List

from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import settings
from backend.services.site_analytics_service import SiteAnalyticsService

logger = logging.getLogger(__name__)

DIGEST_DAYS = 7
CHECK_INTERVAL_SECONDS = 15 * 60
SENT_KEY = "eaglechair:analytics_digest:{week}"

_GOLD = "#b7791f"
_MUTED = "#6b7280"


def digest_recipients() -> List[str]:
    configured = [e.strip() for e in (settings.ANALYTICS_DIGEST_RECIPIENTS or "").split(",") if e.strip()]
    return configured or [settings.ADMIN_EMAIL]


def _change(current: float, previous: float) -> str:
    if not previous:
        return "new" if current else "–"
    pct = (current - previous) / previous * 100
    if abs(pct) < 0.5:
        return "no change"
    return f"{'▲' if pct > 0 else '▼'} {abs(pct):.0f}%"


def _admin_url() -> str:
    return f"{settings.SITE_URL.rstrip('/')}/admin/dashboard"


def _table(title: str, headers: List[str], rows: List[List[Any]]) -> str:
    if not rows:
        return ""

    def align(i):
        return "left" if i == 0 else "right"

    head = "".join(
        f'<th style="text-align:{align(i)};padding:6px 8px;font-size:12px;color:{_MUTED};'
        f'border-bottom:1px solid #e5e7eb">{html.escape(h)}</th>'
        for i, h in enumerate(headers)
    )
    body = "".join(
        "<tr>" + "".join(
            f'<td style="text-align:{align(i)};padding:6px 8px;font-size:13px;'
            f'border-bottom:1px solid #f3f4f6">{html.escape(str(cell))}</td>'
            for i, cell in enumerate(row)
        ) + "</tr>"
        for row in rows
    )
    return (
        f'<h3 style="margin:24px 0 8px;font-size:15px">{html.escape(title)}</h3>'
        f'<table style="width:100%;border-collapse:collapse"><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>'
    )


def render_digest(report: Dict[str, Any]) -> str:
    """Email-safe HTML (inline styles). Every visitor-supplied string is escaped."""
    t, p = report["totals"], report["previous"]
    kpis = [
        ("Visitors", t["visitors"], p["visitors"]),
        ("Page views", t["page_views"], p["page_views"]),
        ("Product views", t["product_views"], p["product_views"]),
        ("Downloads", t["downloads"], p["downloads"]),
        ("Added to quote", t["cart_adds"], p["cart_adds"]),
        ("Quote requests", t["quote_requests"], p["quote_requests"]),
    ]
    cells = [
        f'<td style="padding:10px;border:1px solid #e5e7eb;width:33%">'
        f'<div style="font-size:12px;color:{_MUTED}">{label}</div>'
        f'<div style="font-size:22px;font-weight:700">{value:,}</div>'
        f'<div style="font-size:12px;color:{_MUTED}">{_change(value, prev)} vs prior week</div></td>'
        for label, value, prev in kpis
    ]
    tiles = f'<tr>{"".join(cells[:3])}</tr><tr>{"".join(cells[3:])}</tr>'

    funnel = report["funnel"]
    top = funnel[0]["sessions"] or 1
    funnel_rows = [[s["label"], f'{s["sessions"]:,}', f'{s["sessions"] / top * 100:.0f}%'] for s in funnel]

    gaps = report["content_gaps"]
    gap_lines = []
    if gaps["missing_files_count"]:
        gap_lines.append(f'{gaps["missing_files_count"]} viewed products are missing a spec sheet, CAD file or line drawing.')
    if gaps["never_viewed_count"]:
        gap_lines.append(f'{gaps["never_viewed_count"]} active products had no views.')

    parts = [
        '<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111827;max-width:640px">',
        '<h2 style="margin:0 0 4px">Website activity – last 7 days</h2>',
        f'<p style="margin:0 0 16px;font-size:13px;color:{_MUTED}">Anonymous visitors to the public site. '
        'Bots and staff are not counted.</p>',
        f'<table style="width:100%;border-collapse:separate;border-spacing:6px">{tiles}</table>',
        _table("Path to a quote", ["Step", "Sessions", "Of visits"], funnel_rows),
        _table(
            "Products with the most interest",
            ["Product", "Views", "Downloads", "Quote adds", "Quotes"],
            [[r["name"], r["views"], r["downloads"], r["cart_adds"], r["quotes"]] for r in report["top_products"]],
        ),
        _table("Top pages", ["Page", "Views"], [[r["title"], f'{r["views"]:,}'] for r in report["top_pages"]]),
        _table(
            "Top downloads", ["File", "Downloads"],
            [[r["label"] or r["resource_url"], r["downloads"]] for r in report["top_downloads"]],
        ),
        _table(
            "Searches with no results", ["Search", "Times"],
            [[r["query"], r["searches"]] for r in report["zero_result_searches"]],
        ),
    ]
    if gap_lines:
        items = "".join(f'<li style="font-size:13px;margin:4px 0">{html.escape(line)}</li>' for line in gap_lines)
        parts.append(f'<h3 style="margin:24px 0 8px;font-size:15px">Worth a look</h3><ul style="padding-left:18px">{items}</ul>')
    parts.append(
        f'<p style="margin:28px 0 0"><a href="{html.escape(_admin_url())}" '
        f'style="background:{_GOLD};color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-size:14px">'
        'Open full analytics</a></p></div>'
    )
    return "".join(parts)


async def send_digest(db: AsyncSession, recipients: List[str]) -> int:
    """Build and send the digest. Returns how many recipients it reached."""
    from backend.services.email_service import EmailService

    report = await SiteAnalyticsService.get_overview(db, days=DIGEST_DAYS, limit=5)
    # Passed as context (not as the template) so visitor-supplied text in the
    # report is never parsed as Jinja
    digest_html = render_digest(report)
    sent = 0
    for to_email in recipients:
        if await EmailService.send_email(
            db=db,
            to_email=to_email,
            template_type="analytics_digest",
            context={"digest_html": digest_html, "visitors": report["totals"]["visitors"]},
        ):
            sent += 1
    return sent


async def digest_loop() -> None:
    """Background task: send the weekly digest once per ISO week."""
    import redis.asyncio as redis

    from backend.database.base import AsyncSessionLocal

    await asyncio.sleep(30)
    warned = False
    while True:
        try:
            now = datetime.utcnow()
            if now.weekday() == 0 and now.hour >= settings.ANALYTICS_DIGEST_HOUR_UTC:
                year, week, _ = now.isocalendar()
                client = redis.from_url(settings.REDIS_URL, socket_connect_timeout=2, socket_timeout=5)
                try:
                    claimed = await client.set(SENT_KEY.format(week=f"{year}-W{week:02d}"), "1", nx=True, ex=8 * 86400)
                finally:
                    await client.aclose()
                if claimed:
                    async with AsyncSessionLocal() as db:
                        sent = await send_digest(db, digest_recipients())
                    logger.info(f"[ANALYTICS] Weekly digest sent to {sent} recipient(s)")
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            if not warned:
                logger.warning(f"[ANALYTICS] Weekly digest check failed: {exc}")
                warned = True
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
