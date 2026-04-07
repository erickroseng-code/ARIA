import fastifyRateLimit from '@fastify/rate-limit';
import { FastifyInstance } from 'fastify';

// Routes excluded from rate limiting (status checks, health monitoring, finance UI burst loads)
const SKIP_EXACT_ROUTES = [
  '/health',
  '/api/auth/google/status',
  '/api/auth/notion/status',
  '/api/auth/telegram/status',
];

const SKIP_PREFIX_ROUTES = [
  '/api/finance/',
];

function shouldSkipRateLimit(url: string): boolean {
  const path = url.split('?')[0];
  if (SKIP_EXACT_ROUTES.includes(path)) return true;
  return SKIP_PREFIX_ROUTES.some(prefix => path.startsWith(prefix));
}

export async function registerRateLimitPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyRateLimit, {
    max: 200,
    timeWindow: '1 minute',
    keyGenerator: (req) => {
      return (req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown') as string;
    },
    allowList: (req) => shouldSkipRateLimit(req.url),
  });
}
