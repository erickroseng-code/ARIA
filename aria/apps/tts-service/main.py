"""
ARIA TTS Service — XTTS v2 (Coqui) com voice cloning
Porta 5002. Para clonar a voz do Jarvis, coloque o arquivo de referência em:
  aria/apps/tts-service/jarvis_reference.wav
"""

import os
import io
import logging
from pathlib import Path
from contextlib import asynccontextmanager

import numpy as np
import soundfile as sf
import torch
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="[TTS] %(asctime)s %(levelname)s — %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("aria-tts")

# ── Caminhos ──────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
REFERENCE_AUDIO = SCRIPT_DIR / "jarvis_reference.wav"

# ── Estado global ─────────────────────────────────────────────────────────────
tts_model = None
reference_path: str | None = None
SAMPLE_RATE = 24000   # XTTS v2 gera a 24kHz


# ── Lifespan (substitui deprecated on_event) ──────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    yield


app = FastAPI(title="ARIA TTS Service — XTTS v2", version="2.0.0", lifespan=lifespan)


def load_model():
    global tts_model, reference_path

    # COQUI_TOS_AGREED=1 pula o prompt interativo de licença
    os.environ.setdefault("COQUI_TOS_AGREED", "1")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    log.info(f"Dispositivo: {device} {'(GPU ✓)' if device == 'cuda' else '(CPU — lento)'}")
    if device == "cuda":
        log.info(f"GPU: {torch.cuda.get_device_name(0)}")

    log.info("Carregando XTTS v2... (primeira vez baixa ~1.9GB)")
    try:
        from TTS.api import TTS
        tts_model = TTS("tts_models/multilingual/multi-dataset/xtts_v2",
                        progress_bar=False).to(device)
        log.info("XTTS v2 carregado ✓")
    except Exception as e:
        log.error(f"Falha ao carregar XTTS v2: {e}")
        tts_model = None
        return

    # Referência Jarvis
    if REFERENCE_AUDIO.exists():
        reference_path = str(REFERENCE_AUDIO)
        log.info(f"Referência Jarvis: {REFERENCE_AUDIO.name} ✓")
    else:
        log.warning(
            "⚠  Arquivo jarvis_reference.wav não encontrado.\n"
            "   Coloque um áudio limpo do Jarvis (10-30s) em:\n"
            f"   {REFERENCE_AUDIO}\n"
            "   Até lá será usada uma voz padrão do XTTS v2."
        )

    # Warmup: elimina o lag do primeiro request real (~6s → ~2s)
    try:
        log.info("Warmup do modelo...")
        speaker = (tts_model.speakers or [None])[0]
        if speaker or reference_path:
            tts_model.tts(
                "Iniciando.",
                speaker=speaker if not reference_path else None,
                speaker_wav=reference_path if reference_path else None,
                language="pt",
            )
        log.info("Warmup concluído — pronto para uso ✓")
    except Exception as e:
        log.warning(f"Warmup falhou (não crítico): {e}")


# ── Schemas ───────────────────────────────────────────────────────────────────
class SynthesizeRequest(BaseModel):
    text: str
    language: str = "pt"
    speed: float = 1.0   # 0.5–2.0 — 1.0 = normal, <1.0 = mais lento (Jarvis: 0.9)


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok" if tts_model is not None else "loading",
        "engine": "xtts_v2",
        "reference": reference_path or "default speaker",
        "device": "cuda" if torch.cuda.is_available() else "cpu",
    }


@app.post("/synthesize")
async def synthesize(req: SynthesizeRequest):
    if tts_model is None:
        raise HTTPException(status_code=503, detail="Modelo ainda não carregado")

    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Texto vazio")

    log.info(f"Sintetizando [{req.language}] ({len(text)} chars): {text[:70]}...")

    try:
        if reference_path:
            # Voice cloning: usa o áudio de referência do Jarvis
            wav: list = tts_model.tts(
                text=text,
                speaker_wav=reference_path,
                language=req.language,
                speed=req.speed,
            )
        else:
            # Sem referência: usa speaker padrão do XTTS v2
            speakers = tts_model.speakers or []
            default_speaker = speakers[0] if speakers else None
            if default_speaker:
                wav = tts_model.tts(
                    text=text,
                    speaker=default_speaker,
                    language=req.language,
                    speed=req.speed,
                )
            else:
                raise HTTPException(
                    status_code=503,
                    detail="Nenhum speaker disponível. Adicione jarvis_reference.wav."
                )

        # Converte lista de floats → WAV em memória
        audio_arr = np.array(wav, dtype=np.float32)
        buf = io.BytesIO()
        sf.write(buf, audio_arr, SAMPLE_RATE, format="WAV", subtype="PCM_16")
        buf.seek(0)

        log.info("Síntese concluída ✓")
        return StreamingResponse(
            buf,
            media_type="audio/wav",
            headers={"Content-Disposition": "inline; filename=speech.wav"},
        )

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Erro na síntese: {e}")
        raise HTTPException(status_code=500, detail=f"Erro na síntese: {str(e)}")


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5002, log_level="info")
