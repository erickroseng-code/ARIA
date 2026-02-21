import { DocumentService } from '@aria/core';
import { contextStore } from '@aria/core';
import { ERROR_MESSAGE } from '../templates/responses';
import { getDocumentGuidance, getLimitReachedMessage } from '../templates/document.guidance';

const documentService = new DocumentService();

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function documentHandler(ctx: any) {
  const document = ctx.message?.document;
  const { sessionId } = ctx.session;
  const userId = ctx.from?.id;

  if (!document || !sessionId) {
    return;
  }

  // Log request (metadata only — NFR13)
  ctx.api.logger?.('debug', { sessionId, userId, fileName: document.file_name }, 'Processing document');

  try {
    // Validate file size
    if (document.file_size && document.file_size > MAX_FILE_SIZE) {
      const sizeMb = (document.file_size / (1024 * 1024)).toFixed(1);
      const message = `❌ File too large (${sizeMb}MB). Limit: 10MB.`;
      return ctx.reply(message);
    }

    // Validate MIME type support
    const mimeType = document.mime_type;
    const supportedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!mimeType || !supportedTypes.includes(mimeType)) {
      return ctx.reply('❌ File type not supported. Please upload PDF or Word documents (.pdf, .doc, .docx)');
    }

    // Download file from Telegram
    const file = await ctx.api.getFile(document.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;

    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error('Failed to download file');
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Process document
    const processedDoc = await documentService.processDocument(buffer, document.file_name, mimeType);

    // Add to pending documents (with auto-extracted label)
    const pendingDoc = documentService.addPendingDocument(sessionId, processedDoc);

    // Store in context for session persistence
    await contextStore.addPendingDocument(sessionId, pendingDoc);

    const pendingDocs = await contextStore.getPendingDocuments(sessionId);

    // Generate contextual guidance message
    const guidanceMessage = getDocumentGuidance({
      documentCount: pendingDocs.length,
      totalLimit: 5,
      label: pendingDoc.label,
      fileName: document.file_name,
    });

    return ctx.reply(guidanceMessage, { parse_mode: 'MarkdownV2' });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    ctx.api.logger?.('error', { sessionId, userId, error: errorMsg }, 'Document processing error');

    // Handle specific document limit error
    if (errorMsg.includes('Limite')) {
      return ctx.reply(getLimitReachedMessage(), { parse_mode: 'MarkdownV2' });
    }

    return ctx.reply(ERROR_MESSAGE, { parse_mode: 'MarkdownV2' });
  }
}
