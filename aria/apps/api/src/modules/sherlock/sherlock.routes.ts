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
  search_meta?: {
    sources?: string[];
    days?: number;
    keywords?: string[];
    focus_keywords?: string[];
    triggered_at?: string;
  };
}

const MAX_TRENDS = 10;

type PipelineStatus = 'waiting' | 'processing' | 'ready';
let PIPELINE_STATUS: PipelineStatus = 'waiting';
let SOURCE_PROGRESS: Record<string, 'waiting' | 'running' | 'done' | 'error'> = {};
let LAST_TRIGGER_META: TrendReport['search_meta'] | null = null;

const SHERLOCK_BASE = path.resolve(__dirname, '..', '..', '..', '..', '..', '..', 'sherlock');
const REPORT_FILE = path.join(SHERLOCK_BASE, 'last_report.json');
const REPORTS_DIR = path.join(SHERLOCK_BASE, 'reports');

function loadReport(): TrendReport | null {
  try {
    if (fs.existsSync(REPORT_FILE)) return JSON.parse(fs.readFileSync(REPORT_FILE, 'utf-8'));
  } catch {}
  return null;
}

function saveReport(report: TrendReport) {
  try { fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2)); } catch {}
  try {
    if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const rand = Math.random().toString(36).slice(2, 8);
    fs.writeFileSync(path.join(REPORTS_DIR, `report_${ts}_${rand}.json`), JSON.stringify(report, null, 2));
  } catch {}
}

function limitPerSource<T extends { source?: string }>(items: T[], maxPerSource: number): T[] {
  const out: T[] = [];
  const counts: Record<string, number> = {};
  for (const item of items) {
    const src = item.source ?? 'unknown';
    const current = counts[src] ?? 0;
    if (current >= maxPerSource) continue;
    counts[src] = current + 1;
    out.push(item);
  }
  return out;
}

