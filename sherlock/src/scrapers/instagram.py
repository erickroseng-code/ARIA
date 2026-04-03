import datetime
import re
import logging
from typing import List, Dict, Any, Optional
from playwright.async_api import async_playwright
from .base import BaseScraper
from ._chrome import new_persistent_context

logger = logging.getLogger(__name__)


class InstagramScraper(BaseScraper):
    """
    Scraper de Reels do Instagram via Playwright com sessao existente do Chrome.
    Modo automatico (pipeline diario): retorna lista vazia (requer sessao local).
    Modo manual (pesquisa on-demand): recebe keywords + days via parametros.
    """

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
        if not self.keywords:
            logger.info("InstagramScraper: sem keywords, pulando (modo automatico).")
            return []

        logger.info(f"Instagram Reels: {self.keywords} | periodos {self.periods}d | min {self.min_views//1000}k views")
        all_reels = []
        seen_urls: set = set()
        # Usa o maior período como cutoff para cobrir tudo de uma vez
        max_days = max(self.periods)
        cutoff_date = datetime.datetime.utcnow() - datetime.timedelta(days=max_days)

        shared = self._pw_context is not None

        async def _run(context):
            page = await context.new_page()
            detail_page = await context.new_page()
            try:
                for keyword in self.keywords[:3]:
                    reels = await self._search_keyword(page, detail_page, keyword, cutoff_date)
                    new_reels = 0
                    for reel in reels:
                        url = reel.get("url", "")
                        if url in seen_urls:
                            continue
                        seen_urls.add(url)
                        # Calcula period_days: menor período que contém o reel
                        pub = reel.get("published_at")
                        if pub:
                            days_ago = (datetime.datetime.utcnow() - pub).days
                            reel["period_days"] = next(
                                (p for p in sorted(self.periods) if p >= days_ago),
                                max(self.periods),
                            )
                        else:
                            reel["period_days"] = max(self.periods)
                        all_reels.append(reel)
                        new_reels += 1
                    logger.info(f"Instagram '{keyword}': {new_reels} Reels novos encontrados")
            finally:
                await detail_page.close()
                await page.close()

        if shared:
            await _run(self._pw_context)
        else:
            from scrapers._chrome import IS_CI
            async with async_playwright() as p:
                try:
                    context = await new_persistent_context(p, headless=IS_CI)
                except Exception as e:
                    logger.error(f"Erro ao abrir Chromium: {e}")
                    return []
                try:
                    await _run(context)
                finally:
                    await context.close()

        logger.info(f"Instagram total: {len(all_reels)} Reels")
        return all_reels

    async def _search_keyword(
        self, page, detail_page, keyword: str, cutoff_date: datetime.datetime
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
                    # Quando views nao sao parseaveis, mantemos o item com engagement 0.
                    # Isso evita inflar score com numeros artificiais.
                    if views > 0 and views < self.min_views:
                        continue

                    published_at = await self._resolve_published_at(detail_page, url, card_text)
                    # Filtro de periodo estrito: se nao conseguimos inferir data, descartamos.
                    if not published_at:
                        continue
                    if published_at < cutoff_date:
                        continue

                    shortcode = _shortcode_from_url(url)
                    reels.append({
                        "source": "instagram",
                        "title": f"Reel: {keyword} [{shortcode}]",
                        "content": f"Keyword: {keyword} | Views: {_format_views(views) if views > 0 else 'n/d'}",
                        "url": url,
                        "engagement": float(views),
                        "published_at": published_at,
                    })
                except Exception:
                    continue

            # Fallback via hashtag se nenhum resultado
            if not reels:
                reels.extend(await self._extract_from_hashtag_page(page, detail_page, keyword, cutoff_date))

        except Exception as e:
            logger.error(f"Erro Instagram '{keyword}': {e}")

        return reels

    async def _extract_from_hashtag_page(
        self, page, detail_page, keyword: str, cutoff_date: datetime.datetime
    ) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        tag = keyword.replace(" ", "")
        tag_url = f"https://www.instagram.com/explore/tags/{tag}/"
        await page.goto(tag_url, timeout=30000, wait_until="domcontentloaded")
        await page.wait_for_timeout(2200)

        for _ in range(5):
            await page.mouse.wheel(0, 1600)
            await page.wait_for_timeout(900)

        link_handles = await page.locator('a[href*="/reel/"], a[href*="/p/"]').all()
        seen: set[str] = set()
        for link in link_handles[:35]:
            try:
                href = await link.get_attribute("href") or ""
                if not href:
                    continue
                url = f"https://www.instagram.com{href}" if href.startswith("/") else href
                if url in seen:
                    continue
                seen.add(url)
                card_text = ""
                try:
                    card_text = (await link.inner_text()).strip()
                except Exception:
                    pass
                published_at = await self._resolve_published_at(detail_page, url, card_text)
                # Filtro de periodo estrito no fallback.
                if not published_at or published_at < cutoff_date:
                    continue
                shortcode = _shortcode_from_url(url)
                kind = "Reel" if "/reel/" in url else "Post"
                results.append(
                    {
                        "source": "instagram",
                        "title": f"{kind} #{tag} [{shortcode}]",
                        "content": f"Hashtag: #{tag}",
                        "url": url,
                        "engagement": 0.0,
                        "published_at": published_at,
                    }
                )
            except Exception:
                continue
        return results

    async def _resolve_published_at(self, detail_page, url: str, card_text: str) -> Optional[datetime.datetime]:
        """
        Resolve published_at trying fast text parse first, then post page <time datetime>.
        """
        est = _estimate_date(card_text)
        if est:
            return est

        try:
            await detail_page.goto(url, timeout=20000, wait_until="domcontentloaded")
            await detail_page.wait_for_timeout(900)
            time_el = detail_page.locator("time").first
            dt_attr = await time_el.get_attribute("datetime")
            if dt_attr:
                try:
                    return datetime.datetime.fromisoformat(dt_attr.replace("Z", "+00:00")).replace(tzinfo=None)
                except Exception:
                    pass
            # Fallback textual parse from detail page when datetime attr is missing.
            body_text = (await detail_page.locator("body").inner_text())[:2000]
            return _estimate_date(body_text)
        except Exception:
            return None


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
    m = re.search(r"h[áa]\s+(\d+)\s+dia", t)
    if m:
        return now - datetime.timedelta(days=int(m.group(1)))
    m = re.search(r"h[áa]\s+(\d+)\s+semana", t)
    if m:
        return now - datetime.timedelta(weeks=int(m.group(1)))
    m = re.search(r"h[áa]\s+(\d+)\s+m[eê]s", t)
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


def _shortcode_from_url(url: str) -> str:
    # Instagram can expose posts as /reel/<id>, /p/<id> or /tv/<id>.
    m = re.search(r"/(?:reel|p|tv)/([^/?#]+)", url)
    return m.group(1) if m else "unknown"
