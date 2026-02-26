import type { FastifyInstance } from 'fastify';

/**
 * Telegram Auth/Status Routes
 *
 * Telegram uses a Bot Token (not OAuth 2.0).
 * The token is configured via TELEGRAM_BOT_TOKEN in .env.
 *
 * GET /api/auth/telegram/status — Returns bot status and username.
 */
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

        try {
            const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
            const data = await res.json() as any;

            if (data.ok && data.result) {
                return reply.send({
                    connected: true,
                    botUsername: data.result.username,
                    botName: data.result.first_name,
                    botUrl: `https://t.me/${data.result.username}`,
                });
            }

            return reply.send({ connected: false, reason: data.description ?? 'Invalid bot token' });
        } catch {
            // Network error — report connected if token exists (offline dev scenario)
            return reply.send({ connected: true, source: 'bot_token' });
        }
    });

    fastify.log.info('[Telegram Auth] Registered /api/auth/telegram/status');
}
