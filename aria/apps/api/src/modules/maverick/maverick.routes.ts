import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import * as path from 'path';
import { MaverickService } from './maverick.service';
import { generateScriptsFromPlan } from './copywriter.service';
import { runTrendResearch } from './trend-researcher.service';
import { generatePlan, ICP } from './plan.service';
import { sendTelegram, sendTelegramDocument } from '../../shared/telegram';
import { PdfService } from '../../services/pdf/pdf.service';
import type { ReportLayoutData } from '../../services/pdf/pdf.service';

const pdfService = new PdfService();
import { MetricsService } from './metrics.service';
import { generateCarouselStructure, ScriptInput } from './carousel-designer/index';
import { generateCarouselHtml } from './carousel-designer/html-export';
import { runWeeklyBatch, getBatch, BatchResult, BatchTopic } from './weekly-batch.service';
import { createBatchZip, getBatchFilename } from './zip.service';

function writeSseHeaders(raw: any, origin: string) {
  raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Credentials': 'true',
  });
}

function sendEvent(raw: any, type: string, data: Record<string, unknown>) {
  raw.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
}

// ─── Figma Queue (in-memory, max 50 items) ────────────────────────────────────

interface FigmaQueueItem {
  id: string;
  carousel: ReturnType<typeof generateCarouselStructure>;
  theme: 'dark' | 'light';
  addedAt: string;
}

const figmaQueue: FigmaQueueItem[] = [];

