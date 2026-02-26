import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export type WorkspaceCredentials = {
    refreshToken?: string | null;
    accessToken?: string | null;
};

// Dependency injection proxy to allow the API server (owner of Prisma) to supply tokens dynamically.
type TokenResolver = () => Promise<WorkspaceCredentials | null>;
let globalTokenResolver: TokenResolver | null = null;

export function setWorkspaceTokenResolver(resolver: TokenResolver) {
    globalTokenResolver = resolver;
}

/**
 * GoogleWorkspaceClient
 * Shared OAuth2 client for all Google Workspace APIs.
 * Fetches dynamic tokens from the injected resolver or fallback to .env
 */
export async function createWorkspaceClient(): Promise<OAuth2Client> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback';

    // Resolve dynamic tokens from DB if configured, otherwise fallback to .env for backwards compat.
    const dbTokens = globalTokenResolver ? await globalTokenResolver() : null;
    const refreshToken = dbTokens?.refreshToken || process.env.GOOGLE_REFRESH_TOKEN;
    const accessToken = dbTokens?.accessToken;

    if (!clientId || !clientSecret) {
        throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env');
    }
    if (!refreshToken && !accessToken) {
        throw new Error(
            'Google Workspace Integration missing. Authorize first at http://localhost:3001/api/auth/google/url',
        );
    }

    const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // Auto-setup credentials
    if (refreshToken) auth.setCredentials({ refresh_token: refreshToken });
    if (accessToken) auth.setCredentials({ access_token: accessToken });

    return auth;
}

export async function isWorkspaceConfigured(): Promise<boolean> {
    const id = process.env.GOOGLE_CLIENT_ID;
    const secret = process.env.GOOGLE_CLIENT_SECRET;

    const dbTokens = globalTokenResolver ? await globalTokenResolver() : null;
    const token = dbTokens?.refreshToken || process.env.GOOGLE_REFRESH_TOKEN;

    return !!(id && secret && token);
}

/**
 * Retry helper with exponential backoff for Google API calls.
 * Retries on network errors and 5xx/429 responses only.
 * Never retries on 4xx auth errors (403, 401) — those need re-auth.
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    context: string,
    maxAttempts = 3,
    initialBackoffMs = 600,
): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (err: unknown) {
            lastError = err;
            const msg = err instanceof Error ? err.message : String(err);

            // Do not retry auth/permission errors
            const isAuthError = msg.includes('401') || msg.includes('403')
                || msg.includes('Unauthorized') || msg.includes('Forbidden')
                || msg.includes('insufficient_scope') || msg.includes('invalid_grant');
            if (isAuthError) throw err;

            if (attempt < maxAttempts) {
                const delay = initialBackoffMs * Math.pow(2, attempt - 1);
                console.warn(`[${context}] attempt ${attempt}/${maxAttempts} failed: ${msg}. Retrying in ${delay}ms…`);
                await new Promise((r) => setTimeout(r, delay));
            }
        }
    }
    throw lastError;
}
