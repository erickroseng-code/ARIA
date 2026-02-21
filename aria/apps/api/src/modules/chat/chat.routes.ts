import { FastifyInstance } from 'fastify';
import { handleMessage, handleStream } from './chat.controller';

export async function registerChatRoutes(fastify: FastifyInstance) {
  fastify.post('/message', handleMessage);
  fastify.post('/stream', handleStream);
}
