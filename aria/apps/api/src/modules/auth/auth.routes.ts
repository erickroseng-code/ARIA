/**
 * Story 6.4 — Task 1: Auth Routes
 * POST /api/auth/login — Issue JWT + refresh
 * POST /api/auth/refresh — Rotate refresh token
 * POST /api/auth/logout — Revoke refresh token
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../../plugins/auth.middleware';
import { z } from 'zod';

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
});

const refreshSchema = z.object({
    refreshToken: z.string().min(1),
});

// In-memory refresh token store (replace with Redis/DB in production)
const refreshTokenStore = new Map<string, { userId: string; expiresAt: Date }>();

export async function registerAuthRoutes(fastify: FastifyInstance) {

    /** Login */
    fastify.post('/auth/login', async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const body = loginSchema.parse(req.body);

            // TODO: Replace with actual user lookup + bcrypt comparison
            // For now, accept any valid email/password combo for development
            const userId = `user_${Buffer.from(body.email).toString('base64').substring(0, 8)}`;
            const role = 'user';

            const accessToken = await generateAccessToken(userId, role);
            const refreshToken = await generateRefreshToken(userId);

            // Store refresh token
            refreshTokenStore.set(refreshToken, {
                userId,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            });

            return reply.status(200).send({
                accessToken,
                refreshToken,
                expiresIn: 900, // 15 minutes in seconds
                tokenType: 'Bearer',
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.status(400).send({ error: 'Invalid input', details: error.issues, code: 'AUTH_003' });
            }
            return reply.status(500).send({ error: 'Internal server error', code: 'AUTH_500' });
        }
    });

    /** Refresh Token */
    fastify.post('/auth/refresh', async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const body = refreshSchema.parse(req.body);
            const stored = refreshTokenStore.get(body.refreshToken);

            if (!stored || stored.expiresAt < new Date()) {
                refreshTokenStore.delete(body.refreshToken);
                return reply.status(401).send({ error: 'Invalid or expired refresh token', code: 'AUTH_004' });
            }

            // Verify the JWT itself
            await verifyToken(body.refreshToken);

            // Rotate: delete old, issue new
            refreshTokenStore.delete(body.refreshToken);

            const accessToken = await generateAccessToken(stored.userId);
            const newRefreshToken = await generateRefreshToken(stored.userId);

            refreshTokenStore.set(newRefreshToken, {
                userId: stored.userId,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            });

            return reply.status(200).send({
                accessToken,
                refreshToken: newRefreshToken,
                expiresIn: 900,
                tokenType: 'Bearer',
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.status(400).send({ error: 'Invalid input', details: error.issues, code: 'AUTH_003' });
            }
            return reply.status(401).send({ error: 'Token verification failed', code: 'AUTH_005' });
        }
    });

    /** Logout */
    fastify.post('/auth/logout', async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const body = refreshSchema.parse(req.body);
            refreshTokenStore.delete(body.refreshToken);
            return reply.status(200).send({ message: 'Logged out successfully' });
        } catch {
            return reply.status(200).send({ message: 'Logged out' });
        }
    });
}
