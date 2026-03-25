import datetime
import json
import logging
import re
import xml.etree.ElementTree as ET
from typing import List, Dict, Any

import httpx
from playwright.async_api import async_playwright
from .base import BaseScraper
from ._chrome import new_persistent_context

logger = logging.getLogger(__name__)

# Google Trends RSS feed — public, stable, no auth needed
_RSS_URL = "https://trends.google.com/trending/rss?geo={geo}&hl={hl}"
# Fallback: internal JSON API
_DAILY_JSON = "https://trends.google.com/trends/api/dailytrends?hl={hl}&tz=-180&geo={geo}&ns=15"

_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}


class GTrendsScraper(BaseScraper):
    """Scraper for Google Trends — daily trending searches for BR and Global."""

    def __init__(self):
        super().__init__()

    async def fetch_trends(self) -> List[Dict[str, Any]]:
        logger.info("Iniciando extração Google Trends via RSS...")
        trends = []

        for geo, hl in [("BR", "pt-BR"), ("US", "en-US")]:
            got = await self._fetch_rss(geo, hl)
            if not got:
                logger.warning(f"Google Trends RSS [{geo}] vazio — tentando JSON API...")
                got = await self._fetch_json_api(geo, hl)
            if not got:
                logger.warning(f"Google Trends JSON API [{geo}] vazio — tentando Playwright...")
                got = await self._playwright_fallback(geo, hl)
            trends.extend(got)
            logger.info(f"Google Trends [{geo}]: {len(got)} tópicos")

        logger.info(f"Google Trends total: {len(trends)} trends")
        return trends

    async def _fetch_rss(self, geo: str, hl: str) -> List[Dict[str, Any]]:
        """Primary: RSS feed — public and stable."""
        trends = []
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    _RSS_URL.format(geo=geo, hl=hl),
                    headers=_HEADERS,
                    follow_redirects=True,
                )
            if resp.status_code != 200:
                return []
            root = ET.fromstring(resp.text)
            ns = {"ht": "https://trends.google.com/trending/rss"}
            for item in root.findall(".//item")[:15]:
                title = item.findtext("title", "").strip()
                if not title:
                    continue
                link = item.findtext("link", "").strip()
                traffic_raw = item.findtext("ht:approx_traffic", "1K+", ns)
                # First news article snippet as content
                news_snippet = item.findtext("ht:news_item/ht:news_item_snippet", title, ns)
                news_url = item.findtext("ht:news_item/ht:news_item_url", link, ns)
                trends.append({
                    "source": "google_trends",
                    "title": title,
                    "content": news_snippet or title,
                    "url": news_url or link or f"https://trends.google.com/trending?geo={geo}",
                    "engagement": float(_parse_traffic(traffic_raw)),
                    "published_at": datetime.datetime.utcnow(),
                })
        except Exception as e:
            logger.warning(f"Google Trends RSS [{geo}] erro: {e}")
        return trends

    async def _fetch_json_api(self, geo: str, hl: str) -> List[Dict[str, Any]]:
        """Fallback: unofficial JSON API."""
        trends = []
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    _DAILY_JSON.format(hl=hl, geo=geo),
                    headers=_HEADERS,
                    follow_redirects=True,
                )
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
        except Exception as e:
            logger.warning(f"Google Trends JSON API [{geo}] erro: {e}")
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
