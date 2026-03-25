import datetime
import logging
import json
from typing import List, Dict, Any

from playwright.async_api import async_playwright
from playwright_stealth import stealth_async
from .base import BaseScraper
from ._chrome import new_persistent_context

logger = logging.getLogger(__name__)


class YouTubeScraper(BaseScraper):
    """Scraper for YouTube Trending Brazil via Playwright (persistent context required)."""

    async def fetch_trends(self) -> List[Dict[str, Any]]:
        logger.info("Iniciando extracao do YouTube Trending Brasil...")
        trends = []
        shared = self._pw_context is not None

        async def _run(context):
            nonlocal trends
            page = await context.new_page()
            await stealth_async(page)
            try:
                # Navega para home primeiro — evita redirect de logados no trending direto
                await page.goto("https://www.youtube.com/", timeout=20000, wait_until="domcontentloaded")
                await page.wait_for_timeout(1500)
                await page.goto(
                    "https://www.youtube.com/feed/trending",
                    timeout=40000,
                    wait_until="domcontentloaded",
                )
                await page.wait_for_timeout(3000)

                content = await page.content()
                idx = content.find("var ytInitialData = ")
                if idx == -1:
                    logger.warning("ytInitialData não encontrado na página do YouTube Trending")
                    return

                decoder = json.JSONDecoder()
                data, _ = decoder.raw_decode(content, idx + len("var ytInitialData = "))

                tab_content = (
                    data.get("contents", {})
                    .get("twoColumnBrowseResultsRenderer", {})
                    .get("tabs", [{}])[0]
                    .get("tabRenderer", {})
                    .get("content", {})
                )

                # New layout: richGridRenderer > richItemRenderer > lockupViewModel
                grid_items = tab_content.get("richGridRenderer", {}).get("contents", [])
                for grid_item in grid_items:
                    vm = (
                        grid_item.get("richItemRenderer", {})
                        .get("content", {})
                        .get("lockupViewModel", {})
                    )
                    if not vm or vm.get("contentType") != "LOCKUP_CONTENT_TYPE_VIDEO":
                        continue
                    video_id = vm.get("contentId", "")
                    title = (
                        vm.get("metadata", {})
                        .get("lockupMetadataViewModel", {})
                        .get("title", {})
                        .get("content", "")
                    )
                    if title and video_id:
                        trends.append({
                            "source": "youtube_trending",
                            "title": title,
                            "content": title,
                            "url": f"https://www.youtube.com/watch?v={video_id}",
                            "engagement": 1000.0,
                            "published_at": datetime.datetime.utcnow(),
                        })
                    if len(trends) >= 10:
                        break

                # Legacy layout fallback: sectionListRenderer > videoRenderer
                if not trends:
                    sections = tab_content.get("sectionListRenderer", {}).get("contents", [])
                    for section in sections:
                        items = section.get("itemSectionRenderer", {}).get("contents", [])
                        for item in items:
                            video = item.get("videoRenderer", {})
                            if not video:
                                continue
                            video_id = video.get("videoId", "")
                            title_runs = video.get("title", {}).get("runs", [])
                            title = " ".join(r.get("text", "") for r in title_runs)
                            if title and video_id:
                                trends.append({
                                    "source": "youtube_trending",
                                    "title": title,
                                    "content": title,
                                    "url": f"https://www.youtube.com/watch?v={video_id}",
                                    "engagement": 1000.0,
                                    "published_at": datetime.datetime.utcnow(),
                                })
                            if len(trends) >= 10:
                                break
                        if len(trends) >= 10:
                            break

            except Exception as e:
                logger.error(f"Erro ao acessar YouTube Trending: {e}")
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

        logger.info(f"YouTube Trending: {len(trends)} videos extraidos")
        return trends
