import { FastifyInstance } from 'fastify';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

// ── Configuração ──────────────────────────────────────────────────────────────
const EL_API_KEY  = process.env.ELEVENLABS_API_KEY ?? '';
const EL_VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? '';
const EL_MODEL    = process.env.ELEVENLABS_MODEL ?? 'eleven_multilingual_v2';
const EL_BASE_URL = 'https://api.elevenlabs.io/v1';

// Configurações de voz para estilo Jarvis: estável, preciso, leve gravidade
const EL_VOICE_SETTINGS = {
  stability:          parseFloat(process.env.EL_STABILITY         ?? '0.75'),
  similarity_boost:   parseFloat(process.env.EL_SIMILARITY        ?? '0.85'),
  style:              parseFloat(process.env.EL_STYLE             ?? '0.05'),
  use_speaker_boost:  true,
};

const JARVIS_VOICE = 'pt-BR-AntonioNeural'; // fallback msEdge

// ── ElevenLabs ────────────────────────────────────────────────────────────────
function isElConfigured(): boolean {
  return !!EL_API_KEY && !!EL_VOICE_ID;
}

async function synthesizeElevenLabs(text: string): Promise<Buffer> {
  const res = await fetch(`${EL_BASE_URL}/text-to-speech/${EL_VOICE_ID}/stream`, {
    method: 'POST',
    headers: {
      'xi-api-key':   EL_API_KEY,
      'Content-Type': 'application/json',
      'Accept':       'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id:       EL_MODEL,
      voice_settings: EL_VOICE_SETTINGS,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`ElevenLabs ${res.status}: ${err}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ── msEdge singleton (fallback final) ────────────────────────────────────────
let ttsInstance: MsEdgeTTS | null = null;
let ttsReady = false;

async function getMsEdgeTTS(): Promise<MsEdgeTTS> {
  if (ttsInstance && ttsReady) return ttsInstance;
  const tts = new MsEdgeTTS({ enableLogger: false });
  await tts.setMetadata(JARVIS_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  ttsInstance = tts;
  ttsReady = true;
  return tts;
}

function resetMsEdgeTTS() {
  try { ttsInstance?.close(); } catch { /* ignora */ }
  ttsInstance = null;
  ttsReady = false;
}

// ── Rotas ─────────────────────────────────────────────────────────────────────
export async function registerTTSRoutes(fastify: FastifyInstance) {
  getMsEdgeTTS().catch(() => {});

  if (isElConfigured()) {
    fastify.log.info(`[TTS] ElevenLabs configurado — voice: ${EL_VOICE_ID}, model: ${EL_MODEL}`);
  } else {
    fastify.log.warn('[TTS] ELEVENLABS_API_KEY ou ELEVENLABS_VOICE_ID não configurados — usando msEdge');
  }

  // ── POST /synthesize ───────────────────────────────────────────────────────
  fastify.post('/synthesize', {
    schema: {
      body: {
        type: 'object',
        required: ['text'],
        properties: { text: { type: 'string', maxLength: 5000 } },
      },
    },
  }, async (request, reply) => {
    const { text } = request.body as { text: string };
    const clean = text.trim();
    if (!clean) return reply.status(400).send({ error: 'text é obrigatório' });

    // 1️⃣  ElevenLabs (primário)
    if (isElConfigured()) {
      try {
        const audio = await synthesizeElevenLabs(clean);
        reply.header('Content-Type', 'audio/mpeg');
        reply.header('Cache-Control', 'no-cache');
        reply.header('X-TTS-Engine', 'elevenlabs');
        return reply.send(audio);
      } catch (err) {
        fastify.log.warn(`[TTS] ElevenLabs falhou, usando msEdge: ${err instanceof Error ? err.message : err}`);
      }
    }

    // 2️⃣  msEdge Neural (fallback)
    try {
      const tts = await getMsEdgeTTS();
      const { audioStream } = tts.toStream(clean, { pitch: '-12%', rate: '-8%' });
      reply.header('Content-Type', 'audio/mpeg');
      reply.header('Cache-Control', 'no-cache');
      reply.header('Transfer-Encoding', 'chunked');
      reply.header('X-TTS-Engine', 'msedge');
      return reply.send(audioStream);
    } catch (err) {
      resetMsEdgeTTS();
      fastify.log.error(`[TTS] msEdge falhou: ${err instanceof Error ? err.message : err}`);
      return reply.status(500).send({ error: 'Falha na síntese de voz' });
    }
  });

  // ── GET /status ────────────────────────────────────────────────────────────
  fastify.get('/status', async (_req, reply) => {
    return reply.send({
      elevenlabs: isElConfigured() ? 'configured' : 'not_configured',
      msedge: 'available',
      active: isElConfigured() ? 'elevenlabs' : 'msedge',
      voice_id: EL_VOICE_ID || null,
      model: EL_MODEL,
    });
  });

  // ── GET /el-voices — lista vozes disponíveis na sua conta ElevenLabs ───────
  fastify.get('/el-voices', async (_req, reply) => {
    if (!EL_API_KEY) {
      return reply.status(400).send({ error: 'ELEVENLABS_API_KEY não configurada' });
    }
    try {
      const res = await fetch(`${EL_BASE_URL}/voices`, {
        headers: { 'xi-api-key': EL_API_KEY },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
      const data = await res.json() as { voices: Array<{ voice_id: string; name: string; category: string }> };
      return reply.send(data.voices.map(v => ({
        id:       v.voice_id,
        name:     v.name,
        category: v.category,
      })));
    } catch (err) {
      return reply.status(500).send({ error: `Falha ao buscar vozes: ${err instanceof Error ? err.message : err}` });
    }
  });
}
