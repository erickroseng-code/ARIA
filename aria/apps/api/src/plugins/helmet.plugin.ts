import fastifyHelmet from '@fastify/helmet';
import { FastifyInstance } from 'fastify';

export async function registerHelmetPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: false,
  });
}
