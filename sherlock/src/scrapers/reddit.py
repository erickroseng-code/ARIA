import datetime
import logging
import re
from typing import List, Dict, Any

import httpx
from .base import BaseScraper

logger = logging.getLogger(__name__)

# Subreddits representing what's trending globally and in Brazil.
SUBREDDITS = ["popular", "brasil", "investimentos", "empreendedorismo"]

# Reddit JSON API — public, no auth needed, reliable
_JSON_API = "https://www.reddit.com/r/{sub}/hot/.json?limit=10&raw_json=1"
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; SherlockBot/1.0; trend scraper)",
    "Accept": "application/json",
}


class RedditScraper(BaseScraper):
    """Scraper for Reddit subreddits via public JSON API (no browser needed)."""

    def __init__(self, subreddits: List[str] = SUBREDDITS):
        super().__init__()
        self.subreddits = subreddits

    async def fetch_trends(self) -> List[Dict[str, Any]]:
        logger.info(f"Iniciando extração Reddit via JSON API: {self.subreddits}")
        trends = []

        async with httpx.AsyncClient(timeout=15, headers=_HEADERS, follow_redirects=True) as client:
            for sub in self.subreddits:
                sub_trends = await _fetch_subreddit(client, sub)
                trends.extend(sub_trends)
                logger.info(f"Reddit r/{sub}: {len(sub_trends)} posts")

        logger.info(f"Reddit total: {len(trends)} posts extraídos")
        return trends


async def _fetch_subreddit(client: httpx.AsyncClient, subreddit: str) -> List[Dict[str, Any]]:
    trends = []
    try:
        resp = await client.get(_JSON_API.format(sub=subreddit))
        if resp.status_code != 200:
            logger.warning(f"Reddit r/{subreddit} retornou HTTP {resp.status_code}")
            return []

        data = resp.json()
        posts = data.get("data", {}).get("children", [])

        for post_wrap in posts[:8]:
            post = post_wrap.get("data", {})
            title = post.get("title", "").strip()
            if not title or post.get("stickied"):
                continue
            permalink = post.get("permalink", "")
            url = f"https://www.reddit.com{permalink}" if permalink else post.get("url", "")
            score = int(post.get("score", 0))
            trends.append({
                "source": f"reddit_r_{subreddit}",
                "title": title,
                "content": post.get("selftext", title)[:300] or title,
                "url": url,
                "engagement": float(score),
                "published_at": datetime.datetime.utcnow(),
            })
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
