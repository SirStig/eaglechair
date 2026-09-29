"""
Ephemeral key/value store for short-lived security state

Used for WebAuthn challenges and login-failure counters. Backed by Redis
(shared across Gunicorn workers) when available, with an in-process TTL dict
fallback so auth keeps working when Redis is down or in tests.
"""

import logging
import threading
import time
from typing import Optional

from backend.core.config import settings

logger = logging.getLogger(__name__)

KEY_PREFIX = "eaglechair:sec:"

# After a Redis failure, skip Redis for this many seconds before retrying
_REDIS_RETRY_SECONDS = 30
# Upper bound on in-memory entries (expired entries are pruned first)
_MAX_MEMORY_ENTRIES = 50000


class EphemeralStore:
    """Redis-backed TTL store with an in-process fallback."""

    def __init__(self):
        self._redis = None
        self._redis_disabled_until = 0.0
        self._memory: dict[str, tuple[str, float]] = {}
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # Redis helpers
    # ------------------------------------------------------------------

    def _get_redis(self):
        if settings.TESTING:
            return None
        if time.monotonic() < self._redis_disabled_until:
            return None
        if self._redis is None:
            try:
                import redis.asyncio as redis

                self._redis = redis.from_url(
                    settings.REDIS_URL,
                    decode_responses=True,
                    socket_connect_timeout=1,
                    socket_timeout=1,
                )
            except Exception as e:  # pragma: no cover - import/config failure
                logger.warning(f"Ephemeral store: Redis unavailable, using memory: {e}")
                self._redis_disabled_until = time.monotonic() + _REDIS_RETRY_SECONDS
                return None
        return self._redis

    def _redis_failed(self, error: Exception) -> None:
        logger.warning(f"Ephemeral store: Redis error, falling back to memory: {error}")
        self._redis_disabled_until = time.monotonic() + _REDIS_RETRY_SECONDS

    # ------------------------------------------------------------------
    # Memory helpers
    # ------------------------------------------------------------------

    def _mem_get(self, key: str) -> Optional[str]:
        entry = self._memory.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if expires_at <= time.monotonic():
            self._memory.pop(key, None)
            return None
        return value

    def _mem_prune(self) -> None:
        if len(self._memory) < _MAX_MEMORY_ENTRIES:
            return
        now = time.monotonic()
        for k in [k for k, (_, exp) in self._memory.items() if exp <= now]:
            self._memory.pop(k, None)
        # Still full: drop the entries closest to expiry
        overflow = len(self._memory) - _MAX_MEMORY_ENTRIES + 1
        if overflow > 0:
            for k, _ in sorted(self._memory.items(), key=lambda kv: kv[1][1])[:overflow]:
                self._memory.pop(k, None)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def set(self, key: str, value: str, ttl: int) -> None:
        key = KEY_PREFIX + key
        client = self._get_redis()
        if client is not None:
            try:
                await client.set(key, value, ex=ttl)
                return
            except Exception as e:
                self._redis_failed(e)
        with self._lock:
            self._mem_prune()
            self._memory[key] = (value, time.monotonic() + ttl)

    async def get(self, key: str) -> Optional[str]:
        key = KEY_PREFIX + key
        client = self._get_redis()
        if client is not None:
            try:
                return await client.get(key)
            except Exception as e:
                self._redis_failed(e)
        with self._lock:
            return self._mem_get(key)

    async def pop(self, key: str) -> Optional[str]:
        """Atomically get and delete a key (single-use values)."""
        key = KEY_PREFIX + key
        client = self._get_redis()
        if client is not None:
            try:
                async with client.pipeline(transaction=True) as pipe:
                    pipe.get(key)
                    pipe.delete(key)
                    value, _ = await pipe.execute()
                return value
            except Exception as e:
                self._redis_failed(e)
        with self._lock:
            value = self._mem_get(key)
            self._memory.pop(key, None)
            return value

    async def delete(self, key: str) -> None:
        key = KEY_PREFIX + key
        client = self._get_redis()
        if client is not None:
            try:
                await client.delete(key)
                return
            except Exception as e:
                self._redis_failed(e)
        with self._lock:
            self._memory.pop(key, None)

    async def incr(self, key: str, ttl: int) -> int:
        """
        Increment a counter. The TTL is set when the counter is created, so
        it acts as a fixed window starting at the first increment.
        """
        key = KEY_PREFIX + key
        client = self._get_redis()
        if client is not None:
            try:
                async with client.pipeline(transaction=True) as pipe:
                    pipe.incr(key)
                    pipe.ttl(key)
                    count, remaining = await pipe.execute()
                # -1 means the key has no expiry yet (just created)
                if remaining is None or int(remaining) < 0:
                    await client.expire(key, ttl)
                return int(count)
            except Exception as e:
                self._redis_failed(e)
        with self._lock:
            current = self._mem_get(key)
            if current is None:
                self._mem_prune()
                self._memory[key] = ("1", time.monotonic() + ttl)
                return 1
            count = int(current) + 1
            self._memory[key] = (str(count), self._memory[key][1])
            return count

    def clear_memory(self) -> None:
        """Clear the in-process fallback (used by tests)."""
        with self._lock:
            self._memory.clear()


ephemeral_store = EphemeralStore()
