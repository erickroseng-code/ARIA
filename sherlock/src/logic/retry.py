import asyncio
import logging
import random
from functools import wraps
from typing import Callable, Any

logger = logging.getLogger(__name__)

def async_retry(retries: int = 3, base_delay: float = 2.0, max_delay: float = 10.0, backoff_factor: float = 2.0):
    """
    Decorator that retries an async function with exponential backoff.
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            delay = base_delay
            for attempt in range(retries):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    if attempt == retries - 1:
                        logger.error(f"Failed after {retries} attempts. Last error: {e}")
                        raise
                    
                    jitter = random.uniform(0, 0.5)
                    sleep_time = min(delay + jitter, max_delay)
                    logger.warning(f"Attempt {attempt + 1} failed: {e}. Retrying in {sleep_time:.2f}s...")
                    
                    await asyncio.sleep(sleep_time)
                    delay *= backoff_factor
        return wrapper
    return decorator
