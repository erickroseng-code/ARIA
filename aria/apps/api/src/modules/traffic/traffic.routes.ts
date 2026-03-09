import { FastifyPluginAsync } from 'fastify';
import { TrafficService } from './traffic.service';

const trafficService = new TrafficService();

export const registerTrafficRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/traffic/workspaces — lista workspaces configurados (pety, erick)
  fastify.get('/workspaces', async (_req, reply) => {
    try {
      const workspaces = trafficService.getWorkspaces();
      return reply.send(workspaces);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
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
      return reply.status(500).send({ error: error.message });
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
        return reply.status(500).send({ error: error.message });
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
        return reply.status(500).send({ error: error.message });
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
        return reply.status(500).send({ error: error.message });
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
        return reply.status(500).send({ error: error.message });
      }
    }
  );
};
