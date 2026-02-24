import Fastify from 'fastify';
import { env } from './config/env';
import { logger } from './shared/logger';
import { AppError } from './shared/errors/AppError';
import { registerHelmetPlugin } from './plugins/helmet.plugin';
import { registerCorsPlugin } from './plugins/cors.plugin';
import { registerRateLimitPlugin } from './plugins/rate-limit.plugin';
import { registerChatRoutes } from './modules/chat/chat.routes';
import { registerDocumentsRoutes } from './modules/documents/documents.routes';
import { registerAuthRoutes } from './modules/auth/auth.routes';
import { registerClickUpRoutes } from './routes/clickup.routes';
import { registerAuthPlugin } from './plugins/auth.middleware';
import fastifyMultipart from '@fastify/multipart';
import { ChatService, contextStore, createOpenRouterClient } from '@aria/core';
import { setChatService } from './modules/chat/chat.controller';
import {
  initializeClickUpClient,
  initializeClickUpQueryService,
} from '@aria/integrations';


const startServer = async () => {
  const fastify = Fastify({});

  // Register plugins
  await registerHelmetPlugin(fastify);
  await registerCorsPlugin(fastify);
  await registerRateLimitPlugin(fastify);
  await fastify.register(fastifyMultipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

  // Initialize OpenRouter client (compatible with Anthropic interface) and ChatService
  const openRouterClient = createOpenRouterClient(env.OPENROUTER_API_KEY);

  // Initialize ClickUp integration (if configured)
  const clickupApiToken = process.env.CLICKUP_API_TOKEN;
  const clickupListId = process.env.CLICKUP_DEFAULT_LIST_ID || process.env.CLICKUP_ID_LIST;
  const clickupTeamId = process.env.CLICKUP_TEAM_ID;
  const clickupUserId = process.env.CLICKUP_USER_ID ? parseInt(process.env.CLICKUP_USER_ID) : 164632817; // Erick's user ID

  console.log('[server] ClickUp Config Check:', {
    hasToken: !!clickupApiToken,
    hasListId: !!clickupListId,
    listId: clickupListId,
    userId: clickupUserId,
  });

  let clickupQueryService = undefined;
  if (clickupApiToken && clickupListId) {
    const clickupClient = initializeClickUpClient(clickupApiToken, clickupListId);
    clickupQueryService = initializeClickUpQueryService(clickupClient, clickupTeamId ?? '', clickupListId, clickupUserId);
    console.log('[server] ClickUp integration initialized ✓');
  } else {
    console.warn('[server] ClickUp not configured — set CLICKUP_API_TOKEN and CLICKUP_DEFAULT_LIST_ID or CLICKUP_ID_LIST');
  }

  const chatService = new ChatService(openRouterClient, contextStore, clickupQueryService);
  setChatService(chatService);



  // Health endpoint
  fastify.get('/health', async (req, reply) => {
    return reply.send({
      status: 'ok',
      uptime: process.uptime(),
    });
  });

  // Register child routes
  await fastify.register(registerChatRoutes, { prefix: '/api/chat' });
  await fastify.register(registerDocumentsRoutes, { prefix: '/api' });
  await fastify.register(registerAuthRoutes, { prefix: '/api' });
  await fastify.register(registerClickUpRoutes, { prefix: '/api/clickup', clickupQueryService });

  // Global error handler
  fastify.setErrorHandler((error, req, reply) => {
    if (error instanceof AppError) {
      return reply
        .status(error.options?.statusCode || 400)
        .send(error.toJSON());
    }

    if (req.log) {
      req.log.error(error);
    }
    return reply.status(500).send({
      error: 'Internal server error',
      code: 'INTERNAL_001',
    });
  });

  try {
    await fastify.listen({ port: env.PORT, host: '0.0.0.0' });
    logger.info(`Server running at http://localhost:${env.PORT}`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }

  // Graceful shutdown for zero-downtime deploys
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    try {
      await fastify.close();
      logger.info('Server closed gracefully');
      process.exit(0);
    } catch (err) {
      logger.error(`Error during shutdown: ${err}`);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer();
