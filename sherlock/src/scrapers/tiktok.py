import datetime
import logging
import re
from typing import Any, Dict, List, Optional

from playwright.async_api import async_playwright

from ._chrome import new_persistent_context
from .base import BaseScraper

logger = logging.getLogger(__name__)


class TikTokScraper(BaseScraper):
    """Scraper for TikTok videos via TikTokApi (primary) with Playwright fallback."""

    def __init__(
        self,
        keywords: Optional[List[str]] = None,
        periods: Optional[List[int]] = None,
        min_views: int = 100_000,
    ):
        super().__init__()
        self.keywords = keywords
        self.periods = periods or [30]
        self.min_views = min_views

    async def fetch_trends(self) -> List[Dict[str, Any]]:
        max_days = max(self.periods) if self.periods else 30
        cutoff_date = datetime.datetime.utcnow() - datetime.timedelta(days=max_days)

        try:
            from TikTokApi import TikTokApi
        except ImportError:
            logger.warning("TikTokApi nao instalado. Usando fallback Playwright para TikTok.")
            return await self._fetch_playwright_fallback(cutoff_date)

        logger.info(
            f"TikTok: keywords={self.keywords or 'trending'} | min {self.min_views // 1000}k views"
        )

        all_videos: List[Dict[str, Any]] = []

        try:
            async with TikTokApi() as api:
                await api.create_sessions(
                    num_sessions=1,
                    sleep_after=3,
                    headless=True,
                    suppress_resource_load_types=["image", "media", "font", "stylesheet"],
                )

                if self.keywords:
                    for keyword in self.keywords[:3]:
                        videos = await self._fetch_hashtag(api, keyword, cutoff_date)
                        all_videos.extend(videos)
                        logger.info(f"TikTok #{keyword}: {len(videos)} videos")
                else:
                    videos = await self._fetch_trending(api, cutoff_date)
                    all_videos.extend(videos)
                    logger.info(f"TikTok trending: {len(videos)} videos")

        except Exception as e:
            logger.error(f"TikTok erro geral: {e}")
            if not all_videos:
                logger.warning("TikTokApi falhou sem resultados. Tentando fallback Playwright...")
                return await self._fetch_playwright_fallback(cutoff_date)

        if not all_videos:
            logger.warning("TikTokApi retornou vazio. Tentando fallback Playwright...")
            return await self._fetch_playwright_fallback(cutoff_date)

        logger.info(f"TikTok total: {len(all_videos)} videos")
        return all_videos

    async def _fetch_hashtag(self, api, keyword: str, cutoff_date: datetime.datetime) -> List[Dict[str, Any]]:
        videos = []
        try:
            tag = api.hashtag(name=keyword)
            async for video in tag.videos(count=30):
                item = self._video_to_dict(video, keyword=keyword, cutoff_date=cutoff_date)
                if item and item["engagement"] >= self.min_views:
                    videos.append(item)
        except Exception as e:
            logger.error(f"TikTok hashtag '{keyword}': {e}")
        return videos

    async def _fetch_trending(self, api, cutoff_date: datetime.datetime) -> List[Dict[str, Any]]:
        videos = []
        try:
            async for video in api.trending.videos(count=30):
                item = self._video_to_dict(video, keyword="trending", cutoff_date=cutoff_date)
                if item and item["engagement"] >= self.min_views:
                    videos.append(item)
        except Exception as e:
            logger.error(f"TikTok trending: {e}")
        return videos

    def _video_to_dict(self, video, keyword: str, cutoff_date: datetime.datetime) -> Optional[Dict[str, Any]]:
        try:
            stats = video.stats or {}
            plays = int(stats.get("playCount") or 0)
            video_id = str(video.id)
            url = f"https://www.tiktok.com/@{video.author.username}/video/{video_id}"

            d = video.as_dict
            desc = (d.get("desc") or keyword)[:120]
            published_at = _extract_published_at(d)
            # Filtro de periodo estrito: sem data detectavel, descartamos.
            if not published_at:
                return None
            if published_at < cutoff_date:
                return None

            return {
                "source": "tiktok",
                "title": f"TikTok: {desc}",
                "content": f"#{keyword} | {_format_views(plays)} views | @{video.author.username}",
                "url": url,
                "engagement": float(plays),
                "viral_score": plays / 1_000_000,
                "published_at": published_at,
            }
        except Exception:
            return None

    async def _fetch_playwright_fallback(self, cutoff_date: datetime.datetime) -> List[Dict[str, Any]]:
        videos: List[Dict[str, Any]] = []
        seen_urls: set[str] = set()

        shared = self._pw_context is not None

        async def _scrape_page(page, keyword: str) -> None:
            query = keyword.replace(" ", "%20")
            url = f"https://www.tiktok.com/search/video?q={query}"
            await page.goto(url, timeout=30000, wait_until="domcontentloaded")
            await page.wait_for_timeout(3500)
            for _ in range(4):
                await page.mouse.wheel(0, 1600)
                await page.wait_for_timeout(900)

            links = await page.locator('a[href*="/video/"]').all()
            for link in links[:35]:
                try:
                    href = await link.get_attribute("href") or ""
                    if not href:
                        continue
                    video_url = href if href.startswith("http") else f"https://www.tiktok.com{href}"
                    if video_url in seen_urls:
                        continue

                    txt = ""
                    try:
                        txt = (await link.inner_text()).strip()
                    except Exception:
                        pass

                    plays = _parse_views_text(txt)
                    if plays > 0 and plays < self.min_views:
                        continue

                    published_at = _parse_relative_date(txt)
                    # Filtro de periodo estrito no fallback.
                    if not published_at:
                        continue
                    if published_at < cutoff_date:
                        continue

                    seen_urls.add(video_url)
                    videos.append(
                        {
                            "source": "tiktok",
                            "title": f"TikTok: {keyword}",
                            "content": f"#{keyword} | {_format_views(plays) if plays > 0 else 'views n/d'}",
                            "url": video_url,
                            "engagement": float(plays),
                            "viral_score": plays / 1_000_000 if plays > 0 else 0.0,
                            "published_at": published_at,
                        }
                    )
                except Exception:
                    continue

        async def _run(context) -> None:
            page = await context.new_page()
            try:
                keywords = self.keywords[:3] if self.keywords else ["trending"]
                for kw in keywords:
                    await _scrape_page(page, kw)
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

        logger.info(f"TikTok fallback Playwright: {len(videos)} videos")
        return videos


