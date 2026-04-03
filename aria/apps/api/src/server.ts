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
import { registerScheduledReportsRoutes } from './routes/scheduled-reports-fastify.routes';
import { registerAudioRoutes } from './routes/audio-fastify.routes';
import { registerReportsRoutes } from './routes/reports-fastify.routes';
import { registerGoogleCalendarRoutes } from './routes/google-calendar-fastify.routes';
import { registerGoogleAuthRoutes, checkGoogleHealth } from './routes/google-auth.routes';
import { registerTelegramWebhookRoutes } from './routes/telegram-webhook.routes';
import { registerScheduledTasksRoutes } from './routes/scheduled-tasks.routes';
import { registerNotionAuthRoutes } from './routes/notion-auth.routes';
import { registerTelegramAuthRoutes } from './routes/telegram-auth.routes';
import { workspaceActionRoutes } from './routes/workspace-action.routes';
import { registerFinanceRoutes } from './modules/finance/finance.routes';
import { registerTrafficRoutes } from './modules/traffic/traffic.routes';
import { registerMaverickRoutes } from './modules/maverick/maverick.v2.routes';
import { registerSherlockRoutes } from './modules/sherlock/sherlock.routes';
import { registerUmaRoutes } from './modules/uma/uma.routes';
import { registerTTSRoutes } from './routes/tts.routes';
import { registerAuthPlugin } from './plugins/auth.middleware';
import fastifyMultipart from '@fastify/multipart';
import { ChatService, contextStore, createGroqClient } from '@aria/core';
import { setChatService } from './modules/chat/chat.controller';
import {
  setWorkspaceTokenResolver,
  setOnInvalidGrant,
  setWorkspaceTokenPersistor,
  isWorkspaceConfigured,
} from '@aria/integrations';
import { db } from './config/db';

// Ensure Atlas audit log table exists
db.prepare(`
  CREATE TABLE IF NOT EXISTS atlas_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    dry_run INTEGER NOT NULL DEFAULT 1,
    result TEXT NOT NULL,
    reason TEXT,
    triggered_by TEXT NOT NULL DEFAULT 'scheduler'
  )
`).run();

const startServer = async () => {
  const fastify = Fastify({});

  // Register plugins
  await registerHelmetPlugin(fastify);
  await registerCorsPlugin(fastify);
  await registerRateLimitPlugin(fastify);
  await fastify.register(fastifyMultipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

  // Inject Database Token Resolver for Google Workspace using native sqlite
  // Falls back to GOOGLE_REFRESH_TOKEN from .env so integrations survive DB resets.
  setWorkspaceTokenResolver(async () => {
    try {
      const stmt = db.prepare('SELECT refreshToken, accessToken, isValid FROM integrations WHERE provider = ?');
      const integration = stmt.get('google') as any;

      if (integration?.refreshToken && integration.isValid !== 0) {
        return {
          accessToken: integration.accessToken,
          refreshToken: integration.refreshToken,
        };
      }

      // Fallback: use env token (persists across DB resets)
      const envRefreshToken = process.env.GOOGLE_REFRESH_TOKEN?.trim();
      if (envRefreshToken) {
        return { refreshToken: envRefreshToken, accessToken: null };
      }

      return null;
    } catch (err) {
      console.error('[TokenResolver NativeDB] Error querying tokens:', err);
      // On DB error, still try env fallback
      const envRefreshToken = process.env.GOOGLE_REFRESH_TOKEN?.trim();
      return envRefreshToken ? { refreshToken: envRefreshToken, accessToken: null } : null;
    }
  });

  // Quando googleapis renova o access_token automaticamente, persiste o novo token no DB.
  setWorkspaceTokenPersistor(async ({ accessToken, expiryDate }) => {
    try {
      db.prepare('UPDATE integrations SET accessToken = ?, updatedAt = CURRENT_TIMESTAMP WHERE provider = ?')
        .run(accessToken, 'google');
      if (expiryDate) {
        console.log(`[Google] Access token auto-renovado. Expira em: ${new Date(expiryDate).toISOString()}`);
      }
    } catch (err) {
      console.error('[Google] Falha ao persistir token renovado:', err);
    }
  });

  // Quando invalid_grant é detectado, marca o token como inválido no DB automaticamente
  setOnInvalidGrant(() => {
    try {
      db.prepare('UPDATE integrations SET isValid = 0, updatedAt = CURRENT_TIMESTAMP WHERE provider = ?').run('google');
      console.warn('[Google] invalid_grant detectado — token marcado como inválido no DB. Re-autentique em /api/auth/google/url');
    } catch (err) {
      console.error('[Google] Falha ao marcar token como inválido:', err);
    }
  });

  // Initialize Groq client (compatible with Anthropic interface) and ChatService
  // GROQ_API_KEY must be set in .env — server starts but chat won't work without it
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    console.error('[server] ❌ GROQ_API_KEY is not set in .env — add it to enable AI chat');
  }
  const groqClient = createGroqClient(groqApiKey);

  const chatService = new ChatService(groqClient, contextStore);
  setChatService(chatService);



  // Enhanced health endpoint with detailed diagnostics
  fastify.get('/health', async (req, reply) => {
    const googleStatus = await isWorkspaceConfigured()
      .then(ok => ok ? 'connected' : 'disconnected')
      .catch(() => 'not_configured');

    const health = {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        chat: !!chatService ? 'ready' : 'not_ready',
        fastify: 'ready',
        google: googleStatus,
      },
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
      },
    };

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
  await fastify.register(registerScheduledReportsRoutes, { prefix: '/api/scheduled-reports' });
  await fastify.register(registerAudioRoutes, { prefix: '/api/audio' });
  await fastify.register(registerReportsRoutes, { prefix: '/api/reports' });
  await fastify.register(registerGoogleCalendarRoutes, { prefix: '/api/calendar' });
  await fastify.register(registerGoogleAuthRoutes, { prefix: '/api/auth/google' });
  await fastify.register(registerNotionAuthRoutes, { prefix: '/api/auth/notion' });
  await fastify.register(registerTelegramAuthRoutes, { prefix: '/api/auth/telegram' });
  await fastify.register(workspaceActionRoutes);
  await fastify.register(registerFinanceRoutes, { prefix: '/api/finance' });
  await fastify.register(registerTrafficRoutes, { prefix: '/api/traffic' });
  await fastify.register(registerMaverickRoutes, { prefix: '/api/maverick' });
  await fastify.register(registerSherlockRoutes, { prefix: '/api/sherlock' });
  await fastify.register(registerUmaRoutes, { prefix: '/api/uma' });
  await fastify.register(registerTTSRoutes, { prefix: '/api/tts' });
  await fastify.register(registerTelegramWebhookRoutes, { prefix: '/api/telegram' });
  await fastify.register(registerScheduledTasksRoutes, { prefix: '/api/tasks' });

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
    console.log(`${'='.repeat(60)}\n`);

    // Non-blocking boot validation — check Google tokens after server is live
    checkGoogleHealth().then(({ connected, source }) => {
      if (connected) {
        console.log(`[Google] ✅ Integração ativa (source: ${source})`);
      } else {
        console.warn('[Google] ⚠️  Tokens ausentes ou inválidos. Re-autorize em /api/auth/google/url');
      }
    }).catch(() => {
      console.warn('[Google] ⚠️  Erro ao verificar integração no startup');
    });
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
