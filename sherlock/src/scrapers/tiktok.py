import datetime
import os
import logging
from typing import List, Dict, Any
from apify_client import ApifyClientAsync
from .base import BaseScraper
from logic.retry import async_retry

logger = logging.getLogger(__name__)

class TikTokScraper(BaseScraper):
    """Scraper for TikTok via Apify."""
    
    def __init__(self):
        self.profiles = ["tiktok"] # Default profile for TikTok
        token = os.environ.get("APIFY_TOKEN")
        if not token:
            logger.warning("APIFY_TOKEN não configurado. TikTokScraper pode falhar.")
        self.client = ApifyClientAsync(token)
        
    @async_retry(retries=3)
    async def fetch_trends(self) -> List[Dict[str, Any]]:
        logger.info("Iniciando extração do TikTok via Apify...")
        trends = []
        
        run_input = {
            "profiles": self.profiles,
            "resultsPerPage": 5,
            "shouldDownloadVideos": False,
        }
        
        try:
            run = await self.client.actor("clockwork/tiktok-profile-scraper").call(run_input=run_input)
            
            async for item in self.client.dataset(run["defaultDatasetId"]).iterate_items():
                title = item.get("text", "TikTok Video")
                content = item.get("text", "")
                url = item.get("webVideoUrl", "")
                diggCount = item.get("diggCount", 0)
                shareCount = item.get("shareCount", 0)
                
                engagement = float(diggCount + (shareCount * 5))
                
                trends.append({
                    "source": "tiktok",
                    "title": title[:50] + "..." if len(title) > 50 else title,
                    "content": content,
                    "url": url,
                    "engagement": engagement,
                    "published_at": datetime.datetime.utcnow()
                })
        except Exception as e:
            logger.error(f"Erro ao extrair TikTok: {e}")
            
        logger.info(f"Extraídas {len(trends)} tendências do TikTok.")
        return trends
