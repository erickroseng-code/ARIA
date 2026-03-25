import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

interface TrendReport {
  date: string;
  mashup_angle: string;
  carousel_script: string;
  top_news: Record<string, any>;
  top_trend: Record<string, any>;
  scored_trends?: any[];
}

type PipelineStatus = 'waiting' | 'processing' | 'ready';
let PIPELINE_STATUS: PipelineStatus = 'waiting';

const REPORT_FILE = path.resolve(__dirname, '..', '..', '..', '..', '..', '..', 'sherlock', 'last_report.json');

function loadReport(): TrendReport | null {
  try {
    if (fs.existsSync(REPORT_FILE)) return JSON.parse(fs.readFileSync(REPORT_FILE, 'utf-8'));
  } catch {}
  return null;
}

function saveReport(report: TrendReport) {
  try { fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2)); } catch {}
}

export async function registerSherlockRoutes(fastify: FastifyInstance) {

  // GET /api/sherlock/dashboard
  fastify.get('/dashboard', async (_req: FastifyRequest, reply: FastifyReply) => {
    if (PIPELINE_STATUS === 'processing') {
      return reply.send({ status: 'processing', message: 'Pipeline em execução...' });
    }
    const report = loadReport();
    if (!report) {
      return reply.send({ status: 'waiting', message: 'Nenhum relatório processado ainda.' });
    }
    return reply.send({
      status: 'ready',
      date: report.date,
      trends: report.scored_trends ?? [],
    });
  });

  // POST /api/sherlock/webhook — recebe relatório do Python pipeline
  fastify.post('/webhook', async (
    req: FastifyRequest<{ Body: TrendReport }>,
    reply: FastifyReply,
  ) => {
    saveReport(req.body);
    PIPELINE_STATUS = 'ready';
    fastify.log.info('[Sherlock] Relatório recebido e salvo em disco');
    return reply.send({ status: 'success' });
  });

  // POST /api/sherlock/trigger — executa pipeline localmente
  fastify.post('/trigger', async (
    req: FastifyRequest<{ Body: { sources?: string[]; keywords?: string[]; keywords_tiktok?: string[]; keywords_instagram?: string[]; days?: number; period_days?: number } }>,
    reply: FastifyReply,
  ) => {
    const sources = req.body?.sources ?? [];
    const keywordsGeneric = req.body?.keywords ?? [];
    const keywords_tiktok = req.body?.keywords_tiktok ?? (sources.includes('tiktok') ? keywordsGeneric : []);
    const keywords_instagram = req.body?.keywords_instagram ?? (sources.includes('instagram') ? keywordsGeneric : []);
    const days = req.body?.days ?? req.body?.period_days ?? 30;
    const port = process.env.PORT ?? '3001';

    PIPELINE_STATUS = 'processing';

    const sherlockDir = path.resolve(__dirname, '..', '..', '..', '..', '..', '..', 'sherlock');
    const scriptPath = path.join(sherlockDir, 'src', 'main.py');

    // Resolve Python executable — usa forward slashes para compatibilidade no Windows
    const pythonExe = process.env.PYTHON_EXE
      ?? (process.platform === 'win32' ? 'C:/Python314/python.exe' : 'python3');

    const args = [scriptPath];
    if (sources.length > 0) args.push('--sources', sources.join(','));
    if (keywords_tiktok.length > 0) args.push('--tiktok-keywords', keywords_tiktok.join(','));
    if (keywords_instagram.length > 0) args.push('--instagram-keywords', keywords_instagram.join(','));
    args.push('--days', String(days));

    fastify.log.info(`[Sherlock] Iniciando pipeline local — fontes: ${sources.join(', ') || 'todas'}`);

    const proc = spawn(pythonExe, args, {
      cwd: path.join(sherlockDir, 'src'),
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        RENDER_WEBHOOK_URL: `http://localhost:${port}/api/sherlock/webhook`,
      },
      detached: false,
    });

    proc.stdout.on('data', (d: Buffer) => fastify.log.info(`[Sherlock] ${d.toString().trim()}`));
    proc.stderr.on('data', (d: Buffer) => fastify.log.warn(`[Sherlock] ${d.toString().trim()}`));
    proc.on('error', (err: Error) => {
      fastify.log.error(`[Sherlock] Falha ao iniciar Python: ${err.message}`);
      PIPELINE_STATUS = 'waiting';
    });
    proc.on('close', (code: number) => {
      if (code === 0) fastify.log.info('[Sherlock] Pipeline concluído com sucesso.');
      else fastify.log.error(`[Sherlock] Pipeline encerrou com código ${code}.`);
      // Se o webhook não foi chamado (pipeline saiu sem enviar dados), desbloqueia o status
      if (PIPELINE_STATUS === 'processing') {
        fastify.log.warn('[Sherlock] Pipeline encerrou sem disparar webhook — resetando status.');
        PIPELINE_STATUS = 'waiting';
      }
    });

    return reply.send({ status: 'running', message: 'Pipeline Sherlock iniciado localmente.' });
  });

  // POST /api/sherlock/instagram-research — pesquisa Reels com keywords + período
  fastify.post('/instagram-research', async (
    req: FastifyRequest<{ Body: { keywords: string[]; days: number } }>,
    reply: FastifyReply,
  ) => {
    const { keywords, days } = req.body;

    if (!keywords?.length || keywords.length > 3) {
      return reply.status(400).send({ error: 'Envie entre 1 e 3 keywords.' });
    }
    if (![30, 45, 60, 90].includes(days)) {
      return reply.status(400).send({ error: 'Período deve ser 30, 45, 60 ou 90 dias.' });
    }

    fastify.log.info(`[Sherlock] Instagram research: keywords=${keywords.join(',')} days=${days}`);

    return new Promise((resolve) => {
      const sherlockDir = path.join(process.cwd(), '..', '..', '..', 'sherlock');
      const script = path.join(sherlockDir, 'src', 'instagram_research.py');

      const proc = spawn('python', [script, '--keywords', ...keywords, '--days', String(days)], {
        cwd: path.join(sherlockDir, 'src'),
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
      });

      let output = '';
      let errOutput = '';

      proc.stdout.on('data', (d) => { output += d.toString(); });
      proc.stderr.on('data', (d) => { errOutput += d.toString(); });

      proc.on('close', (code) => {
        if (code !== 0) {
          fastify.log.error(`[Sherlock] Instagram research falhou: ${errOutput}`);
          resolve(reply.status(500).send({ error: 'Falha na pesquisa do Instagram', details: errOutput.slice(-500) }));
          return;
        }

        try {
          const result = JSON.parse(output.trim().split('\n').pop() || '[]');
          resolve(reply.send({ status: 'success', reels: result, count: result.length }));
        } catch {
          resolve(reply.status(500).send({ error: 'Falha ao parsear resultado', raw: output.slice(-300) }));
        }
      });

      // Timeout de 5 minutos (scraping pode demorar)
      setTimeout(() => {
        proc.kill();
        resolve(reply.status(408).send({ error: 'Timeout — pesquisa demorou mais de 5 minutos.' }));
      }, 5 * 60 * 1000);
    });
  });
}
