import datetime
import os
import logging
from typing import List, Dict, Any
from apify_client import ApifyClientAsync
from .base import BaseScraper
from logic.retry import async_retry

logger = logging.getLogger(__name__)

class XScraper(BaseScraper):
    """Scraper for X (Twitter) via Apify."""
    
    def __init__(self, search_terms: List[str] = ["tecnologia", "marketing"]):
        self.search_terms = search_terms
        token = os.environ.get("APIFY_TOKEN")
        self.client = ApifyClientAsync(token)
        
    @async_retry(retries=3)
    async def fetch_trends(self) -> List[Dict[str, Any]]:
        logger.info(f"Iniciando extração do X (Twitter) via Apify para termos: {self.search_terms}")
        trends = []
        
        run_input = {
            "searchTerms": self.search_terms,
            "tweetsDesired": 10,
        }
        
        try:
            run = await self.client.actor("apidojo/tweet-scraper").call(run_input=run_input)
            
            async for item in self.client.dataset(run["defaultDatasetId"]).iterate_items():
                content = item.get("text", "")
                url = item.get("url", "")
                likes = item.get("favorite_count", 0)
                retweets = item.get("retweet_count", 0)
                
                engagement = float(likes + (retweets * 3))
                
                trends.append({
                    "source": "x_twitter",
                    "title": content[:50] + "..." if len(content) > 50 else content,
                    "content": content,
                    "url": url,
                    "engagement": engagement,
                    "published_at": datetime.datetime.utcnow()
                })
        except Exception as e:
            logger.error(f"Erro ao extrair X: {e}")
            
        logger.info(f"Extraídas {len(trends)} tendências do X.")
        return trends
