import type { FastifyInstance } from 'fastify';

/**
 * Notion Auth/Status Routes
 *
 * Notion uses a simple API Integration Token (not OAuth 2.0).
 * The token is configured via NOTION_API_KEY in .env.
 *
 * GET /api/auth/notion/status — Returns whether the token is configured and valid.
 */
export async function registerNotionAuthRoutes(fastify: FastifyInstance): Promise<void> {
    /**
     * GET /api/auth/notion/status
     * Checks if Notion API key is configured and optionally verifies it with the API.
     */
    fastify.get('/status', async (_req, reply) => {
        const apiKey = process.env.NOTION_API_KEY?.trim();
        const databaseId = process.env.NOTION_DATABASE_ID?.trim();

        if (!apiKey) {
            return reply.send({ connected: false, reason: 'NOTION_API_KEY not configured' });
        }

        // Verify token is valid by calling Notion API
        try {
            const res = await fetch('https://api.notion.com/v1/users/me', {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Notion-Version': '2022-06-28',
                },
            });

            if (res.ok) {
                const user = await res.json() as any;
                return reply.send({
                    connected: true,
                    source: 'api_key',
                    hasDatabase: !!databaseId,
                    workspaceName: user?.name ?? null,
                });
            }

            return reply.send({ connected: false, reason: 'Invalid NOTION_API_KEY' });
        } catch {
            // Network error — still report as connected if key exists (offline dev scenario)
            return reply.send({ connected: true, source: 'api_key', hasDatabase: !!databaseId });
        }
    });

    fastify.log.info('[Notion Auth] Registered /api/auth/notion/status');
}
