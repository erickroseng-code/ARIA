import fastifyRateLimit from '@fastify/rate-limit';
import { FastifyInstance } from 'fastify';

// Routes excluded from rate limiting (status checks, health monitoring)
const SKIP_ROUTES = [
  '/health',
  '/api/auth/google/status',
  '/api/auth/notion/status',
  '/api/auth/telegram/status',
];

export async function registerRateLimitPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyRateLimit, {
    max: 200,
    timeWindow: '1 minute',
    keyGenerator: (req) => {
      return (req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown') as string;
    },
    allowList: (req) => SKIP_ROUTES.includes(req.url),
  });
}
