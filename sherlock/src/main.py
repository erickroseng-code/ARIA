import asyncio
import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from sqlmodel import SQLModel, create_engine

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

from models.trend import Trend

root_dir = Path(__file__).parent.parent.parent
env_path = root_dir / ".env"
load_dotenv(dotenv_path=env_path)

sqlite_file_name = "sherlock.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"
engine = create_engine(sqlite_url)

from scrapers.g1 import G1Scraper
from scrapers.gtrends import GTrendsScraper
from scrapers.reddit import RedditScraper
from scrapers.youtube import YouTubeScraper
from scrapers.instagram import InstagramScraper
from scrapers.tiktok import TikTokScraper
from scrapers.x import XScraper
from scrapers._chrome import new_persistent_context, save_context_cookies
from playwright.async_api import async_playwright

from logic.deduplication import filter_new_trends, save_processed_trend
from logic.strategist import ContentStrategist
from logic.telegram import send_telegram_notification
import httpx
import datetime

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def _serialize_payload(obj):
    if isinstance(obj, datetime.datetime):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: _serialize_payload(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_serialize_payload(i) for i in obj]
    return obj

async def dispatch_webhook(payload: dict):
    webhook_url = os.environ.get("RENDER_WEBHOOK_URL")
    if not webhook_url:
        logger.warning("RENDER_WEBHOOK_URL nao configurado. POST final ignorado.")
        return
    try:
        serializable_payload = _serialize_payload(payload)
        async with httpx.AsyncClient() as client:
            resp = await client.post(webhook_url, json=serializable_payload)
            resp.raise_for_status()
            logger.info("Webhook POST disparado com sucesso!")
    except Exception as e:
        logger.error(f"Erro no POST do Webhook: {e}")

def _instagram_keywords() -> list[str] | None:
    """Lê INSTAGRAM_KEYWORDS do env (ex: 'finanças,marketing,empreendedorismo')."""
    raw = os.environ.get("INSTAGRAM_KEYWORDS", "").strip()
    if not raw:
        return None
    return [k.strip() for k in raw.split(",") if k.strip()]


def _limit_per_source(items: list[dict], max_per_source: int = 10) -> list[dict]:
    limited: list[dict] = []
    counts: dict[str, int] = {}
    for item in items:
        source = str(item.get("source", "unknown"))
        current = counts.get(source, 0)
        if current >= max_per_source:
            continue
        counts[source] = current + 1
        limited.append(item)
    return limited

ALL_SCRAPERS = {
    "g1":            lambda: G1Scraper(),
    "google_trends": lambda: GTrendsScraper(),
    "reddit":        lambda: RedditScraper(),
    "youtube":       lambda: YouTubeScraper(),
    "instagram":     lambda: InstagramScraper(keywords=_instagram_keywords(), periods=[30], min_views=100_000),
    "tiktok":        lambda: TikTokScraper(periods=[30], min_views=100_000),
    "x":             lambda: XScraper(),
}

def _playwright_scraper_keys(active_sources: list[str], instagram_keywords: list[str] | None) -> set[str]:
    """Resolve quais scrapers devem reutilizar o contexto compartilhado de Playwright."""
    keys = {"g1", "youtube", "x", "google_trends"}
    if "instagram" in active_sources and (instagram_keywords or _instagram_keywords()):
        keys.add("instagram")
    # TikTok pode usar fallback Playwright quando TikTokApi nao estiver disponivel.
    if "tiktok" in active_sources:
        keys.add("tiktok")
    return keys

