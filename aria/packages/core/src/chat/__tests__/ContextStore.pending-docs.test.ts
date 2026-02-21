import { describe, it, expect, beforeEach } from 'vitest';
import { ContextStore, SessionContext } from '../ContextStore';
import type { PendingDocument } from '@aria/shared';

describe('ContextStore - Pending Documents', () => {
  let store: ContextStore;
  const sessionId = 'test-session-001';

  beforeEach(() => {
    store = new ContextStore();
  });

  describe('addPendingDocument', () => {
    it('should add a pending document to session', async () => {
      const mockDoc: PendingDocument = {
        id: 'doc-001',
        originalName: 'setor-comercial.pdf',
        mimeType: 'application/pdf',
        extractedText: 'Commercial sector analysis...',
        label: 'Setor Comercial',
        uploadedAt: new Date(),
      };

      await store.addPendingDocument(sessionId, mockDoc);
      const docs = await store.getPendingDocuments(sessionId);

      expect(docs).toHaveLength(1);
      expect(docs[0]).toEqual(mockDoc);
    });

    it('should add multiple pending documents', async () => {
      const doc1: PendingDocument = {
        id: 'doc-001',
        originalName: 'report.pdf',
        mimeType: 'application/pdf',
        extractedText: 'Report content',
        label: 'Report',
        uploadedAt: new Date(),
      };

      const doc2: PendingDocument = {
        id: 'doc-002',
        originalName: 'analysis.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extractedText: 'Analysis content',
        label: 'Analysis',
        uploadedAt: new Date(),
      };

      await store.addPendingDocument(sessionId, doc1);
      await store.addPendingDocument(sessionId, doc2);

      const docs = await store.getPendingDocuments(sessionId);
      expect(docs).toHaveLength(2);
      expect(docs[0].label).toBe('Report');
      expect(docs[1].label).toBe('Analysis');
    });

    it('should preserve document order', async () => {
      const docs = [
        { id: 'doc-1', label: 'First', originalName: 'first.pdf', mimeType: 'application/pdf' as const, extractedText: '', uploadedAt: new Date() },
        { id: 'doc-2', label: 'Second', originalName: 'second.pdf', mimeType: 'application/pdf' as const, extractedText: '', uploadedAt: new Date() },
        { id: 'doc-3', label: 'Third', originalName: 'third.pdf', mimeType: 'application/pdf' as const, extractedText: '', uploadedAt: new Date() },
      ];

      for (const doc of docs) {
        await store.addPendingDocument(sessionId, doc);
      }

      const retrieved = await store.getPendingDocuments(sessionId);
      expect(retrieved.map(d => d.label)).toEqual(['First', 'Second', 'Third']);
    });
  });

  describe('getPendingDocuments', () => {
    it('should return empty array for session without pending docs', async () => {
      const docs = await store.getPendingDocuments('unknown-session');
      expect(docs).toEqual([]);
    });

    it('should return all pending documents for session', async () => {
      const doc1: PendingDocument = {
        id: 'doc-001',
        originalName: 'file1.pdf',
        mimeType: 'application/pdf',
        extractedText: 'Content 1',
        label: 'File 1',
        uploadedAt: new Date(),
      };

      const doc2: PendingDocument = {
        id: 'doc-002',
        originalName: 'file2.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extractedText: 'Content 2',
        label: 'File 2',
        uploadedAt: new Date(),
      };

      await store.addPendingDocument(sessionId, doc1);
      await store.addPendingDocument(sessionId, doc2);

      const docs = await store.getPendingDocuments(sessionId);
      expect(docs).toHaveLength(2);
      expect(docs).toContainEqual(doc1);
      expect(docs).toContainEqual(doc2);
    });

    it('should not affect other sessions', async () => {
      const session2Id = 'test-session-002';

      const doc1: PendingDocument = {
        id: 'doc-001',
        originalName: 'file1.pdf',
        mimeType: 'application/pdf',
        extractedText: 'Content 1',
        label: 'Session 1 Doc',
        uploadedAt: new Date(),
      };

      const doc2: PendingDocument = {
        id: 'doc-002',
        originalName: 'file2.pdf',
        mimeType: 'application/pdf',
        extractedText: 'Content 2',
        label: 'Session 2 Doc',
        uploadedAt: new Date(),
      };

      await store.addPendingDocument(sessionId, doc1);
      await store.addPendingDocument(session2Id, doc2);

      const docs1 = await store.getPendingDocuments(sessionId);
      const docs2 = await store.getPendingDocuments(session2Id);

      expect(docs1).toHaveLength(1);
      expect(docs1[0].label).toBe('Session 1 Doc');
      expect(docs2).toHaveLength(1);
      expect(docs2[0].label).toBe('Session 2 Doc');
    });
  });

  describe('clearPendingDocuments', () => {
    it('should clear all pending documents for a session', async () => {
      const doc: PendingDocument = {
        id: 'doc-001',
        originalName: 'test.pdf',
        mimeType: 'application/pdf',
        extractedText: 'Test content',
        label: 'Test',
        uploadedAt: new Date(),
      };

      await store.addPendingDocument(sessionId, doc);
      let docs = await store.getPendingDocuments(sessionId);
      expect(docs).toHaveLength(1);

      await store.clearPendingDocuments(sessionId);
      docs = await store.getPendingDocuments(sessionId);

      expect(docs).toEqual([]);
    });

    it('should clear only the specified session', async () => {
      const session2Id = 'test-session-002';
      const doc1: PendingDocument = {
        id: 'doc-001',
        originalName: 'file1.pdf',
        mimeType: 'application/pdf',
        extractedText: 'Content 1',
        label: 'Session 1 Doc',
        uploadedAt: new Date(),
      };

      const doc2: PendingDocument = {
        id: 'doc-002',
        originalName: 'file2.pdf',
        mimeType: 'application/pdf',
        extractedText: 'Content 2',
        label: 'Session 2 Doc',
        uploadedAt: new Date(),
      };

      await store.addPendingDocument(sessionId, doc1);
      await store.addPendingDocument(session2Id, doc2);

      await store.clearPendingDocuments(sessionId);

      const docs1 = await store.getPendingDocuments(sessionId);
      const docs2 = await store.getPendingDocuments(session2Id);

      expect(docs1).toEqual([]);
      expect(docs2).toHaveLength(1);
      expect(docs2[0].label).toBe('Session 2 Doc');
    });

    it('should be safe to clear non-existent pending documents', async () => {
      // Should not throw an error
      await expect(store.clearPendingDocuments('non-existent-session')).resolves.not.toThrow();
    });
  });

  describe('Integration with SessionContext', () => {
    it('should maintain pending documents in SessionContext', async () => {
      const doc: PendingDocument = {
        id: 'doc-001',
        originalName: 'test.pdf',
        mimeType: 'application/pdf',
        extractedText: 'Test content',
        label: 'Test Document',
        uploadedAt: new Date(),
      };

      await store.addPendingDocument(sessionId, doc);
      const context = await store.getSessionContext(sessionId);

      expect(context?.pendingDocuments).toBeDefined();
      expect(context?.pendingDocuments).toHaveLength(1);
      expect(context?.pendingDocuments?.[0].label).toBe('Test Document');
    });

    it('should initialize empty pendingDocuments array when getting new context', async () => {
      const context = await store.get(sessionId);
      expect(context.pendingDocuments).toBeUndefined();

      // After adding a document, it should exist
      const doc: PendingDocument = {
        id: 'doc-001',
        originalName: 'test.pdf',
        mimeType: 'application/pdf',
        extractedText: 'Test',
        label: 'Test',
        uploadedAt: new Date(),
      };

      await store.addPendingDocument(sessionId, doc);
      const updatedContext = await store.get(sessionId);
      expect(updatedContext.pendingDocuments).toBeDefined();
      expect(updatedContext.pendingDocuments).toHaveLength(1);
    });
  });
});
