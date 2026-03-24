import datetime
import re
import logging
from typing import List, Dict, Any
from playwright.async_api import async_playwright
from playwright_stealth import stealth_async
from .base import BaseScraper
from ._chrome import new_persistent_context

logger = logging.getLogger(__name__)

class XScraper(BaseScraper):
    """Scraper for X (Twitter) Brazil trending topics via Playwright (no auth needed)."""

    async def fetch_trends(self) -> List[Dict[str, Any]]:
        logger.info("Iniciando extracao das trends do X Brasil via Playwright...")
        trends = []

        shared = self._pw_context is not None

        async def _run(context):
            page = await context.new_page()
            await stealth_async(page)
            nonlocal trends
            try:
                # Tentar página de trends do X
                await page.goto("https://x.com/explore/tabs/trending", timeout=30000, wait_until="domcontentloaded")
                await page.wait_for_timeout(4000)

                # Extrair trends do painel lateral ou da página
                trend_elements = await page.locator('[data-testid="trend"]').all()

                if not trend_elements:
                    # Fallback: tentar explorar via estrutura de células
                    trend_elements = await page.locator('div[data-testid="cellInnerDiv"]').all()

                for el in trend_elements[:20]:
                    try:
                        text = await el.inner_text()
                        lines = [l.strip() for l in text.split('\n') if l.strip()]
                        if not lines:
                            continue

                        # Primeiro item costuma ser a categoria, segundo o topic
                        topic = lines[1] if len(lines) > 1 else lines[0]
                        if len(topic) < 3 or topic.startswith('#') is False and any(
                            skip in topic.lower() for skip in ['trending', 'promoted', 'patrocinado', 'show more']
                        ):
                            continue

                        # Engagement aproximado pelo numero de tweets se disponivel
                        tweets_text = next((l for l in lines if 'K' in l or 'M' in l or 'tweets' in l.lower() or 'posts' in l.lower()), "")
                        engagement = _parse_count(tweets_text)

                        trends.append({
                            "source": "x_twitter",
                            "title": topic,
                            "content": " | ".join(lines[:3]),
                            "url": f"https://x.com/search?q={topic.replace(' ', '+')}&f=live",
                            "engagement": float(engagement),
                            "published_at": datetime.datetime.utcnow(),
                        })
                    except Exception:
                        continue

            except Exception as e:
                logger.error(f"Erro ao acessar X Trending: {e}")
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

        logger.info(f"X Twitter Trending: {len(trends)} trends extraidas")
        return trends


def _parse_count(text: str) -> int:
    """Parse '12.5K', '1.2M', '234 tweets' → int"""
    text = text.strip()
    match = re.search(r'([\d.,]+)\s*([KkMm]?)', text)
    if not match:
        return 100
    num = float(match.group(1).replace(',', '.'))
    suffix = match.group(2).upper()
    if suffix == 'K':
        return int(num * 1000)
    if suffix == 'M':
        return int(num * 1_000_000)
    return int(num)
