import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  initializeGoalsTable,
  createGoal,
  getGoals,
  getGoalById,
  updateGoalProgress,
  updateGoal,
  deleteGoal,
} from './goals.service';

export async function registerGoalsRoutes(fastify: FastifyInstance) {
  // Inicializar tabela ao registrar rotas
  initializeGoalsTable();

  // GET /api/graham/goals — Listar todas as metas
  fastify.get('/goals', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const goals = getGoals();
      return reply.send({ success: true, goals });
    } catch (err: any) {
      console.error('[Graham] /goals error:', err);
      return reply.status(500).send({ error: err.message ?? 'Erro ao carregar metas.' });
    }
  });

  // GET /api/graham/goals/:id — Obter meta específica
  fastify.get<{ Params: { id: string } }>('/goals/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const goal = getGoalById(req.params.id);
      if (!goal) {
        return reply.status(404).send({ error: 'Meta não encontrada.' });
      }
      return reply.send({ success: true, goal });
    } catch (err: any) {
      console.error('[Graham] /goals/:id error:', err);
      return reply.status(500).send({ error: err.message ?? 'Erro ao carregar meta.' });
    }
  });

  // POST /api/graham/goals — Criar nova meta
  fastify.post<{ Body: { description: string; targetValue: number } }>(
    '/goals',
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const { description, targetValue } = req.body;

        if (!description?.trim()) {
          return reply.status(400).send({ error: 'description é obrigatório' });
        }
        if (typeof targetValue !== 'number' || targetValue <= 0) {
          return reply.status(400).send({ error: 'targetValue deve ser um número positivo' });
        }

        const goal = createGoal(description, targetValue);
        return reply.status(201).send({ success: true, goal });
      } catch (err: any) {
        console.error('[Graham] POST /goals error:', err);
        return reply.status(500).send({ error: err.message ?? 'Erro ao criar meta.' });
      }
    },
  );

  // PATCH /api/graham/goals/:id/progress — Atualizar progresso da meta
  fastify.patch<{ Params: { id: string }; Body: { currentValue: number } }>(
    '/goals/:id/progress',
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const { currentValue } = req.body;

        if (typeof currentValue !== 'number' || currentValue < 0) {
          return reply.status(400).send({ error: 'currentValue deve ser um número não-negativo' });
        }

        const goal = updateGoalProgress(req.params.id, currentValue);
        if (!goal) {
          return reply.status(404).send({ error: 'Meta não encontrada.' });
        }

        return reply.send({ success: true, goal });
      } catch (err: any) {
        console.error('[Graham] PATCH /goals/:id/progress error:', err);
        return reply.status(500).send({ error: err.message ?? 'Erro ao atualizar progresso.' });
      }
    },
  );

  // PUT /api/graham/goals/:id — Atualizar meta
  fastify.put<{ Params: { id: string }; Body: { description?: string; targetValue?: number } }>(
    '/goals/:id',
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const goal = getGoalById(req.params.id);
        if (!goal) {
          return reply.status(404).send({ error: 'Meta não encontrada.' });
        }

        const description = req.body.description ?? goal.description;
        const targetValue = req.body.targetValue ?? goal.targetValue;

        if (!description?.trim()) {
          return reply.status(400).send({ error: 'description é obrigatório' });
        }
        if (typeof targetValue !== 'number' || targetValue <= 0) {
          return reply.status(400).send({ error: 'targetValue deve ser um número positivo' });
        }

        const updated = updateGoal(req.params.id, description, targetValue);
        return reply.send({ success: true, goal: updated });
      } catch (err: any) {
        console.error('[Graham] PUT /goals/:id error:', err);
        return reply.status(500).send({ error: err.message ?? 'Erro ao atualizar meta.' });
      }
    },
  );

  // DELETE /api/graham/goals/:id — Deletar meta
  fastify.delete<{ Params: { id: string } }>('/goals/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const deleted = deleteGoal(req.params.id);
      if (!deleted) {
        return reply.status(404).send({ error: 'Meta não encontrada.' });
      }
      return reply.send({ success: true, message: 'Meta deletada com sucesso.' });
    } catch (err: any) {
      console.error('[Graham] DELETE /goals/:id error:', err);
      return reply.status(500).send({ error: err.message ?? 'Erro ao deletar meta.' });
    }
  });
}
