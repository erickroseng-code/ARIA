import fs from 'fs';
import path from 'path';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  generateContentPyramid,
  generateIdeaCards,
  generateScript,
  generateDossie,
  generateScriptV2,
  type OnboardingInput,
  type IdeatorInput,
  type GenerateInput,
  type DossieInput,
  type GenerateV2Input,
} from './copywriter.v2.service';
import { runOracle, discoverNicheContext, type OracleInput, type DiscoverInput } from './oracle.service';

const SHERLOCK_REPORT_PATH = path.resolve(__dirname, '../../../../../../sherlock/last_report.json');
const HISTORY_PATH = path.resolve(__dirname, '../../../data/maverick-history.json');

interface HistoryEntry {
  id: string;
  timestamp: string;
  mode: string;
  label: string;
  hook: string;
  scriptPreview: string;
  script: string;
  keywords?: string[];
}

function readHistory(): HistoryEntry[] {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8')) as HistoryEntry[];
  } catch {
    return [];
  }
}

function writeHistory(entries: HistoryEntry[]): void {
  const dir = path.dirname(HISTORY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(entries, null, 2), 'utf-8');
}

export async function registerMaverickRoutes(fastify: FastifyInstance) {
  // ── POST /api/maverick/onboarding ──────────────────────────────────────────
  // Recebe Nicho + Público e retorna a Pirâmide de Conteúdo (3 Pilares + 5 Micro-Temas cada)
  fastify.post('/onboarding', async (
    req: FastifyRequest<{ Body: OnboardingInput }>,
    reply: FastifyReply,
  ) => {
    const { niche, targetAudience } = req.body;

    if (!niche?.trim() || !targetAudience?.trim()) {
      return reply.status(400).send({ error: 'niche e targetAudience são obrigatórios' });
    }

    try {
      const pyramid = await generateContentPyramid({ niche, targetAudience });
      return reply.send({ success: true, pyramid });
    } catch (err: any) {
      console.error('[Maverick] /onboarding error:', err);
      return reply.status(500).send({ error: err.message ?? 'Erro ao gerar pirâmide de conteúdo' });
    }
  });

  // ── POST /api/maverick/ideator ─────────────────────────────────────────────
  // Recebe Nicho + Público + Tema genérico e retorna 5 Cards de Ângulo ultra-específicos
  fastify.post('/ideator', async (
    req: FastifyRequest<{ Body: IdeatorInput }>,
    reply: FastifyReply,
  ) => {
    const { niche, targetAudience, topic } = req.body;

    if (!niche?.trim() || !topic?.trim()) {
      return reply.status(400).send({ error: 'niche e topic são obrigatórios' });
    }

    try {
      const cards = await generateIdeaCards({ niche, targetAudience: targetAudience ?? '', topic });
      return reply.send({ success: true, cards });
    } catch (err: any) {
      console.error('[Maverick] /ideator error:', err);
      return reply.status(500).send({ error: err.message ?? 'Erro ao gerar ângulos' });
    }
  });

  // ── POST /api/maverick/generate (SSE Streaming) ────────────────────────────
  // Recebe o Ângulo escolhido + Formato e gera a copy final via llama-4-maverick
  fastify.post('/generate', async (
    req: FastifyRequest<{ Body: GenerateInput }>,
    reply: FastifyReply,
  ) => {
    const { niche, targetAudience, angle, hook, format } = req.body;

    if (!niche?.trim() || !angle?.trim() || !format) {
      return reply.status(400).send({ error: 'niche, angle e format são obrigatórios' });
    }

    const validFormats = ['reels', 'carousel', 'sales_page'];
    if (!validFormats.includes(format)) {
      return reply.status(400).send({ error: `format deve ser um de: ${validFormats.join(', ')}` });
    }

    try {
      // Configurar SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no',
      });

      const generator = generateScript({ niche, targetAudience: targetAudience ?? '', angle, hook: hook ?? angle, format });

      for await (const chunk of generator) {
        reply.raw.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }

      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();
    } catch (err: any) {
      console.error('[Maverick] /generate error:', err);
      if (!reply.raw.headersSent) {
        return reply.status(500).send({ error: err.message ?? 'Erro ao gerar roteiro' });
      }
      reply.raw.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      reply.raw.end();
    }
  });

  // ── GET /api/maverick/instagram-videos ────────────────────────────────────
  // Lê o last_report.json do Sherlock e retorna vídeos do Instagram disponíveis.
  // Query param: keywords (comma-separated) — filtra por matched_keywords do relatório.
  fastify.get('/instagram-videos', async (req: FastifyRequest<{ Querystring: { keywords?: string } }>, reply: FastifyReply) => {
    try {
      const raw = fs.readFileSync(SHERLOCK_REPORT_PATH, 'utf-8');
      const report = JSON.parse(raw);

      const kwParam = (req.query as any).keywords ?? '';
      const requestedKws: string[] = kwParam
        ? kwParam.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean)
        : [];

      const all = ((report.scored_trends ?? []) as any[]).filter(t => t.source === 'instagram');

      // Se vieram keywords, filtra trends que têm pelo menos 1 keyword em comum
      const filtered = requestedKws.length > 0
        ? all.filter(t => {
            const matched: string[] = (t.score_components?.matched_keywords ?? []).map((k: string) => k.toLowerCase());
            return matched.some(k => requestedKws.some(rk => k.includes(rk) || rk.includes(k)));
          })
        : all;

      // Se não sobrou nada após filtrar, retorna vazio (sem fallback para outro nicho)
      const videos = filtered.slice(0, 6).map(t => ({
        title: t.title ?? '',
        content: t.content ?? '',
        url: t.url ?? '',
        views: t.engagement ?? 0,
        viralScore: Math.round(t.viral_score ?? 0),
      }));

      return reply.send({ success: true, videos });
    } catch {
      return reply.send({ success: true, videos: [] });
    }
  });

  // ── POST /api/maverick/dossie ──────────────────────────────────────────────
  // Recebe modo + respostas de scoping → retorna estratégia + 3 ganchos do brain
  fastify.post('/dossie', async (
    req: FastifyRequest<{ Body: DossieInput }>,
    reply: FastifyReply,
  ) => {
    const { mode, scopingAnswers, referenceVideos } = req.body;
    if (!mode || !scopingAnswers) {
      return reply.status(400).send({ error: 'mode e scopingAnswers são obrigatórios' });
    }
    try {
      const dossie = await generateDossie({ mode, scopingAnswers, referenceVideos });
      return reply.send({ success: true, dossie });
    } catch (err: any) {
      console.error('[Maverick] /dossie error:', err);
      return reply.status(500).send({ error: err.message ?? 'Erro ao gerar dossiê' });
    }
  });

  // ── POST /api/maverick/generate-v2 (SSE Streaming) ────────────────────────
  // Recebe modo + scopingAnswers + chosenHook → gera copy via llama-4-maverick
  fastify.post('/generate-v2', async (
    req: FastifyRequest<{ Body: GenerateV2Input }>,
    reply: FastifyReply,
  ) => {
    const { mode, scopingAnswers, chosenHook } = req.body;
    if (!mode || !scopingAnswers || !chosenHook?.trim()) {
      return reply.status(400).send({ error: 'mode, scopingAnswers e chosenHook são obrigatórios' });
    }
    try {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no',
      });
      const generator = generateScriptV2({ mode, scopingAnswers, chosenHook });
      for await (const chunk of generator) {
        reply.raw.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }
      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();
    } catch (err: any) {
      console.error('[Maverick] /generate-v2 error:', err);
      if (!reply.raw.headersSent) {
        return reply.status(500).send({ error: err.message ?? 'Erro ao gerar copy' });
      }
      reply.raw.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      reply.raw.end();
    }
  });

  // ── POST /api/maverick/oracle ──────────────────────────────────────────────
  // Oráculo: pesquisa web real via Tavily + síntese LLM para descoberta de nicho
  fastify.post('/oracle', async (
    req: FastifyRequest<{ Body: OracleInput }>,
    reply: FastifyReply,
  ) => {
    const { rawIdea } = req.body;
    if (!rawIdea?.trim()) {
      return reply.status(400).send({ error: 'rawIdea é obrigatório (ex: "sou nutricionista")' });
    }
    try {
      const blueprint = await runOracle({ rawIdea });
      return reply.send({ success: true, blueprint });
    } catch (err: any) {
      console.error('[Maverick] /oracle error:', err);
      return reply.status(500).send({ error: err.message ?? 'Erro ao executar o Oráculo' });
    }
  });

  // ── POST /api/maverick/discover ───────────────────────────────────────────
  // Descobre keywords + temas do nicho via Tavily e dispara Sherlock Instagram
  fastify.post('/discover', async (
    req: FastifyRequest<{ Body: DiscoverInput }>,
    reply: FastifyReply,
  ) => {
    const { niche, objective, period } = req.body;
    if (!niche?.trim() || !objective?.trim()) {
      return reply.status(400).send({ error: 'niche e objective são obrigatórios' });
    }
    try {
      const discovery = await discoverNicheContext({ niche, objective, period: period ?? 30 });

      // Dispara Sherlock Instagram em background com as keywords descobertas
      const port = process.env.PORT ?? '3001';
      fetch(`http://localhost:${port}/api/sherlock/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: ['instagram'],
          keywords_instagram: discovery.keywords,
          focus_keywords: discovery.keywords,
          days: period ?? 30,
        }),
      }).catch(() => { /* background — ignora erro */ });

      return reply.send({ success: true, discovery });
    } catch (err: any) {
      console.error('[Maverick] /discover error:', err);
      return reply.status(500).send({ error: err.message ?? 'Erro ao descobrir tendências' });
    }
  });

  // ── GET /api/maverick/history ─────────────────────────────────────────────
  fastify.get('/history', async (_req: FastifyRequest, reply: FastifyReply) => {
    const entries = readHistory().slice(-20).reverse(); // mais recentes primeiro
    return reply.send({ success: true, entries });
  });

  // ── POST /api/maverick/history ────────────────────────────────────────────
  fastify.post('/history', async (
    req: FastifyRequest<{ Body: Omit<HistoryEntry, 'id' | 'timestamp'> }>,
    reply: FastifyReply,
  ) => {
    const { mode, label, hook, scriptPreview, script, keywords } = req.body;
    if (!mode || !hook || !script) {
      return reply.status(400).send({ error: 'mode, hook e script são obrigatórios' });
    }
    const entries = readHistory();
    const entry: HistoryEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      mode,
      label: label ?? '',
      hook,
      scriptPreview: scriptPreview ?? script.slice(0, 140),
      script,
      keywords,
    };
    entries.push(entry);
    // mantém máximo de 50 entradas
    if (entries.length > 50) entries.splice(0, entries.length - 50);
    writeHistory(entries);
    return reply.send({ success: true, entry });
  });

  // ── GET /api/maverick/health ───────────────────────────────────────────────
  fastify.get('/health', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'ok',
      squad: 'Maverick V2',
      engine: 'meta-llama/llama-4-maverick',
      ideator: 'llama-3.1-8b-instant',
    });
  });
}
