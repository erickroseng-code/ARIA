import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocumentService } from '../DocumentService';

// Mock parsers to avoid mammoth/pdf-parse dependency complexities in this test
vi.mock('../PdfParser', () => ({
  PdfParser: class {
    async parse() {
      return {
        id: 'test-id',
        originalName: 'test.pdf',
        mimeType: 'application/pdf',
        extractedText: 'PDF content',
        uploadedAt: new Date(),
        processedAt: new Date(),
      };
    }
  },
}));

vi.mock('../DocxParser', () => ({
  DocxParser: class {
    async parse(buffer: Buffer, filename: string, mimeType: string) {
      return {
        id: 'test-id',
        originalName: filename,
        mimeType: mimeType as any,
        extractedText: 'DOCX content',
        uploadedAt: new Date(),
        processedAt: new Date(),
      };
    }
  },
}));

describe('DocumentService', () => {
  let service: DocumentService;

  beforeEach(() => {
    service = new DocumentService();
  });

  describe('file validation', () => {
    it('should reject files larger than 10MB', async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      const mimeType = 'application/pdf';

      await expect(service.processDocument(largeBuffer, 'large.pdf', mimeType)).rejects.toThrow('File too large');
    });

    it('should reject unsupported file types', async () => {
      const buffer = Buffer.from('test content');
      const mimeType = 'image/png';

      await expect(service.processDocument(buffer, 'image.png', mimeType)).rejects.toThrow(
        'File type not supported'
      );
    });

    it('should accept PDF files', async () => {
      const buffer = Buffer.from('valid pdf content');
      const result = await service.processDocument(buffer, 'test.pdf', 'application/pdf');

      expect(result.mimeType).toBe('application/pdf');
    });

    it('should accept DOCX files', async () => {
      const buffer = Buffer.from('valid docx content');
      const result = await service.processDocument(
        buffer,
        'test.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );

      expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    });

    it('should accept DOC files', async () => {
      const buffer = Buffer.from('valid doc content');
      const result = await service.processDocument(buffer, 'test.doc', 'application/msword');

      expect(result.mimeType).toBe('application/msword');
    });
  });

  describe('session management', () => {
    it('should store documents in session', () => {
      const doc = {
        id: '123',
        originalName: 'test.pdf',
        mimeType: 'application/pdf' as const,
        extractedText: 'content',
        uploadedAt: new Date(),
      };

      service.addToSession('session1', doc);
      const docs = service.getSessionDocuments('session1');

      expect(docs).toHaveLength(1);
      expect(docs[0].id).toBe('123');
    });

    it('should enforce 5 document limit per session', () => {
      const sessionId = 'session2';

      for (let i = 0; i < 5; i++) {
        service.addToSession(sessionId, {
          id: `doc${i}`,
          originalName: `test${i}.pdf`,
          mimeType: 'application/pdf' as const,
          extractedText: 'content',
          uploadedAt: new Date(),
        });
      }

      const sixthDoc = {
        id: 'doc6',
        originalName: 'test6.pdf',
        mimeType: 'application/pdf' as const,
        extractedText: 'content',
        uploadedAt: new Date(),
      };

      expect(() => service.addToSession(sessionId, sixthDoc)).toThrow('Maximum 5 documents per session exceeded');
    });

    it('should return empty array for non-existent session', () => {
      const docs = service.getSessionDocuments('non-existent');
      expect(docs).toEqual([]);
    });

    it('should clear session documents', () => {
      const sessionId = 'session3';
      service.addToSession(sessionId, {
        id: '123',
        originalName: 'test.pdf',
        mimeType: 'application/pdf' as const,
        extractedText: 'content',
        uploadedAt: new Date(),
      });

      service.clearSession(sessionId);
      const docs = service.getSessionDocuments(sessionId);

      expect(docs).toHaveLength(0);
    });
  });

  describe('document labeling (Task 9.3)', () => {
    it('should update label of last document with index -1', () => {
      const sessionId = 'label-test-1';
      const doc = {
        id: '123',
        originalName: 'setor-comercial.pdf',
        mimeType: 'application/pdf' as const,
        extractedText: 'content',
        uploadedAt: new Date(),
      };

      service.addPendingDocument(sessionId, doc);
      service.setDocumentLabel(sessionId, -1, 'RH');

      const docs = service.getPendingDocuments(sessionId);
      expect(docs[0].label).toBe('RH');
    });

    it('should update label by specific index', () => {
      const sessionId = 'label-test-2';

      for (let i = 0; i < 3; i++) {
        service.addPendingDocument(sessionId, {
          id: `doc${i}`,
          originalName: `test${i}.pdf`,
          mimeType: 'application/pdf' as const,
          extractedText: 'content',
          uploadedAt: new Date(),
        });
      }

      service.setDocumentLabel(sessionId, 1, 'Marketing');

      const docs = service.getPendingDocuments(sessionId);
      expect(docs[1].label).toBe('Marketing');
      expect(docs[0].label).not.toBe('Marketing'); // unchanged
      expect(docs[2].label).not.toBe('Marketing'); // unchanged
    });

    it('should silently ignore index out of range', () => {
      const sessionId = 'label-test-3';
      const originalLabel = service.addPendingDocument(sessionId, {
        id: '123',
        originalName: 'test.pdf',
        mimeType: 'application/pdf' as const,
        extractedText: 'content',
        uploadedAt: new Date(),
      }).label;

      // Should not throw, just no-op
      service.setDocumentLabel(sessionId, 99, 'New Label');

      const docs = service.getPendingDocuments(sessionId);
      expect(docs[0].label).toBe(originalLabel);
    });

    it('should silently handle setDocumentLabel with no documents', () => {
      const sessionId = 'label-test-4';

      // Should not throw, just no-op
      expect(() => {
        service.setDocumentLabel(sessionId, -1, 'RH');
      }).not.toThrow();
    });
  });
});
