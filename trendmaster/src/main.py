import asyncio
import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from sqlmodel import SQLModel, create_engine

# Configuração de Logs
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Ensure models are registered
from models.trend import Trend

# Carrega o .env da raiz do projeto (aios-core/.env)
root_dir = Path(__file__).parent.parent.parent
env_path = root_dir / ".env"
load_dotenv(dotenv_path=env_path)

sqlite_file_name = "trendmaster.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"
engine = create_engine(sqlite_url)

from scrapers.g1 import G1Scraper
from scrapers.gtrends import GTrendsScraper
from scrapers.reddit import RedditScraper
from scrapers.instagram import InstagramScraper
from scrapers.tiktok import TikTokScraper
from scrapers.x import XScraper

from logic.deduplication import filter_new_trends, save_processed_trend
from logic.strategist import ContentStrategist
from logic.telegram import send_telegram_notification
import httpx
import datetime

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def _serialize_payload(obj):
    """Serializa recursivamente objetos datetime para ISO string."""
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
        logger.warning("RENDER_WEBHOOK_URL não configurado. POST final ignorado.")
        return
    try:
        serializable_payload = _serialize_payload(payload)
        async with httpx.AsyncClient() as client:
            resp = await client.post(webhook_url, json=serializable_payload)
            resp.raise_for_status()
            logger.info("Webhook POST disparado para o Render com sucesso!")
    except Exception as e:
        logger.error(f"Erro no POST do Webhook para o Render: {e}")

async def run_agent():
    logger.info("Iniciando Pipeline do TIE...")
    # 1. Scrapes
    scrapers = [
        G1Scraper(), GTrendsScraper(), RedditScraper(),
        InstagramScraper(), TikTokScraper(), XScraper()
    ]
    
    raw_trends = []
    # Usando gather para rodar scapers de forma assíncrona concorrente
    results = await asyncio.gather(*(s.fetch_trends() for s in scrapers), return_exceptions=True)
    
    for res in results:
        if isinstance(res, list):
            raw_trends.extend(res)
        else:
            logger.error(f"Scraper falhou: {res}")
            
    if not raw_trends:
        logger.error("Nenhuma tendência capturada. Abortando.")
        return
        
    # 2. Score & Cleanup
    strategist = ContentStrategist()
    scored_trends = strategist.stage1_extraction_and_score(raw_trends)
    
    # 3. Deduplicate
    new_trends = filter_new_trends(scored_trends)
    if not new_trends:
        logger.info("Nenhuma tendência nova encontrada após deduplicação.")
        return
        
    # Salva as processadas no DB
    for t in new_trends:
        save_processed_trend(t)
        
    # 4. Intelligence
    # Separação simples: Top Notícia x Top Trend Social
    news_sources = ["g1", "google_trends", "reddit_r_brasil", "reddit_r_investimentos", "reddit_r_marketing"]
    social_sources = ["instagram", "tiktok", "x_twitter"]
    
    top_news = next((t for t in new_trends if t.get("source") in news_sources), new_trends[0])
    top_trend = next((t for t in new_trends if t.get("source") in social_sources), new_trends[0])
    
    angle = await strategist.stage2_angle_analysis(top_news, top_trend)
    carousel_script = await strategist.stage3_copywriting_pro(angle)
    
    # 5. Build Report
    report = {
        "date": datetime.datetime.utcnow().isoformat(),
        "mashup_angle": angle,
        "carousel_script": carousel_script,
        "top_news": top_news,
        "top_trend": top_trend,
        "scored_trends": new_trends[:20]  # Mandar top 20 limit
    }
    
    # 6. Deliver
    await dispatch_webhook(report)
    await send_telegram_notification(report)
    logger.info("TIE Pipeline Concluído com Sucesso!")

async def main():
    create_db_and_tables()
    await run_agent()

if __name__ == "__main__":
    asyncio.run(main())
