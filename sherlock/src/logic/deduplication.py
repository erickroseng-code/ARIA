import hashlib
import datetime
import logging
from typing import List, Dict, Any
from sqlmodel import Session, select
from models.trend import Trend
from main import engine # Usamos a engine do main

logger = logging.getLogger(__name__)

def generate_content_hash(title: str, source: str) -> str:
    """Gera hash MD5 para o título e fonte para deduplicação."""
    raw = f"{source}::{title.strip().lower()}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()

def is_duplicate(session: Session, content_hash: str, days: int = 7) -> bool:
    """Verifica se essa trend já foi processada recentemente."""
    cutoff_date = datetime.datetime.utcnow() - datetime.timedelta(days=days)
    statement = select(Trend).where(
        Trend.content_hash == content_hash,
        Trend.processed_at >= cutoff_date
    )
    result = session.exec(statement).first()
    return result is not None

def filter_new_trends(trends: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Filtra as trends retornando apenas as novas."""
    logger.info("Executando deduplicação em SQLite...")
    new_trends = []
    
    with Session(engine) as session:
        for trend in trends:
            t_hash = generate_content_hash(trend.get("title", ""), trend.get("source", ""))
            trend["content_hash"] = t_hash
            
            if not is_duplicate(session, t_hash):
                new_trends.append(trend)
                
    logger.info(f"Deduplicação concluída: {len(trends)} totais -> {len(new_trends)} originais.")
    return new_trends

def save_processed_trend(trend_data: Dict[str, Any]):
    """Salva a tendência no banco para futura deduplicação."""
    with Session(engine) as session:
        # Verifica duplicatas de novo por segurança
        if not is_duplicate(session, trend_data["content_hash"]):
            db_trend = Trend(
                source=trend_data.get("source", ""),
                content_hash=trend_data["content_hash"],
                title=trend_data.get("title", ""),
                content=trend_data.get("content", ""),
                url=trend_data.get("url", ""),
                published_at=trend_data.get("published_at", datetime.datetime.utcnow()),
                engagement=trend_data.get("engagement", 0.0),
                viral_score=trend_data.get("viral_score", 0.0)
            )
            session.add(db_trend)
            session.commit()
