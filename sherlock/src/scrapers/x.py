import datetime
import logging
import re
from typing import Any, Dict, List

from playwright.async_api import async_playwright
from playwright_stealth import stealth_async

from ._chrome import new_persistent_context
from .base import BaseScraper

logger = logging.getLogger(__name__)


class XScraper(BaseScraper):
    """Scraper for X (Twitter) trending topics with resilient fallback."""

    async def fetch_trends(self) -> List[Dict[str, Any]]:
        logger.info("Iniciando extracao das trends do X via Playwright...")
        trends: List[Dict[str, Any]] = []
        seen_topics: set[str] = set()

        shared = self._pw_context is not None

        async def _extract_x_native(page) -> None:
            await page.goto("https://x.com/explore/tabs/trending", timeout=30000, wait_until="domcontentloaded")
            await page.wait_for_timeout(3500)

            candidates = await page.locator('[data-testid="trend"]').all()
            if not candidates:
                candidates = await page.locator('div[data-testid="cellInnerDiv"]').all()

            for el in candidates[:30]:
                try:
                    text = (await el.inner_text()).strip()
                    lines = [l.strip() for l in text.split("\n") if l.strip()]
                    if not lines:
                        continue

                    topic = ""
                    for item in lines:
                        low = item.lower()
                        if any(skip in low for skip in ["trending", "promoted", "patrocinado", "show more", "mostrar mais"]):
                            continue
                        if len(item) >= 3:
                            topic = item
                            break
                    if not topic:
                        continue

                    normalized = topic.lower()
                    if normalized in seen_topics:
                        continue
                    seen_topics.add(normalized)

                    tweets_text = next(
                        (
                            l
                            for l in lines
                            if "tweets" in l.lower() or "posts" in l.lower() or re.search(r"\d+[.,]?\d*\s*[kKmM]", l)
                        ),
                        "",
                    )
                    engagement = _parse_count(tweets_text)

                    trends.append(
                        {
                            "source": "x_twitter",
                            "title": topic,
                            "content": " | ".join(lines[:3]),
                            "url": f"https://x.com/search?q={topic.replace(' ', '+')}&f=live",
                            "engagement": float(engagement),
                            "published_at": datetime.datetime.utcnow(),
                        }
                    )
                except Exception:
                    continue

        async def _extract_fallback(page) -> None:
            # Fallback publico para quando X bloqueia scraping anonimo.
            await page.goto("https://trends24.in/brazil/", timeout=30000, wait_until="domcontentloaded")
            await page.wait_for_timeout(2500)

            links = await page.locator('a[href*="/search?q="]').all()
            for link in links[:40]:
                try:
                    topic = (await link.inner_text()).strip()
                    if len(topic) < 3:
                        continue
                    normalized = topic.lower()
                    if normalized in seen_topics:
                        continue
                    seen_topics.add(normalized)

                    trends.append(
                        {
                            "source": "x_twitter",
                            "title": topic,
                            "content": "Trend topic (fallback)",
                            "url": f"https://x.com/search?q={topic.replace(' ', '+')}&f=live",
                            "engagement": 1000.0,
                            "published_at": datetime.datetime.utcnow(),
                        }
                    )
                except Exception:
                    continue

        async def _run(context) -> None:
            page = await context.new_page()
            await stealth_async(page)
            try:
                try:
                    await _extract_x_native(page)
                except Exception as e:
                    logger.warning(f"X native failed: {e}")
                if not trends:
                    await _extract_fallback(page)
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

        logger.info(f"X trending total: {len(trends)} trends")
        return trends


def _parse_count(text: str) -> int:
    """Parse '12.5K', '1.2M', '234 tweets' to int."""
    text = text.strip()
    match = re.search(r"([\d.,]+)\s*([KkMm]?)", text)
    if not match:
        return 100
    num = float(match.group(1).replace(",", "."))
    suffix = match.group(2).upper()
    if suffix == "K":
        return int(num * 1000)
    if suffix == "M":
        return int(num * 1_000_000)
    return int(num)