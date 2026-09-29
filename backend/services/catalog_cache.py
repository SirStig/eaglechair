"""
Catalog cache helpers

- A catalog "version" counter that admin write paths bump. It lives in Redis
  (INCR, shared by every worker) plus a per-process counter, so in-process
  caches (search index, option map) and the Redis response cache notice edits.
- A short-TTL Redis cache for anonymous public catalog GET responses, keyed by
  catalog version + path + sorted query string.
- Cache-Control header helpers for those responses.

Everything degrades to a no-op when Redis is unavailable: failures open a
short circuit breaker so requests don't pay a connection attempt each time.
"""

import json
import logging
import time
from typing import Any, Optional, Tuple
from urllib.parse import urlencode

from fastapi import Request
from fastapi.responses import Response
from pydantic import TypeAdapter

from backend.core.config import settings
from backend.core.security import AUTH_COOKIE_NAMES

logger = logging.getLogger(__name__)

CATALOG_VERSION_KEY = "eaglechair:catalog_version"
PUBLIC_CACHE_PREFIX = "eaglechair:pubcache"
PUBLIC_CACHE_TTL = 120  # seconds

PUBLIC_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300"
PRIVATE_CACHE_CONTROL = "private, no-store"

_REDIS_RETRY_AFTER = 30.0  # seconds to skip Redis after a failure

_client = None
_redis_down_until = 0.0
_local_version = 0


def _redis_enabled() -> bool:
    return bool(settings.ENABLE_CACHE) and not settings.TESTING


def _get_client():
    global _client
    if not _redis_enabled() or time.monotonic() < _redis_down_until:
        return None
    if _client is None:
        try:
            import redis.asyncio as aioredis

            _client = aioredis.from_url(
                settings.REDIS_URL,
                socket_connect_timeout=0.5,
                socket_timeout=0.5,
            )
        except Exception as e:  # pragma: no cover - import/config errors
            logger.warning(f"Catalog cache: Redis client unavailable: {e}")
            _mark_down()
            return None
    return _client


def _mark_down() -> None:
    global _redis_down_until
    if time.monotonic() >= _redis_down_until:
        logger.warning(
            f"Catalog cache: Redis unavailable, skipping for {_REDIS_RETRY_AFTER:.0f}s"
        )
    _redis_down_until = time.monotonic() + _REDIS_RETRY_AFTER


async def _redis_call(fn) -> Any:
    client = _get_client()
    if client is None:
        return None
    try:
        return await fn(client)
    except Exception as e:
        logger.debug(f"Catalog cache Redis error: {e}")
        _mark_down()
        return None


# ---------------------------------------------------------------------------
# Version counter
# ---------------------------------------------------------------------------


async def get_remote_version() -> Optional[int]:
    """Shared (Redis) catalog version, or None when Redis is unavailable."""
    raw = await _redis_call(lambda c: c.get(CATALOG_VERSION_KEY))
    if raw is None:
        return None if time.monotonic() < _redis_down_until else 0
    try:
        return int(raw)
    except (TypeError, ValueError):
        return 0


async def get_catalog_version() -> Tuple[Optional[int], int]:
    """(shared version, per-process version) for in-process cache validation."""
    return (await get_remote_version(), _local_version)


async def bump_catalog_version() -> None:
    """Mark catalog data as changed (call after admin writes)."""
    global _local_version
    _local_version += 1
    await _redis_call(lambda c: c.incr(CATALOG_VERSION_KEY))


# ---------------------------------------------------------------------------
# Public response cache
# ---------------------------------------------------------------------------


def _cache_key(request: Request, version: int) -> str:
    query = urlencode(sorted(request.query_params.multi_items()))
    return f"{PUBLIC_CACHE_PREFIX}:{version}:{request.url.path}?{query}"


def _is_authenticated_request(request: Request) -> bool:
    # Browsers authenticate with httpOnly cookies, API clients with a header;
    # either way the response may carry per-company pricing.
    if request.headers.get("authorization"):
        return True
    return any(request.cookies.get(name) for name in AUTH_COOKIE_NAMES)


def _apply_cache_headers(response: Response, request: Request) -> Response:
    response.headers["Cache-Control"] = (
        PRIVATE_CACHE_CONTROL
        if _is_authenticated_request(request)
        else PUBLIC_CACHE_CONTROL
    )
    response.headers["Vary"] = "Authorization, Cookie"
    return response


async def get_cached_public_response(
    request: Request, cacheable: bool = True
) -> Optional[Response]:
    """
    Return a cached anonymous response for this request, or None.

    `cacheable` must be False for responses that depend on the caller
    (e.g. company pricing tiers).
    """
    if not cacheable or not _redis_enabled():
        return None
    version = await get_remote_version()
    if version is None:
        return None
    key = _cache_key(request, version)
    body = await _redis_call(lambda c: c.get(key))
    if body is None:
        return None
    response = Response(content=body, media_type="application/json")
    response.headers["X-Cache"] = "HIT"
    return _apply_cache_headers(response, request)


async def public_json_response(
    request: Request, data: Any, response_type: Any, cacheable: bool = True
) -> Response:
    """
    Serialize `data` exactly as FastAPI would for `response_type`, store it
    in the public cache when `cacheable`, and return it with Cache-Control.
    """
    adapter = TypeAdapter(response_type)
    payload = adapter.dump_python(
        adapter.validate_python(data, from_attributes=True),
        mode="json",
        by_alias=True,
    )
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")

    if cacheable and _redis_enabled():
        version = await get_remote_version()
        if version is not None:
            key = _cache_key(request, version)
            await _redis_call(lambda c: c.set(key, body, ex=PUBLIC_CACHE_TTL))

    response = Response(content=body, media_type="application/json")
    if not cacheable:
        response.headers["Cache-Control"] = PRIVATE_CACHE_CONTROL
        response.headers["Vary"] = "Authorization, Cookie"
        return response
    return _apply_cache_headers(response, request)
