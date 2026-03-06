import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { spawn } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { MaverickService } from './maverick.service';
import { MetricsService } from './metrics.service';

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

  // POST /api/maverick/scripts — Copywriter com SSE streaming
  fastify.post('/scripts', async (
    req: FastifyRequest<{ Body: { plan: string; analysisId?: string } }>,
    reply: FastifyReply,
  ) => {
    const { plan, analysisId } = req.body;

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

    const child = spawn('npx', ['ts-node', MAVERICK_SCRIPTS_SCRIPT, tempFile], {
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
      if (code === 0) {
        sendEvent(raw, 'done', {});
      } else if (!scriptsBuffer) {
        sendEvent(raw, 'error', { message: 'Copywriter falhou. Verifique o OPENROUTER_API_KEY.' });
      }
      raw.end();
    });

    child.on('error', (err) => {
      try { fs.unlinkSync(tempFile); } catch { /* ignora */ }
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
        })),
      });
    } catch (error) {
      return reply.status(500).send({ error: 'Erro ao recuperar histórico' });
    }
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
}
