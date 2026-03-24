import { FastifyInstance } from 'fastify';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

// ── Configuração ──────────────────────────────────────────────────────────────
const JARVIS_VOICE = 'pt-BR-AntonioNeural'; // fallback msEdge

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

  fastify.log.info('[TTS] Inicializando apenas com o msEdge...');

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

    // O ElevenLabs foi removido, usando msEdge Neural direto
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
      elevenlabs: 'removed',
      msedge: 'available',
      active: 'msedge',
    });
  });
}