export async function registerSherlockRoutes(fastify: FastifyInstance) {
  const pythonExe = process.env.PYTHON_EXE
    ?? (process.platform === 'win32' ? 'C:/Python314/python.exe' : 'python3');

  // GET /api/sherlock/dashboard
  fastify.get('/dashboard', async (_req: FastifyRequest, reply: FastifyReply) => {
    if (PIPELINE_STATUS === 'processing') {
      return reply.send({ status: 'processing', message: 'Pipeline em execução...', source_progress: SOURCE_PROGRESS });
    }
    const report = loadReport();
    if (!report) {
      return reply.send({ status: 'waiting', message: 'Nenhum relatório processado ainda.' });
    }
    return reply.send({
      status: 'ready',
      date: report.date,
      trends: limitPerSource(report.scored_trends ?? [], MAX_TRENDS),
      mashup_angle: report.mashup_angle,
      carousel_script: report.carousel_script,
    });
  });

  // POST /api/sherlock/webhook — recebe relatório do Python pipeline
  fastify.post('/webhook', async (
    req: FastifyRequest<{ Body: TrendReport }>,
    reply: FastifyReply,
  ) => {
    const reportToSave: TrendReport = {
      ...req.body,
      search_meta: req.body.search_meta ?? LAST_TRIGGER_META ?? undefined,
    };
    saveReport(reportToSave);
    LAST_TRIGGER_META = null;
    PIPELINE_STATUS = 'ready';
    fastify.log.info('[Sherlock] Relatório recebido e salvo em disco');
    return reply.send({ status: 'success' });
  });

  // POST /api/sherlock/trigger — executa pipeline localmente
  fastify.post('/trigger', async (
    req: FastifyRequest<{ Body: { sources?: string[]; keywords?: string[]; keywords_tiktok?: string[]; keywords_instagram?: string[]; focus_keywords?: string[]; days?: number; period_days?: number } }>,
    reply: FastifyReply,
  ) => {
    const sources = req.body?.sources ?? [];
    const keywordsGeneric = req.body?.keywords ?? [];
    const keywords_tiktok = req.body?.keywords_tiktok ?? (sources.includes('tiktok') ? keywordsGeneric : []);
    const keywords_instagram = req.body?.keywords_instagram ?? (sources.includes('instagram') ? keywordsGeneric : []);
    const focus_keywords = req.body?.focus_keywords ?? keywordsGeneric;
    const days = req.body?.days ?? req.body?.period_days ?? 30;
    const port = process.env.PORT ?? '3001';

    LAST_TRIGGER_META = {
      sources,
      days,
      keywords: keywordsGeneric,
      focus_keywords,
      triggered_at: new Date().toISOString(),
    };

    PIPELINE_STATUS = 'processing';
    SOURCE_PROGRESS = {};
    for (const s of (sources.length > 0 ? sources : ['g1', 'google_trends', 'reddit', 'youtube', 'instagram', 'tiktok', 'x'])) {
      SOURCE_PROGRESS[s] = 'waiting';
    }

    const sherlockDir = path.resolve(__dirname, '..', '..', '..', '..', '..', '..', 'sherlock');
    const scriptPath = path.join(sherlockDir, 'src', 'main.py');
    const args = [scriptPath];
    if (sources.length > 0) args.push('--sources', sources.join(','));
    if (keywords_tiktok.length > 0) args.push('--tiktok-keywords', keywords_tiktok.join(','));
    if (keywords_instagram.length > 0) args.push('--instagram-keywords', keywords_instagram.join(','));
    if (focus_keywords.length > 0) args.push('--focus-keywords', focus_keywords.join(','));
    args.push('--days', String(days));

    fastify.log.info(`[Sherlock] Iniciando pipeline local — fontes: ${sources.join(', ') || 'todas'} | tiktok_kw: ${keywords_tiktok.join(',') || 'nenhuma'}`);

    const proc = spawn(pythonExe, args, {
      cwd: path.join(sherlockDir, 'src'),
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        RENDER_WEBHOOK_URL: `http://localhost:${port}/api/sherlock/webhook`,
      },
      detached: false,
    });

    proc.stdout.on('data', (d: Buffer) => {
      const text = d.toString();
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        fastify.log.info(`[Sherlock] ${trimmed}`);
        if (trimmed.startsWith('SHERLOCK_PROGRESS:')) {
          const parts = trimmed.split(':');
          const src = parts[1];
          const status = parts[2] as 'waiting' | 'running' | 'done' | 'error';
          if (src && status) SOURCE_PROGRESS[src] = status;
        }
      }
    });
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
  // GET /api/sherlock/session-health - valida login/cookies de Instagram, X e TikTok
  fastify.get('/session-health', async (_req: FastifyRequest, reply: FastifyReply) => {
    return new Promise((resolve) => {
      const sherlockDir = path.resolve(__dirname, '..', '..', '..', '..', '..', '..', 'sherlock');
      const scriptPath = path.join(sherlockDir, 'src', 'session_health.py');

      const proc = spawn(pythonExe, [scriptPath], {
        cwd: path.join(sherlockDir, 'src'),
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
      });

      let output = '';
      let errOutput = '';

      proc.stdout.on('data', (d: Buffer) => { output += d.toString(); });
      proc.stderr.on('data', (d: Buffer) => { errOutput += d.toString(); });

      proc.on('close', (code: number) => {
        if (code !== 0) {
          fastify.log.error(`[Sherlock] session-health falhou: ${errOutput}`);
          resolve(reply.status(500).send({ error: 'session-health failed', details: errOutput.slice(-600) }));
          return;
        }

        try {
          const lastLine = output.trim().split('\n').pop() || '{}';
          const data = JSON.parse(lastLine);
          resolve(reply.send({ status: 'ok', ...data }));
        } catch {
          resolve(reply.status(500).send({ error: 'invalid session-health output', raw: output.slice(-600) }));
        }
      });

      setTimeout(() => {
        proc.kill();
        resolve(reply.status(408).send({ error: 'session-health timeout' }));
      }, 90_000);
    });
  });
  // GET /api/sherlock/history — lista relatórios salvos
  fastify.get('/history', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!fs.existsSync(REPORTS_DIR)) return reply.send({ reports: [] });
      const files = fs.readdirSync(REPORTS_DIR)
        .filter(f => f.startsWith('report_') && f.endsWith('.json'))
        .sort().reverse().slice(0, 20);
      const reports = files.flatMap(filename => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, filename), 'utf-8')) as TrendReport;
          const limited = limitPerSource(data.scored_trends ?? [], MAX_TRENDS);
          return [{
            id: filename.replace('.json', ''),
            date: data.date,
            trend_count: limited.length,
            search_meta: data.search_meta ?? null,
          }];
        } catch { return []; }
      });
      return reply.send({ reports });
    } catch {
      return reply.send({ reports: [] });
    }
  });

  // GET /api/sherlock/report/:id — carrega relatório histórico específico
  fastify.get('/report/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = req.params;
    if (!id.startsWith('report_') || id.includes('..') || id.includes('/')) {
      return reply.status(400).send({ error: 'ID inválido' });
    }
    const reportFile = path.join(REPORTS_DIR, `${id}.json`);
    if (!fs.existsSync(reportFile)) return reply.status(404).send({ error: 'Relatório não encontrado' });
    try {
      const report = JSON.parse(fs.readFileSync(reportFile, 'utf-8')) as TrendReport;
      return reply.send({
        status: 'ready',
        date: report.date,
        trends: limitPerSource(report.scored_trends ?? [], MAX_TRENDS),
        mashup_angle: report.mashup_angle,
        carousel_script: report.carousel_script,
      });
    } catch {
      return reply.status(500).send({ error: 'Erro ao carregar relatório' });
    }
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


