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
import { enrichReferenceVideos } from './video-intel.service';

const SHERLOCK_REPORT_PATH = path.resolve(__dirname, '../../../../../../sherlock/last_report.json');
const HISTORY_PATH = path.resolve(__dirname, '../../../data/maverick-history.json');

interface HistoryEntry {
  id: string;
  timestamp: string;
  type?: 'script' | 'dossie' | 'analysis';
  mode: string;
  label: string;
  hook: string;
  scriptPreview: string;
  script: string;
  keywords?: string[];
  input?: unknown;
  output?: unknown;
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

function buildPreview(text: string, max = 140): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, max);
}

function appendHistory(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): HistoryEntry {
  const entries = readHistory();
  const saved: HistoryEntry = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  entries.push(saved);
  if (entries.length > 200) entries.splice(0, entries.length - 200);
  writeHistory(entries);
  return saved;
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
      appendHistory({
        type: 'analysis',
        mode: 'onboarding',
        label: `${niche} • ${targetAudience}`,
        hook: 'Piramide de conteudo',
        scriptPreview: buildPreview(JSON.stringify(pyramid)),
        script: JSON.stringify(pyramid, null, 2),
        input: { niche, targetAudience },
        output: pyramid,
      });
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
      appendHistory({
        type: 'analysis',
        mode: 'ideator',
        label: `${niche} • ${topic}`,
        hook: 'Cards de angulo',
        scriptPreview: buildPreview(JSON.stringify(cards)),
        script: JSON.stringify(cards, null, 2),
        input: { niche, targetAudience, topic },
        output: cards,
      });
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

      let fullScript = '';
      const generator = generateScript({ niche, targetAudience: targetAudience ?? '', angle, hook: hook ?? angle, format });

      for await (const chunk of generator) {
        fullScript += chunk;
        reply.raw.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }

      appendHistory({
        type: 'script',
        mode: format,
        label: angle,
        hook: hook ?? angle,
        scriptPreview: buildPreview(fullScript),
        script: fullScript,
        input: { niche, targetAudience, angle, hook, format },
        output: { script: fullScript },
      });

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
  // Query params:
  // - keywords (comma-separated): filtra por matched_keywords do relatório
  // - limit: quantidade máxima de vídeos retornados (default 20, max 50)
  fastify.get('/instagram-videos', async (
    req: FastifyRequest<{ Querystring: { keywords?: string; limit?: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const raw = fs.readFileSync(SHERLOCK_REPORT_PATH, 'utf-8');
      const report = JSON.parse(raw);

      const kwParam = (req.query as any).keywords ?? '';
      const limitRaw = Number((req.query as any).limit ?? 20);
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;
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

      const videos = filtered.slice(0, limit).map(t => ({
        title: t.title ?? '',
        content: t.content ?? '',
        url: t.url ?? '',
        views: t.engagement ?? 0,
        viralScore: Math.round(t.viral_score ?? 0),
        matchedKeywords: (t.score_components?.matched_keywords ?? []) as string[],
      }));

      const meta = {
        source: 'sherlock:last_report.json',
        totalInstagramCandidates: all.length,
        totalAfterKeywordFilter: filtered.length,
        requestedKeywords: requestedKws,
        keywordFilterApplied: requestedKws.length > 0,
        sort: 'viral_score desc',
        limit,
      };

      return reply.send({ success: true, videos, meta });
    } catch {
      return reply.send({ success: true, videos: [], meta: null });
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
      const { enrichedVideos, intel } = await enrichReferenceVideos(referenceVideos);
      const dossie = await generateDossie({ mode, scopingAnswers, referenceVideos: enrichedVideos });
      const dossieText = `Estrategia: ${dossie.strategy}\n\nHooks:\n- ${dossie.hooks.join('\n- ')}`;
      appendHistory({
        type: 'dossie',
        mode,
        label: (scopingAnswers.temaInimigo ?? scopingAnswers.produto ?? scopingAnswers.local ?? 'Dossie').slice(0, 120),
        hook: dossie.hooks[0] ?? dossie.strategy,
        scriptPreview: buildPreview(dossieText),
        script: dossieText,
        input: { mode, scopingAnswers, referenceVideos },
        output: { dossie, referenceIntel: intel },
      });
      return reply.send({ success: true, dossie, referenceIntel: intel });
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
      let fullScript = '';
      const generator = generateScriptV2({ mode, scopingAnswers, chosenHook });
      for await (const chunk of generator) {
        fullScript += chunk;
        reply.raw.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }
      appendHistory({
        type: 'script',
        mode,
        label: (scopingAnswers.temaInimigo ?? scopingAnswers.produto ?? scopingAnswers.local ?? 'Maverick V2').slice(0, 120),
        hook: chosenHook,
        scriptPreview: buildPreview(fullScript),
        script: fullScript,
        input: { mode, scopingAnswers, chosenHook },
        output: { script: fullScript },
      });
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
      appendHistory({
        type: 'analysis',
        mode: 'oracle',
        label: rawIdea.slice(0, 120),
        hook: blueprint.enemy ?? 'Oracle',
        scriptPreview: buildPreview(JSON.stringify(blueprint)),
        script: JSON.stringify(blueprint, null, 2),
        keywords: blueprint.pains ?? [],
        input: { rawIdea },
        output: blueprint,
      });
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
      appendHistory({
        type: 'analysis',
        mode: 'discover',
        label: `${niche} • ${objective}`,
        hook: discovery.enemy ?? 'Discover',
        scriptPreview: buildPreview(JSON.stringify(discovery)),
        script: JSON.stringify(discovery, null, 2),
        keywords: discovery.keywords,
        input: { niche, objective, period: period ?? 30 },
        output: discovery,
      });

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
    const { type, mode, label, hook, scriptPreview, script, keywords, input, output } = req.body;
    if (!mode || !hook || !script) {
      return reply.status(400).send({ error: 'mode, hook e script são obrigatórios' });
    }
    const entry = appendHistory({
      type: type ?? 'script',
      mode,
      label: label ?? '',
      hook,
      scriptPreview: scriptPreview ?? buildPreview(script),
      script,
      keywords,
      input,
      output,
    });
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
