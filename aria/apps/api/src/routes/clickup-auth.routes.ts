import type { FastifyInstance } from 'fastify';
import { db } from '../config/db';

/**
 * ClickUp OAuth 2.0 Auth Routes
 *
 * Authenticates using ClickUp's OAuth 2.0 flow and persists
 * the access_token to the native SQLite DB (provider = 'clickup').
 *
 * ENV: CLICKUP_CLIENT_ID, CLICKUP_CLIENT_SECRET
 * Redirect URI registered in ClickUp App: http://localhost:3001/api/auth/clickup/callback
 */

function getRedirectUri(): string {
    return process.env.CLICKUP_REDIRECT_URI || 'http://localhost:3001/api/auth/clickup/callback';
}

function getClickUpConfig() {
    const clientId = process.env.CLICKUP_CLIENT_ID;
    const clientSecret = process.env.CLICKUP_CLIENT_SECRET;

    // ClickUp also supports Personal API Tokens — if no OAuth app is configured,
    // check if the legacy CLICKUP_API_TOKEN is present and report as connected.
    const legacyToken = process.env.CLICKUP_API_TOKEN?.trim();

    return { clientId, clientSecret, legacyToken };
}

export async function registerClickUpAuthRoutes(fastify: FastifyInstance): Promise<void> {
    /**
     * GET /api/auth/clickup/url
     * Returns the ClickUp OAuth authorization URL.
     */
    fastify.get('/url', async (_req, reply) => {
        const { clientId, clientSecret, legacyToken } = getClickUpConfig();

        // If OAuth app is not configured, fall back to legacy PAT check
        if (!clientId || !clientSecret) {
            if (legacyToken) {
                return reply.status(400).send({
                    error: 'CLICKUP_CLIENT_ID / CLICKUP_CLIENT_SECRET not configured.',
                    hint: 'The current ClickUp integration relies on a Personal Access Token (CLICKUP_API_TOKEN). To enable OAuth, add CLICKUP_CLIENT_ID and CLICKUP_CLIENT_SECRET to .env.',
                });
            }
            return reply.status(400).send({
                error: 'ClickUp credentials not configured.',
                hint: 'Add CLICKUP_CLIENT_ID and CLICKUP_CLIENT_SECRET to .env.',
            });
        }

        const url = `https://app.clickup.com/api?client_id=${clientId}&redirect_uri=${encodeURIComponent(getRedirectUri())}`;

        const acceptHeader = _req.headers.accept ?? '';
        if (acceptHeader.includes('text/html')) {
            return reply.redirect(url);
        }

        return reply.send({ success: true, url });
    });

    /**
     * GET /api/auth/clickup/callback?code=...
     * Exchanges the authorization code for an access token and persists to SQLite.
     */
    fastify.get('/callback', async (req, reply) => {
        const { code, error: authError } = req.query as { code?: string; error?: string };

        if (authError) {
            return reply.header('Content-Type', 'text/html').send(`
                <html><body style="font-family:monospace;background:#1a1a2e;color:#ff4d6d;padding:40px">
                    <h2>❌ ClickUp Authorization denied</h2>
                    <p>Error: <strong>${authError}</strong></p>
                </body></html>
            `);
        }

        if (!code) {
            return reply.status(400).send({ error: 'Missing authorization code' });
        }

        const { clientId, clientSecret } = getClickUpConfig();
        if (!clientId || !clientSecret) {
            return reply.status(500).send({ error: 'Server OAuth credentials not configured' });
        }

        try {
            const tokenRes = await fetch('https://api.clickup.com/api/v2/oauth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: clientId,
                    client_secret: clientSecret,
                    code,
                }),
            });

            if (!tokenRes.ok) {
                const errData = await tokenRes.json() as any;
                throw new Error(errData?.err ?? `HTTP ${tokenRes.status}`);
            }

            const data = await tokenRes.json() as { access_token: string };
            const accessToken = data.access_token;

            if (!accessToken) throw new Error('No access_token received from ClickUp');

            // Upsert into SQLite
            const stmt = db.prepare(`
                INSERT INTO integrations (provider, refreshToken, accessToken, isValid, updatedAt)
                VALUES (?, NULL, ?, 1, CURRENT_TIMESTAMP)
                ON CONFLICT(provider) DO UPDATE SET
                    accessToken = excluded.accessToken,
                    isValid = 1,
                    updatedAt = CURRENT_TIMESTAMP
            `);
            stmt.run('clickup', accessToken);

            const html = `
                <html>
                <head><title>ARIA — ClickUp Conectado</title></head>
                <body style="font-family:system-ui,sans-serif;background:#050508;color:#e2e8f0;padding:40px;max-width:700px;margin:0 auto">
                    <h1 style="color:#6366f1">✅ ClickUp Conectado!</h1>
                    <p>A ARIA agora tem acesso ao seu ClickUp. As credenciais foram salvas no banco de dados automaticamente.</p>
                    <p style="margin-top:32px;color:#64748b">Fechando automaticamente...</p>
                    <script>setTimeout(() => { window.close(); }, 1500);</script>
                </body>
                </html>`;

            return reply.header('Content-Type', 'text/html').send(html);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return reply.status(500).header('Content-Type', 'text/html').send(`
                <html><body style="font-family:monospace;background:#1a1a2e;color:#ff4d6d;padding:40px">
                    <h2>❌ Falha na autenticação ClickUp</h2><p>${msg}</p>
                </body></html>
            `);
        }
    });

    /**
     * GET /api/auth/clickup/status
     * Returns current ClickUp connection status.
     */
    fastify.get('/status', async (_req, reply) => {
        try {
            // First check if we have a DB-persisted OAuth token
            const stmt = db.prepare('SELECT accessToken, isValid, updatedAt FROM integrations WHERE provider = ?');
            const integration = stmt.get('clickup') as any;

            if (integration?.accessToken && integration.isValid) {
                return reply.send({ connected: true, isValid: true, source: 'oauth', updatedAt: integration.updatedAt });
            }

            // Fallback: check legacy Personal Access Token from .env
            const { legacyToken } = getClickUpConfig();
            if (legacyToken) {
                return reply.send({ connected: true, isValid: true, source: 'pat' });
            }

            return reply.send({ connected: false, isValid: false });
        } catch (error) {
            return reply.status(500).send({ error: error instanceof Error ? error.message : String(error) });
        }
    });

    fastify.log.info('[ClickUp Auth] Registered /api/auth/clickup/url, /callback and /status');
}
