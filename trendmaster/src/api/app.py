import logging
from typing import Dict, Any, List
from fastapi import FastAPI, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import datetime

logger = logging.getLogger(__name__)

app = FastAPI(title="TrendMaster Intelligence Engine API")

# Configure CORS
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

# Add src to python path for imports to work when run via uvicorn
src_dir = Path(__file__).parent.parent
sys.path.append(str(src_dir))

import main  # We import main to use its functions

# Assegura que as tabelas do banco de dados existem ao iniciar a API
main.create_db_and_tables()

class ReportPayload(BaseModel):
    date: str
    mashup_angle: str
    carousel_script: str
    top_news: Dict[str, Any]
    top_trend: Dict[str, Any]
    scored_trends: List[Dict[str, Any]]

# Em memória para demonstração do Dashboard (Ideal: Persistência no próprio app ou cache Real)
LATEST_REPORT = None

@app.post("/webhook/report")
async def receive_report(payload: ReportPayload):
    """
    Recebe o relatório final do agente cron diário.
    """
    global LATEST_REPORT
    logger.info(f"Relatório recebido! Data: {payload.date}")
    LATEST_REPORT = payload.dict()
    return {"status": "success", "message": "Relatório salvo com sucesso."}

@app.get("/api/dashboard")
async def get_dashboard():
    """
    Endpoint para servir dados ao Dashboard frontend.
    """
    if not LATEST_REPORT:
        return {"status": "waiting", "message": "Nenhum relatório processado ainda hoje."}
    
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
        logger.info("Execução manual concluída.")
    except Exception as e:
        logger.error(f"Erro na execução manual: {e}")

@app.post("/api/trigger")
async def trigger_agent(background_tasks: BackgroundTasks):
    """
    Endpoint para disparar o agente manualmente.
    O processamento ocorre em background.
    """
    # Define status temporário
    global LATEST_REPORT
    LATEST_REPORT = {
        "date": datetime.datetime.utcnow().isoformat(),
        "mashup_angle": "Gerando dados... Aguarde.",
        "carousel_script": "O agente TIE está processando as maiores tendências do dia no momento.\n[SLIDE 1]\nAguarde alguns instantes e atualize a página...",
        "top_news": {"source": "Processando..."},
        "top_trend": {"source": "Processando..."}
    }
    background_tasks.add_task(run_agent_task)
    return {"status": "success", "message": "Execução manual do TIE iniciada em background."}

@app.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.datetime.utcnow().isoformat()}
