import { FastifyPluginAsync } from 'fastify';
import { TrafficService, RateLimitError } from './traffic.service';
import { atlasChat, atlasAutoAnalyze, atlasSchedulerRun } from './agents/atlas-orchestrator';
import { getAuditLogs } from './agents/atlas-audit';
import { sendAtlasNotification, sendAtlasErrorAlert } from './agents/atlas-notifier';
import { listCreativesFromDrive, generateCreativeCopy } from './agents/atlas-creative-service';

const trafficService = new TrafficService();

function sendError(reply: any, error: any) {
  if (error instanceof RateLimitError) {
    return reply.status(429).send({ error: error.message, rateLimit: true });
  }
  return reply.status(500).send({ error: error.message });
}

export const registerTrafficRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/traffic/workspaces — lista workspaces configurados (pety, erick)
  fastify.get('/workspaces', async (_req, reply) => {
    try {
      const workspaces = trafficService.getWorkspaces();
      return reply.send(workspaces);
    } catch (error: any) {
      return sendError(reply, error);
    }
  });

  // GET /api/traffic/accounts?workspace=pety
  fastify.get<{ Querystring: { workspace: string } }>('/accounts', async (req, reply) => {
    const { workspace } = req.query;
    if (!workspace) return reply.status(400).send({ error: 'workspace é obrigatório' });
    try {
      const accounts = await trafficService.getAccounts(workspace);
      return reply.send(accounts);
    } catch (error: any) {
      return sendError(reply, error);
    }
  });

  // GET /api/traffic/campaigns?accountId=act_xxx&workspace=pety
  fastify.get<{ Querystring: { accountId: string; workspace: string } }>(
    '/campaigns',
    async (req, reply) => {
      const { accountId, workspace } = req.query;
      if (!accountId || !workspace)
        return reply.status(400).send({ error: 'accountId e workspace são obrigatórios' });
      try {
        const campaigns = await trafficService.getCampaigns(accountId, workspace);
        return reply.send(campaigns);
      } catch (error: any) {
        return sendError(reply, error);
      }
    }
  );

  // GET /api/traffic/insights?accountId=act_xxx&workspace=pety&datePreset=last_30d
  fastify.get<{ Querystring: { accountId: string; workspace: string; datePreset?: string } }>(
    '/insights',
    async (req, reply) => {
      const { accountId, workspace, datePreset } = req.query;
      if (!accountId || !workspace)
        return reply.status(400).send({ error: 'accountId e workspace são obrigatórios' });
      try {
        const insights = await trafficService.getAccountInsights(
          accountId,
          workspace,
          datePreset || 'last_30d'
        );
        return reply.send(insights);
      } catch (error: any) {
        return sendError(reply, error);
      }
    }
  );

  // GET /api/traffic/insights/timeseries?accountId=...&workspace=...&datePreset=...
  // Retorna série temporal diária (para sparklines e gráficos de linha)
  fastify.get<{ Querystring: { accountId: string; workspace: string; datePreset?: string } }>(
    '/insights/timeseries',
    async (req, reply) => {
      const { accountId, workspace, datePreset } = req.query;
      if (!accountId || !workspace)
        return reply.status(400).send({ error: 'accountId e workspace são obrigatórios' });
      try {
        const series = await trafficService.getAccountTimeseries(
          accountId,
          workspace,
          datePreset || 'last_30d'
        );
        return reply.send(series);
      } catch (error: any) {
        return sendError(reply, error);
      }
    }
  );

  // GET /api/traffic/ads/insights?accountId=...&workspace=...&datePreset=...
  // Retorna anúncios com métricas + criativo (thumbnail, título, copy), ordenado por CTR desc
  fastify.get<{ Querystring: { accountId: string; workspace: string; datePreset?: string } }>(
    '/ads/insights',
    async (req, reply) => {
      const { accountId, workspace, datePreset } = req.query;
      if (!accountId || !workspace)
        return reply.status(400).send({ error: 'accountId e workspace são obrigatórios' });
      try {
        const ads = await trafficService.getAdsWithCreatives(
          accountId,
          workspace,
          datePreset || 'last_30d'
        );
        return reply.send(ads);
      } catch (error: any) {
        return sendError(reply, error);
      }
    }
  );

  // POST /api/traffic/insights/batch — buscar métricas de múltiplas contas
  fastify.post<{
    Body: {
      accounts: Array<{ accountId: string; workspace: string; accountName?: string }>;
      datePreset?: string;
    };
  }>('/insights/batch', async (req, reply) => {
    const { accounts, datePreset } = req.body;
    if (!accounts || !Array.isArray(accounts) || accounts.length === 0)
      return reply.status(400).send({ error: 'accounts é obrigatório e deve ser um array não vazio' });

    try {
      const results = await Promise.all(
        accounts.map(async (acc) => {
          try {
            const insights = await trafficService.getAccountInsights(
              acc.accountId,
              acc.workspace,
              datePreset || 'last_30d'
            );
            return {
              accountId: acc.accountId,
              accountName: acc.accountName || acc.accountId,
              workspace: acc.workspace,
              insights,
              error: null,
            };
          } catch (err: any) {
            return {
              accountId: acc.accountId,
              accountName: acc.accountName || acc.accountId,
              workspace: acc.workspace,
              insights: null,
              error: err.message || 'Erro ao buscar insights',
            };
          }
        })
      );
      return reply.send(results);
    } catch (error: any) {
      return sendError(reply, error);
    }
  });

  // GET /api/traffic/adsets?campaignId=xxx&workspace=erick
  fastify.get<{ Querystring: { campaignId: string; workspace: string } }>(
    '/adsets',
    async (req, reply) => {
      const { campaignId, workspace } = req.query;
      if (!campaignId || !workspace)
        return reply.status(400).send({ error: 'campaignId e workspace são obrigatórios' });
      try {
        const adsets = await trafficService.getAdSets(campaignId, workspace);
        return reply.send(adsets);
      } catch (error: any) {
        return sendError(reply, error);
      }
    }
  );

  // GET /api/traffic/ads?adsetId=xxx&workspace=erick
  fastify.get<{ Querystring: { adsetId: string; workspace: string } }>(
    '/ads',
    async (req, reply) => {
      const { adsetId, workspace } = req.query;
      if (!adsetId || !workspace)
        return reply.status(400).send({ error: 'adsetId e workspace são obrigatórios' });
      try {
        const ads = await trafficService.getAds(adsetId, workspace);
        return reply.send(ads);
      } catch (error: any) {
        return sendError(reply, error);
      }
    }
  );

  // POST /api/traffic/campaigns/:id/pause
  fastify.post<{ Params: { id: string }; Body: { workspace: string } }>(
    '/campaigns/:id/pause',
    async (req, reply) => {
      const { id } = req.params;
      const { workspace } = req.body;
      if (!workspace) return reply.status(400).send({ error: 'workspace é obrigatório' });
      try {
        await trafficService.pauseCampaign(id, workspace);
        return reply.send({ success: true });
      } catch (error: any) {
        return sendError(reply, error);
      }
    }
  );

  // POST /api/traffic/campaigns/:id/enable
  fastify.post<{ Params: { id: string }; Body: { workspace: string } }>(
    '/campaigns/:id/enable',
    async (req, reply) => {
      const { id } = req.params;
      const { workspace } = req.body;
      if (!workspace) return reply.status(400).send({ error: 'workspace é obrigatório' });
      try {
        await trafficService.enableCampaign(id, workspace);
        return reply.send({ success: true });
      } catch (error: any) {
        return sendError(reply, error);
      }
    }
  );

  // POST /api/traffic/campaigns/:id/budget
  fastify.post<{ Params: { id: string }; Body: { workspace: string; dailyBudget: number } }>(
    '/campaigns/:id/budget',
    async (req, reply) => {
      const { id } = req.params;
      const { workspace, dailyBudget } = req.body;
      if (!workspace || !dailyBudget) return reply.status(400).send({ error: 'workspace e dailyBudget são obrigatórios' });
      try {
        await trafficService.updateCampaignBudget(id, dailyBudget, workspace);
        return reply.send({ success: true });
      } catch (error: any) {
        return sendError(reply, error);
      }
    }
  );

  // POST /api/traffic/chat — Atlas AI chat
  fastify.post<{
    Body: {
      message: string;
      history: Array<{ role: 'user' | 'assistant'; content: string }>;
      workspace: string;
      accountId: string;
      accountName?: string;
      currency?: string;
      datePreset?: string;
    };
  }>('/chat', async (req, reply) => {
    const { message, history = [], workspace, accountId, accountName, currency, datePreset } = req.body;
    if (!message || !workspace || !accountId)
      return reply.status(400).send({ error: 'message, workspace e accountId são obrigatórios' });

    try {
      // Carrega dados frescos para contexto
      const [insights, rawCampaigns] = await Promise.all([
        trafficService.getAccountInsights(accountId, workspace, datePreset ?? 'last_30d'),
        trafficService.getCampaigns(accountId, workspace),
      ]);

      // Enrich active campaigns with AdSet and Ad data (limit to 5 to avoid enormous prompts)
      const activeCampaigns = rawCampaigns.filter(c => c.status === 'ACTIVE').slice(0, 5);
      const enrichedCampaigns = await Promise.all(
        rawCampaigns.map(async (c) => {
          if (!activeCampaigns.find(ac => ac.id === c.id)) return c;
          try {
            const adsets = await trafficService.getAdSets(c.id, workspace);
            const enrichedAdsets = await Promise.all(adsets.map(async (as) => {
              const ads = await trafficService.getAds(as.id, workspace);
              return { ...as, ads };
            }));
            return { ...c, adsets: enrichedAdsets };
          } catch (e) {
            return c;
          }
        })
      );

      const result = await atlasChat(message, history, {
        workspace, accountId, accountName, currency, insights, campaigns: enrichedCampaigns, datePreset,
      }, trafficService);

      return reply.send(result);
    } catch (error: any) {
      return sendError(reply, error);
    }
  });

  // POST /api/traffic/atlas/auto-optimize — Autonomous scheduler (called by GitHub Actions)
  fastify.post<{
    Body: {
      workspaceId: string;
      accountId: string;
      dryRun?: boolean;
      datePreset?: string;
    };
  }>('/atlas/auto-optimize', async (req, reply) => {
    // Auth check via Bearer token
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    const schedulerToken = process.env.ATLAS_SCHEDULER_TOKEN;

    if (!schedulerToken || !token || token !== schedulerToken) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { workspaceId, accountId, dryRun = true, datePreset = 'last_7d' } = req.body;
    if (!workspaceId || !accountId) {
      return reply.status(400).send({ error: 'workspaceId e accountId são obrigatórios' });
    }

    try {
      // Load fresh campaign data with timeout
      const dataPromise = Promise.all([
        trafficService.getAccountInsights(accountId, workspaceId, datePreset),
        trafficService.getCampaigns(accountId, workspaceId),
      ]);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Data loading timeout after 30s')), 30000)
      );

      const [insights, campaigns] = await Promise.race([dataPromise, timeoutPromise]);

      const ctx = { workspace: workspaceId, accountId, insights, campaigns, datePreset };
      const result = await atlasSchedulerRun(ctx, trafficService, dryRun);

      // Send Telegram notification (non-blocking)
      sendAtlasNotification(result.actionsExecuted, dryRun).catch(() => {});

      return reply.send({ ...result, dryRun });
    } catch (error: any) {
      // Alert on critical failure
      sendAtlasErrorAlert(error.message).catch(() => {});
      return sendError(reply, error);
    }
  });

  // GET /api/traffic/atlas/audit — Audit log history
  fastify.get<{ Querystring: { limit?: string; workspaceId?: string } }>(
    '/atlas/audit',
    async (req, reply) => {
      const { limit, workspaceId } = req.query;
      const logs = getAuditLogs(workspaceId, limit ? parseInt(limit) : 50);
      return reply.send({ logs });
    }
  );

  // POST /api/traffic/analyze — Atlas AI auto-analysis
  fastify.post<{
    Body: { workspace: string; accountId: string; accountName?: string; currency?: string; datePreset?: string };
  }>('/analyze', async (req, reply) => {
    const { workspace, accountId, accountName, currency, datePreset } = req.body;
    if (!workspace || !accountId)
      return reply.status(400).send({ error: 'workspace e accountId são obrigatórios' });

    try {
      const [insights, rawCampaigns] = await Promise.all([
        trafficService.getAccountInsights(accountId, workspace, datePreset ?? 'last_30d'),
        trafficService.getCampaigns(accountId, workspace),
      ]);

      const activeCampaigns = rawCampaigns.filter(c => c.status === 'ACTIVE').slice(0, 5);
      const enrichedCampaigns = await Promise.all(
        rawCampaigns.map(async (c) => {
          if (!activeCampaigns.find(ac => ac.id === c.id)) return c;
          try {
            const adsets = await trafficService.getAdSets(c.id, workspace);
            const enrichedAdsets = await Promise.all(adsets.map(async (as) => {
              const ads = await trafficService.getAds(as.id, workspace);
              return { ...as, ads };
            }));
            return { ...c, adsets: enrichedAdsets };
          } catch (e) {
            return c;
          }
        })
      );

      const analysis = await atlasAutoAnalyze({
        workspace, accountId, accountName, currency, insights, campaigns: enrichedCampaigns, datePreset,
      }, trafficService);

      return reply.send({ analysis });
    } catch (error: any) {
      return sendError(reply, error);
    }
  });

  // GET /api/traffic/atlas/creatives — list creatives from Google Drive folder
  fastify.get('/atlas/creatives', async (_req, reply) => {
    try {
      const files = await listCreativesFromDrive();
      return reply.send({ files, folderId: process.env.ATLAS_CREATIVE_DRIVE_FOLDER_ID ?? null });
    } catch (error: any) {
      return sendError(reply, error);
    }
  });

  // POST /api/traffic/atlas/swap-creative — manual creative swap (web interface)
  fastify.post<{
    Body: {
      adId: string;
      adName?: string;
      driveFileId: string;
      workspace: string;
      accountId: string;
      newCopy?: boolean;
      productContext?: string;
      confirm?: boolean;
      proposedCopy?: { primaryText: string; title: string; description: string };
    };
  }>('/atlas/swap-creative', async (req, reply) => {
    const {
      adId, adName = 'Anúncio', driveFileId, workspace, accountId,
      newCopy = true, productContext, confirm = false, proposedCopy,
    } = req.body;

    if (!adId || !driveFileId || !workspace || !accountId) {
      return reply.status(400).send({ error: 'adId, driveFileId, workspace e accountId são obrigatórios' });
    }

    try {
      // 1. Fetch the creative file from Drive
      const allCreatives = await listCreativesFromDrive();
      const file = allCreatives.find(f => f.id === driveFileId);
      if (!file) {
        return reply.status(404).send({ error: 'Criativo não encontrado na pasta do Drive configurada' });
      }

      // 2. Generate copy if requested and not already proposed
      let copy = proposedCopy;
      if (!copy && newCopy) {
        copy = await generateCreativeCopy({
          adName,
          productContext,
          reason: 'Troca manual solicitada pela interface web',
        });
      } else if (!copy) {
        copy = { primaryText: '(manter copy atual)', title: '(manter)', description: '(manter)' };
      }

      // 3. If not confirmed, return the proposal for review
      if (!confirm) {
        return reply.send({
          proposal: {
            adId, adName, file,
            copy,
            status: 'pending_approval',
            message: 'Envie confirm:true com os mesmos parâmetros e proposedCopy para executar a troca.',
          },
        });
      }

      // 4. Execute the swap (requires ATLAS_WRITE_ENABLED=true)
      if (process.env.ATLAS_WRITE_ENABLED !== 'true') {
        return reply.send({
          executed: false,
          dryRun: true,
          message: '[MODO SEGURO] Troca registrada mas não aplicada. Defina ATLAS_WRITE_ENABLED=true para executar.',
          adId, file, copy,
        });
      }

      // Production: execute via TrafficService (update_ad_creative requires pageId/link)
      // This is a placeholder for the full creative upload flow (Story 8.6)
      return reply.send({
        executed: true,
        adId, adName, file, copy,
        message: `Criativo "${file.name}" proposto para o anúncio "${adName}". Integração completa com Meta Creative API em desenvolvimento (Story 8.6).`,
      });

    } catch (error: any) {
      return sendError(reply, error);
    }
  });
};

