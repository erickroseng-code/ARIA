import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { spawn } from 'child_process';
import path from 'path';

interface TrendReport {
  date: string;
  mashup_angle: string;
  carousel_script: string;
  top_news: Record<string, any>;
  top_trend: Record<string, any>;
  scored_trends?: any[];
}

let LATEST_REPORT: TrendReport | null = null;

export async function registerSherlockRoutes(fastify: FastifyInstance) {

  // GET /api/sherlock/dashboard
  fastify.get('/dashboard', async (_req: FastifyRequest, reply: FastifyReply) => {
    if (!LATEST_REPORT) {
      return reply.send({ status: 'waiting', message: 'Nenhum relatório processado ainda hoje.' });
    }
    return reply.send({
      status: 'ready',
      date: LATEST_REPORT.date,
      mashup: LATEST_REPORT.mashup_angle,
      script: LATEST_REPORT.carousel_script,
      top_sources: [
        LATEST_REPORT.top_news?.source ?? 'N/A',
        LATEST_REPORT.top_trend?.source ?? 'N/A',
      ],
    });
  });

  // POST /api/sherlock/webhook — recebe relatório do GitHub Actions
  fastify.post('/webhook', async (
    req: FastifyRequest<{ Body: TrendReport }>,
    reply: FastifyReply,
  ) => {
    LATEST_REPORT = req.body;
    fastify.log.info('[Sherlock] Relatório recebido via webhook');
    return reply.send({ status: 'success' });
  });

  // POST /api/sherlock/trigger — dispara GitHub Actions workflow_dispatch
  fastify.post('/trigger', async (_req: FastifyRequest, reply: FastifyReply) => {
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO ?? 'erick/aios-core';

    LATEST_REPORT = {
      date: new Date().toISOString(),
      mashup_angle: 'Gerando dados... Aguarde.',
      carousel_script: '[SLIDE 1]\nO agente Sherlock está processando as tendências do dia.\nAtualize em alguns minutos.',
      top_news: { source: 'Processando...' },
      top_trend: { source: 'Processando...' },
    };

    if (!token) {
      fastify.log.warn('[Sherlock] GITHUB_TOKEN não configurado — trigger ignorado');
      return reply.send({ status: 'processing', message: 'Relatório em geração (sem trigger automático).' });
    }

    try {
      const res = await fetch(
        `https://api.github.com/repos/${repo}/actions/workflows/sherlock-daily.yml/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ref: 'master' }),
        },
      );

      if (!res.ok) {
        const err = await res.text();
        fastify.log.error(`[Sherlock] GitHub Actions trigger falhou: ${err}`);
        return reply.status(500).send({ error: 'Falha ao disparar GitHub Actions' });
      }

      fastify.log.info('[Sherlock] GitHub Actions workflow_dispatch disparado');
      return reply.send({ status: 'success', message: 'Pipeline Sherlock iniciado via GitHub Actions.' });
    } catch (err: any) {
      fastify.log.error(`[Sherlock] Erro ao chamar GitHub API: ${err.message}`);
      return reply.status(500).send({ error: err.message });
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
      const sherlockDir = path.join(process.cwd(), '..', '..', '..', '..', 'sherlock');
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
