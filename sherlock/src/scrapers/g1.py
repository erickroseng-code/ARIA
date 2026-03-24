import datetime
from typing import List, Dict, Any
from playwright.async_api import async_playwright
from playwright_stealth import stealth_async
from .base import BaseScraper
from logic.retry import async_retry
import logging

logger = logging.getLogger(__name__)

class G1Scraper(BaseScraper):
    """Scraper for G1 (g1.globo.com) top news."""
    
    @async_retry(retries=3)
    async def fetch_trends(self) -> List[Dict[str, Any]]:
        logger.info("Iniciando extração do G1...")
        trends = []
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = await context.new_page()
            await stealth_async(page)
            
            try:
                await page.goto("https://g1.globo.com/", timeout=30000, wait_until="domcontentloaded")
                
                # Extract news elements
                posts = await page.locator(".feed-post").all()
                for post in posts[:15]: # Top 15 news
                    try:
                        title_elem = post.locator(".feed-post-link")
                        title = await title_elem.inner_text()
                        url = await title_elem.get_attribute("href")
                        
                        try:
                            summary_elem = post.locator(".feed-post-body-resumo")
                            content = await summary_elem.inner_text()
                        except:
                            content = title
                            
                        # G1 doesn't expose easy engagement stats on the front page, so we rank by position (top = higher)
                        trends.append({
                            "source": "g1",
                            "title": title.strip(),
                            "content": content.strip(),
                            "url": url,
                            "engagement": 1.0,  # Base scale 
                            "published_at": datetime.datetime.utcnow()
                        })
                    except Exception as e:
                        logger.debug(f"Erro ao extrair post do G1: {e}")
                        continue
                        
            finally:
                await browser.close()
                
        logger.info(f"Extraídas {len(trends)} tendências do G1.")
        return trends
