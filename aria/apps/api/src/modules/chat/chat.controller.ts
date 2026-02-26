import { FastifyRequest, FastifyReply } from 'fastify';
import { ChatMessageBody, ChatStreamBody } from './chat.schema';
import { ChatService } from '@aria/core';

let chatService: ChatService;

export function setChatService(service: ChatService) {
  chatService = service;
}

export async function handleMessage(
  req: FastifyRequest<{ Body: ChatMessageBody }>,
  reply: FastifyReply,
) {
  try {
    const { content, sessionId } = req.body;
    req.log.info({ sessionId }, 'Chat message request');

    if (!chatService) {
      throw new Error('ChatService not initialized');
    }

    const response = await chatService.completeResponse(content, sessionId);
    return reply.send({ reply: response });
  } catch (error) {
    req.log.error(error, 'Error handling message');
    throw error;
  }
}

export async function handleStream(
  req: FastifyRequest<{ Body: ChatStreamBody }>,
  reply: FastifyReply,
) {
  const { content, sessionId } = req.body;
  req.log.info({ sessionId }, 'Chat stream request');

  if (!chatService) {
    reply.status(500).send({ error: 'ChatService not initialized' });
    return;
  }

  // Take full control of the socket — bypass all Fastify serialization/hooks
  reply.hijack();

  const raw = reply.raw;
  raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': req.headers['origin'] || '*',
    'Access-Control-Allow-Credentials': 'true',
  });

  try {
    for await (const chunk of chatService.streamResponse(content, sessionId)) {
      raw.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      if (raw.flushHeaders) raw.flushHeaders();
      // Force TCP flush if possible for ultra-fast LPU chunks
      if (raw.socket && typeof raw.socket.write === 'function') {
        const _ = raw.socket.write('');
      }
    }
    raw.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  } catch (error) {
    req.log.error(error, 'Error during streaming');
    try {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isConfiguredVal = process.env.GOOGLE_REFRESH_TOKEN ? 'yes' : 'no';
      raw.write(`data: ${JSON.stringify({ type: 'error', code: 'AI_001', message: errorMsg, tokenPrefix: isConfiguredVal })}\n\n`);
    } catch { }
  } finally {
    raw.end();
  }
}
