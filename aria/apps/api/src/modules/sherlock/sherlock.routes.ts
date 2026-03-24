import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

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
}
