import type { FastifyRequest, FastifyReply } from 'fastify';
import Anthropic from '@anthropic-ai/sdk';
import { DocumentService, DocumentAnalysisService, AppError, NotionDocumentCreator, NotificationService } from '@aria/core';

const documentService = new DocumentService();
const claudeClient = new Anthropic();
const analysisService = new DocumentAnalysisService(claudeClient);

export async function uploadDocument(req: FastifyRequest, reply: FastifyReply) {
  let sessionId: string = 'default';
  const headerSessionId = req.headers['x-session-id'];
  if (typeof headerSessionId === 'string') {
    sessionId = headerSessionId;
  } else if (typeof req.query === 'object' && req.query && typeof (req.query as Record<string, unknown>).sessionId === 'string') {
    sessionId = (req.query as Record<string, unknown>).sessionId as string;
  }

  const data = await (req as any).file();
  if (!data) {
    return reply.status(400).send({ error: 'No file provided' });
  }

  const file = data as unknown as Record<string, unknown>;
  const buffer = await (file.toBuffer as () => Promise<Buffer>)();
  const filename = (file.filename as string) || 'unknown';
  const mimetype = (file.mimetype as string) || 'application/octet-stream';

  try {
    const processedDoc = await documentService.processDocument(buffer, filename, mimetype);
    documentService.addToSession(sessionId, processedDoc);

    const sessionDocs = documentService.getSessionDocuments(sessionId);

    return reply.status(200).send({
      document: processedDoc,
      sessionDocCount: sessionDocs.length,
      message: `📄 *${filename}* received and processed (${(buffer.length / 1024).toFixed(1)}KB)`,
    });
  } catch (error) {
    if (error instanceof Error) {
      const appError = error as { code?: string; statusCode?: number; message: string };
      return reply.status(appError.statusCode ?? 500).send({
        error: error.message,
        code: appError.code,
      });
    }
    return reply.status(500).send({ error: 'Failed to process document' });
  }
}

export async function analyzeDocuments(req: FastifyRequest, reply: FastifyReply) {
  try {
    const body = req.body as { sessionId?: string; clientName?: string } | null;
    const sessionId = body?.sessionId || 'default';
    const clientName = body?.clientName || 'Cliente';

    const docs = documentService.getSessionDocuments(sessionId);

    if (docs.length === 0) {
      return reply.status(400).send({
        error: 'No documents to analyze',
        code: 'DOC_005',
      });
    }

    reply.type('text/event-stream');
    reply.header('Cache-Control', 'no-cache');
    reply.header('Connection', 'keep-alive');

    // Send streaming SSE events
    for await (const chunk of analysisService.analyzeDocuments(docs, clientName)) {
      reply.raw.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }

    reply.raw.write('data: [DONE]\n\n');
    reply.raw.end();
  } catch (error) {
    if (error instanceof AppError) {
      return reply.status(error.statusCode ?? 500).send({
        error: error.message,
        code: error.code,
      });
    }
    if (error instanceof Error) {
      return reply.status(500).send({
        error: error.message,
      });
    }
    return reply.status(500).send({ error: 'Failed to analyze documents' });
  }
}

export async function generateAnalysis(req: FastifyRequest, reply: FastifyReply) {
  try {
    const body = req.body as { sessionId?: string; clientName?: string; userId?: string } | null;
    const sessionId = body?.sessionId || 'default';
    const clientName = body?.clientName || 'Cliente';
    const userId = body?.userId || 'default-user';

    const docs = documentService.getSessionDocuments(sessionId);

    if (docs.length === 0) {
      return reply.status(400).send({
        error: 'No documents to analyze',
        code: 'DOC_005',
      });
    }

    // Convert ProcessedDocument to PendingDocument expected by analyzeDocumentsWithStructure
    const pendingDocs = docs.map((d, i) => ({ ...d, label: `Documento ${i + 1}: ${d.originalName}` }));

    // 1. Generate Structured Analysis using Claude
    const analysis = await analysisService.analyzeDocumentsWithStructure(pendingDocs as any, clientName);

    // 2. Save Analysis to Notion
    const notionCreator = new NotionDocumentCreator();
    const notionUrl = await notionCreator.createAnalysisPage(analysis);

    // 3. Notify User
    const notificationService = new NotificationService();
    await notificationService.notifyAnalysisReady(clientName, userId, notionUrl);

    return reply.status(200).send({
      message: 'Analysis generated and saved successfully',
      notionUrl,
      analysis,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return reply.status(error.statusCode ?? 500).send({
        error: error.message,
        code: error.code,
      });
    }
    if (error instanceof Error) {
      return reply.status(500).send({
        error: error.message,
      });
    }
    return reply.status(500).send({ error: 'Failed to generate analysis' });
  }
}
