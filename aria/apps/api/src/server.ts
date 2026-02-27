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
import { registerScheduledReportsRoutes } from './routes/scheduled-reports-fastify.routes';
import { registerAudioRoutes } from './routes/audio-fastify.routes';
import { registerReportsRoutes } from './routes/reports-fastify.routes';
import { registerGoogleCalendarRoutes } from './routes/google-calendar-fastify.routes';
import { registerGoogleAuthRoutes } from './routes/google-auth.routes';
import { registerClickUpAuthRoutes } from './routes/clickup-auth.routes';
import { registerNotionAuthRoutes } from './routes/notion-auth.routes';
import { registerTelegramAuthRoutes } from './routes/telegram-auth.routes';
import { workspaceActionRoutes } from './routes/workspace-action.routes';
import { registerMaverickRoutes } from './modules/maverick/maverick.routes';
import { registerAuthPlugin } from './plugins/auth.middleware';
import fastifyMultipart from '@fastify/multipart';
import { ChatService, contextStore, createGroqClient } from '@aria/core';
import { setChatService } from './modules/chat/chat.controller';
import {
  initializeClickUpClient,
  initializeClickUpQueryService,
  setWorkspaceTokenResolver
} from '@aria/integrations';
import { db } from './config/db';


const startServer = async () => {
  const fastify = Fastify({});

  // Register plugins
  await registerHelmetPlugin(fastify);
  await registerCorsPlugin(fastify);
  await registerRateLimitPlugin(fastify);
  await fastify.register(fastifyMultipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

  // Inject Database Token Resolver for Google Workspace using native sqlite
  setWorkspaceTokenResolver(async () => {
    try {
      const stmt = db.prepare('SELECT refreshToken, accessToken, isValid FROM integrations WHERE provider = ?');
      const integration = stmt.get('google') as any;

      // If no integration or manually marked invalid, return null to force re-auth
      if (!integration || integration.isValid === 0) return null;
      return {
        accessToken: integration.accessToken,
        refreshToken: integration.refreshToken,
      };
    } catch (err) {
      console.error('[TokenResolver NativeDB] Error querying tokens:', err);
      return null;
    }
  });

  // Initialize Groq client (compatible with Anthropic interface) and ChatService
  // GROQ_API_KEY must be set in .env — server starts but chat won't work without it
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    console.error('[server] ❌ GROQ_API_KEY is not set in .env — add it to enable AI chat');
  }
  const groqClient = createGroqClient(groqApiKey);

  // Initialize ClickUp integration (if configured)
  // Support BOTH naming conventions: CLICKUP_API_KEY and CLICKUP_API_TOKEN
  const clickupApiToken = process.env.CLICKUP_API_TOKEN || process.env.CLICKUP_API_KEY;
  const clickupListId = process.env.CLICKUP_DEFAULT_LIST_ID || process.env.CLICKUP_ID_LIST || process.env.CLICKUP_LIST_ID;
  const clickupTeamId = process.env.CLICKUP_TEAM_ID;
  const clickupUserId = process.env.CLICKUP_USER_ID ? parseInt(process.env.CLICKUP_USER_ID) : undefined;

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
    console.warn('[server] ClickUp not configured — ensure CLICKUP_API_KEY and CLICKUP_LIST_ID are set in .env');
  }

  const chatService = new ChatService(groqClient, contextStore, clickupQueryService);
  setChatService(chatService);



  // Enhanced health endpoint with detailed diagnostics
  fastify.get('/health', async (req, reply) => {
    const health = {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        clickup: clickupQueryService ? 'configured' : 'not_configured',
        chat: !!chatService ? 'ready' : 'not_ready',
        fastify: 'ready',
      },
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
      },
    };

    // Check for any issues
    if (!clickupQueryService) {
      health.status = 'warning';
      console.warn('[Health Check] ⚠️  ClickUp not configured');
    }
    if (!chatService) {
      health.status = 'error';
      console.error('[Health Check] ❌ Chat service not initialized');
    }

    return reply.code(health.status === 'ok' ? 200 : health.status === 'warning' ? 200 : 500).send(health);
  });

  // Register child routes
  await fastify.register(registerChatRoutes, { prefix: '/api/chat' });
  await fastify.register(registerDocumentsRoutes, { prefix: '/api' });
  await fastify.register(registerAuthRoutes, { prefix: '/api' });
  await fastify.register(registerClickUpRoutes, { prefix: '/api/clickup', clickupQueryService });
  await fastify.register(registerScheduledReportsRoutes, { prefix: '/api/scheduled-reports' });
  await fastify.register(registerAudioRoutes, { prefix: '/api/audio' });
  await fastify.register(registerReportsRoutes, { prefix: '/api/reports' });
  await fastify.register(registerGoogleCalendarRoutes, { prefix: '/api/calendar' });
  await fastify.register(registerGoogleAuthRoutes, { prefix: '/api/auth/google' });
  await fastify.register(registerClickUpAuthRoutes, { prefix: '/api/auth/clickup' });
  await fastify.register(registerNotionAuthRoutes, { prefix: '/api/auth/notion' });
  await fastify.register(registerTelegramAuthRoutes, { prefix: '/api/auth/telegram' });
  await fastify.register(workspaceActionRoutes);
  await fastify.register(registerMaverickRoutes, { prefix: '/api/maverick' });

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

  // Global error handlers to prevent crashes
  process.on('uncaughtException', (error) => {
    console.error('[CRITICAL] Uncaught Exception - Server will continue running:', error);
    logger.error(`[CRITICAL] Uncaught Exception: ${error instanceof Error ? error.message : String(error)}`);
    // Do NOT exit - keep server alive
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[CRITICAL] Unhandled Rejection - Server will continue running:', reason);
    logger.error(`[CRITICAL] Unhandled Rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
    // Do NOT exit - keep server alive
  });

  try {
    await fastify.listen({ port: env.PORT, host: '0.0.0.0' });
    logger.info(`✅ Server running at http://localhost:${env.PORT}`);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ ARIA API Server STABLE`);
    console.log(`   URL: http://localhost:${env.PORT}`);
    console.log(`   Status: READY`);
    console.log(`   ClickUp: ${clickupQueryService ? '✅ Connected' : '⚠️  Not configured'}`);
    console.log(`${'='.repeat(60)}\n`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[FATAL] Failed to start server:', err);
    logger.error(`[FATAL] Failed to start server: ${errMsg}`);
    // Try to recover on port conflict
    if (err instanceof Error && err.message.includes('EADDRINUSE')) {
      console.error('[RECOVERY] Port 3001 in use. Waiting 5 seconds and retrying...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      // Recursively try again
      return startServer();
    }
    process.exit(1);
  }

  // Graceful shutdown for zero-downtime deploys
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    console.log(`\n[SHUTDOWN] Received ${signal}. Closing server gracefully...\n`);
    try {
      await fastify.close();
      logger.info('Server closed gracefully');
      console.log('[SHUTDOWN] ✅ Server closed successfully\n');
      process.exit(0);
    } catch (err) {
      logger.error(`Error during shutdown: ${err}`);
      console.error('[SHUTDOWN] ❌ Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer().catch((err) => {
  const errMsg = err instanceof Error ? err.message : String(err);
  console.error('[BOOTSTRAP] Fatal error during startup:', err);
  logger.error(`[BOOTSTRAP] Fatal error during startup: ${errMsg}`);
  process.exit(1);
});
