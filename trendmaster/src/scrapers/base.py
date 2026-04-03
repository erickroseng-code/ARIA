from abc import ABC, abstractmethod
from typing import List, Dict, Any

class BaseScraper(ABC):
    """
    Abstract base class for all Trend Scrapers.
    """
    
    @abstractmethod
    async def fetch_trends(self) -> List[Dict[str, Any]]:
        """
        Fetch trends from the respective source.
        Should return a list of dictionaries with structure:
        - title: str
        - content: str
        - url: str
        - engagement: float
        - published_at: datetime
        """
        pass