def _format_views(views: int) -> str:
    if views >= 1_000_000:
        return f"{views/1_000_000:.1f}M"
    if views >= 1_000:
        return f"{views/1_000:.0f}k"
    return str(views)


def _parse_views_text(text: str) -> int:
    if not text:
        return 0
    t = text.lower().replace(",", ".")
    m = re.search(r"([\d.]+)\s*m", t)
    if m:
        return int(float(m.group(1)) * 1_000_000)
    m = re.search(r"([\d.]+)\s*k", t)
    if m:
        return int(float(m.group(1)) * 1_000)
    m = re.search(r"([\d.]+)\s*(views|visuali|reproduc|plays?)", t)
    if m:
        return int(float(m.group(1)))
    return 0


def _extract_published_at(video_dict: Dict[str, Any]) -> Optional[datetime.datetime]:
    candidates = [
        video_dict.get("createTime"),
        (video_dict.get("itemInfo") or {}).get("itemStruct", {}).get("createTime"),
    ]
    for candidate in candidates:
        if candidate is None:
            continue
        try:
            # TikTok usually returns unix timestamp in seconds.
            ts = int(candidate)
            if ts > 0:
                return datetime.datetime.utcfromtimestamp(ts)
        except Exception:
            continue
    return None


def _parse_relative_date(text: str) -> Optional[datetime.datetime]:
    if not text:
        return None
    t = text.lower()
    now = datetime.datetime.utcnow()

    m = re.search(r"(\d+)\s*d", t)
    if m:
        return now - datetime.timedelta(days=int(m.group(1)))
    m = re.search(r"(\d+)\s*w", t)
    if m:
        return now - datetime.timedelta(weeks=int(m.group(1)))
    m = re.search(r"(\d+)\s*h", t)
    if m:
        return now - datetime.timedelta(hours=int(m.group(1)))
    m = re.search(r"(\d+)\s*mo(n(th)?s?)?", t)
    if m:
        return now - datetime.timedelta(days=int(m.group(1)) * 30)
    return None
