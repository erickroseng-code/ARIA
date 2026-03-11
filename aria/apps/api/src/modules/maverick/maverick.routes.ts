import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { spawn } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { MaverickService } from './maverick.service';
import { MetricsService } from './metrics.service';
import { generateCarouselStructure, ScriptInput } from './carousel-designer/index';
import { generateCarouselHtml } from './carousel-designer/html-export';
import { runWeeklyBatch, getBatch } from './weekly-batch.service';

const MAVERICK_ROOT = path.resolve(__dirname, '../../../../../../squads/maverick');
const MAVERICK_PLAN_SCRIPT = path.join(MAVERICK_ROOT, 'src', 'maverick-plan.ts');
const MAVERICK_SCRIPTS_SCRIPT = path.join(MAVERICK_ROOT, 'src', 'maverick-scripts.ts');

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

    const planArgs = ['ts-node', MAVERICK_PLAN_SCRIPT, username];
    if (icp) planArgs.push(JSON.stringify(icp));

    const child = spawn('npx', planArgs, {
      cwd: MAVERICK_ROOT,
      env: { ...process.env },
      shell: process.platform === 'win32',
    });

    let planBuffer = '';
    let inPlan = false;
    let lineBuffer = '';

    child.stdout.on('data', (chunk: Buffer) => {
      lineBuffer += chunk.toString();
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.trim() === '[PLAN_START]') {
          inPlan = true;
          continue;
        }
        if (line.trim() === '[PLAN_END]') {
          inPlan = false;
          sendEvent(raw, 'plan', { content: planBuffer.trim() });

          // Salvar análise no banco de dados
          try {
            const report = JSON.parse(planBuffer.trim());
            maverickService.saveAnalysis(report).then(saved => {
              // Envia o analysisId ao frontend para vincular os roteiros depois
              sendEvent(raw, 'analysis_id', { analysisId: saved.id });
            }).catch(err => {
              console.error('[ERROR] Erro ao salvar análise:', err);
            });
          } catch (err) {
            console.error('[ERROR] Erro ao parsear report JSON:', err);
          }
          continue;
        }
        if (inPlan) {
          planBuffer += line + '\n';
        }
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      process.stderr.write(`[maverick/plan] ${text}`); // visível no PM2 logs
      if (text.includes('[ERROR]')) {
        const msg = text.replace('[ERROR]', '').trim();
        sendEvent(raw, 'error', { message: msg });
      }
    });

    child.on('close', (code) => {
      if (code === 0) {
        sendEvent(raw, 'done', {});
      } else if (!planBuffer) {
        sendEvent(raw, 'error', { message: 'Processo encerrado com erro. Verifique o OPENROUTER_API_KEY e se o Puppeteer está instalado.' });
      }
      raw.end();
    });

    child.on('error', (err) => {
      sendEvent(raw, 'error', { message: err.message });
      raw.end();
    });
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
    req: FastifyRequest<{ Body: { plan: string; analysisId?: string; keywords?: string[]; maxAgeDays?: number } }>,
    reply: FastifyReply,
  ) => {
    const { plan, analysisId, keywords, maxAgeDays = 45 } = req.body;

    if (!plan) {
      return reply.status(400).send({ error: 'plan é obrigatório' });
    }

    // Salva o plano em arquivo temporário para passar ao script filho
    const tempFile = path.join(os.tmpdir(), `maverick-plan-${Date.now()}.txt`);
    fs.writeFileSync(tempFile, plan, 'utf-8');

    reply.hijack();
    const raw = reply.raw;
    writeSseHeaders(raw, req.headers['origin'] as string);

    sendEvent(raw, 'step', { message: '⏳ O time do Maverick está trabalhando na análise...' });

    // Escreve keywords em arquivo temp para evitar problemas de escaping no Windows
    let keywordsFile: string | undefined;
    if (keywords && keywords.length > 0) {
      keywordsFile = path.join(os.tmpdir(), `maverick-kw-${Date.now()}.json`);
      fs.writeFileSync(keywordsFile, JSON.stringify(keywords), 'utf-8');
    }

    // Escreve maxAgeDays em arquivo temp
    const maxAgeDaysFile = path.join(os.tmpdir(), `maverick-age-${Date.now()}.json`);
    fs.writeFileSync(maxAgeDaysFile, JSON.stringify({ maxAgeDays }), 'utf-8');

    const scriptArgs = ['ts-node', MAVERICK_SCRIPTS_SCRIPT, tempFile];
    if (keywordsFile) scriptArgs.push(keywordsFile);
    scriptArgs.push(maxAgeDaysFile);

    const child = spawn('npx', scriptArgs, {
      cwd: MAVERICK_ROOT,
      env: { ...process.env },
      shell: process.platform === 'win32',
    });

    let scriptsBuffer = '';
    let inScripts = false;
    let trendBuffer = '';
    let inTrend = false;
    let lineBuffer = '';

    child.stdout.on('data', (chunk: Buffer) => {
      lineBuffer += chunk.toString();
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? '';

      for (const line of lines) {
        // Mensagens de progresso emitidas pelo processo filho
        if (line.startsWith('[STEP]')) {
          sendEvent(raw, 'step', { message: line.replace('[STEP]', '').trim() });
          continue;
        }
        // Alerta de poucos resultados — sugere ampliar o período
        if (line.startsWith('[LOW_RESULTS]')) {
          const parts = line.replace('[LOW_RESULTS]', '').trim().split(':');
          const count = parseInt(parts[0] ?? '0');
          const nextAge = parseInt(parts[1] ?? '90');
          sendEvent(raw, 'low_results', {
            count,
            suggestedMaxAge: nextAge,
            message: `⚠️ Apenas ${count} vídeo(s) viral(is) encontrado(s). Tente ampliar para ${nextAge} dias.`,
          });
          continue;
        }
        // Captura bloco de trend research (com URLs de referência)
        if (line.trim() === '[TREND_DATA_START]') { inTrend = true; continue; }
        if (line.trim() === '[TREND_DATA_END]') {
          inTrend = false;
          try {
            const trendData = JSON.parse(trendBuffer.trim());
            sendEvent(raw, 'trend_research', { content: trendData });
            // Salva no banco se houver analysisId
            if (analysisId) {
              maverickService.saveTrendResearch(analysisId, trendData).catch(err => {
                console.error('[ERROR] Erro ao salvar trend research:', err);
              });
            }
          } catch { /* ignora parse error */ }
          trendBuffer = '';
          continue;
        }
        if (inTrend) { trendBuffer += line + '\n'; continue; }

        if (line.trim() === '[SCRIPTS_START]') {
          inScripts = true;
          continue;
        }
        if (line.trim() === '[SCRIPTS_END]') {
          inScripts = false;
          const scriptsContent = scriptsBuffer.trim();
          sendEvent(raw, 'scripts', { content: scriptsContent });
          // Salvar roteiros vinculados à análise
          if (analysisId) {
            try {
              const parsed = JSON.parse(scriptsContent);
              maverickService.saveScripts(analysisId, parsed).catch(err => {
                console.error('[ERROR] Erro ao salvar roteiros:', err);
              });
            } catch { /* ignora parse error */ }
          }
          continue;
        }
        if (inScripts) {
          scriptsBuffer += line + '\n';
          // Streaming em tempo real linha a linha
          sendEvent(raw, 'chunk', { content: line + '\n' });
        }
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      process.stderr.write(`[maverick/scripts] ${text}`); // visível no PM2 logs
      if (text.includes('[ERROR]')) {
        const msg = text.replace('[ERROR]', '').trim();
        sendEvent(raw, 'error', { message: msg });
      } else if (text.includes('[WARN]')) {
        // Trend research failure: send as informational step (non-blocking)
        const msg = text.replace('[WARN]', '').trim().split('\n')[0];
        sendEvent(raw, 'step', { message: `⚠️ ${msg}` });
      }
    });

    child.on('close', (code) => {
      try { fs.unlinkSync(tempFile); } catch { /* ignora */ }
      if (keywordsFile) try { fs.unlinkSync(keywordsFile); } catch { /* ignora */ }
      try { fs.unlinkSync(maxAgeDaysFile); } catch { /* ignora */ }
      if (code === 0) {
        sendEvent(raw, 'done', {});
      } else if (!scriptsBuffer) {
        sendEvent(raw, 'error', { message: 'Copywriter falhou. Verifique o OPENROUTER_API_KEY.' });
      }
      raw.end();
    });

    child.on('error', (err) => {
      try { fs.unlinkSync(tempFile); } catch { /* ignora */ }
      if (keywordsFile) try { fs.unlinkSync(keywordsFile); } catch { /* ignora */ }
      try { fs.unlinkSync(maxAgeDaysFile); } catch { /* ignora */ }
      sendEvent(raw, 'error', { message: err.message });
      raw.end();
    });
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
        analyses: analyses.map(a => ({
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
        analyses: result.data.map(a => ({
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

    let figmaUrl: string | undefined;

    if (exportToFigma && process.env.FIGMA_API_TOKEN && process.env.FIGMA_FILE_KEY) {
      figmaUrl = await tryFigmaExport();
    }

    return reply.send({ carousel, htmlExport, figmaUrl });
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
