import datetime
import json
import logging
import re
from typing import List, Dict, Any

from playwright.async_api import async_playwright
from playwright_stealth import stealth_async
from .base import BaseScraper
from ._chrome import new_persistent_context

logger = logging.getLogger(__name__)


class TikTokScraper(BaseScraper):
    """Scraper for TikTok trending via Playwright (uses scraper profile session)."""

    def __init__(self):
        super().__init__()

    async def fetch_trends(self) -> List[Dict[str, Any]]:
        logger.info("Iniciando extração TikTok Trending via Playwright...")
        trends = []
        shared = self._pw_context is not None

        async def _run(context):
            page = await context.new_page()
            await stealth_async(page)

            # Intercept TikTok's internal explore/trending API
            api_items = []

            async def handle_response(response):
                if "api/explore/item_list" in response.url or "trending" in response.url:
                    try:
                        body = await response.json()
                        items = body.get("itemList", body.get("data", []))
                        if isinstance(items, list):
                            api_items.extend(items)
                    except Exception:
                        pass

            page.on("response", handle_response)

            try:
                await page.goto(
                    "https://www.tiktok.com/explore",
                    timeout=40000,
                    wait_until="domcontentloaded",
                )
                await page.wait_for_timeout(5000)

                # Check for login wall
                if await page.locator('[data-e2e="login-modal"]').count() > 0:
                    logger.warning("TikTok: login necessário no perfil 'scraper'.")
                    return

                # --- Primary: use intercepted API data ---
                if api_items:
                    for item in api_items[:20]:
                        try:
                            desc = item.get("desc", "")
                            if not desc:
                                continue
                            video_id = item.get("id", "")
                            author = item.get("author", {}).get("uniqueId", "")
                            url = f"https://www.tiktok.com/@{author}/video/{video_id}" if author and video_id else "https://www.tiktok.com/explore"
                            stats = item.get("stats", {})
                            plays = stats.get("playCount", stats.get("diggCount", 1000))
                            trends.append({
                                "source": "tiktok",
                                "title": desc[:80] + ("..." if len(desc) > 80 else ""),
                                "content": desc,
                                "url": url,
                                "engagement": float(plays),
                                "published_at": datetime.datetime.utcnow(),
                            })
                        except Exception:
                            continue
                    logger.info(f"TikTok: {len(trends)} vídeos extraídos via API")
                    return

                # --- Fallback: DOM scraping with broad selectors ---
                # Try multiple selector strategies since TikTok renames classes frequently
                selectors = [
                    '[data-e2e="explore-item"]',
                    '[class*="DivVideoCardDesc"]',
                    '[class*="video-card"]',
                    'div[class*="explore"] a',
                ]
                cards = []
                for sel in selectors:
                    cards = await page.locator(sel).all()
                    if cards:
                        break

                # Last resort: grab any anchor with /video/ in href
                if not cards:
                    links = await page.locator('a[href*="/video/"]').all()
                    for link in links[:20]:
                        try:
                            href = await link.get_attribute("href") or ""
                            text = (await link.inner_text()).strip()
                            if not text or len(text) < 3:
                                continue
                            url = f"https://www.tiktok.com{href}" if href.startswith("/") else href
                            trends.append({
                                "source": "tiktok",
                                "title": text[:80],
                                "content": text,
                                "url": url,
                                "engagement": 1000.0,
                                "published_at": datetime.datetime.utcnow(),
                            })
                        except Exception:
                            continue
                    logger.info(f"TikTok: {len(trends)} vídeos extraídos via links")
                    return

                for card in cards[:20]:
                    try:
                        text = (await card.inner_text()).strip().split("\n")[0]
                        if not text or len(text) < 3:
                            continue
                        link_el = card.locator("a").first
                        href = await link_el.get_attribute("href") or ""
                        url = f"https://www.tiktok.com{href}" if href.startswith("/") else href
                        trends.append({
                            "source": "tiktok",
                            "title": text[:80],
                            "content": text,
                            "url": url,
                            "engagement": 1000.0,
                            "published_at": datetime.datetime.utcnow(),
                        })
                    except Exception:
                        continue
                logger.info(f"TikTok: {len(trends)} vídeos extraídos via DOM")

            except Exception as e:
                logger.error(f"Erro TikTok: {e}")
            finally:
                page.remove_listener("response", handle_response)
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

        logger.info(f"TikTok total: {len(trends)} tendências")
        return trends


def _parse_count(text: str) -> int:
    text = text.strip().upper().replace(",", ".")
    m = re.search(r"([\d.]+)\s*([KkMm]?)", text)
    if not m:
        return 1_000
    num = float(m.group(1))
    suffix = m.group(2).upper()
    if suffix == "K":
        return int(num * 1_000)
    if suffix == "M":
        return int(num * 1_000_000)
    return int(num) if num > 0 else 1_000
