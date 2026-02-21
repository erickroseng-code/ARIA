import { describe, it, expect, vi, beforeEach } from 'vitest';
import { documentHandler } from '../document.handler';

vi.mock('@aria/core', () => ({
  DocumentService: class {
    processDocument = vi.fn(async (buffer: Buffer, name: string, mime: string) => ({
      id: '123',
      originalName: name,
      mimeType: mime,
      extractedText: 'test content',
      uploadedAt: new Date(),
      processedAt: new Date(),
    }));

    addToSession = vi.fn();
    getSessionDocuments = vi.fn(() => []);
    clearSession = vi.fn();
  },
}));

describe('Document Handler', () => {
  let mockCtx: any;

  beforeEach(() => {
    mockCtx = {
      message: {
        document: {
          file_id: 'test_file_id',
          file_name: 'test.pdf',
          file_size: 1024,
          mime_type: 'application/pdf',
        },
      },
      session: {
        sessionId: 'test-session',
      },
      from: {
        id: 123456,
      },
      api: {
        logger: vi.fn(),
        token: 'test_token',
        getFile: vi.fn(async () => ({ file_path: 'documents/test.pdf' })),
      },
      reply: vi.fn(async (_msg: string) => ({ ok: true })),
    };
  });

  it('should handle valid PDF upload', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(1024),
    } as unknown as Response));

    await documentHandler(mockCtx);

    expect(mockCtx.reply).toHaveBeenCalled();
  });

  it('should reject files larger than 10MB', async () => {
    mockCtx.message.document.file_size = 11 * 1024 * 1024;

    await documentHandler(mockCtx);

    expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('too large'));
  });

  it('should reject unsupported file types', async () => {
    mockCtx.message.document.mime_type = 'image/png';

    await documentHandler(mockCtx);

    expect(mockCtx.reply).toHaveBeenCalledWith(expect.stringContaining('not supported'));
  });

  it('should handle missing document gracefully', async () => {
    mockCtx.message.document = null;

    await documentHandler(mockCtx);

    expect(mockCtx.reply).not.toHaveBeenCalled();
  });

  it('should log metadata only', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(1024),
    } as unknown as Response));

    await documentHandler(mockCtx);

    expect(mockCtx.api.logger).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ fileName: 'test.pdf' }), expect.any(String));
  });
});
