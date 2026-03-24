import logging
from typing import Dict, Any, List
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import datetime

logger = logging.getLogger(__name__)

app = FastAPI(title="Sherlock Intelligence Engine API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import sys
import os
from pathlib import Path

src_dir = Path(__file__).parent.parent
sys.path.append(str(src_dir))

import main

main.create_db_and_tables()

class ReportPayload(BaseModel):
    date: str
    mashup_angle: str
    carousel_script: str
    top_news: Dict[str, Any]
    top_trend: Dict[str, Any]
    scored_trends: List[Dict[str, Any]]

LATEST_REPORT = None

@app.post("/webhook/report")
async def receive_report(payload: ReportPayload):
    global LATEST_REPORT
    logger.info(f"[Sherlock] Relatorio recebido! Data: {payload.date}")
    LATEST_REPORT = payload.dict()
    return {"status": "success", "message": "Relatorio salvo com sucesso."}

@app.get("/api/dashboard")
async def get_dashboard():
    if not LATEST_REPORT:
        return {"status": "waiting", "message": "Nenhum relatorio processado ainda hoje."}

    return {
        "status": "ready",
        "date": LATEST_REPORT["date"],
        "mashup": LATEST_REPORT["mashup_angle"],
        "script": LATEST_REPORT["carousel_script"],
        "top_sources": [
            LATEST_REPORT["top_news"].get("source", "N/A"),
            LATEST_REPORT["top_trend"].get("source", "N/A")
        ]
    }

async def run_agent_task():
    try:
        await main.run_agent()
        logger.info("[Sherlock] Execucao manual concluida.")
    except Exception as e:
        logger.error(f"[Sherlock] Erro na execucao manual: {e}")

@app.post("/api/trigger")
async def trigger_agent(background_tasks: BackgroundTasks):
    global LATEST_REPORT
    LATEST_REPORT = {
        "date": datetime.datetime.utcnow().isoformat(),
        "mashup_angle": "Gerando dados... Aguarde.",
        "carousel_script": "O agente Sherlock esta processando as tendencias do dia.\n[SLIDE 1]\nAguarde alguns instantes e atualize a pagina...",
        "top_news": {"source": "Processando..."},
        "top_trend": {"source": "Processando..."}
    }
    background_tasks.add_task(run_agent_task)
    return {"status": "success", "message": "Execucao manual do Sherlock iniciada em background."}

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "sherlock", "timestamp": datetime.datetime.utcnow().isoformat()}
