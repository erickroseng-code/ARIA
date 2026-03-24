import datetime
import os
import logging
from typing import List, Dict, Any
from apify_client import ApifyClientAsync
from .base import BaseScraper
from logic.retry import async_retry

logger = logging.getLogger(__name__)

class InstagramScraper(BaseScraper):
    """Scraper for Instagram via Apify."""
    
    def __init__(self, hashtags: List[str] = ["viral", "trend", "marketing"]):
        self.hashtags = hashtags
        token = os.environ.get("APIFY_TOKEN")
        if not token:
            logger.warning("APIFY_TOKEN não configurado. InstagramScraper pode falhar.")
        self.client = ApifyClientAsync(token)
        
    @async_retry(retries=3)
    async def fetch_trends(self) -> List[Dict[str, Any]]:
        logger.info(f"Iniciando extração do Instagram via Apify para hashtags: {self.hashtags}")
        trends = []
        
        run_input = {
            "hashtags": self.hashtags,
            "resultsLimit": 5,
        }
        
        try:
            # Substitua por um ator mais adequado se necessário. (ex: apify/instagram-hashtag-scraper)
            run = await self.client.actor("apify/instagram-hashtag-scraper").call(run_input=run_input)
            
            async for item in self.client.dataset(run["defaultDatasetId"]).iterate_items():
                title = item.get("caption", "Instagram Post")
                content = item.get("caption", "")
                url = item.get("url", "")
                likes = item.get("likesCount", 0)
                comments = item.get("commentsCount", 0)
                
                # Simple engagement metric
                engagement = float(likes + (comments * 2))
                
                trends.append({
                    "source": "instagram",
                    "title": title[:50] + "..." if len(title) > 50 else title,
                    "content": content,
                    "url": url,
                    "engagement": engagement,
                    "published_at": datetime.datetime.utcnow() # Extract actual date if provided by Apify
                })
        except Exception as e:
            logger.error(f"Erro ao extrair Instagram: {e}")
            
        logger.info(f"Extraídas {len(trends)} tendências do Instagram.")
        return trends
