import type { FastifyInstance } from 'fastify';
import { db } from '../config/db';

/**
 * Notion Auth/Status Routes
 *
 * Notion uses a simple API Integration Token (not OAuth 2.0).
 * The token can be configured via:
 *   1. POST /api/auth/notion/save  — saves key to SQLite (via UI)
 *   2. NOTION_API_KEY in .env      — fallback, checked when SQLite has no entry
 *
 * GET /api/auth/notion/status — Returns whether the token is configured and valid.
 * POST /api/auth/notion/save  — Saves API key to SQLite for persistent storage.
 */
export async function registerNotionAuthRoutes(fastify: FastifyInstance): Promise<void> {
    /**
     * GET /api/auth/notion/status
     * Checks if Notion API key is configured (SQLite first, then .env) and verifies it.
     */
    fastify.get('/status', async (_req, reply) => {
        // Priority 1: SQLite-stored key (saved via UI)
        let apiKey: string | undefined;
        let source: 'db' | 'env' = 'env';

        try {
            const stmt = db.prepare('SELECT accessToken FROM integrations WHERE provider = ?');
            const row = stmt.get('notion') as any;
            if (row?.accessToken) {
                apiKey = row.accessToken;
                source = 'db';
            }
        } catch {
            // SQLite read error — fall through to env
        }

        // Priority 2: .env NOTION_API_KEY
        if (!apiKey) {
            apiKey = process.env.NOTION_API_KEY?.trim();
        }

        const databaseId = process.env.NOTION_DATABASE_ID?.trim();

        if (!apiKey || apiKey === 'secret_...') {
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
                    source,
                    hasDatabase: !!databaseId,
                    workspaceName: user?.name ?? null,
                });
            }

            return reply.send({ connected: false, reason: 'Invalid NOTION_API_KEY' });
        } catch {
            // Network error — report as connected if key exists (offline dev scenario)
            return reply.send({ connected: true, source, hasDatabase: !!databaseId });
        }
    });

    /**
     * POST /api/auth/notion/save
     * Saves the Notion API key to SQLite for persistent storage.
     * Body: { apiKey: string }
     */
    fastify.post('/save', async (req, reply) => {
        const { apiKey } = req.body as { apiKey?: string };

        if (!apiKey?.trim()) {
            return reply.status(400).send({ error: 'apiKey is required' });
        }

        const key = apiKey.trim();

        // Validate the key with Notion API before saving
        try {
            const res = await fetch('https://api.notion.com/v1/users/me', {
                headers: {
                    Authorization: `Bearer ${key}`,
                    'Notion-Version': '2022-06-28',
                },
            });

            if (!res.ok) {
                return reply.status(400).send({ error: 'Invalid Notion API key — verification failed' });
            }

            const user = await res.json() as any;

            // Save to SQLite
            const stmt = db.prepare(`
                INSERT INTO integrations (provider, accessToken, isValid, updatedAt)
                VALUES (?, ?, 1, CURRENT_TIMESTAMP)
                ON CONFLICT(provider) DO UPDATE SET
                    accessToken = excluded.accessToken,
                    isValid = 1,
                    updatedAt = CURRENT_TIMESTAMP
            `);
            stmt.run('notion', key);

            return reply.send({
                success: true,
                connected: true,
                workspaceName: user?.name ?? null,
            });
        } catch (error) {
            return reply.status(500).send({
                error: error instanceof Error ? error.message : String(error),
            });
        }
    });

    fastify.log.info('[Notion Auth] Registered /api/auth/notion/status and /save');
}
