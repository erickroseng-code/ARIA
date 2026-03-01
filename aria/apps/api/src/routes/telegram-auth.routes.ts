import type { FastifyInstance } from 'fastify';

/**
 * Telegram Auth/Status Routes
 *
 * Telegram uses a Bot Token (not OAuth 2.0).
 * The token is configured via TELEGRAM_BOT_TOKEN in .env.
 *
 * GET /api/auth/telegram/status — Returns bot status and username.
 */

// Cache getMe result for 10 minutes to avoid Telegram rate limits
let telegramCache: { result: any; expiry: number } | null = null;

export async function registerTelegramAuthRoutes(fastify: FastifyInstance): Promise<void> {
    /**
     * GET /api/auth/telegram/status
     * Checks if Telegram Bot Token is configured and returns bot username.
     */
    fastify.get('/status', async (_req, reply) => {
        const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();

        if (!botToken) {
            return reply.send({ connected: false, reason: 'TELEGRAM_BOT_TOKEN not configured' });
        }

        // Return cached result if still valid
        if (telegramCache && Date.now() < telegramCache.expiry) {
            return reply.send(telegramCache.result);
        }

        try {
            const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
            const data = await res.json() as any;

            let response: any;
            if (data.ok && data.result) {
                response = {
                    connected: true,
                    botUsername: data.result.username,
                    botName: data.result.first_name,
                    botUrl: `https://t.me/${data.result.username}`,
                };
            } else {
                response = { connected: false, reason: data.description ?? 'Invalid bot token' };
            }

            // Cache for 10 minutes
            telegramCache = { result: response, expiry: Date.now() + 10 * 60 * 1000 };
            return reply.send(response);
        } catch {
            // Network error — report connected if token exists (offline dev scenario)
            const response = { connected: true, source: 'bot_token' };
            telegramCache = { result: response, expiry: Date.now() + 2 * 60 * 1000 };
            return reply.send(response);
        }
    });

    fastify.log.info('[Telegram Auth] Registered /api/auth/telegram/status');
}
