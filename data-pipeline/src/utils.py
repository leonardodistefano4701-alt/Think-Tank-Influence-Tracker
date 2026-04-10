import asyncio
import httpx
import structlog
from functools import wraps
from typing import Callable

logger = structlog.get_logger()

class RateLimiter:
    def __init__(self, calls: int, period: float):
        self.calls = calls
        self.period = period
        self._tokens = calls
        self._last_update = 0.0 # will be initialized on first wait

    async def wait(self):
        loop = asyncio.get_running_loop()
        now = loop.time()
        if self._last_update == 0.0:
            self._last_update = now
            
        elapsed = now - self._last_update
        self._tokens = min(self.calls, self._tokens + elapsed * (self.calls / self.period))
        while self._tokens <= 0:
            await asyncio.sleep(0.1)
            now = loop.time()
            elapsed = now - self._last_update
            self._tokens = min(self.calls, self._tokens + elapsed * (self.calls / self.period))
            
        self._tokens -= 1
        self._last_update = loop.time()

def with_retry(retries=3, backoffs=(1, 2, 4)):
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            for idx in range(retries):
                try:
                    return await func(*args, **kwargs)
                except httpx.HTTPStatusError as e:
                    if e.response.status_code == 429 and idx < len(backoffs):
                        logger.warning(f"Rate limited, retrying in {backoffs[idx]}s...")
                        await asyncio.sleep(backoffs[idx])
                    else:
                        raise e
                except Exception as e:
                    if idx < len(backoffs):
                        logger.warning(f"Error {e}, retrying in {backoffs[idx]}s...")
                        await asyncio.sleep(backoffs[idx])
                    else:
                        raise e
            return await func(*args, **kwargs)
        return wrapper
    return decorator

def get_async_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=10.0)
