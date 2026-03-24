import asyncio
import datetime
import logging
import re
from typing import List, Dict, Any
from playwright.async_api import async_playwright
from playwright_stealth import stealth_async
from .base import BaseScraper
from ._chrome import new_persistent_context

logger = logging.getLogger(__name__)

# Subreddits representing what's trending globally and in Brazil.
# r/popular → cross-reddit hot posts (global)
# r/brasil, r/investimentos, r/empreendedorismo → BR community trending
SUBREDDITS = ["popular", "brasil", "investimentos", "empreendedorismo"]


class RedditScraper(BaseScraper):
    """Scraper for Reddit Brazil subreddits via Playwright."""

    def __init__(self, subreddits: List[str] = SUBREDDITS):
        super().__init__()
        self.subreddits = subreddits

    async def fetch_trends(self) -> List[Dict[str, Any]]:
        logger.info(f"Iniciando extração Reddit via Playwright: {self.subreddits}")
        shared = self._pw_context is not None

        async def _scrape_all(context):
            page = await context.new_page()
            await stealth_async(page)
            all_trends = []
            try:
                for sub in self.subreddits:
                    sub_trends = await _scrape_subreddit(page, sub)
                    all_trends.extend(sub_trends)
            finally:
                await page.close()
            return all_trends

        if shared:
            trends = await _scrape_all(self._pw_context)
        else:
            async with async_playwright() as p:
                context = await new_persistent_context(p, headless=True)
                try:
                    trends = await _scrape_all(context)
                finally:
                    await context.close()

        logger.info(f"Reddit total: {len(trends)} posts extraídos")
        return trends


async def _scrape_subreddit(page, subreddit: str) -> List[Dict[str, Any]]:
    trends = []
    
    try:
        await page.goto(
            f"https://www.reddit.com/r/{subreddit}/hot/",
            timeout=30000,
            wait_until="domcontentloaded",
        )
        await page.wait_for_timeout(2500)

        # New Reddit layout — article cards
        posts = await page.locator('article, [data-testid="post-container"], shreddit-post').all()

        # Fallback: old Reddit
        if not posts:
            await page.goto(
                f"https://old.reddit.com/r/{subreddit}/hot/",
                timeout=25000,
                wait_until="domcontentloaded",
            )
            await page.wait_for_timeout(1500)
            posts = await page.locator(".thing.link").all()

        for post in posts[:8]:
            try:
                # Title
                title_el = post.locator('a[data-click-id="body"], h3, .title > a').first
                title = (await title_el.inner_text()).strip()
                if not title or len(title) < 5:
                    continue

                # URL
                href = await title_el.get_attribute("href") or ""
                url = f"https://www.reddit.com{href}" if href.startswith("/") else href

                # Score
                score_text = ""
                try:
                    score_el = post.locator('[id*="vote-arrows"] faceplate-number, .score.unvoted').first
                    score_text = await score_el.inner_text()
                except Exception:
                    pass
                score = _parse_score(score_text)

                trends.append({
                    "source": f"reddit_r_{subreddit}",
                    "title": title,
                    "content": title,
                    "url": url,
                    "engagement": float(score),
                    "published_at": datetime.datetime.utcnow(),
                })
            except Exception:
                continue

        logger.info(f"Reddit r/{subreddit}: {len(trends)} posts")
    except Exception as e:
        logger.error(f"Erro Reddit r/{subreddit}: {e}")

    return trends


def _parse_score(text: str) -> int:
    text = text.strip().upper().replace(",", ".")
    m = re.search(r"([\d.]+)\s*([KkMm]?)", text)
    if not m:
        return 100
    num = float(m.group(1))
    suffix = m.group(2).upper()
    if suffix == "K":
        return int(num * 1_000)
    if suffix == "M":
        return int(num * 1_000_000)
    return int(num) if num > 0 else 100
