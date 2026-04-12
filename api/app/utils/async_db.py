"""Async wrapper for synchronous database operations."""

import asyncio
from functools import wraps
from typing import Callable, TypeVar
from concurrent.futures import ThreadPoolExecutor

T = TypeVar("T")

# Shared executor for DB operations
_db_executor = ThreadPoolExecutor(max_workers=10, thread_name_prefix="db")


async def run_sync(func: Callable[..., T], *args, **kwargs) -> T:
    """Run a synchronous function in the thread pool executor."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_db_executor, lambda: func(*args, **kwargs))


def async_db(func):
    """Decorator to run a sync function in the DB thread pool."""

    @wraps(func)
    async def wrapper(*args, **kwargs):
        return await run_sync(func, *args, **kwargs)

    return wrapper
