import datetime
import re
import logging
import os
from typing import List, Dict, Any, Optional
from playwright.async_api import async_playwright
from .base import BaseScraper

logger = logging.getLogger(__name__)

CHROME_USER_DATA = os.environ.get(
    "CHROME_USER_DATA_DIR",
    r"C:\Users\erick\AppData\Local\Google\Chrome\User Data"
)
CHROME_PROFILE = os.environ.get("CHROME_PROFILE", "Default")


class InstagramScraper(BaseScraper):
    """
    Scraper de Reels do Instagram via Playwright com sessao existente do Chrome.
    Modo automatico (pipeline diario): retorna lista vazia (requer sessao local).
    Modo manual (pesquisa on-demand): recebe keywords + days via parametros.
    """

    def __init__(
        self,
        keywords: Optional[List[str]] = None,
        days: int = 30,
        min_views: int = 100_000,
    ):
        self.keywords = keywords
        self.days = days
        self.min_views = min_views

    async def fetch_trends(self) -> List[Dict[str, Any]]:
        if not self.keywords:
            logger.info("InstagramScraper: sem keywords, pulando (modo automatico).")
            return []

        logger.info(f"Instagram Reels: {self.keywords} | ultimos {self.days} dias | min {self.min_views//1000}k views")
        all_reels = []

        async with async_playwright() as p:
            try:
                context = await p.chromium.launch_persistent_context(
                    user_data_dir=CHROME_USER_DATA,
                    channel="chrome",
                    headless=False,
                    args=[f"--profile-directory={CHROME_PROFILE}"],
                    slow_mo=200,
                )
            except Exception as e:
                logger.error(f"Erro ao abrir Chrome com perfil: {e}")
                return []

            try:
                page = await context.new_page()
                cutoff_date = datetime.datetime.utcnow() - datetime.timedelta(days=self.days)

                for keyword in self.keywords[:3]:
                    reels = await self._search_keyword(page, keyword, cutoff_date)
                    all_reels.extend(reels)
                    logger.info(f"Instagram '{keyword}': {len(reels)} Reels encontrados")

            finally:
                await context.close()

        logger.info(f"Instagram total: {len(all_reels)} Reels")
        return all_reels

    async def _search_keyword(
        self, page, keyword: str, cutoff_date: datetime.datetime
    ) -> List[Dict[str, Any]]:
        reels = []

        try:
            search_url = f"https://www.instagram.com/explore/search/?q={keyword.replace(' ', '+')}"
            await page.goto(search_url, timeout=30000, wait_until="domcontentloaded")
            await page.wait_for_timeout(2500)

            # Tentar clicar na aba Reels
            try:
                tabs = await page.locator("role=tab").all()
                for tab in tabs:
                    tab_text = (await tab.inner_text()).lower()
                    if "reel" in tab_text:
                        await tab.click()
                        await page.wait_for_timeout(2000)
                        break
            except Exception:
                pass

            # Scroll para carregar mais
            for _ in range(4):
                await page.keyboard.press("End")
                await page.wait_for_timeout(1200)

            reel_links = await page.locator('a[href*="/reel/"]').all()

            for link in reel_links[:30]:
                try:
                    href = await link.get_attribute("href") or ""
                    if not href:
                        continue
                    url = f"https://www.instagram.com{href}" if href.startswith("/") else href

                    card_text = ""
                    try:
                        card_text = await link.inner_text()
                    except Exception:
                        pass

                    views = _parse_ig_views(card_text)
                    if views < self.min_views:
                        continue

                    published_at = _estimate_date(card_text)
                    if published_at and published_at < cutoff_date:
                        continue

                    reels.append({
                        "source": "instagram",
                        "title": f"Reel: {keyword}",
                        "content": f"Keyword: {keyword} | Views: {_format_views(views)}",
                        "url": url,
                        "engagement": float(views),
                        "published_at": published_at or datetime.datetime.utcnow(),
                    })
                except Exception:
                    continue

            # Fallback via hashtag se nenhum resultado
            if not reels:
                tag = keyword.replace(" ", "")
                tag_url = f"https://www.instagram.com/explore/tags/{tag}/"
                await page.goto(tag_url, timeout=20000, wait_until="domcontentloaded")
                await page.wait_for_timeout(2000)

                reel_links_fb = await page.locator('a[href*="/reel/"]').all()
                for link in reel_links_fb[:10]:
                    try:
                        href = await link.get_attribute("href") or ""
                        if href:
                            url = f"https://www.instagram.com{href}" if href.startswith("/") else href
                            reels.append({
                                "source": "instagram",
                                "title": f"Reel #{tag}",
                                "content": f"Hashtag: #{tag}",
                                "url": url,
                                "engagement": float(self.min_views),
                                "published_at": datetime.datetime.utcnow(),
                            })
                    except Exception:
                        continue

        except Exception as e:
            logger.error(f"Erro Instagram '{keyword}': {e}")

        return reels


def _parse_ig_views(text: str) -> int:
    t = text.lower().replace(",", ".").replace("\xa0", " ")
    for pattern, mult in [(r"([\d.]+)\s*m", 1_000_000), (r"([\d.]+)\s*mil", 1_000), (r"([\d.]+)\s*k", 1_000)]:
        m = re.search(pattern, t)
        if m:
            return int(float(m.group(1)) * mult)
    m = re.search(r"([\d.]+)\s*(visuali|view|reprod)", t)
    if m:
        return int(float(m.group(1)))
    return 0


def _estimate_date(text: str) -> Optional[datetime.datetime]:
    now = datetime.datetime.utcnow()
    t = text.lower()
    m = re.search(r"ha (\d+) dia", t)
    if m:
        return now - datetime.timedelta(days=int(m.group(1)))
    m = re.search(r"ha (\d+) semana", t)
    if m:
        return now - datetime.timedelta(weeks=int(m.group(1)))
    m = re.search(r"ha (\d+) mes", t)
    if m:
        return now - datetime.timedelta(days=int(m.group(1)) * 30)
    m = re.search(r"(\d+)d ago|(\d+) days", t)
    if m:
        return now - datetime.timedelta(days=int(m.group(1) or m.group(2)))
    m = re.search(r"(\d+)w ago|(\d+) weeks", t)
    if m:
        return now - datetime.timedelta(weeks=int(m.group(1) or m.group(2)))
    return None


def _format_views(views: int) -> str:
    if views >= 1_000_000:
        return f"{views/1_000_000:.1f}M"
    if views >= 1_000:
        return f"{views/1_000:.0f}k"
    return str(views)
