import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { spawn } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

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
}
