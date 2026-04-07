import { FastifyRequest, FastifyReply } from 'fastify';
import { ChatMessageBody, ChatStreamBody } from './chat.schema';
import { ChatService } from '@aria/core';
import { processFinanceMessage } from '../finance/agents/orchestrator';

let chatService: ChatService;

function isFinanceMessage(content: string): boolean {
  const normalized = content
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const keywords = [
    'graham',
    'saldo',
    'balanco',
    'orcamento',
    'despesa',
    'despesas',
    'receita',
    'receitas',
    'gastei',
    'gasto',
    'paguei',
    'pague',
    'recebi',
    'receber',
    'ganhei',
    'ganho',
    'extrato',
    'transacao',
    'transacoes',
    'movimento',
    'movimentacoes',
    'divida',
    'dividas',
    'cartao',
    'cartao de credito',
    'limite',
    'quanto tenho',
    'quanto gastei',
    'quanto recebi',
  ];

  return keywords.some((keyword) => normalized.includes(keyword));
}
async function getFinanceReply(content: string): Promise<string | null> {
  if (!isFinanceMessage(content)) return null;

  const response = await processFinanceMessage(content);
  return response.reply;
}

function writeSseChunk(raw: FastifyReply['raw'], payload: unknown): void {
  raw.write(`data: ${JSON.stringify(payload)}\n\n`);
  if (typeof raw.flushHeaders === 'function') {
    raw.flushHeaders();
  }
  if (raw.socket && typeof raw.socket.write === 'function') {
    raw.socket.write('');
  }
}

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

    const financeReply = await getFinanceReply(content);
    if (financeReply !== null) {
      return reply.send({ reply: financeReply });
    }

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

  const financeReply = await getFinanceReply(content);
  if (financeReply !== null) {
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
      writeSseChunk(raw, { type: 'chunk', content: financeReply });
      writeSseChunk(raw, { type: 'done' });
    } finally {
      raw.end();
    }
    return;
  }

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
      writeSseChunk(raw, { type: 'chunk', content: chunk });
    }
    writeSseChunk(raw, { type: 'done' });
  } catch (error) {
    req.log.error(error, 'Error during streaming');
    try {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isConfiguredVal = process.env.GOOGLE_REFRESH_TOKEN ? 'yes' : 'no';
      writeSseChunk(raw, { type: 'error', code: 'AI_001', message: errorMsg, tokenPrefix: isConfiguredVal });
    } catch (err) {
      req.log.error(err, 'Error writing error response');
    }
  } finally {
    raw.end();
  }
}
