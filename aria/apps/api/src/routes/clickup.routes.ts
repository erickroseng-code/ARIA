import type { FastifyInstance } from 'fastify';
import { logger } from '../shared/logger';

/**
 * Direct ClickUp routes - NO LLM PROCESSING
 * These endpoints return data directly from ClickUp without any AI interpretation
 */
export async function registerClickUpRoutes(
  fastify: FastifyInstance,
  options: { clickupQueryService?: any },
) {
  const { clickupQueryService } = options;

  if (!clickupQueryService) {
    logger.warn('[ClickUp Routes] ClickUp service not configured');
    return;
  }

  /**
   * GET /api/clickup/my-tasks
   * Returns user's tasks directly from ClickUp (NO LLM)
   */
  fastify.get(
    '/my-tasks',
    async (req, reply) => {
      try {
        const filter = (req.query as any)?.filter; // 'today' | 'overdue' | undefined
        const withSubtasks = (req.query as any)?.subtasks === 'true';

        logger.info({ filter, withSubtasks }, '[ClickUp] Fetching my tasks');

        let tasks;
        if (withSubtasks) {
          tasks = await clickupQueryService.getMyTasksWithSubtasks(filter);
        } else {
          tasks = await clickupQueryService.getMyTasks(filter);
        }

        logger.info(`[ClickUp] Got ${tasks.length} tasks`);

        return reply.send({
          success: true,
          count: tasks.length,
          data: tasks,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error({ error }, '[ClickUp] Error fetching my tasks');
        return reply
          .status(500)
          .send({
            success: false,
            error: 'Failed to fetch ClickUp tasks',
            message: error instanceof Error ? error.message : String(error),
          });
      }
    },
  );

  /**
   * GET /api/clickup/client-pipeline
   * Returns client pipeline tasks directly from ClickUp (NO LLM)
   */
  fastify.get(
    '/client-pipeline',
    async (req, reply) => {
      try {
        const statusFilter = (req.query as any)?.status || 'all'; // 'em andamento' | 'aguardando' | 'all'

        logger.info({ statusFilter }, '[ClickUp] Fetching client pipeline');

        const pipeline = await clickupQueryService.getClientPipeline(statusFilter);

        logger.info(`[ClickUp] Got ${pipeline.length} pipeline items`);

        return reply.send({
          success: true,
          count: pipeline.length,
          data: pipeline,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error({ error }, '[ClickUp] Error fetching client pipeline');
        return reply
          .status(500)
          .send({
            success: false,
            error: 'Failed to fetch ClickUp pipeline',
            message: error instanceof Error ? error.message : String(error),
          });
      }
    },
  );

  /**
   * GET /api/clickup/tasks/:taskId
   * Returns specific task details directly from ClickUp (NO LLM)
   */
  fastify.get(
    '/tasks/:taskId',
    async (req, reply) => {
      try {
        const { taskId } = req.params as { taskId: string };

        logger.info({ taskId }, '[ClickUp] Fetching task details');

        // Try to get task directly from ClickUp
        const task = await clickupQueryService.getTaskById?.(taskId) ||
          (await clickupQueryService.getMyTasks()).find((t: any) => t.id === taskId);

        if (!task) {
          return reply
            .status(404)
            .send({
              success: false,
              error: 'Task not found',
              taskId,
            });
        }

        return reply.send({
          success: true,
          data: task,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error({ error }, '[ClickUp] Error fetching task');
        return reply
          .status(500)
          .send({
            success: false,
            error: 'Failed to fetch ClickUp task',
            message: error instanceof Error ? error.message : String(error),
          });
      }
    },
  );

  /**
   * GET /api/clickup/search
   * Search tasks by keyword (NO LLM interpretation, just filtering)
   */
  fastify.get(
    '/search',
    async (req, reply) => {
      try {
        const query = (req.query as any)?.q || (req.query as any)?.query;

        if (!query || query.trim().length === 0) {
          return reply
            .status(400)
            .send({
              success: false,
              error: 'Query parameter required (use ?q= or ?query=)',
            });
        }

        logger.info({ query }, '[ClickUp] Searching tasks');

        const allTasks = await clickupQueryService.getMyTasks();
        const lowerQuery = query.toLowerCase();

        const results = allTasks.filter(
          (task: any) =>
            (task.name?.toLowerCase().includes(lowerQuery) ?? false) ||
            (task.description?.toLowerCase().includes(lowerQuery) ?? false) ||
            (task.status?.toLowerCase().includes(lowerQuery) ?? false),
        );

        logger.info(`[ClickUp] Found ${results.length} matching tasks`);

        return reply.send({
          success: true,
          query,
          count: results.length,
          data: results,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error({ error }, '[ClickUp] Error searching tasks');
        return reply
          .status(500)
          .send({
            success: false,
            error: 'Failed to search ClickUp tasks',
            message: error instanceof Error ? error.message : String(error),
          });
      }
    },
  );

  logger.info('[ClickUp Routes] Registered 4 direct endpoints (NO LLM)');
}
