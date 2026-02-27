import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { spawn } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { MaverickService } from './maverick.service';

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
  const prisma = new PrismaClient();
  const maverickService = new MaverickService(prisma);

  // POST /api/maverick/plan — Scout + Strategist com SSE streaming
  fastify.post('/plan', async (
    req: FastifyRequest<{ Body: { username: string } }>,
    reply: FastifyReply,
  ) => {
    const { username } = req.body;

    if (!username) {
      return reply.status(400).send({ error: 'username é obrigatório' });
    }

    reply.hijack();
    const raw = reply.raw;
    writeSseHeaders(raw, req.headers['origin'] as string);

    sendEvent(raw, 'step', { message: `🦅 Squad Maverick iniciado para @${username}` });
    sendEvent(raw, 'step', { message: '🧭 Scout: Conectando ao Instagram...' });

    const child = spawn('npx', ['ts-node', MAVERICK_PLAN_SCRIPT, username], {
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
          sendEvent(raw, 'step', { message: '📄 Gerando plano estratégico...' });
          continue;
        }
        if (line.trim() === '[PLAN_END]') {
          inPlan = false;
          sendEvent(raw, 'plan', { content: planBuffer.trim() });

          // Salvar análise no banco de dados
          try {
            const report = JSON.parse(planBuffer.trim());
            maverickService.saveAnalysis(report).catch(err => {
              console.error('[ERROR] Erro ao salvar análise:', err);
            });
          } catch (err) {
            console.error('[ERROR] Erro ao parsear report JSON:', err);
          }
          continue;
        }
        if (inPlan) {
          planBuffer += line + '\n';
        } else if (line.startsWith('[LOG]')) {
          const msg = line.slice(5).trim();
          sendEvent(raw, 'step', { message: msg });
        }
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
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
    req: FastifyRequest<{ Body: { plan: string } }>,
    reply: FastifyReply,
  ) => {
    const { plan } = req.body;

    if (!plan) {
      return reply.status(400).send({ error: 'plan é obrigatório' });
    }

    // Salva o plano em arquivo temporário para passar ao script filho
    const tempFile = path.join(os.tmpdir(), `maverick-plan-${Date.now()}.txt`);
    fs.writeFileSync(tempFile, plan, 'utf-8');

    reply.hijack();
    const raw = reply.raw;
    writeSseHeaders(raw, req.headers['origin'] as string);

    sendEvent(raw, 'step', { message: '✍️ Copywriter: Analisando plano estratégico...' });

    const child = spawn('npx', ['ts-node', MAVERICK_SCRIPTS_SCRIPT, tempFile], {
      cwd: MAVERICK_ROOT,
      env: { ...process.env },
      shell: process.platform === 'win32',
    });

    let scriptsBuffer = '';
    let inScripts = false;
    let lineBuffer = '';

    child.stdout.on('data', (chunk: Buffer) => {
      lineBuffer += chunk.toString();
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.trim() === '[SCRIPTS_START]') {
          inScripts = true;
          continue;
        }
        if (line.trim() === '[SCRIPTS_END]') {
          inScripts = false;
          sendEvent(raw, 'scripts', { content: scriptsBuffer.trim() });
          continue;
        }
        if (inScripts) {
          scriptsBuffer += line + '\n';
          // Streaming em tempo real linha a linha
          sendEvent(raw, 'chunk', { content: line + '\n' });
        } else if (line.startsWith('[LOG]')) {
          const msg = line.slice(5).trim();
          sendEvent(raw, 'step', { message: msg });
        }
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      if (text.includes('[ERROR]')) {
        const msg = text.replace('[ERROR]', '').trim();
        sendEvent(raw, 'error', { message: msg });
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
}
