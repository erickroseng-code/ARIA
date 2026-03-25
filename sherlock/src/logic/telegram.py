import os
import httpx
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

SOURCE_LABEL = {
    "g1":                       "📰 G1",
    "google_trends":            "🔍 Google Trends",
    "reddit_r_popular":         "🤖 Reddit Popular",
    "reddit_r_brasil":          "🤖 Reddit Brasil",
    "reddit_r_investimentos":   "🤖 Reddit Invest.",
    "reddit_r_empreendedorismo":"🤖 Reddit Empreend.",
    "youtube_trending":         "▶️ YouTube",
    "instagram":                "📸 Instagram",
    "tiktok":                   "🎵 TikTok",
    "x_twitter":                "🐦 X / Twitter",
}


async def send_telegram_notification(report: Dict[str, Any]):
    """Envia notificação com lista de tendências por fonte via Telegram."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("ALLOWED_TELEGRAM_IDS", "").split(",")[0].strip()

    if not token or not chat_id:
        logger.warning("TELEGRAM_BOT_TOKEN ou ALLOWED_TELEGRAM_IDS ausentes. Notificação ignorada.")
        return

    trends = report.get("scored_trends", [])
    date_str = report.get("date", "")[:10]  # só a data

    # Agrupa por fonte
    by_source: Dict[str, list] = {}
    for t in trends:
        src = t.get("source", "outro")
        by_source.setdefault(src, []).append(t.get("title", ""))

    msg = f"🔎 *Sherlock — Tendências do dia* ({date_str})\n"
    msg += "━━━━━━━━━━━━━━━━━━━━\n\n"

    for source, titles in by_source.items():
        label = SOURCE_LABEL.get(source, f"📌 {source}")
        msg += f"*{label}*\n"
        for title in titles[:5]:  # máx 5 por fonte
            # Escapa caracteres especiais do Markdown
            safe = title.replace("*", "").replace("_", "").replace("`", "").replace("[", "").replace("]", "")
            msg += f"• {safe}\n"
        msg += "\n"

    msg += "━━━━━━━━━━━━━━━━━━━━\n"
    msg += "✅ Veja o dashboard para o roteiro completo."

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": msg,
        "parse_mode": "Markdown",
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            logger.info("Notificação Telegram enviada com sucesso!")
    except Exception as e:
        logger.error(f"Erro ao enviar notificação pro Telegram: {e}")
