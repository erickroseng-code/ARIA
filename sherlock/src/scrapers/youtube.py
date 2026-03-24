import datetime
import logging
import json
import re
from typing import List, Dict, Any
from playwright.async_api import async_playwright
from playwright_stealth import stealth_async
from .base import BaseScraper

logger = logging.getLogger(__name__)

class YouTubeScraper(BaseScraper):
    """Scraper for YouTube Trending Brazil via Playwright (no API key needed)."""

    async def fetch_trends(self) -> List[Dict[str, Any]]:
        logger.info("Iniciando extracao do YouTube Trending Brasil...")
        trends = []

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                locale="pt-BR",
            )
            page = await context.new_page()
            await stealth_async(page)

            try:
                await page.goto(
                    "https://www.youtube.com/feed/trending?gl=BR&hl=pt-BR",
                    timeout=40000,
                    wait_until="domcontentloaded"
                )

                # Extrair ytInitialData do script inline
                content = await page.content()
                match = re.search(r'var ytInitialData = ({.*?});</script>', content, re.DOTALL)

                if match:
                    try:
                        data = json.loads(match.group(1))
                        sections = (
                            data.get("contents", {})
                            .get("twoColumnBrowseResultsRenderer", {})
                            .get("tabs", [{}])[0]
                            .get("tabRenderer", {})
                            .get("content", {})
                            .get("sectionListRenderer", {})
                            .get("contents", [])
                        )

                        for section in sections:
                            items = (
                                section.get("itemSectionRenderer", {})
                                .get("contents", [])
                            )
                            for item in items:
                                video = item.get("videoRenderer", {})
                                if not video:
                                    continue

                                video_id = video.get("videoId", "")
                                title_runs = video.get("title", {}).get("runs", [])
                                title = " ".join(r.get("text", "") for r in title_runs)
                                views_text = video.get("viewCountText", {}).get("simpleText", "0")
                                views_str = re.sub(r"[^0-9]", "", views_text.split(" ")[0])
                                views = int(views_str) if views_str else 0

                                if title and video_id:
                                    trends.append({
                                        "source": "youtube_trending",
                                        "title": title,
                                        "content": title,
                                        "url": f"https://www.youtube.com/watch?v={video_id}",
                                        "engagement": float(views),
                                        "published_at": datetime.datetime.utcnow(),
                                    })

                                if len(trends) >= 10:
                                    break
                            if len(trends) >= 10:
                                break
                    except (json.JSONDecodeError, KeyError, IndexError) as e:
                        logger.error(f"Erro ao parsear ytInitialData: {e}")
                else:
                    # Fallback: extrair via DOM
                    video_elements = await page.locator("ytd-video-renderer").all()
                    for el in video_elements[:10]:
                        try:
                            title = await el.locator("#video-title").inner_text()
                            href = await el.locator("#video-title").get_attribute("href")
                            url = f"https://www.youtube.com{href}" if href else ""
                            if title:
                                trends.append({
                                    "source": "youtube_trending",
                                    "title": title.strip(),
                                    "content": title.strip(),
                                    "url": url,
                                    "engagement": 1000.0,
                                    "published_at": datetime.datetime.utcnow(),
                                })
                        except Exception:
                            continue

            except Exception as e:
                logger.error(f"Erro ao acessar YouTube Trending: {e}")
            finally:
                await browser.close()

        logger.info(f"YouTube Trending: {len(trends)} videos extraidos")
        return trends
