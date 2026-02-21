import { chatService } from '../services/chat';
import { ERROR_MESSAGE, escapeMarkdownV2 } from '../templates/responses';

export async function messageHandler(ctx: any) {
  const text = ctx.message?.text;
  const { sessionId } = ctx.session;
  const userId = ctx.from?.id;

  if (!text || !sessionId) {
    return;
  }

  // Log request (without message content — NFR13)
  ctx.api.logger?.('debug', { sessionId, userId }, 'Processing message');

  try {
    const response = await chatService.completeResponse(text, sessionId);
    const escaped = escapeMarkdownV2(response);
    return ctx.reply(escaped, { parse_mode: 'MarkdownV2' });
  } catch (error) {
    ctx.api.logger?.('error', { sessionId, userId, error: String(error) }, 'Chat error');
    return ctx.reply(ERROR_MESSAGE, { parse_mode: 'MarkdownV2' });
  }
}
