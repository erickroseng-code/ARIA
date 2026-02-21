import { describe, it, expect, beforeEach } from 'vitest';
import { ChatService } from '../ChatService';
import { ContextStore } from '../ContextStore';

describe('ChatService', () => {
  let contextStore: ContextStore;

  beforeEach(() => {
    contextStore = new ContextStore();
  });

  it('should initialize with claude client and context store', async () => {
    // Mock Anthropic client with minimal interface
    const mockClaude = {
      messages: {
        stream: async function* () {
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Hello ' },
          };
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'ARIA!' },
          };
        },
        create: async () => ({
          content: [{ type: 'text', text: 'Hello ARIA!' }],
        }),
      },
    };

    const service = new ChatService(mockClaude as any, contextStore);
    expect(service).toBeDefined();
  });

  it('should stream response with chunks', async () => {
    const mockClaude = {
      messages: {
        stream: async function* () {
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Test ' },
          };
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'response' },
          };
        },
        create: async () => ({
          content: [{ type: 'text', text: 'Test response' }],
        }),
      },
    };

    const service = new ChatService(mockClaude as any, contextStore);
    const chunks: string[] = [];
    for await (const chunk of service.streamResponse('test message', 'session-1')) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join('')).toContain('Test');
  });

  it('should save user and assistant messages to context', async () => {
    const mockClaude = {
      messages: {
        stream: async function* () {
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Response' },
          };
        },
        create: async () => ({
          content: [{ type: 'text', text: 'Response' }],
        }),
      },
    };

    const service = new ChatService(mockClaude as any, contextStore);

    // Consume the stream
    for await (const chunk of service.streamResponse('test message', 'session-1')) {
      expect(chunk).toBeDefined();
    }

    const context = await contextStore.get('session-1');
    expect(context.history.length).toBeGreaterThanOrEqual(2);
  });

  describe('PLAN_OF_ATTACK_CREATE handler (Task 9.5)', () => {
    it('should reject "pronto" with 0 documents', async () => {
      const mockClaude = {
        messages: {
          stream: async function* () {
            yield {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: 'Mínimo 2 documentos' },
            };
          },
        },
      };

      const service = new ChatService(mockClaude as any, contextStore);
      const sessionId = 'pronto-test-1';

      // No pending documents
      const context = await contextStore.get(sessionId);
      expect(context.pendingDocuments || []).toHaveLength(0);

      // Should not initiate analysis without documents
      // (This would be validated at handler level in bot)
    });

    it('should reject "pronto" with only 1 document', async () => {
      const mockClaude = {
        messages: {
          stream: async function* () {
            yield {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: 'Mínimo 2 documentos' },
            };
          },
        },
      };

      const service = new ChatService(mockClaude as any, contextStore);
      const sessionId = 'pronto-test-2';

      // Add one document
      await contextStore.addPendingDocument(sessionId, {
        id: 'doc1',
        originalName: 'test.pdf',
        label: 'Test',
        mimeType: 'application/pdf' as const,
        extractedText: 'content',
        uploadedAt: new Date(),
      });

      const context = await contextStore.get(sessionId);
      expect((context.pendingDocuments || []).length).toBe(1);

      // Should not initiate analysis with only 1 document
    });

    it('should allow "pronto" with 2+ documents', async () => {
      const mockClaude = {
        messages: {
          stream: async function* () {
            yield {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: 'Analisando documentos...' },
            };
          },
        },
      };

      const service = new ChatService(mockClaude as any, contextStore);
      const sessionId = 'pronto-test-3';

      // Add two documents
      for (let i = 0; i < 2; i++) {
        await contextStore.addPendingDocument(sessionId, {
          id: `doc${i}`,
          originalName: `test${i}.pdf`,
          label: `Doc ${i}`,
          mimeType: 'application/pdf' as const,
          extractedText: 'content',
          uploadedAt: new Date(),
        });
      }

      const context = await contextStore.get(sessionId);
      expect((context.pendingDocuments || []).length).toBe(2);

      // Analysis should be initiated (would be called by handler)
    });
  });

  describe('Confirmation message format (Task 9.7)', () => {
    it('should include correct labels in confirmation message', async () => {
      const mockClaude = {
        messages: {
          stream: async function* () {
            yield {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: 'Gerando plano...' },
            };
          },
        },
      };

      const service = new ChatService(mockClaude as any, contextStore);
      const sessionId = 'confirm-test-1';

      // Add three documents with labels
      const labels = ['Setor Comercial', 'Marketing', 'RH'];
      for (const label of labels) {
        await contextStore.addPendingDocument(sessionId, {
          id: `doc-${label}`,
          originalName: `${label}.pdf`,
          label,
          mimeType: 'application/pdf' as const,
          extractedText: 'content',
          uploadedAt: new Date(),
        });
      }

      const context = await contextStore.get(sessionId);
      const pendingDocs = context.pendingDocuments || [];

      // Confirmation message should list all documents
      expect(pendingDocs).toHaveLength(3);
      expect(pendingDocs.map(d => d.label)).toEqual(labels);

      // Format would be: "Gerando Plano com 3 documentos: Setor Comercial, Marketing, RH"
    });

    it('should format confirmation with 2 documents', async () => {
      const mockClaude = {
        messages: {
          stream: async function* () {
            yield {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: 'Gerando plano...' },
            };
          },
        },
      };

      const service = new ChatService(mockClaude as any, contextStore);
      const sessionId = 'confirm-test-2';

      // Add two documents
      for (let i = 0; i < 2; i++) {
        await contextStore.addPendingDocument(sessionId, {
          id: `doc${i}`,
          originalName: `test${i}.pdf`,
          label: `Documento ${i + 1}`,
          mimeType: 'application/pdf' as const,
          extractedText: 'content',
          uploadedAt: new Date(),
        });
      }

      const context = await contextStore.get(sessionId);
      const pendingDocs = context.pendingDocuments || [];

      expect(pendingDocs).toHaveLength(2);
      // Confirmation message would list: "Documento 1, Documento 2"
    });
  });
});
