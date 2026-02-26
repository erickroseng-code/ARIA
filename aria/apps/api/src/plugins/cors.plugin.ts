import fastifyCors from '@fastify/cors';
import { FastifyInstance } from 'fastify';

export async function registerCorsPlugin(fastify: FastifyInstance) {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  await fastify.register(fastifyCors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (server-to-server, curl, Postman)
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin "${origin}" not allowed`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
  });
}
