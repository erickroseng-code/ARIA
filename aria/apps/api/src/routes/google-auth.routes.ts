import type { FastifyInstance, FastifyRequest } from 'fastify';
import { google } from 'googleapis';
import { db } from '../config/db';

/**
 * Google Workspace Auth Routes
 *
 * Used to generate a long-lived GOOGLE_REFRESH_TOKEN for all Google Workspace APIs:
 * - Google Drive (read files, search)
 * - Gmail (read emails, search)
 * - Google Docs (read document content)
 * - Google Sheets (read spreadsheet data)
 * - Google Calendar (read/write events)
 *
 * FLOW:
 * 1. User visits GET /api/auth/google/url — gets the Google consent URL
 * 2. User logs in and approves permissions in browser
 * 3. Google redirects to GET /api/auth/google/callback?code=...
 * 4. Server exchanges code for tokens and displays the refresh_token
 * 5. User copies refresh_token to .env as GOOGLE_REFRESH_TOKEN
 */

const SCOPES = [
    // Calendar (read + write events)
    'https://www.googleapis.com/auth/calendar',
    // Drive — full access (read, write, create, move, delete)
    'https://www.googleapis.com/auth/drive',
    // Gmail — full mailbox access (read, send, modify, delete)
    'https://mail.google.com/',
    // Sheets — full read/write access
    'https://www.googleapis.com/auth/spreadsheets',
    // Docs — full read/write access
    'https://www.googleapis.com/auth/documents',
];

function getRedirectUri(): string {
    return process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback';
}

function createOAuthClient() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env');
    }

    return new google.auth.OAuth2(clientId, clientSecret, getRedirectUri());
}

