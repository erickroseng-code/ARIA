/**
 * Story 6.4 — Task 1: JWT Authentication & Refresh Tokens
 * Fastify plugin for JWT verification using jose library.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'aria-dev-secret-change-in-production');
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export interface AriaJWTPayload extends JWTPayload {
    userId: string;
    role: string;
}

/** Generate an access token (short-lived) */
export async function generateAccessToken(userId: string, role: string = 'user'): Promise<string> {
    return new SignJWT({ userId, role })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(ACCESS_TOKEN_EXPIRY)
        .setIssuer('aria-api')
        .sign(JWT_SECRET);
}

/** Generate a refresh token (long-lived) */
export async function generateRefreshToken(userId: string): Promise<string> {
    return new SignJWT({ userId, type: 'refresh' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(REFRESH_TOKEN_EXPIRY)
        .setIssuer('aria-api')
        .sign(JWT_SECRET);
}

/** Verify and decode a JWT */
export async function verifyToken(token: string): Promise<AriaJWTPayload> {
    const { payload } = await jwtVerify(token, JWT_SECRET, { issuer: 'aria-api' });
    return payload as AriaJWTPayload;
}

/** Fastify auth preHandler — verifies Bearer token on protected routes */
export async function authPreHandler(req: FastifyRequest, reply: FastifyReply) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Missing or invalid authorization header', code: 'AUTH_001' });
    }

    const token = authHeader.substring(7);

    try {
        const payload = await verifyToken(token);
        (req as any).user = payload;
    } catch {
        return reply.status(401).send({ error: 'Invalid or expired token', code: 'AUTH_002' });
    }
}

/** Register the auth plugin on a Fastify instance */
export async function registerAuthPlugin(fastify: FastifyInstance) {
    fastify.decorateRequest('user', null);
}
