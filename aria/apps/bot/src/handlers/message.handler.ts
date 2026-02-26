import { chatService } from '../services/chat';
import { ERROR_MESSAGE, escapeMarkdownV2 } from '../templates/responses';

export async function messageHandler(ctx: any) {
  const text = ctx.message?.text;
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;

  if (!text) {
    console.log('⚠️  Mensagem vazia');
    return;
  }

  // Create sessionId if not present
  const sessionId = ctx.session?.sessionId || (chatId ? `tg_${chatId}` : `user_${userId}`);

  console.log(`📨 Mensagem de ${userId}: "${text.substring(0, 50)}"`);

  try {
    const response = await chatService.completeResponse(text, sessionId);
    console.log(`📤 Resposta: "${response.substring(0, 50)}..."`);
    const escaped = escapeMarkdownV2(response);
    return ctx.reply(escaped, { parse_mode: 'MarkdownV2' });
  } catch (error) {
    console.error(`❌ Erro ao processar mensagem:`, error);
    return ctx.reply(ERROR_MESSAGE, { parse_mode: 'MarkdownV2' });
  }
}
