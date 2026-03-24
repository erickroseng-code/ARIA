from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class BaseScraper(ABC):
    """Abstract base class for all Trend Scrapers."""

    def __init__(self):
        self._pw_context = None  # shared Playwright context, set by run_agent()

    def set_playwright_context(self, context) -> None:
        """Inject a shared Playwright context so the scraper reuses an open browser."""
        self._pw_context = context

    @abstractmethod
    async def fetch_trends(self) -> List[Dict[str, Any]]:
        """
        Fetch trends from the respective source.
        Returns list of dicts with: title, content, url, engagement, published_at.
        """
        pass
