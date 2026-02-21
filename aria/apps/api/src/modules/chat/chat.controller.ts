import { FastifyRequest, FastifyReply } from 'fastify';
import { ChatMessageBody, ChatStreamBody } from './chat.schema';

let chatService: any; // Will be injected

export function setChatService(service: any) {
  chatService = service;
}

export async function handleMessage(
  req: FastifyRequest<{ Body: ChatMessageBody }>,
  reply: FastifyReply,
) {
  try {
    const { content, sessionId } = req.body;
    req.log.info({ sessionId }, 'Chat message request');

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
  try {
    const { content, sessionId } = req.body;
    req.log.info({ sessionId }, 'Chat stream request');

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    for await (const chunk of chatService.streamResponse(content, sessionId)) {
      reply.raw.write(
        `data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`,
      );
    }
    reply.raw.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  } catch (error) {
    req.log.error(error, 'Error handling stream');
    reply.raw.write(
      `data: ${JSON.stringify({ type: 'error', code: 'AI_001' })}\n\n`,
    );
  } finally {
    reply.raw.end();
  }
}