function addToFigmaQueue(carousel: ReturnType<typeof generateCarouselStructure>, theme: 'dark' | 'light') {
  figmaQueue.push({
    id: `figma-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    carousel,
    theme,
    addedAt: new Date().toISOString(),
  });
  if (figmaQueue.length > 50) figmaQueue.splice(0, figmaQueue.length - 50);
}

export async function registerMaverickRoutes(fastify: FastifyInstance) {
  // PrismaClient requires an adapter in Prisma v7 (DATABASE_URL + adapter config).
  // If not configured, register stub routes returning 503 so the server starts cleanly.
  let prisma: PrismaClient;
  let maverickService: MaverickService;
  let metricsService: MetricsService;

  try {
    const dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db').replace(/\\/g, '/');
    const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
    prisma = new PrismaClient({ adapter } as any);
    maverickService = new MaverickService(prisma);
    metricsService = new MetricsService(prisma);
  } catch (err) {
    console.warn('[Maverick] ⚠️  Prisma not configured — registering stub routes (503):', err instanceof Error ? err.message.split('\n')[0] : String(err));
    // Register stub routes so Fastify doesn't crash
    const stubHandler = (_req: FastifyRequest, reply: FastifyReply) =>
      reply.status(503).send({ error: 'Maverick não disponível — DATABASE_URL não configurado' });
    fastify.post('/plan', stubHandler);
    fastify.post('/keywords', stubHandler);
    fastify.post('/scripts', stubHandler);
    fastify.get('/history', stubHandler);
    fastify.get('/history/:username', stubHandler);
    fastify.get('/history/:username/latest', stubHandler);
    fastify.get('/metrics', stubHandler);
    fastify.get('/metrics/:username', stubHandler);
    fastify.get('/traceability/:analysisId', stubHandler);
    fastify.post('/feedback/:traceId', stubHandler);
    return; // Do NOT register real routes
  }

  // POST /api/maverick/plan — Scout + Strategist com SSE streaming
  fastify.post('/plan', async (
    req: FastifyRequest<{ Body: { username: string; icp?: Record<string, string>; force?: boolean } }>,
    reply: FastifyReply,
  ) => {
    const { username, icp, force } = req.body;

    if (!username) {
      return reply.status(400).send({ error: 'username é obrigatório' });
    }

    reply.hijack();
    const raw = reply.raw;
    writeSseHeaders(raw, req.headers['origin'] as string);

    // ── Cache: verifica análise recente (24h) quando não há ICP e não é forçado ──
    const CACHE_TTL_MS = (parseInt(process.env.MAVERICK_CACHE_TTL_HOURS ?? '24') || 24) * 60 * 60 * 1000;
    if (!icp && !force) {
      try {
        const cached = await maverickService.getLatestAnalysis(username);
        if (cached && (Date.now() - new Date(cached.createdAt).getTime()) < CACHE_TTL_MS) {
          const ageH = Math.round((Date.now() - new Date(cached.createdAt).getTime()) / 3600000);
          sendEvent(raw, 'step', { message: `✅ Análise recente encontrada (há ${ageH}h) — carregando do histórico` });
          sendEvent(raw, 'plan', { content: JSON.stringify(cached.fullReport) });
          sendEvent(raw, 'analysis_id', { analysisId: cached.id });
          sendEvent(raw, 'done', {});
          raw.end();
          return;
        }
      } catch { /* ignora erro de cache — prossegue com análise normal */ }
    }

    sendEvent(raw, 'step', { message: `⏳ O time do Maverick está trabalhando na análise...` });

    try {
      const planJson = await generatePlan(
        username,
        icp as ICP | undefined,
        (msg) => sendEvent(raw, 'step', { message: msg }),
      );

      sendEvent(raw, 'plan', { content: planJson });

      try {
        const report = JSON.parse(planJson);
        maverickService.saveAnalysis(report).then(saved => {
          sendEvent(raw, 'analysis_id', { analysisId: saved.id });
        }).catch(err => {
          console.error('[ERROR] Erro ao salvar análise:', err);
        });
      } catch (err) {
        console.error('[ERROR] Erro ao parsear report JSON:', err);
      }

      sendEvent(raw, 'done', {});
    } catch (err: any) {
      console.error('[maverick/plan] erro:', err);
      sendEvent(raw, 'error', { message: err.message || 'Scout/Strategist falhou.' });
    }

    raw.end();
  });

  // POST /api/maverick/keywords — Sugere 3 termos de busca baseados no plano (chamada direta ao LLM)
  fastify.post('/keywords', async (
    req: FastifyRequest<{ Body: { plan: string } }>,
    reply: FastifyReply,
  ) => {
    const { plan } = req.body;
    if (!plan) return reply.status(400).send({ error: 'plan é obrigatório' });

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return reply.status(500).send({ error: 'OPENROUTER_API_KEY não configurada' });

    const prompt = `Analise o plano estratégico abaixo e identifique os 3 MELHORES TERMOS DE BUSCA para encontrar vídeos virais no Instagram relacionados ao nicho do criador.

PASSO 1 — Identifique:
- ICP (quem é o criador e seu público-alvo)
- Tema central (o que ele ensina/vende/transforma)

PASSO 2 — Selecione EXATAMENTE 3 termos de busca:
- São palavras que o PÚBLICO-ALVO digitaria no Instagram para encontrar conteúdo sobre o problema/desejo dele
- Podem ter 1 a 4 palavras, com espaços, acentos e caracteres normais
- Mix: 1 termo AMPLO do tema + 2 termos ESPECÍFICOS do nicho/dor/transformação

REGRAS:
- NÃO use termos genéricos como: "conteúdo", "dicas", "brasil", "instagram", "viral"
- NÃO use hashtags (sem #, sem palavras coladas tipo "perderpeso")
- FOQUE no que o público pesquisa quando sente a dor ou deseja a transformação

EXEMPLOS CORRETOS:
ICP: Coach financeiro → Keywords: ["educação financeira", "como sair das dívidas", "independência financeira"]
ICP: Nutricionista emagrecimento → Keywords: ["emagrecer sem dieta", "emagrecimento feminino", "como perder peso"]
ICP: Personal trainer hipertrofia → Keywords: ["ganhar massa muscular", "hipertrofia masculina", "treino para ganhar músculo"]

PLANO ESTRATÉGICO:
${plan.slice(0, 3000)}

Responda APENAS com JSON: { "keywords": ["termo 1", "termo 2", "termo 3"] }`;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://aios-maverick.local',
          'X-Title': 'Maverick Squad',
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-v3.2',
          temperature: 0,
          messages: [
            { role: 'system', content: 'Você é uma API JSON estrita. Nunca retorne nada além de JSON.' },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error('[keywords] OpenRouter error:', err);
        return reply.status(500).send({ error: 'Falha ao chamar LLM' });
      }

      const data = await response.json() as any;
      const raw: string = data.choices?.[0]?.message?.content || '';

      // Extrai JSON da resposta
      let keywords: string[] = [];
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        keywords = Array.isArray(parsed.keywords) ? parsed.keywords : [];
      }

      // Sanitiza: só trim e lowercase, mantém acentos e espaços
      keywords = keywords
        .map((k: string) => k.trim().toLowerCase().replace(/^#+/, '').trim())
        .filter((k: string) => k.length > 2 && k.length < 60)
        .slice(0, 3);

      return reply.send({ keywords });
    } catch (err: any) {
      console.error('[keywords] erro:', err);
      return reply.status(500).send({ error: err.message });
    }
  });

  // POST /api/maverick/scripts — Copywriter com SSE streaming
  fastify.post('/scripts', async (
    req: FastifyRequest<{ Body: { plan: string; analysisId?: string; keywords?: string[]; maxAgeDays?: number; skipTrendResearch?: boolean } }>,
    reply: FastifyReply,
  ) => {
    const { plan, analysisId, keywords, maxAgeDays = 45, skipTrendResearch = false } = req.body;

    if (!plan) {
      return reply.status(400).send({ error: 'plan é obrigatório' });
    }

    reply.hijack();
    const raw = reply.raw;
    writeSseHeaders(raw, req.headers['origin'] as string);

    sendEvent(raw, 'step', { message: '⏳ O time do Maverick está trabalhando na análise...' });

    try {
      // Se keywords foram fornecidas pelo usuário, injeta-as no plan como next_steps
      // para que o copywriter use esses temas ao gerar os roteiros
      let effectivePlan = plan;
      if (keywords && keywords.length > 0) {
        try {
          const parsed = JSON.parse(plan);
          if (parsed?.strategy) {
            parsed.strategy.next_steps = keywords;
            // Também injeta como key_concept se ainda não houver
            if (!parsed.strategy.key_concept) {
              parsed.strategy.key_concept = keywords[0];
            }
          }
          effectivePlan = JSON.stringify(parsed);
          console.log(`[/scripts] Keywords injetadas no plan: [${keywords.join(', ')}]`);
        } catch {
          console.warn('[/scripts] Falha ao injetar keywords no plan — usando plan original');
        }
      }

      // Brief expansion: quando apenas keywords foram fornecidas (sem análise de perfil real),
      // infere ICP completo via LLM para dar ao copywriter contexto equivalente a uma análise de perfil.
      // Detecta "plan sintético" pela ausência de audience_profile no ICP.
      const hasParsedProfile = (() => {
        try {
          const p = JSON.parse(effectivePlan);
          const icp = p?.strategy?.suggested_icp;
          return !!(icp?.inferred_audience && icp.inferred_audience.length > 30);
        } catch { return true; }
      })();

      if (keywords && keywords.length > 0 && !hasParsedProfile && skipTrendResearch) {
        sendEvent(raw, 'step', { message: '🎯 Mapeando perfil de audiência e dores...' });
        try {
          const apiKey = process.env.OPENROUTER_API_KEY;
          if (apiKey) {
            const briefRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'deepseek/deepseek-v3.2',
                temperature: 0.3,
                messages: [
                  {
                    role: 'system',
                    content: 'Você é um estrategista de ICP para o mercado brasileiro. Retorne APENAS JSON válido, sem markdown, sem explicações.',
                  },
                  {
                    role: 'user',
                    content: `Com base nas palavras-chave abaixo, identifique o perfil de público real com precisão cirúrgica.

PALAVRAS-CHAVE: ${keywords.join(', ')}

INSTRUÇÕES:
- Seja específico: cargo real, situação real, faixa etária plausível
- A dor principal deve ser concreta — o que mantém essa pessoa acordada às 23h
- Proibido generalizar: "empreendedores" sem especificação, "pessoas que querem crescer", etc.

Retorne JSON:
{
  "inferred_audience": "descrição específica de quem é esse público (cargo, situação, contexto)",
  "main_pain_addressed": "dor principal concreta e específica (não genérica)",
  "inferred_product": "o que provavelmente se vende nesse nicho",
  "key_concept": "conceito central que esse público precisa entender para tomar ação",
  "diagnosis": "gap em 2 linhas: onde esse público está vs onde quer chegar, com linguagem crua"
}`,
                  },
                ],
              }),
            });

            if (briefRes.ok) {
              const briefData = await briefRes.json() as any;
              const briefRaw: string = briefData.choices?.[0]?.message?.content || '';
              const match = briefRaw.match(/\{[\s\S]*\}/);
              if (match) {
                const icp = JSON.parse(match[0]);
                const parsedPlan = JSON.parse(effectivePlan);
                if (parsedPlan?.strategy) {
                  if (icp.diagnosis) parsedPlan.strategy.diagnosis = icp.diagnosis;
                  if (icp.key_concept) parsedPlan.strategy.key_concept = icp.key_concept;
                  if (!parsedPlan.strategy.suggested_icp) parsedPlan.strategy.suggested_icp = {};
                  if (icp.inferred_audience) parsedPlan.strategy.suggested_icp.inferred_audience = icp.inferred_audience;
                  if (icp.main_pain_addressed) parsedPlan.strategy.suggested_icp.main_pain_addressed = icp.main_pain_addressed;
                  if (icp.inferred_product) parsedPlan.strategy.suggested_icp.inferred_product = icp.inferred_product;
                }
                effectivePlan = JSON.stringify(parsedPlan);
                console.log(`[/scripts] Brief expansion aplicado — ICP inferido: ${icp.inferred_audience?.slice(0, 80)}`);
              }
            }
          }
        } catch (briefErr) {
          console.warn('[/scripts] Brief expansion falhou — continuando sem enriquecimento:', briefErr instanceof Error ? briefErr.message : String(briefErr));
        }
      }


      let trendResearch;
      if (!skipTrendResearch) {
        try {
          trendResearch = await runTrendResearch(effectivePlan, (msg) => {
            sendEvent(raw, 'step', { message: msg });
          }, maxAgeDays, keywords);
        } catch (err: any) {
          console.error('[TrendResearch] Failed:', err);
        }
      }

      const scripts = await generateScriptsFromPlan(effectivePlan, trendResearch, (msg) => {
        sendEvent(raw, 'step', { message: msg });
      });

      const scriptsJson = JSON.stringify(scripts, null, 2);
      sendEvent(raw, 'scripts', { content: scriptsJson });

      if (analysisId) {
        maverickService.saveScripts(analysisId, scripts).catch(err => {
          console.error('[ERROR] Erro ao salvar roteiros:', err);
        });
      }

      sendEvent(raw, 'done', {});
    } catch (err: any) {
      console.error('[maverick/scripts] erro:', err);
      sendEvent(raw, 'error', { message: err.message || 'Copywriter falhou.' });
    }

    raw.end();
  });

  // GET /api/maverick/history/:username — Histórico de análises
  fastify.get('/history/:username', async (
    req: FastifyRequest<{ Params: { username: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const { username } = req.params;
      const analyses = await maverickService.getAnalysisByUsername(username);

      return reply.send({
        username,
        count: analyses.length,
        analyses: analyses.map((a: typeof analyses[number]) => ({
          id: a.id,
          createdAt: a.createdAt,
          status: a.status,
          profile: a.profile,
          analysis: a.analysis,
          strategy: a.strategy,
          scripts: a.scripts ?? [],
          trendResearch: a.trendResearch ?? null,
        })),
      });
    } catch (error) {
      return reply.status(500).send({ error: 'Erro ao recuperar histórico' });
    }
  });

  // GET /api/maverick/history/:username/latest — Última análise
  fastify.get('/history/:username/latest', async (
    req: FastifyRequest<{ Params: { username: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const { username } = req.params;
      const analysis = await maverickService.getLatestAnalysis(username);

      if (!analysis) {
        return reply.status(404).send({ error: 'Nenhuma análise encontrada' });
      }

      return reply.send({
        id: analysis.id,
        createdAt: analysis.createdAt,
        profile: analysis.profile,
        analysis: analysis.analysis,
        strategy: analysis.strategy,
        scripts: analysis.scripts ?? [],
        trendResearch: analysis.trendResearch ?? null,
      });
    } catch (error) {
      return reply.status(500).send({ error: 'Erro ao recuperar análise' });
    }
  });

  // GET /api/maverick/history — Todas as análises com paginação
  fastify.get('/history', async (
    req: FastifyRequest<{ Querystring: { limit?: string; offset?: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const limit = Math.min(parseInt(req.query.limit || '50'), 100);
      const offset = parseInt(req.query.offset || '0');

      const result = await maverickService.getAllAnalyses(limit, offset);

      return reply.send({
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.hasMore,
        analyses: result.data.map((a: typeof result.data[number]) => ({
          id: a.id,
          username: a.username,
          createdAt: a.createdAt,
          status: a.status,
          profile: a.profile,
          analysis: a.analysis,
          strategy: a.strategy,
          scripts: a.scripts ?? [],
          trendResearch: a.trendResearch ?? null,
        })),
      });
    } catch (error) {
      return reply.status(500).send({ error: 'Erro ao recuperar histórico' });
    }
  });

  // POST /api/maverick/carousel — Gera estrutura de carrossel a partir de um script
  fastify.post('/carousel', async (
    req: FastifyRequest<{ Body: { script: ScriptInput; exportToFigma?: boolean; theme?: 'dark' | 'light' } }>,
    reply: FastifyReply,
  ) => {
    if (process.env.MAVERICK_CAROUSEL_ENABLED === 'false') {
      return reply.status(503).send({ error: 'Carousel feature not enabled' });
    }

    const { script, exportToFigma = false, theme = 'dark' } = req.body;
    if (!script) return reply.status(400).send({ error: 'script é obrigatório' });

    const carousel = generateCarouselStructure(script);
    const htmlExport = generateCarouselHtml(carousel, theme);

    // Auto-add to Figma queue so the plugin can fetch without copy-paste
    addToFigmaQueue(carousel, theme);

    let figmaUrl: string | undefined;

    if (exportToFigma && process.env.FIGMA_API_TOKEN && process.env.FIGMA_FILE_KEY) {
      figmaUrl = await tryFigmaExport();
    }

    return reply.send({ carousel, htmlExport, figmaUrl });
  });

  // ─── Figma Queue endpoints ─────────────────────────────────────────────────

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // OPTIONS preflight for Figma plugin CORS
  fastify.options('/figma-queue', async (_req, reply) => {
    return reply.headers(corsHeaders).send();
  });
  fastify.options('/figma-queue/:id', async (_req, reply) => {
    return reply.headers(corsHeaders).send();
  });

  // GET /api/maverick/figma-queue — Retorna carrosséis pendentes para o plugin
  fastify.get('/figma-queue', async (_req, reply) => {
    return reply.headers(corsHeaders).send({ items: figmaQueue, count: figmaQueue.length });
  });

  // DELETE /api/maverick/figma-queue/:id — Plugin confirma que gerou o item
  fastify.delete('/figma-queue/:id', async (
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const idx = figmaQueue.findIndex(i => i.id === req.params.id);
    if (idx === -1) return reply.headers(corsHeaders).status(404).send({ error: 'Item not found' });
    figmaQueue.splice(idx, 1);
    return reply.headers(corsHeaders).send({ ok: true, remaining: figmaQueue.length });
  });

  // GET /api/maverick/stats — Estatísticas do histórico
  fastify.get('/stats', async (
    req: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const stats = await maverickService.getStats();
      return reply.send(stats);
    } catch (error) {
      return reply.status(500).send({ error: 'Erro ao recuperar estatísticas' });
    }
  });

  // DELETE /api/maverick/history/:id — Deletar uma análise
  fastify.delete('/history/:id', async (
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const { id } = req.params;
      await maverickService.deleteAnalysis(id);
      return reply.send({ success: true });
    } catch (error) {
      return reply.status(500).send({ error: 'Erro ao deletar análise' });
    }
  });


  // DELETE /api/maverick/history — Limpar todo o histórico
  fastify.delete('/history', async (
    _req: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const result = await maverickService.clearAllHistory();
      return reply.send(result);
    } catch (error) {
      return reply.status(500).send({ error: 'Erro ao limpar histórico' });
    }
  });

  // ========== PHASE 4: Quality Metrics Dashboard ==========

  // GET /api/maverick/metrics/analysis/:analysisId — Métricas de uma análise
  fastify.get('/metrics/analysis/:analysisId', async (
    req: FastifyRequest<{ Params: { analysisId: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const { analysisId } = req.params;
      const metrics = await metricsService.getAnalysisMetrics(analysisId);

      if (!metrics) {
        return reply.status(404).send({ error: 'Análise não encontrada' });
      }

      return reply.send(metrics);
    } catch (error) {
      return reply.status(500).send({ error: 'Erro ao recuperar métricas da análise' });
    }
  });

  // GET /api/maverick/metrics/dashboard — Dashboard geral de métricas
  fastify.get('/metrics/dashboard', async (
    req: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const metrics = await metricsService.getDashboardMetrics();
      return reply.send(metrics);
    } catch (error) {
      return reply.status(500).send({ error: 'Erro ao recuperar métricas do dashboard' });
    }
  });

  // ========== EPIC 12: Weekly Batch ==========

  // POST /api/maverick/weekly-batch — Gera carrosséis para múltiplos tópicos (AC: 1-7)
  fastify.post('/weekly-batch', async (
    req: FastifyRequest<{ Body: { topics: string[]; theme?: 'dark' | 'light'; scriptOptions?: { maxAgeDays?: number } } }>,
    reply: FastifyReply,
  ) => {
    const { topics, theme = 'dark', scriptOptions = {} } = req.body;

    if (!Array.isArray(topics) || topics.length === 0) {
      return reply.status(400).send({ error: 'topics deve ser um array não vazio' });
    }
    if (topics.length > 10) {
      return reply.status(400).send({ error: 'máximo de 10 tópicos por request' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return reply.status(500).send({ error: 'OPENROUTER_API_KEY não configurada' });
    }

    const result = await runWeeklyBatch(topics, theme, apiKey, scriptOptions);
    return reply.send(result);
  });

  // GET /api/maverick/weekly-batch/:batchId — Recupera resultado de um batch (usado pela Story 12.3)
  fastify.get('/weekly-batch/:batchId', async (
    req: FastifyRequest<{ Params: { batchId: string } }>,
    reply: FastifyReply,
  ) => {
    const { batchId } = req.params;
    const batch = getBatch(batchId);
    if (!batch) {
      return reply.status(404).send({ error: 'Batch não encontrado ou expirado (TTL: 24h)' });
    }
    return reply.send(batch);
  });

  // GET /api/maverick/weekly-batch/:batchId/download — Download ZIP do batch (AC: 1, 2, 3)
  fastify.get('/weekly-batch/:batchId/download', async (
    req: FastifyRequest<{ Params: { batchId: string } }>,
    reply: FastifyReply,
  ) => {
    const { batchId } = req.params;
    const batch = getBatch(batchId);
    if (!batch) {
      return reply.status(404).send({ error: 'Batch não encontrado ou expirado (TTL: 24h)' });
    }

    const zipBuffer = await createBatchZip(batch);
    const filename = getBatchFilename(batch);

    return reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(zipBuffer);
  });

  // POST /api/maverick/weekly-batch/:batchId/send-telegram — Envia diagnóstico + lista + ZIP (AC: 6)
  fastify.post('/weekly-batch/:batchId/send-telegram', async (
    req: FastifyRequest<{ Params: { batchId: string } }>,
    reply: FastifyReply,
  ) => {
    const { batchId } = req.params;
    const batch = getBatch(batchId);
    if (!batch) {
      return reply.status(404).send({ error: 'Batch não encontrado ou expirado (TTL: 24h)' });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      return reply.status(500).send({ error: 'Telegram não configurado (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)' });
    }

    // ── Mensagem 1: Diagnóstico do perfil como PDF (opcional) ────────────────
    const weeklyUsername = process.env.MAVERICK_WEEKLY_USERNAME;
    if (weeklyUsername) {
      try {
        const analyses = await maverickService.getAnalysisByUsername(weeklyUsername);
        if (analyses.length > 0) {
          const pdfData = buildMaverickPdfData(analyses[0]);
          const pdfBuffer = await pdfService.generatePdfBuffer('maverick', pdfData);
          const date = new Date(analyses[0].createdAt).toISOString().slice(0, 10);
          const filename = `Maverick-Weekly-${date}.pdf`;
          const report = analyses[0].fullReport as unknown as FullReportExtended;
          await sendTelegramDocument(
            chatId,
            pdfBuffer,
            filename,
            `🎨 Diagnóstico Maverick — @${report.profile?.username ?? weeklyUsername} · ${new Date(analyses[0].createdAt).toLocaleDateString('pt-BR')}`,
          );
        }
      } catch (err) {
        console.warn('[Maverick Weekly] Diagnóstico de perfil indisponível:', err instanceof Error ? err.message : String(err));
      }
    }

    // ── Mensagem 2: Lista de carrosséis com hooks ─────────────────────────────
    const carouselListMsg = buildCarouselListMessage(batch);
    await sendTelegram(chatId, carouselListMsg);

    // ── Mensagem 3: ZIP como documento ────────────────────────────────────────
    const zipBuffer = await createBatchZip(batch);
    const filename = getBatchFilename(batch);
    const successCount = batch.topics.filter(t => t.status === 'success').length;
    const date = new Date(batch.generatedAt).toLocaleDateString('pt-BR');

    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('caption', `📎 ${successCount} carrossel(is) · ${date}`);
    formData.append('document', new Blob([zipBuffer.buffer as ArrayBuffer], { type: 'application/zip' }), filename);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      return reply.status(500).send({ error: `Telegram error: ${errText.slice(0, 200)}` });
    }

    return reply.send({ success: true, filename });
  });
}

// ── Telegram message builders ──────────────────────────────────────────────────

interface ProfileScore {
  overall: number;
  dimensions: { consistency: number; engagement: number; niche_clarity: number; cta_presence: number; bio_quality: number };
}
interface EngagementPanorama { profile_rate: string; classification: string; tier: string; market_position: string; verdict?: string }
interface SuggestedIcp { inferred_audience?: string; inferred_product?: string; main_pain_addressed?: string }
interface FullReportExtended {
  profile: { username: string; followers: string; posts_count: string };
  analysis: {
    positive_points: string[];
    profile_gaps: string[];
    best_posts: { caption_preview: string; reason: string }[];
    worst_posts: { caption_preview: string; reason: string }[];
  };
  strategy: {
    diagnosis: string;
    key_concept?: string;
    next_steps: string[];
    profile_score?: ProfileScore;
    engagement_panorama?: EngagementPanorama;
    suggested_icp?: SuggestedIcp;
  };
}

function scoreDelta(curr: number, prev: number | undefined): string {
  if (prev === undefined) return '';
  const diff = curr - prev;
  if (diff === 0) return ' — igual';
  return diff > 0 ? ` ▲ +${diff}` : ` ▼ ${diff}`;
}

function buildDiagnosticMessage(current: any, previous: any | null): string {
  const report = current.fullReport as FullReportExtended;
  const prevReport = previous?.fullReport as FullReportExtended | null;
  const { profile, analysis, strategy } = report;
  const prevStrategy = prevReport?.strategy;

  const followers = parseInt(profile.followers || '0').toLocaleString('pt-BR');
  const date = new Date(current.createdAt).toLocaleDateString('pt-BR');
  const score = strategy.profile_score;
  const eng = strategy.engagement_panorama;
  const icp = strategy.suggested_icp;

  const lines: string[] = [
    `🎨 <b>Maverick Weekly — @${profile.username}</b>`,
    `📅 ${date}`,
    ``,
    `👥 ${followers} seguidores · ${profile.posts_count} posts`,
  ];

  if (score) {
    const prevScore = prevStrategy?.profile_score;
    lines.push(``, `━━━━━━━━━━━━━━━━━━`, `📊 <b>SCORE DO PERFIL</b>`, `━━━━━━━━━━━━━━━━━━`);
    lines.push(`🏆 Overall: ${score.overall}/100${scoreDelta(score.overall, prevScore?.overall)}`);
    lines.push(``);
    lines.push(`• Consistência:     ${score.dimensions.consistency}${scoreDelta(score.dimensions.consistency, prevScore?.dimensions.consistency)}`);
    lines.push(`• Engajamento:      ${score.dimensions.engagement}${scoreDelta(score.dimensions.engagement, prevScore?.dimensions.engagement)}`);
    lines.push(`• Clareza de nicho: ${score.dimensions.niche_clarity}${scoreDelta(score.dimensions.niche_clarity, prevScore?.dimensions.niche_clarity)}`);
    lines.push(`• CTAs:             ${score.dimensions.cta_presence}${scoreDelta(score.dimensions.cta_presence, prevScore?.dimensions.cta_presence)}`);
    lines.push(`• Qualidade da bio: ${score.dimensions.bio_quality}${scoreDelta(score.dimensions.bio_quality, prevScore?.dimensions.bio_quality)}`);
  }

  if (eng) {
    lines.push(``, `━━━━━━━━━━━━━━━━━━`, `📈 <b>ENGAJAMENTO</b>`, `━━━━━━━━━━━━━━━━━━`);
    lines.push(`Taxa: ${eng.profile_rate} · <b>${eng.classification}</b>`);
    lines.push(`Tier: ${eng.tier} · ${eng.market_position}`);
    if (eng.verdict) lines.push(``, `<i>${eng.verdict.slice(0, 200)}</i>`);
  }

  lines.push(``, `━━━━━━━━━━━━━━━━━━`, `🔍 <b>DIAGNÓSTICO</b>`, `━━━━━━━━━━━━━━━━━━`);
  if (strategy.key_concept) lines.push(`📌 Conceito-chave: <b>${strategy.key_concept}</b>`, ``);
  lines.push(`<i>${strategy.diagnosis.slice(0, 300)}</i>`);

  if (analysis.positive_points.length > 0) {
    lines.push(``, `━━━━━━━━━━━━━━━━━━`, `✅ <b>PONTOS FORTES</b>`, `━━━━━━━━━━━━━━━━━━`);
    analysis.positive_points.slice(0, 3).forEach(p => lines.push(`✔ ${p.slice(0, 100)}`));
  }

  if (analysis.profile_gaps.length > 0) {
    lines.push(``, `⚠️ <b>PONTOS DE MELHORIA</b>`);
    analysis.profile_gaps.slice(0, 3).forEach(g => lines.push(`✖ ${g.slice(0, 100)}`));
  }

  const best = analysis.best_posts[0];
  const worst = analysis.worst_posts[0];
  if (best || worst) {
    lines.push(``, `━━━━━━━━━━━━━━━━━━`);
    if (best) {
      lines.push(`🏅 <b>Melhor post:</b> <i>"${best.caption_preview.slice(0, 70)}..."</i>`);
      lines.push(`   └ ${best.reason.slice(0, 100)}`);
    }
    if (worst) {
      lines.push(``);
      lines.push(`💀 <b>Post que não funcionou:</b> <i>"${worst.caption_preview.slice(0, 70)}..."</i>`);
      lines.push(`   └ ${worst.reason.slice(0, 100)}`);
    }
  }

  if (strategy.next_steps.length > 0) {
    lines.push(``, `━━━━━━━━━━━━━━━━━━`, `🎯 <b>PRÓXIMOS PASSOS</b>`, `━━━━━━━━━━━━━━━━━━`);
    const nums = ['1️⃣', '2️⃣', '3️⃣'];
    strategy.next_steps.slice(0, 3).forEach((step, i) => lines.push(`${nums[i]} ${step.slice(0, 120)}`));
  }

  if (icp) {
    lines.push(``, `━━━━━━━━━━━━━━━━━━`, `👤 <b>SEU ICP</b>`, `━━━━━━━━━━━━━━━━━━`);
    if (icp.inferred_audience) lines.push(`Público: ${icp.inferred_audience.slice(0, 120)}`);
    if (icp.inferred_product) lines.push(`Produto: ${icp.inferred_product.slice(0, 100)}`);
    if (icp.main_pain_addressed) lines.push(`Dor principal: ${icp.main_pain_addressed.slice(0, 100)}`);
  }

  return lines.join('\n');
}

function buildMaverickPdfData(analysis: any): ReportLayoutData {
  const report = analysis.fullReport as unknown as FullReportExtended;
  const { profile, strategy, analysis: analysisData } = report;
  const score = strategy.profile_score;
  const eng = strategy.engagement_panorama;
  const icp = strategy.suggested_icp;

  const resultsRows: ReportLayoutData['results'] = [];
  analysisData.positive_points.slice(0, 3).forEach(p => {
    resultsRows.push({ name: p.slice(0, 60), status: 'FORTE', detail: '' });
  });
  analysisData.profile_gaps.slice(0, 3).forEach(g => {
    resultsRows.push({ name: g.slice(0, 60), status: 'ATENÇÃO', detail: '' });
  });
  if (analysisData.best_posts[0]) {
    resultsRows.push({ name: `"${analysisData.best_posts[0].caption_preview.slice(0, 55)}"`, status: 'VIRAL', detail: analysisData.best_posts[0].reason.slice(0, 80) });
  }
  if (analysisData.worst_posts[0]) {
    resultsRows.push({ name: `"${analysisData.worst_posts[0].caption_preview.slice(0, 55)}"`, status: 'FALHOU', detail: analysisData.worst_posts[0].reason.slice(0, 80) });
  }

  const diagLines: string[] = [];
  if (strategy.key_concept) diagLines.push(`Conceito-chave: ${strategy.key_concept}`, '');
  diagLines.push(strategy.diagnosis.slice(0, 400));
  if (strategy.next_steps.length > 0) {
    diagLines.push('', 'Próximos passos:');
    strategy.next_steps.slice(0, 3).forEach((step, i) => diagLines.push(`${i + 1}. ${step.slice(0, 120)}`));
  }
  if (icp?.inferred_audience) diagLines.push('', `ICP: ${icp.inferred_audience.slice(0, 120)}`);

  const followers = parseInt(profile.followers || '0').toLocaleString('pt-BR');
  const metrics: ReportLayoutData['metrics'] = [
    { label: 'Seguidores', value: followers },
    { label: 'Posts', value: profile.posts_count },
  ];
  if (score) metrics.push({ label: 'Score Geral', value: `${score.overall}/100` });
  if (eng) metrics.push({ label: 'Engajamento', value: eng.profile_rate });

  return {
    title: 'Análise de Nicho & Roteiros (Maverick)',
    clientName: `@${profile.username}`,
    clientId: analysis.id?.slice(0, 8) ?? 'MAV',
    reportDate: new Date(analysis.createdAt).toLocaleDateString('pt-BR'),
    metrics,
    results: resultsRows.length > 0 ? resultsRows : [{ name: 'Análise concluída', status: 'OK', detail: '' }],
    diagnosis: diagLines.join('\n'),
  };
}

function buildCarouselListMessage(batch: BatchResult): string {
  const successTopics = batch.topics.filter(t => t.status === 'success');
  const date = new Date(batch.generatedAt).toLocaleDateString('pt-BR');
  const nums = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

  const lines: string[] = [
    `🎨 <b>Maverick Weekly — Carrosséis</b>`,
    `📅 ${date}`,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `📦 ${successTopics.length} carrossel(is) prontos para postar:`,
    `━━━━━━━━━━━━━━━━━━`,
  ];

  successTopics.forEach((topic: BatchTopic, i: number) => {
    const num = nums[i] ?? `${i + 1}.`;
    const slides = topic.carousel?.total_slides ?? 0;
    const hook = topic.carousel?.slides?.[0]?.title ?? '';
    lines.push(``);
    lines.push(`${num} <b>${topic.topic}</b>`);
    lines.push(`   ${slides} slides`);
    if (hook) lines.push(`   🎣 <i>"${hook.slice(0, 80)}"</i>`);
  });

  lines.push(``, `━━━━━━━━━━━━━━━━━━`);
  lines.push(`💡 Abra os HTMLs no navegador · 1080×1080px prontos`);

  return lines.join('\n');
}

// Figma REST API v1 is read-only — cannot create frames programmatically.
// Returns the file URL so the designer can open it and apply the HTML export via plugin.
async function tryFigmaExport(): Promise<string | undefined> {
  try {
    const token = process.env.FIGMA_API_TOKEN!;
    const fileKey = process.env.FIGMA_FILE_KEY!;

    const res = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
      headers: { 'X-Figma-Token': token },
    });

    if (!res.ok) return undefined;

    return `https://www.figma.com/file/${fileKey}`;
  } catch {
    return undefined;
  }
}
