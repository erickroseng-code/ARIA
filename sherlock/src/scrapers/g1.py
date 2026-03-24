import datetime
from typing import List, Dict, Any
from playwright.async_api import async_playwright
from playwright_stealth import stealth_async
from .base import BaseScraper
from ._chrome import new_persistent_context
from logic.retry import async_retry
import logging

logger = logging.getLogger(__name__)

class G1Scraper(BaseScraper):
    """Scraper for G1 (g1.globo.com) top news."""
    
    @async_retry(retries=3)
    async def fetch_trends(self) -> List[Dict[str, Any]]:
        logger.info("Iniciando extração do G1...")
        trends = []

        shared = self._pw_context is not None

        async def _run(context):
            page = await context.new_page()
            await stealth_async(page)
            try:
                await page.goto("https://g1.globo.com/", timeout=30000, wait_until="domcontentloaded")
                posts = await page.locator(".feed-post").all()
                for post in posts[:15]:
                    try:
                        title_elem = post.locator(".feed-post-link")
                        title = await title_elem.inner_text()
                        url = await title_elem.get_attribute("href")
                        try:
                            content = await post.locator(".feed-post-body-resumo").inner_text()
                        except Exception:
                            content = title
                        trends.append({
                            "source": "g1",
                            "title": title.strip(),
                            "content": content.strip(),
                            "url": url,
                            "engagement": 1.0,
                            "published_at": datetime.datetime.utcnow(),
                        })
                    except Exception as e:
                        logger.debug(f"Erro ao extrair post do G1: {e}")
            finally:
                await page.close()

        if shared:
            await _run(self._pw_context)
        else:
            async with async_playwright() as p:
                context = await new_persistent_context(p, headless=True)
                try:
                    await _run(context)
                finally:
                    await context.close()

        logger.info(f"Extraídas {len(trends)} tendências do G1.")
        return trends
