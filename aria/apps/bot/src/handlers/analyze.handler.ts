import Anthropic from '@anthropic-ai/sdk';
import { DocumentService, DocumentAnalysisService, contextStore } from '@aria/core';
import type { PendingDocument } from '@aria/shared';
import { ERROR_MESSAGE } from '../templates/responses';

const documentService = new DocumentService();
const claudeClient = new Anthropic();
const analysisService = new DocumentAnalysisService(claudeClient);

// Helper to split text into Telegram-compatible messages (max 4096 chars)
function splitIntoTelegramMessages(text: string, maxLength = 3900): string[] {
  const sections = text.split(/(?=\n## |\n### )/);
  const messages: string[] = [];
  let current = '';

  for (const section of sections) {
    if ((current + section).length > maxLength) {
      if (current) messages.push(current.trim());
      current = section;
    } else {
      current += section;
    }
  }
  if (current) messages.push(current.trim());
  return messages;
}

export async function analyzeHandler(ctx: any) {
  const { sessionId } = ctx.session;
  const userId = ctx.from?.id;

  const docs = documentService.getSessionDocuments(sessionId);

  if (docs.length === 0) {
    await ctx.reply('You have not sent any documents yet. Send PDFs or Word documents before generating the Plan of Attack.');
    return;
  }

  try {
    ctx.api.logger?.('debug', { sessionId, userId, docCount: docs.length }, 'Starting document analysis');

    // Get client name from context (placeholder)
    const clientName = 'Client';

    await ctx.reply('⏳ Analyzing documents and generating content...');

    // Build full analysis (non-streaming for Telegram)
    // Convert ProcessedDocument to PendingDocument (with labels)
    const pendingDocs = docs.map(doc => ({
      ...doc,
      label: (doc as any).label || doc.originalName,
    })) as PendingDocument[];

    const generatedAnalysis = await analysisService.analyzeDocumentsWithStructure(pendingDocs, clientName);

    // Store pending analysis in context for later confirmation
    // PendingAnalysis is an alias for GeneratedAnalysis, so pass it directly
    await contextStore.setPendingAnalysis(sessionId, generatedAnalysis);

    // Split into Telegram-compatible messages
    const messages = splitIntoTelegramMessages(generatedAnalysis.integratedAnalysis);

    // Send analysis in chunks
    for (const message of messages) {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
      });
    }

    // Send action buttons
    await ctx.reply(
      'Analysis complete! Type *confirmar* to create in Notion or *cancelar* to discard.',
      {
        parse_mode: 'Markdown',
      }
    );
  } catch (error) {
    ctx.api.logger?.('error', { sessionId, userId, error: String(error) }, 'Document analysis error');
    return ctx.reply(ERROR_MESSAGE, { parse_mode: 'MarkdownV2' });
  }
}
