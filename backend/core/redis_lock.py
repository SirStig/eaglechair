"""
Redis Lock Helpers

Small cross-process lock primitives shared by the Gunicorn workers:

- A lazily created async Redis client with short timeouts and a circuit
  breaker, so callers pay at most one failed connection attempt per window
  when Redis is down.
- Atomic compare-and-delete / compare-and-refresh Lua scripts, so a worker
  only ever releases or extends a lock it still owns (a get-then-delete could
  drop a lock another worker acquired after ours expired).
- ``redis_lock``: an async context manager that serializes a critical section
  across processes, backed by an in-process asyncio.Lock. When Redis is
  unavailable it falls back to the in-process lock alone and logs a warning
  instead of failing the caller.
"""

import asyncio
import logging
import time
import uuid
from contextlib import asynccontextmanager
from typing import AsyncIterator, Optional

from backend.core.config import settings

logger = logging.getLogger(__name__)

# Delete KEYS[1] only if it still holds our token (ARGV[1])
RELEASE_LOCK_SCRIPT = """
if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
end
return 0
"""

# Extend KEYS[1] to ARGV[2] ms only if it still holds our token (ARGV[1])
REFRESH_LOCK_SCRIPT = """
if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('pexpire', KEYS[1], ARGV[2])
end
return 0
"""

# After a Redis failure, skip Redis for this many seconds before retrying
_REDIS_RETRY_SECONDS = 30.0
# How often a waiting worker polls for the lock
_POLL_INTERVAL_SECONDS = 0.05

_client = None
_redis_down_until = 0.0


def new_lock_token() -> str:
    """Unique owner token for a lock acquisition."""
    return uuid.uuid4().hex


def _get_client():
    """Shared async Redis client, or None when Redis is disabled or down."""
    global _client
    if settings.TESTING or time.monotonic() < _redis_down_until:
        return None
    if _client is None:
        try:
            import redis.asyncio as redis

            _client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=1,
                socket_timeout=2,
            )
        except Exception as e:  # pragma: no cover - import/config failure
            _mark_down(e)
            return None
    return _client


def _mark_down(error: Exception) -> None:
    global _redis_down_until
    if time.monotonic() >= _redis_down_until:
        logger.warning(
            f"Redis lock unavailable, using in-process lock only for "
            f"{_REDIS_RETRY_SECONDS:.0f}s: {error}"
        )
    _redis_down_until = time.monotonic() + _REDIS_RETRY_SECONDS


async def release_lock(client, key: str, token: str) -> bool:
    """Atomically delete ``key`` if it still holds ``token``."""
    return bool(await client.eval(RELEASE_LOCK_SCRIPT, 1, key, token))


async def refresh_lock(client, key: str, token: str, ttl_ms: int) -> bool:
    """Atomically extend ``key`` to ``ttl_ms`` if it still holds ``token``."""
    return bool(await client.eval(REFRESH_LOCK_SCRIPT, 1, key, token, ttl_ms))


@asynccontextmanager
async def redis_lock(
    key: str,
    local_lock: asyncio.Lock,
    ttl_ms: int = 30_000,
    wait_timeout: float = 40.0,
) -> AsyncIterator[bool]:
    """
    Hold ``local_lock`` and, when Redis is reachable, the Redis lock ``key``.

    Yields True if the Redis lock is held, False when running on the
    in-process lock alone (Redis unavailable, or the lock could not be
    acquired within ``wait_timeout``). The critical section must finish well
    within ``ttl_ms``; the TTL only exists so a crashed worker can't wedge
    the lock forever.
    """
    async with local_lock:
        client = _get_client()
        token = new_lock_token()
        acquired = False

        if client is not None:
            deadline = time.monotonic() + wait_timeout
            try:
                while True:
                    if await client.set(key, token, nx=True, px=ttl_ms):
                        acquired = True
                        break
                    if time.monotonic() >= deadline:
                        logger.warning(
                            f"Timed out waiting {wait_timeout:.0f}s for Redis lock "
                            f"{key}; continuing with the in-process lock only"
                        )
                        break
                    await asyncio.sleep(_POLL_INTERVAL_SECONDS)
            except Exception as e:
                _mark_down(e)

        try:
            yield acquired
        finally:
            if acquired:
                try:
                    await release_lock(client, key, token)
                except Exception as e:
                    # The TTL frees it shortly anyway
                    logger.warning(f"Could not release Redis lock {key}: {e}")