async def run_agent(sources: list[str] | None = None, tiktok_keywords: list[str] | None = None, instagram_keywords: list[str] | None = None, days: int = 30, focus_keywords: list[str] | None = None):
    active = sources if sources else list(ALL_SCRAPERS.keys())
    logger.info(f"Iniciando Pipeline Sherlock — fontes: {', '.join(active)}")
    active_valid = [s for s in active if s in ALL_SCRAPERS]

    # Emite marcadores de progresso para o frontend acompanhar
    for s in active_valid:
        print(f"SHERLOCK_PROGRESS:{s}:running", flush=True)

    # Instancia scrapers com keywords se fornecidas
    scrapers = []
    for s in active_valid:
        if s == "tiktok":
            scrapers.append(TikTokScraper(keywords=tiktok_keywords, periods=[days], min_views=100_000))
        elif s == "instagram":
            ig_kw = instagram_keywords if instagram_keywords else _instagram_keywords()
            scrapers.append(InstagramScraper(keywords=ig_kw, periods=[days], min_views=100_000))
        else:
            scrapers.append(ALL_SCRAPERS[s]())

    # Injecta contexto compartilhado nos scrapers Playwright
    playwright_keys = _playwright_scraper_keys(active_valid, instagram_keywords)
    pw_scrapers = [scraper for scraper, key in zip(scrapers, active_valid) if key in playwright_keys]

    raw_trends = []

    async with async_playwright() as p:
        if pw_scrapers:
            from scrapers._chrome import IS_CI
            shared_ctx = await new_persistent_context(p, headless=IS_CI)
            for s in pw_scrapers:
                s.set_playwright_context(shared_ctx)
        else:
            shared_ctx = None

        try:
            results = await asyncio.gather(*(s.fetch_trends() for s in scrapers), return_exceptions=True)
        finally:
            if shared_ctx:
                await save_context_cookies(shared_ctx)
                await shared_ctx.close()

    for key, res in zip(active_valid, results):
        if isinstance(res, list):
            print(f"SHERLOCK_PROGRESS:{key}:done:{len(res)}", flush=True)
            raw_trends.extend(res)
        else:
            print(f"SHERLOCK_PROGRESS:{key}:error", flush=True)
            logger.error(f"Scraper falhou: {res}")

    # Retry especifico para fontes sociais mais instaveis quando retornam 0 itens.
    social_retry_targets = {"instagram", "x", "tiktok"}
    for key, res in zip(active_valid, results):
        if key not in social_retry_targets:
            continue
        if not isinstance(res, list) or len(res) > 0:
            continue

        logger.warning(f"{key}: retorno vazio. Executando retry dedicado...")
        try:
            if key == "tiktok":
                retry_scraper = TikTokScraper(keywords=tiktok_keywords, periods=[days], min_views=100_000)
            elif key == "instagram":
                ig_kw = instagram_keywords if instagram_keywords else _instagram_keywords()
                retry_scraper = InstagramScraper(keywords=ig_kw, periods=[days], min_views=100_000)
            else:
                retry_scraper = ALL_SCRAPERS[key]()
            retry_items = await retry_scraper.fetch_trends()
            if retry_items:
                logger.info(f"{key}: retry recuperou {len(retry_items)} itens.")
                raw_trends.extend(retry_items)
                print(f"SHERLOCK_PROGRESS:{key}:done:{len(retry_items)}", flush=True)
            else:
                logger.warning(f"{key}: retry tambem retornou vazio.")
        except Exception as e:
            logger.error(f"{key}: erro no retry: {e}")

    if not raw_trends:
        logger.error("Nenhuma tendencia capturada. Abortando.")
        return

    strategist = ContentStrategist()
    scored_trends = strategist.stage1_extraction_and_score(raw_trends, focus_keywords=focus_keywords)

    new_trends = filter_new_trends(scored_trends)

    # Salva apenas trends novas no DB (para deduplicação futura)
    for t in new_trends:
        save_processed_trend(t)

    if not new_trends:
        logger.info("Nenhuma tendencia nova apos deduplicacao. Enviando relatorio com dados atuais.")

    news_sources = ["g1", "google_trends", "reddit_r_brasil", "reddit_r_investimentos", "reddit_r_marketing", "youtube_trending"]
    social_sources = ["instagram", "tiktok", "x_twitter"]

    # Usa scored_trends com limite por fonte para evitar dominancia de uma plataforma.
    display_trends = _limit_per_source(scored_trends, max_per_source=10)
    ref_trends = new_trends if new_trends else scored_trends

    top_news = next((t for t in ref_trends if t.get("source") in news_sources), ref_trends[0])
    top_trend = next((t for t in ref_trends if t.get("source") in social_sources), ref_trends[0])

    angle = await strategist.stage2_angle_analysis(top_news, top_trend)
    carousel_script = await strategist.stage3_copywriting_pro(angle)

    report = {
        "date": datetime.datetime.utcnow().isoformat(),
        "mashup_angle": angle,
        "carousel_script": carousel_script,
        "top_news": top_news,
        "top_trend": top_trend,
        "scored_trends": display_trends
    }

    await dispatch_webhook(report)
    # Telegram só notifica se há trends novas
    if new_trends:
        await send_telegram_notification(report)
    logger.info("Pipeline Sherlock Concluido com Sucesso!")

async def main():
    import argparse
    parser = argparse.ArgumentParser(description="Sherlock Intelligence Engine")
    parser.add_argument("--sources", type=str, default=None, help="Comma-separated list of sources to scrape (e.g. g1,reddit,youtube). Default: all.")
    parser.add_argument("--tiktok-keywords", type=str, default=None, help="Comma-separated keywords for TikTok search (e.g. viral,trend,marketing).")
    parser.add_argument("--instagram-keywords", type=str, default=None, help="Comma-separated keywords for Instagram search (e.g. fashion,lifestyle).")
    parser.add_argument("--days", type=int, default=30, help="Period in days for trend filtering (30, 45, 60, 90). Default: 30.")
    parser.add_argument("--focus-keywords", type=str, default=None, help="Comma-separated keywords to boost relevance scoring for all sources (e.g. empreendedorismo,finanças).")
    args = parser.parse_args()

    sources = [s.strip() for s in args.sources.split(",")] if args.sources else None
    tiktok_kw = [k.strip() for k in args.tiktok_keywords.split(",")] if args.tiktok_keywords else None
    instagram_kw = [k.strip() for k in args.instagram_keywords.split(",")] if args.instagram_keywords else None
    focus_kw = [k.strip() for k in args.focus_keywords.split(",")] if args.focus_keywords else None

    create_db_and_tables()
    await run_agent(sources=sources, tiktok_keywords=tiktok_kw, instagram_keywords=instagram_kw, days=args.days, focus_keywords=focus_kw)

if __name__ == "__main__":
    asyncio.run(main())