export async function registerGoogleAuthRoutes(fastify: FastifyInstance): Promise<void> {
    /**
     * GET /api/auth/google/url
     * Generates the Google OAuth authorization URL.
     * Open this URL in a browser to start the OAuth flow.
     */
    fastify.get('/url', async (req, reply) => {
        try {
            const oAuth2Client = createOAuthClient();
            const url = oAuth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: SCOPES,
                prompt: 'consent', // Force consent to always get refresh_token
            });

            // Se acessado pelo browser diretamente (Accept: text/html), redireciona para o Google.
            // Se chamado via fetch/API (Accept: application/json), retorna JSON para o frontend abrir popup.
            const accept = (req as any).headers?.accept || '';
            if (accept.includes('text/html')) {
                return reply.redirect(url);
            }

            return reply.send({
                success: true,
                message: 'Open the authorization URL in your browser to grant access',
                url,
                scopes: SCOPES,
            });
        } catch (error) {
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    });

    /**
     * GET /api/auth/google/callback?code=...
     * OAuth callback — exchanges the authorization code for tokens.
     * Displays the refresh_token so you can save it to .env.
     */
    fastify.get('/callback', async (req, reply) => {
        const { code, error: oauthError } = req.query as { code?: string; error?: string };

        if (oauthError) {
            const html = `
        <html><body style="font-family:monospace;background:#1a1a2e;color:#ff4d6d;padding:40px">
          <h2>❌ Authorization denied</h2>
          <p>Google returned error: <strong>${oauthError}</strong></p>
          <p>Go back and try again.</p>
        </body></html>`;
            return reply.header('Content-Type', 'text/html').send(html);
        }

        if (!code) {
            return reply.status(400).send({ error: 'Missing authorization code' });
        }

        try {
            const oAuth2Client = createOAuthClient();
            const { tokens } = await oAuth2Client.getToken(code);
            const refreshToken = tokens.refresh_token;
            const accessToken = tokens.access_token;
            // Native SQLite stores dates as strings usually, but we can just use ISO
            const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;

            if (refreshToken) {
                // Upsert the token into the Native SQLite DB
                const stmt = db.prepare(`
                    INSERT INTO integrations (provider, refreshToken, accessToken, isValid, updatedAt)
                    VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
                    ON CONFLICT(provider) DO UPDATE SET
                        refreshToken = excluded.refreshToken,
                        accessToken = excluded.accessToken,
                        isValid = 1,
                        updatedAt = CURRENT_TIMESTAMP
                `);
                stmt.run('google', refreshToken, accessToken || null);
            } else if (accessToken) {
                // If Google doesn't send a refresh_token, just update the access token 
                // but keep the old refresh_token if it exists.
                const stmt = db.prepare('SELECT refreshToken FROM integrations WHERE provider = ?');
                const existing = stmt.get('google');

                if (existing) {
                    const updateStmt = db.prepare(`
                        UPDATE integrations 
                        SET accessToken = ?, isValid = 1, updatedAt = CURRENT_TIMESTAMP 
                        WHERE provider = ?
                    `);
                    updateStmt.run(accessToken, 'google');
                }
            }

            const html = `
        <html>
        <head><title>ARIA — Integração Concluída</title></head>
        <body style="font-family:system-ui,sans-serif;background:#050508;color:#e2e8f0;padding:40px;max-width:700px;margin:0 auto">
          <h1 style="color:#6366f1">✅ Integração com Google Concluída!</h1>
          <p>ARIA agora tem permissão para acessar seu Google Workspace. As credenciais foram salvas no banco de dados automaticamente.</p>

          ${!refreshToken ? `
          <div style="background:#0f172a;border:1px solid #fbbf24;border-radius:8px;padding:24px;margin:24px 0">
            <p style="color:#fbbf24">⚠️ Nota: O Google não enviou um novo refresh_token pois a permissão já havia sido dada antes. As chaves de acesso curtas foram atualizadas.</p>
            <p>Se as integrações falharem no futuro, remova o app em <a href="https://myaccount.google.com/permissions" style="color:#6366f1">myaccount.google.com/permissions</a> e tente novamente.</p>
          </div>
          ` : `
          <div style="background:#0f172a;border:1px solid #4ade80;border-radius:8px;padding:24px;margin:24px 0">
            <p style="color:#4ade80">Um novo token vitalício (Refresh Token) foi obtido e está guardado em segurança nativamente.</p>
          </div>
          `}
          
          <p style="margin-top:32px;color:#64748b">Fechando automaticamente...</p>
          <script>
            // Fecha o popup automaticamente após 1.5s
            setTimeout(() => { window.close(); }, 1500);
          </script>
        </body>
        </html>`;

            return reply.header('Content-Type', 'text/html').send(html);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            const html = `
        <html><body style="font-family:monospace;background:#1a1a2e;color:#ff4d6d;padding:40px">
          <h2>❌ Token exchange failed</h2><p>${msg}</p>
        </body></html>`;
            return reply.status(500).header('Content-Type', 'text/html').send(html);
        }
    });

    /**
     * GET /api/auth/google/status
     * Verifica o status REAL da integração tentando renovar o access token via Google.
     * Token existente no banco mas revogado retorna connected: false corretamente.
     */
    fastify.get('/status', async (_req, reply) => {
        try {
            // Resolver o refresh token (banco primeiro, depois .env)
            const stmt = db.prepare('SELECT refreshToken, isValid, updatedAt FROM integrations WHERE provider = ?');
            const integration = stmt.get('google') as any;

            let refreshToken: string | undefined;
            let source: 'db' | 'env' = 'db';

            if (integration?.refreshToken && integration.isValid === 1) {
                refreshToken = integration.refreshToken;
            } else {
                refreshToken = process.env.GOOGLE_REFRESH_TOKEN?.trim();
                source = 'env';
            }

            if (!refreshToken) {
                return reply.send({ connected: false, reason: 'Nenhum token configurado' });
            }

            const clientId = process.env.GOOGLE_CLIENT_ID;
            const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

            if (!clientId || !clientSecret) {
                return reply.send({ connected: false, reason: 'GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET não configurados' });
            }

            // Verificação real: tentar renovar o access token via Google OAuth
            const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    refresh_token: refreshToken,
                    grant_type: 'refresh_token',
                }),
            });

            if (tokenRes.ok) {
                // Token válido — garantir isValid = 1 no banco
                if (integration) {
                    db.prepare('UPDATE integrations SET isValid = 1, updatedAt = CURRENT_TIMESTAMP WHERE provider = ?').run('google');
                }
                return reply.send({ connected: true, isValid: true, source, updatedAt: integration?.updatedAt });
            }

            // Token rejeitado pelo Google — marcar como inválido no banco
            const errData = await tokenRes.json().catch(() => ({})) as any;
            if (integration) {
                db.prepare('UPDATE integrations SET isValid = 0, updatedAt = CURRENT_TIMESTAMP WHERE provider = ?').run('google');
            }
            fastify.log.warn(`[Google] Token inválido em /status: ${errData?.error} — ${errData?.error_description}`);

            return reply.send({
                connected: false,
                reason: errData?.error === 'invalid_grant'
                    ? 'Token revogado ou expirado — reconecte em /api/auth/google/url'
                    : (errData?.error ?? 'Token rejeitado pelo Google'),
            });
        } catch (error) {
            fastify.log.error('[Google] Erro de rede ao verificar token:', error);
            return reply.status(500).send({ connected: false, reason: 'Erro ao verificar token com o Google' });
        }
    });

    fastify.log.info('[Google Auth] Registered /api/auth/google/url, /callback and /status');
}
