import Fastify from 'fastify';
import { env } from './config/env';
import { logger } from './shared/logger';
import { AppError } from './shared/errors/AppError';
import { registerHelmetPlugin } from './plugins/helmet.plugin';
import { registerCorsPlugin } from './plugins/cors.plugin';
import { registerRateLimitPlugin } from './plugins/rate-limit.plugin';
import { registerChatRoutes } from './modules/chat/chat.routes';
import { ChatService, contextStore } from '@aria/core';
import { createOpenRouterClient } from '@aria/core/ai/OpenRouterAdapter';
import { setChatService } from './modules/chat/chat.controller';

const startServer = async () => {
  const fastify = Fastify({});

  // Register plugins
  await registerHelmetPlugin(fastify);
  await registerCorsPlugin(fastify);
  await registerRateLimitPlugin(fastify);

  // Initialize OpenRouter client (compatible with Anthropic interface) and ChatService
  const openRouterClient = createOpenRouterClient(env.OPENROUTER_API_KEY);
  const chatService = new ChatService(openRouterClient, contextStore);
  setChatService(chatService);

  // Health endpoint
  fastify.get('/health', async (req, reply) => {
    return reply.send({
      status: 'ok',
      uptime: process.uptime(),
    });
  });

  // Register chat routes
  await fastify.register(registerChatRoutes, { prefix: '/api/chat' });

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
};

startServer();
