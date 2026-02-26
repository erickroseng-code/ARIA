import type { ProcessedDocument, SupportedMimeType, PendingDocument } from '@aria/shared';
import { AppError } from '../errors/AppError';
import { PdfParser } from './PdfParser';
import { DocxParser } from './DocxParser';
import { getFinalDocumentLabel } from '../utils/document.utils';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_DOCS_PER_SESSION = 5;

export class DocumentService {
  private pdfParser = new PdfParser();
  private docxParser = new DocxParser();
  private sessionDocuments = new Map<string, ProcessedDocument[]>();
  private sessionPendingDocuments = new Map<string, PendingDocument[]>();

  async processDocument(
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<ProcessedDocument> {
    // Validate file size
    if (buffer.length > MAX_FILE_SIZE) {
      const sizeMb = (buffer.length / (1024 * 1024)).toFixed(1);
      throw new AppError(
        `File too large (${sizeMb}MB). Limit: 10MB.`,
        'DOC_002',
        { statusCode: 413 }
      );
    }

    // Validate file type
    const supportedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!supportedTypes.includes(mimeType)) {
      throw new AppError(
        'File type not supported. Supported: PDF, DOC, DOCX, TXT',
        'DOC_001',
        { statusCode: 415 }
      );
    }

    // Dispatch to appropriate parser
    if (mimeType === 'application/pdf') {
      return this.pdfParser.parse(buffer, filename);
    } else if (mimeType === 'text/plain') {
      // Basic TXT processing
      return {
        id: `doc_${Date.now()}`,
        originalName: filename,
        mimeType: 'text/plain',
        extractedText: buffer.toString('utf-8'),
        uploadedAt: new Date(),
        processedAt: new Date(),
      } as any;
    } else {
      // Handle both .doc and .docx
      return this.docxParser.parse(buffer, filename, mimeType as SupportedMimeType);
    }
  }

  addToSession(sessionId: string, doc: ProcessedDocument): void {
    const docs = this.sessionDocuments.get(sessionId) || [];

    if (docs.length >= MAX_DOCS_PER_SESSION) {
      throw new AppError(
        `Maximum ${MAX_DOCS_PER_SESSION} documents per session exceeded`,
        'DOC_004',
        { statusCode: 400 }
      );
    }

    docs.push(doc);
    this.sessionDocuments.set(sessionId, docs);
  }

  getSessionDocuments(sessionId: string): ProcessedDocument[] {
    return this.sessionDocuments.get(sessionId) || [];
  }

  clearSession(sessionId: string): void {
    this.sessionDocuments.delete(sessionId);
  }

  /**
   * Add a document to pending documents with auto-labeled name
   * For multi-document support (Story 2.6)
   */
  addPendingDocument(sessionId: string, doc: ProcessedDocument): PendingDocument {
    const pending = this.sessionPendingDocuments.get(sessionId) || [];

    if (pending.length >= MAX_DOCS_PER_SESSION) {
      throw new AppError(
        `⚠️ Limite de ${MAX_DOCS_PER_SESSION} documentos atingido. Digite **pronto** para gerar o Plano ou **cancelar** para reiniciar.`,
        'DOC_004',
        { statusCode: 400 }
      );
    }

    // Extract or generate label
    const label = getFinalDocumentLabel(doc.originalName, pending.length);

    // Create pending document with label
    const pendingDoc: PendingDocument = {
      ...doc,
      label,
    };

    pending.push(pendingDoc);
    this.sessionPendingDocuments.set(sessionId, pending);

    return pendingDoc;
  }

  /**
   * Get all pending documents for a session (returns a copy)
   */
  getPendingDocuments(sessionId: string): PendingDocument[] {
    const docs = this.sessionPendingDocuments.get(sessionId) || [];
    return JSON.parse(JSON.stringify(docs)); // Deep copy
  }

  /**
   * Update label for a specific document
   * @param docIndex - Document index (0-based) or -1 for last document
   */
  setDocumentLabel(sessionId: string, docIndex: number, label: string): void {
    const docs = this.sessionPendingDocuments.get(sessionId);
    if (!docs || docs.length === 0) {
      return; // Silent no-op if no documents
    }

    const actualIndex = docIndex === -1 ? docs.length - 1 : docIndex;

    if (actualIndex < 0 || actualIndex >= docs.length) {
      return; // Silent no-op if index out of range
    }

    const doc = docs[actualIndex];
    if (doc) {
      doc.label = label;
    }
  }

  /**
   * Clear all pending documents for a session
   */
  clearPendingDocuments(sessionId: string): void {
    this.sessionPendingDocuments.delete(sessionId);
  }
}
