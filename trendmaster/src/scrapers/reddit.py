import datetime
from typing import List, Dict, Any
from playwright.async_api import async_playwright
from playwright_stealth import stealth_async
from bs4 import BeautifulSoup
from .base import BaseScraper
from logic.retry import async_retry
import logging

logger = logging.getLogger(__name__)

class RedditScraper(BaseScraper):
    """Scraper for Reddit via RSS bypassing blocks with Playwright Stealth."""
    
    def __init__(self, subreddits: List[str] = ["brasil", "investimentos", "marketing"]):
        self.subreddits = subreddits
        
    @async_retry(retries=3, base_delay=5.0)
    async def _fetch_subreddit_rss(self, p, subreddit: str) -> List[Dict[str, Any]]:
        trends = []
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        await stealth_async(page)
        
        url = f"https://www.reddit.com/r/{subreddit}/hot.rss"
        try:
            response = await page.goto(url, timeout=30000)
            if response and response.ok:
                xml_content = await page.content()
                soup = BeautifulSoup(xml_content, "xml")
                
                entries = soup.find_all("entry")
                for entry in entries[:5]: # Top 5 from each sub
                    title = entry.title.text if entry.title else ""
                    content = entry.content.text if entry.content else ""
                    link = entry.link.get("href") if entry.find("link") else ""
                    
                    trends.append({
                        "source": f"reddit_r_{subreddit}",
                        "title": title,
                        "content": content,
                        "url": link,
                        "engagement": 2.0, # Relative scale
                        "published_at": datetime.datetime.utcnow()
                    })
            else:
                logger.warning(f"Reddit retornou status ruim para {subreddit}: {response.status if response else 'N/A'}")
        except Exception as e:
            logger.error(f"Erro em subreddit r/{subreddit}: {e}")
        finally:
            await browser.close()
            
        return trends

    async def fetch_trends(self) -> List[Dict[str, Any]]:
        logger.info(f"Iniciando extração do Reddit RSS para: {self.subreddits}")
        all_trends = []
        
        async with async_playwright() as p:
            for sub in self.subreddits:
                sub_trends = await self._fetch_subreddit_rss(p, sub)
                all_trends.extend(sub_trends)
                
        logger.info(f"Extraídas {len(all_trends)} tendências do Reddit.")
        return all_trends
