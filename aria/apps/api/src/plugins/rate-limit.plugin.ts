import fastifyRateLimit from '@fastify/rate-limit';
import { FastifyInstance } from 'fastify';

export async function registerRateLimitPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyRateLimit, {
    max: 30,
    timeWindow: '1 minute',
    keyGenerator: (req) => {
      return (req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown') as string;
    },
  });
}
