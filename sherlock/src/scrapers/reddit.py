import datetime
import logging
from typing import List, Dict, Any
import httpx
from .base import BaseScraper

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "sherlock-agent/1.0 (trend intelligence; contact: erick@synkra.io)",
    "Accept": "application/json",
}

class RedditScraper(BaseScraper):
    """Scraper for Reddit via official JSON API (no auth needed for public subreddits)."""

    def __init__(self, subreddits: List[str] = ["brasil", "investimentos", "marketing", "empreendedorismo"]):
        self.subreddits = subreddits

    async def fetch_trends(self) -> List[Dict[str, Any]]:
        logger.info(f"Iniciando extracao do Reddit JSON API para: {self.subreddits}")
        all_trends = []

        async with httpx.AsyncClient(headers=HEADERS, timeout=20.0, follow_redirects=True) as client:
            for subreddit in self.subreddits:
                try:
                    url = f"https://www.reddit.com/r/{subreddit}/hot.json?limit=5"
                    resp = await client.get(url)
                    resp.raise_for_status()
                    data = resp.json()

                    children = data.get("data", {}).get("children", [])
                    for post in children:
                        d = post.get("data", {})
                        title = d.get("title", "")
                        if not title:
                            continue

                        score = d.get("score", 0)
                        comments = d.get("num_comments", 0)
                        created_utc = d.get("created_utc", 0)
                        url_post = d.get("url", f"https://reddit.com{d.get('permalink', '')}")
                        selftext = d.get("selftext", "") or ""
                        content = selftext[:300] if selftext else title

                        all_trends.append({
                            "source": f"reddit_r_{subreddit}",
                            "title": title,
                            "content": content,
                            "url": url_post,
                            "engagement": float(score + comments * 2),
                            "published_at": datetime.datetime.utcfromtimestamp(created_utc) if created_utc else datetime.datetime.utcnow(),
                        })

                    logger.info(f"Reddit r/{subreddit}: {len(children)} posts extraidos")
                except Exception as e:
                    logger.error(f"Erro em r/{subreddit}: {e}")

        logger.info(f"Reddit total: {len(all_trends)} tendencias")
        return all_trends
