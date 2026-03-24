import datetime
import json
import logging
import re
from typing import List, Dict, Any

import httpx
from playwright.async_api import async_playwright
from .base import BaseScraper
from ._chrome import new_persistent_context

logger = logging.getLogger(__name__)

# Google Trends internal API — returns daily trending searches by geo
_DAILY_JSON = "https://trends.google.com/trends/api/dailytrends?hl={hl}&tz=-180&geo={geo}&ns=15"


class GTrendsScraper(BaseScraper):
    """Scraper for Google Trends — daily trending searches for BR and Global."""

    def __init__(self):
        super().__init__()

    async def fetch_trends(self) -> List[Dict[str, Any]]:
        logger.info("Iniciando extração Google Trends via API JSON...")
        trends = []

        # --- Primary: JSON API (no browser needed) ---
        for geo, hl in [("BR", "pt-BR"), ("US", "en-US")]:
            url = _DAILY_JSON.format(hl=hl, geo=geo)
            try:
                async with httpx.AsyncClient(timeout=15) as client:
                    resp = await client.get(
                        url,
                        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
                        follow_redirects=True,
                    )
                # Google prefixes JSON with ")]}',\n" — strip it
                raw = resp.text.lstrip(")]}'").lstrip(",").strip()
                data = json.loads(raw)
                daily = (
                    data.get("default", {})
                    .get("trendingSearchesDays", [{}])[0]
                    .get("trendingSearches", [])
                )
                for item in daily[:15]:
                    topic = item.get("title", {}).get("query", "")
                    if not topic:
                        continue
                    traffic = item.get("formattedTraffic", "1K+")
                    articles = item.get("articles", [])
                    snippet = articles[0].get("snippet", topic) if articles else topic
                    link = articles[0].get("url", "") if articles else ""
                    trends.append({
                        "source": "google_trends",
                        "title": topic,
                        "content": snippet,
                        "url": link or f"https://trends.google.com/trends/explore?q={topic.replace(' ', '+')}&geo={geo}",
                        "engagement": float(_parse_traffic(traffic)),
                        "published_at": datetime.datetime.utcnow(),
                    })
                logger.info(f"Google Trends [{geo}]: {len([t for t in trends if geo in t['url']])} tópicos")
            except Exception as e:
                logger.warning(f"Google Trends API [{geo}] falhou: {e} — tentando Playwright...")
                pw_trends = await self._playwright_fallback(geo, hl)
                trends.extend(pw_trends)

        logger.info(f"Google Trends total: {len(trends)} trends")
        return trends

    async def _playwright_fallback(self, geo: str, hl: str) -> List[Dict[str, Any]]:
        """Playwright fallback: scrapes the trending searches page."""
        from playwright_stealth import stealth_async
        trends = []
        shared = self._pw_context is not None

        async def _run(context):
            page = await context.new_page()
            await stealth_async(page)
            try:
                await page.goto(
                    f"https://trends.google.com/trending?geo={geo}&hl={hl}",
                    timeout=30000,
                    wait_until="domcontentloaded",
                )
                await page.wait_for_timeout(3000)
                rows = await page.locator("table tbody tr").all()
                for row in rows[:10]:
                    try:
                        text = (await row.inner_text()).strip()
                        lines = [l.strip() for l in text.split("\n") if l.strip()]
                        if not lines:
                            continue
                        topic = lines[0]
                        traffic_text = next(
                            (l for l in lines if re.search(r"\d", l) and ("K" in l or "M" in l or "mil" in l.lower())),
                            ""
                        )
                        trends.append({
                            "source": "google_trends",
                            "title": topic,
                            "content": topic,
                            "url": f"https://trends.google.com/trends/explore?q={topic.replace(' ', '+')}&geo={geo}",
                            "engagement": float(_parse_traffic(traffic_text)),
                            "published_at": datetime.datetime.utcnow(),
                        })
                    except Exception:
                        continue
            except Exception as e:
                logger.error(f"Playwright Trends [{geo}] erro: {e}")
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


def _parse_traffic(text: str) -> int:
    """Parse '200K+', '1M+', '50 mil+' → int"""
    text = str(text).upper().replace(",", ".").replace("MIL", "K")
    m = re.search(r"([\d.]+)\s*([KM]?)", text)
    if not m:
        return 1_000
    num = float(m.group(1))
    suffix = m.group(2)
    if suffix == "K":
        return int(num * 1_000)
    if suffix == "M":
        return int(num * 1_000_000)
    return int(num) if num > 0 else 1_000
