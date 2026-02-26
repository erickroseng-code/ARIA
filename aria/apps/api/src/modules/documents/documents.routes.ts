import type { FastifyInstance } from 'fastify';
import { uploadDocument, analyzeDocuments, generateAnalysis } from './documents.controller';

export async function registerDocumentsRoutes(fastify: FastifyInstance) {
  fastify.post<{
    Body: unknown;
  }>(
    '/documents/upload',
    uploadDocument
  );

  fastify.post<{
    Body: unknown;
  }>(
    '/documents/analyze',
    analyzeDocuments
  );

  fastify.post<{
    Body: unknown;
  }>(
    '/documents/generate-analysis',
    generateAnalysis
  );
}
