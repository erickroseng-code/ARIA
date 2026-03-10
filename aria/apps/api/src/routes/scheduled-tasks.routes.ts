import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sendTelegram } from '../shared/telegram';
import { TrafficService } from '../modules/traffic/traffic.service';
import { atlasSchedulerRun } from '../modules/traffic/agents/atlas-orchestrator';

function checkSchedulerAuth(req: FastifyRequest, reply: FastifyReply): boolean {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const secret = process.env.SCHEDULER_SECRET;
  if (!secret || !token || token !== secret) {
    reply.status(401).send({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

const trafficService = new TrafficService();

export async function registerScheduledTasksRoutes(fastify: FastifyInstance): Promise<void> {

  // POST /api/tasks/weekly-report — Weekly Atlas metrics report via Telegram
  fastify.post('/weekly-report', async (req, reply) => {
    if (!checkSchedulerAuth(req, reply)) return;

    const body = req.body as any ?? {};
    const workspaceId = body.workspaceId ?? process.env.ATLAS_DEFAULT_WORKSPACE ?? 'erick';
    const accountId = body.accountId ?? process.env.ATLAS_DEFAULT_ACCOUNT_ID ?? '';
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!accountId) {
      return reply.status(400).send({ error: 'accountId is required (or set ATLAS_DEFAULT_ACCOUNT_ID in .env)' });
    }

    const executedAt = new Date().toISOString();

    try {
      const insights = await trafficService.getAccountInsights(accountId, workspaceId, 'last_7d');
      const campaigns = await trafficService.getCampaigns(accountId, workspaceId);

      const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE').length;
      const currency = 'BRL';
      const fmt = (v: number) => `R$ ${v.toFixed(2)}`;

      const message =
        `📊 <b>Relatório Semanal — Atlas</b>\n` +
        `📅 ${new Date().toLocaleDateString('pt-BR')}\n\n` +
        `💰 Gasto total: ${fmt(insights.total_spend)}\n` +
        `👁 Impressões: ${insights.total_impressions.toLocaleString('pt-BR')}\n` +
        `🖱 Cliques: ${insights.total_clicks.toLocaleString('pt-BR')}\n` +
        `📈 CTR médio: ${insights.avg_ctr.toFixed(2)}%\n` +
        `💵 CPC médio: ${fmt(insights.avg_cpc)}\n` +
        `🎯 ROAS médio: ${insights.avg_roas.toFixed(2)}x\n\n` +
        `Campanhas ativas: ${activeCampaigns} de ${campaigns.length}`;

      if (chatId) {
        await sendTelegram(chatId, message);
      }

      return reply.send({ task: 'weekly-report', executedAt, success: true, result: 'Report sent' });
    } catch (error: any) {
      return reply.status(500).send({ task: 'weekly-report', executedAt, success: false, error: error.message });
    }
  });

  // POST /api/tasks/atlas-optimize — Trigger Atlas autonomous optimization
  fastify.post('/atlas-optimize', async (req, reply) => {
    if (!checkSchedulerAuth(req, reply)) return;

    const body = req.body as any ?? {};
    const workspaceId = body.workspaceId ?? process.env.ATLAS_DEFAULT_WORKSPACE ?? 'erick';
    const accountId = body.accountId ?? process.env.ATLAS_DEFAULT_ACCOUNT_ID ?? '';
    const dryRun: boolean = body.dryRun !== undefined ? Boolean(body.dryRun) : true;

    if (!accountId) {
      return reply.status(400).send({ error: 'accountId is required (or set ATLAS_DEFAULT_ACCOUNT_ID in .env)' });
    }

    const executedAt = new Date().toISOString();

    try {
      const [insights, campaigns] = await Promise.all([
        trafficService.getAccountInsights(accountId, workspaceId, 'last_7d'),
        trafficService.getCampaigns(accountId, workspaceId),
      ]);

      const ctx = { workspace: workspaceId, accountId, insights, campaigns };
      const result = await atlasSchedulerRun(ctx, trafficService, dryRun);

      return reply.send({ task: 'atlas-optimize', executedAt, success: true, result });
    } catch (error: any) {
      return reply.status(500).send({ task: 'atlas-optimize', executedAt, success: false, error: error.message });
    }
  });

  // POST /api/tasks/maverick-research — Trigger Maverick trend research
  fastify.post('/maverick-research', async (req, reply) => {
    if (!checkSchedulerAuth(req, reply)) return;

    const executedAt = new Date().toISOString();

    // Maverick research will be implemented in Epic 10
    if (!process.env.MAVERICK_ENABLED || process.env.MAVERICK_ENABLED !== 'true') {
      return reply.send({
        task: 'maverick-research',
        executedAt,
        success: true,
        skipped: true,
        reason: 'Maverick not configured (set MAVERICK_ENABLED=true after Epic 10)',
      });
    }

    // Placeholder — Epic 10 will implement the actual logic
    return reply.send({ task: 'maverick-research', executedAt, success: true, result: 'Not yet implemented' });
  });
}
