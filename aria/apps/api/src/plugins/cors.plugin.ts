import fastifyCors from '@fastify/cors';
import { FastifyInstance } from 'fastify';

export async function registerCorsPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyCors, {
    origin: process.env.NODE_ENV === 'production'
      ? ['http://localhost:3000']
      : true,
    credentials: true,
  });
}
