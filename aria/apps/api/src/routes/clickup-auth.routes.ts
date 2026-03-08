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
                // PAT already configured — no OAuth needed, return success with info
                return reply.send({
                    success: true,
                    connected: true,
                    source: 'pat',
                    message: 'ClickUp já está conectado via Personal Access Token.',
                });
            }
            return reply.status(400).send({
                error: 'ClickUp credentials not configured.',
                hint: 'Add CLICKUP_API_TOKEN or CLICKUP_CLIENT_ID and CLICKUP_CLIENT_SECRET to .env.',
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
     * Verifica o status REAL da integração chamando a API do ClickUp.
     * Token existente mas inválido retorna connected: false corretamente.
     */
    fastify.get('/status', async (_req, reply) => {
        try {
            // Resolver o token (banco OAuth primeiro, depois PAT do .env)
            const stmt = db.prepare('SELECT accessToken, isValid, updatedAt FROM integrations WHERE provider = ?');
            const integration = stmt.get('clickup') as any;

            let token: string | undefined;
            let source: 'oauth' | 'pat' = 'oauth';

            if (integration?.accessToken && integration.isValid) {
                token = integration.accessToken;
            } else {
                const { legacyToken } = getClickUpConfig();
                if (legacyToken) {
                    token = legacyToken;
                    source = 'pat';
                }
            }

            if (!token) {
                return reply.send({ connected: false, reason: 'Nenhum token configurado' });
            }

            // Verificação real: chamar API do ClickUp
            const userRes = await fetch('https://api.clickup.com/api/v2/user', {
                headers: { Authorization: token },
            });

            if (userRes.ok) {
                const data = await userRes.json() as any;
                return reply.send({
                    connected: true,
                    isValid: true,
                    source,
                    updatedAt: integration?.updatedAt,
                    username: data?.user?.username ?? null,
                });
            }

            // Token rejeitado — marcar como inválido no banco se veio de lá
            if (integration) {
                db.prepare('UPDATE integrations SET isValid = 0, updatedAt = CURRENT_TIMESTAMP WHERE provider = ?').run('clickup');
            }
            fastify.log.warn(`[ClickUp] Token inválido em /status: HTTP ${userRes.status}`);

            return reply.send({ connected: false, reason: 'Token inválido ou expirado — reconecte' });
        } catch (error) {
            fastify.log.error('[ClickUp] Erro de rede ao verificar token:', error);
            return reply.status(500).send({ connected: false, reason: 'Erro ao verificar token com o ClickUp' });
        }
    });

    fastify.log.info('[ClickUp Auth] Registered /api/auth/clickup/url, /callback and /status');
}
