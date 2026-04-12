"""Caching service — Redis-backed when available, in-memory fallback."""

import json
import logging
import time
from typing import Optional, Any

logger = logging.getLogger(__name__)


class CacheService:
    """Simple cache with TTL. Uses Redis if available, else in-memory dict."""

    def __init__(self):
        self._memory_cache: dict[str, tuple[Any, float]] = {}
        self._redis = None
        self._try_redis()

    def _try_redis(self):
        try:
            import redis
            import os

            redis_url = os.getenv("REDIS_URL")
            if redis_url:
                self._redis = redis.from_url(redis_url)
                self._redis.ping()
                logger.info("Redis cache connected")
        except Exception:
            logger.info("Redis not available, using in-memory cache")

    def get(self, key: str) -> Optional[Any]:
        if self._redis:
            val = self._redis.get(key)
            return json.loads(val) if val else None

        if key in self._memory_cache:
            value, expiry = self._memory_cache[key]
            if time.time() < expiry:
                return value
            del self._memory_cache[key]
        return None

    def set(self, key: str, value: Any, ttl: int = 60):
        if self._redis:
            self._redis.setex(key, ttl, json.dumps(value, default=str))
        else:
            self._memory_cache[key] = (value, time.time() + ttl)

    def delete(self, key: str):
        if self._redis:
            self._redis.delete(key)
        else:
            self._memory_cache.pop(key, None)

    def clear_pattern(self, pattern: str):
        if self._redis:
            for key in self._redis.scan_iter(pattern):
                self._redis.delete(key)
        else:
            keys = [k for k in self._memory_cache if pattern.replace("*", "") in k]
            for k in keys:
                del self._memory_cache[k]


# Singleton
cache = CacheService()
