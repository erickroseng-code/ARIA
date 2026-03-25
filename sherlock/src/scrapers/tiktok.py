import datetime
import logging
from typing import List, Dict, Any, Optional

from .base import BaseScraper

logger = logging.getLogger(__name__)


class TikTokScraper(BaseScraper):
    """Scraper for TikTok videos via TikTokApi (hashtag + trending)."""

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
        try:
            from TikTokApi import TikTokApi
        except ImportError:
            logger.error("TikTokApi não instalado. Execute: pip install TikTokApi")
            return []

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
                        videos = await self._fetch_hashtag(api, keyword)
                        all_videos.extend(videos)
                        logger.info(f"TikTok #{keyword}: {len(videos)} vídeos")
                else:
                    videos = await self._fetch_trending(api)
                    all_videos.extend(videos)
                    logger.info(f"TikTok trending: {len(videos)} vídeos")

        except Exception as e:
            logger.error(f"TikTok erro geral: {e}")

        logger.info(f"TikTok total: {len(all_videos)} vídeos")
        return all_videos

    async def _fetch_hashtag(self, api, keyword: str) -> List[Dict[str, Any]]:
        videos = []
        try:
            tag = api.hashtag(name=keyword)
            async for video in tag.videos(count=30):
                item = self._video_to_dict(video, keyword=keyword)
                if item and item["engagement"] >= self.min_views:
                    videos.append(item)
        except Exception as e:
            logger.error(f"TikTok hashtag '{keyword}': {e}")
        return videos

    async def _fetch_trending(self, api) -> List[Dict[str, Any]]:
        videos = []
        try:
            async for video in api.trending.videos(count=30):
                item = self._video_to_dict(video, keyword="trending")
                if item and item["engagement"] >= self.min_views:
                    videos.append(item)
        except Exception as e:
            logger.error(f"TikTok trending: {e}")
        return videos

    def _video_to_dict(self, video, keyword: str) -> Optional[Dict[str, Any]]:
        try:
            stats = video.stats or {}
            plays = int(stats.get("playCount") or 0)
            video_id = str(video.id)
            url = f"https://www.tiktok.com/@{video.author.username}/video/{video_id}"

            d = video.as_dict
            desc = (d.get("desc") or keyword)[:120]

            return {
                "source": "tiktok",
                "title": f"TikTok: {desc}",
                "content": f"#{keyword} | {_format_views(plays)} views | @{video.author.username}",
                "url": url,
                "engagement": float(plays),
                "viral_score": plays / 1_000_000,
                "published_at": datetime.datetime.utcnow(),
            }
        except Exception:
            return None


def _format_views(views: int) -> str:
    if views >= 1_000_000:
        return f"{views/1_000_000:.1f}M"
    if views >= 1_000:
        return f"{views/1_000:.0f}k"
    return str(views)
