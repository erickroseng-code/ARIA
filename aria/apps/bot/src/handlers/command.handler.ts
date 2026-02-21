import { CommandContext } from 'grammy';
import { contextStore } from '@aria/core';
import { WELCOME_MESSAGE, HELP_MESSAGE } from '../templates/responses';
import { getDocumentsListMessage, getReadyToGenerateMessage } from '../templates/document.guidance';

export async function startHandler(ctx: CommandContext<any>) {
  return ctx.reply(WELCOME_MESSAGE, { parse_mode: 'MarkdownV2' });
}

export async function helpHandler(ctx: CommandContext<any>) {
  return ctx.reply(HELP_MESSAGE, { parse_mode: 'MarkdownV2' });
}

export async function statusHandler(ctx: CommandContext<any>) {
  const userId = ctx.from?.id || 'unknown';
  const message = `Status: online\nUser ID: ${userId}`;
  return ctx.reply(message);
}

/**
 * /docs command - Show accumulated documents
 */
export async function docsHandler(ctx: CommandContext<any>) {
  const { sessionId } = ctx.session;
  if (!sessionId) {
    return ctx.reply('❌ Session not found');
  }

  const pendingDocs = await contextStore.getPendingDocuments(sessionId);

  if (pendingDocs.length === 0) {
    return ctx.reply(
      '📭 *Nenhum documento acumulado ainda*\n\nEnvie documentos para começar a análise.',
      { parse_mode: 'MarkdownV2' }
    );
  }

  const message = getDocumentsListMessage(
    pendingDocs.map((doc) => ({
      label: doc.label,
      fileName: doc.originalName,
    }))
  );

  return ctx.reply(message, { parse_mode: 'MarkdownV2' });
}

/**
 * /pronto command - Generate Plan of Attack with pending documents
 */
export async function prontoHandler(ctx: CommandContext<any>) {
  const { sessionId } = ctx.session;
  if (!sessionId) {
    return ctx.reply('❌ Session not found');
  }

  const pendingDocs = await contextStore.getPendingDocuments(sessionId);

  // Validate minimum documents (2+)
  if (pendingDocs.length < 2) {
    return ctx.reply(
      `⚠️ *Mínimo 2 documentos necessários*\n\nVocê tem ${pendingDocs.length}/2 documentos.\n\n📝 Envie mais documentos para continuar.`,
      { parse_mode: 'MarkdownV2' }
    );
  }

  // Show ready message
  const readyMessage = getReadyToGenerateMessage(
    pendingDocs.map((doc) => ({
      label: doc.label,
    }))
  );

  await ctx.reply(readyMessage, { parse_mode: 'MarkdownV2' });

  // TODO: Task 5 continued - trigger analysis and Notion page creation
  // For now, just acknowledge the command
  // This will be implemented with DocumentAnalysisService (Task 7)
  // and PlanOfAttackService (Task 6)

  return;
}

/**
 * /cancelar command - Clear accumulated documents and restart
 */
export async function cancelarHandler(ctx: CommandContext<any>) {
  const { sessionId } = ctx.session;
  if (!sessionId) {
    return ctx.reply('❌ Session not found');
  }

  await contextStore.clearPendingDocuments(sessionId);

  return ctx.reply(
    '🔄 *Documentos Limpos*\n\nSessão reiniciada. Envie novos documentos para começar uma nova análise.',
    { parse_mode: 'MarkdownV2' }
  );
}
