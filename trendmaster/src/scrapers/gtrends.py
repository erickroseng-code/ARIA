import asyncio
import datetime
import logging
from typing import List, Dict, Any
from pytrends.request import TrendReq
from .base import BaseScraper
from logic.retry import async_retry

logger = logging.getLogger(__name__)

class GTrendsScraper(BaseScraper):
    """Scraper for Google Trends using PyTrends."""
    
    def __init__(self):
        # We initialize pytrends here. 
        # Using proxy or specific settings might be needed if heavily rate limited.
        self.pytrends = TrendReq(hl='pt-BR', tz=180)

    def _get_realtime_trends(self) -> List[Dict[str, Any]]:
        trends_list = []
        try:
            # Gets realtime trends for Brazil
            realtime_df = self.pytrends.realtime_trending_searches(pn='BR')
            
            if not realtime_df.empty:
                for _, row in realtime_df.iterrows():
                    title = row.get("entityNames", [""])[0] if isinstance(row.get("entityNames"), list) and row.get("entityNames") else str(row.get("title", ""))
                    articles = row.get("articles", [])
                    content = articles[0].get("snippet", title) if articles else title
                    url = articles[0].get("url", "") if articles else ""
                    
                    trends_list.append({
                        "source": "google_trends",
                        "title": title,
                        "content": content,
                        "url": url,
                        "engagement": 5.0, # Generally high engagement for active trends
                        "published_at": datetime.datetime.utcnow()
                    })
        except Exception as e:
            logger.error(f"Erro ao buscar realtime trends: {e}")
            
        return trends_list

    @async_retry(retries=3)
    async def fetch_trends(self) -> List[Dict[str, Any]]:
        logger.info("Iniciando extração do Google Trends (PyTrends)...")
        # pytrends is synchronous, moving it to thread to avoid blocking asyncio loop
        trends = await asyncio.to_thread(self._get_realtime_trends)
        logger.info(f"Extraídas {len(trends)} tendências do Google Trends.")
        return trends
