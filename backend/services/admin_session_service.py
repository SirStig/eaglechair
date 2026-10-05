"""
Admin device sessions

Each admin sign-in creates an AdminSession row holding that login's session /
admin / refresh token digests. Access and refresh JWTs carry the row id as
the "sid" claim, so:

  - several devices can be signed in at once (each has its own tokens)
  - each sign-in can be listed (device, IP, location, last active) and
    signed out on its own; a revoked session's tokens stop working at once

Tokens issued before sessions existed (no "sid") still validate against the
single set of digests on AdminUser.
"""

import logging
import re
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.security import SecurityManager
from backend.models.company import AdminSession

logger = logging.getLogger(__name__)

# last_seen_at is written at most this often per session
LAST_SEEN_INTERVAL = timedelta(minutes=1)

_BROWSERS = (
    ("Edge", re.compile(r"Edg(?:e|A|iOS)?/")),
    ("Opera", re.compile(r"OPR/|Opera")),
    ("Samsung Internet", re.compile(r"SamsungBrowser/")),
    ("Firefox", re.compile(r"Firefox/|FxiOS/")),
    ("Chrome", re.compile(r"Chrome/|CriOS/")),
    ("Safari", re.compile(r"Safari/")),
)
_SYSTEMS = (
    ("iPhone", re.compile(r"iPhone")),
    ("iPad", re.compile(r"iPad")),
    ("Android", re.compile(r"Android")),
    ("Windows", re.compile(r"Windows")),
    ("macOS", re.compile(r"Macintosh|Mac OS X")),
    ("ChromeOS", re.compile(r"CrOS")),
    ("Linux", re.compile(r"Linux")),
)


def device_label(user_agent: Optional[str]) -> Optional[str]:
    """'Chrome on macOS' from a User-Agent string (None if unrecognisable)"""
    if not user_agent:
        return None
    browser = next((name for name, pattern in _BROWSERS if pattern.search(user_agent)), None)
    system = next((name for name, pattern in _SYSTEMS if pattern.search(user_agent)), None)
    if browser and system:
        return f"{browser} on {system}"
    return browser or system


def locate(ip: Optional[str]) -> Optional[str]:
    """'City, Region, CC' from the analytics GeoIP database, if configured"""
    if not ip:
        return None
    try:
        import ipaddress

        from backend.services.site_analytics_service import _geoip_reader

        parsed = ipaddress.ip_address(ip)
        if parsed.is_private or parsed.is_loopback:
            return None
        reader = _geoip_reader()
        if reader is None:
            return None
        try:
            hit = reader.city(ip)
            parts = [
                hit.city.name,
                hit.subdivisions.most_specific.name if hit.subdivisions else None,
                hit.country.iso_code,
            ]
        except Exception:
            hit = reader.country(ip)
            parts = [hit.country.iso_code]
        label = ", ".join(p for p in parts if p)
        return label[:150] or None
    except Exception:
        return None


def _now() -> datetime:
    return datetime.utcnow()


async def create_session(
    db: AsyncSession,
    admin_id: int,
    *,
    ip_address: Optional[str],
    user_agent: Optional[str],
    login_method: str,
) -> AdminSession:
    """Insert a session row (token digests filled in by the caller) and flush for its id"""
    session = AdminSession(
        admin_id=admin_id,
        session_token_hash="",
        admin_token_hash="",
        login_method=login_method,
        ip_address=ip_address,
        user_agent=(user_agent or "")[:500] or None,
        device_label=device_label(user_agent),
        location=locate(ip_address),
        last_seen_at=_now(),
    )
    db.add(session)
    await db.flush()
    return session


async def get_session(db: AsyncSession, session_id) -> Optional[AdminSession]:
    try:
        sid = int(session_id)
    except (TypeError, ValueError):
        return None
    return await db.get(AdminSession, sid)


def is_active(session: Optional[AdminSession]) -> bool:
    return session is not None and session.revoked_at is None


def tokens_match(session: AdminSession, session_token: str, admin_token: str) -> bool:
    return SecurityManager.verify_token_digest(
        session_token, session.session_token_hash
    ) and SecurityManager.verify_token_digest(admin_token, session.admin_token_hash)


def refresh_matches(session: AdminSession, refresh_token: str) -> bool:
    if not session.refresh_token_hash:
        return False
    if session.refresh_expires_at and _now() > session.refresh_expires_at:
        return False
    return SecurityManager.verify_token_digest(refresh_token, session.refresh_token_hash)


async def touch(db: AsyncSession, session: AdminSession, ip_address: Optional[str]) -> None:
    """Update last_seen_at (and IP) at most once per LAST_SEEN_INTERVAL. Never raises."""
    now = _now()
    if session.last_seen_at and now - session.last_seen_at < LAST_SEEN_INTERVAL:
        return
    try:
        session.last_seen_at = now
        if ip_address and ip_address != session.ip_address:
            session.ip_address = ip_address
            session.location = locate(ip_address)
        await db.commit()
    except Exception as e:
        logger.warning(f"Could not update admin session {session.id} last_seen: {e}")
        await db.rollback()


def revoke(session: AdminSession, reason: str) -> None:
    """Mark one session signed out. Caller commits."""
    if session.revoked_at is None:
        session.revoked_at = _now()
        session.revoked_reason = reason[:50]


async def revoke_all(
    db: AsyncSession, admin_id: int, reason: str, except_id: Optional[int] = None
) -> int:
    """Sign out every active session of an admin (optionally keeping one). Caller commits."""
    query = (
        update(AdminSession)
        .where(AdminSession.admin_id == admin_id, AdminSession.revoked_at.is_(None))
        .values(revoked_at=_now(), revoked_reason=reason[:50])
    )
    if except_id is not None:
        query = query.where(AdminSession.id != except_id)
    result = await db.execute(query)
    return result.rowcount or 0


async def list_sessions(db: AsyncSession, admin_id: int, include_revoked_days: int = 7) -> list[AdminSession]:
    """Active sessions, then sessions signed out in the last few days, newest first"""
    since = _now() - timedelta(days=include_revoked_days)
    result = await db.execute(
        select(AdminSession)
        .where(
            AdminSession.admin_id == admin_id,
            (AdminSession.revoked_at.is_(None)) | (AdminSession.revoked_at >= since),
        )
        .order_by(AdminSession.revoked_at.is_not(None), AdminSession.last_seen_at.desc(), AdminSession.id.desc())
    )
    return list(result.scalars().all())


def _iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() + "+00:00" if value else None


def serialize(session: AdminSession, current_id: Optional[int] = None) -> dict:
    return {
        "id": session.id,
        "device": session.device_label or "Unknown device",
        "user_agent": session.user_agent,
        "ip_address": session.ip_address,
        "location": session.location,
        "login_method": session.login_method,
        "signed_in_at": _iso(session.created_at),
        "last_seen_at": _iso(session.last_seen_at),
        "revoked_at": _iso(session.revoked_at),
        "revoked_reason": session.revoked_reason,
        "active": session.revoked_at is None,
        "current": current_id is not None and session.id == current_id,
    }
