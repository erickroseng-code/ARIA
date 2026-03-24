import os
import httpx
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

async def send_telegram_notification(report: Dict[str, Any]):
    """Envia notificação resumida via Telegram do relatório do TIE."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    # Tenta usar a lista ALLOWED_TELEGRAM_IDS da raiz
    chat_id = os.environ.get("ALLOWED_TELEGRAM_IDS", "").split(",")[0] 
    
    if not token or not chat_id:
        logger.warning("TELEGRAM_BOT_TOKEN ou ALLOWED_TELEGRAM_IDS ausentes. Notificação ignorada.")
        return
        
    date_str = report.get('date', '')
    top_news = report.get('top_news', {}).get('title', 'N/A')
    top_trend = report.get('top_trend', {}).get('title', 'N/A')
    mashup = report.get('mashup_angle', 'N/A')
    
    msg = f"🚀 *TIE Relatório Diário* ({date_str})\n\n"
    msg += f"📰 *Top Notícia:* {top_news}\n"
    msg += f"🔥 *Top Trend:* {top_trend}\n\n"
    msg += f"💡 *Ângulo Mashup:*\n_{mashup}_\n\n"
    msg += "✅ Roteiro de 7 slides gerado com sucesso! Veja no Dashboard."
    
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": msg,
        "parse_mode": "Markdown"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            logger.info("Notificação Telegram enviada com sucesso!")
    except Exception as e:
        logger.error(f"Erro ao enviar notificação pro Telegram: {e}")
