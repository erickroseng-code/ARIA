import datetime
import logging
import xml.etree.ElementTree as ET
from typing import List, Dict, Any

import httpx
from playwright_stealth import stealth_async
from .base import BaseScraper
from ._chrome import new_persistent_context
from playwright.async_api import async_playwright

logger = logging.getLogger(__name__)

# G1 RSS feeds — estáveis, sem necessidade de JS
_RSS_FEEDS = [
    "https://g1.globo.com/rss/g1/",
    "https://g1.globo.com/rss/g1/brasil/",
    "https://g1.globo.com/rss/g1/economia/",
    "https://g1.globo.com/rss/g1/politica/",
]

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/rss+xml, application/xml, text/xml",
}


class G1Scraper(BaseScraper):
    """Scraper for G1 (g1.globo.com) — RSS primary, Playwright fallback."""

    async def fetch_trends(self) -> List[Dict[str, Any]]:
        logger.info("Iniciando extração do G1 via RSS...")
        trends = await self._fetch_rss()
        if trends:
            logger.info(f"G1 RSS: {len(trends)} notícias extraídas")
            return trends

        logger.warning("G1 RSS vazio — tentando Playwright fallback...")
        trends = await self._fetch_playwright()
        logger.info(f"G1 Playwright: {len(trends)} notícias extraídas")
        return trends

    async def _fetch_rss(self) -> List[Dict[str, Any]]:
        """Fetches G1 news via public RSS feeds — no browser needed."""
        trends = []
        seen_titles: set = set()
        try:
            async with httpx.AsyncClient(timeout=20, headers=_HEADERS, follow_redirects=True) as client:
                for feed_url in _RSS_FEEDS:
                    try:
                        resp = await client.get(feed_url)
                        if resp.status_code != 200:
                            logger.debug(f"G1 RSS {feed_url} → HTTP {resp.status_code}")
                            continue
                        root = ET.fromstring(resp.text)
                        for item in root.findall(".//item")[:8]:
                            title = (item.findtext("title") or "").strip()
                            if not title or title in seen_titles:
                                continue
                            seen_titles.add(title)
                            link = (item.findtext("link") or "").strip()
                            description = (item.findtext("description") or title).strip()
                            # Strip HTML tags from description
                            import re
                            description = re.sub(r"<[^>]+>", "", description).strip() or title
                            trends.append({
                                "source": "g1",
                                "title": title,
                                "content": description[:300],
                                "url": link or "https://g1.globo.com/",
                                "engagement": 1.0,
                                "published_at": datetime.datetime.utcnow(),
                            })
                    except Exception as e:
                        logger.debug(f"G1 RSS feed {feed_url} erro: {e}")
        except Exception as e:
            logger.warning(f"G1 RSS erro geral: {e}")
        return trends

    async def _fetch_playwright(self) -> List[Dict[str, Any]]:
        """Playwright fallback — tries multiple CSS selectors for G1's layout."""
        trends = []
        shared = self._pw_context is not None

        async def _run(context):
            page = await context.new_page()
            await stealth_async(page)
            try:
                await page.goto("https://g1.globo.com/", timeout=30000, wait_until="domcontentloaded")
                await page.wait_for_timeout(2000)

                # Tenta diferentes seletores para o layout atual do G1
                selectors = [
                    (".feed-post-link", ".feed-post-body-resumo"),
                    ("a.feed-post-link", None),
                    (".bastian-feed-item a[href*='g1.globo.com']", None),
                    ("article h2 a", "article p"),
                    (".post-tile a", None),
                ]

                for title_sel, content_sel in selectors:
                    elements = await page.locator(title_sel).all()
                    if not elements:
                        continue
                    for el in elements[:12]:
                        try:
                            title = (await el.inner_text()).strip()
                            url = await el.get_attribute("href") or ""
                            if not title or len(title) < 5:
                                continue
                            content = title
                            if content_sel:
                                try:
                                    parent = el.locator("..")
                                    content_el = parent.locator(content_sel)
                                    content = (await content_el.inner_text()).strip() or title
                                except Exception:
                                    pass
                            trends.append({
                                "source": "g1",
                                "title": title,
                                "content": content,
                                "url": url if url.startswith("http") else f"https://g1.globo.com{url}",
                                "engagement": 1.0,
                                "published_at": datetime.datetime.utcnow(),
                            })
                        except Exception:
                            continue
                    if trends:
                        break
            except Exception as e:
                logger.error(f"G1 Playwright erro: {e}")
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

        return trends
