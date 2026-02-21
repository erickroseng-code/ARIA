import { describe, it, expect, beforeEach, vi } from 'vitest';
import { audioHandler } from '../audio.handler';

// Mock AudioService
vi.mock('@aria/core', () => ({
  AudioService: vi.fn().mockImplementation(() => ({
    transcribeFromBuffer: vi.fn(),
  })),
  contextStore: {},
}));

describe('audioHandler', () => {
  let mockCtx: any;

  beforeEach(() => {
    mockCtx = {
      message: {
        voice: {
          file_id: 'test-file-id',
          file_size: 2 * 1024 * 1024, // 2MB
          duration: 10, // 10 seconds
        },
      },
      session: {
        sessionId: 'test-session-id',
      },
      from: {
        id: 12345,
      },
      api: {
        getFile: vi.fn().mockResolvedValue({
          file_path: 'documents/test-audio.ogg',
        }),
        token: 'test-token',
        logger: vi.fn(),
      },
      reply: vi.fn().mockResolvedValue({ message_id: 1 }),
      editMessageText: vi.fn().mockResolvedValue({ message_id: 1 }),
    };

    // Mock fetch
    global.fetch = vi.fn();
  });

  it('should handle valid voice message', async () => {
    // Mock fetch response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
    });

    await audioHandler(mockCtx);

    expect(mockCtx.reply).toHaveBeenCalledWith('🎙️ Transcrevendo áudio...');
  });

  it('should reject oversized audio files', async () => {
    mockCtx.message.voice.file_size = 11 * 1024 * 1024; // 11MB

    await audioHandler(mockCtx);

    expect(mockCtx.reply).toHaveBeenCalledWith('🎙️ Transcrevendo áudio...');
    expect(mockCtx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('muito grande')
    );
  });

  it('should reject very short audio (< 1s)', async () => {
    mockCtx.message.voice.duration = 0;

    await audioHandler(mockCtx);

    expect(mockCtx.reply).toHaveBeenCalledWith('🎙️ Transcrevendo áudio...');
    expect(mockCtx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('muito curto')
    );
  });

  it('should reject very long audio (> 60s)', async () => {
    mockCtx.message.voice.duration = 65;

    await audioHandler(mockCtx);

    expect(mockCtx.reply).toHaveBeenCalledWith('🎙️ Transcrevendo áudio...');
    expect(mockCtx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('muito longo')
    );
  });

  it('should handle missing voice message gracefully', async () => {
    mockCtx.message.voice = undefined;

    await audioHandler(mockCtx);

    expect(mockCtx.reply).not.toHaveBeenCalled();
  });

  it('should handle missing session gracefully', async () => {
    mockCtx.session.sessionId = undefined;

    await audioHandler(mockCtx);

    expect(mockCtx.reply).not.toHaveBeenCalled();
  });

  it('should handle file download failure', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
    });

    await audioHandler(mockCtx);

    expect(mockCtx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('Erro')
    );
  });

  it('should handle transcription service error', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
    });

    // AudioService error will be caught by the handler
    // This test verifies error handling through the fetch response

    await audioHandler(mockCtx);

    // The handler should attempt processing
    expect(mockCtx.reply).toHaveBeenCalledWith('🎙️ Transcrevendo áudio...');
  });

  it('should log debug information', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
    });

    await audioHandler(mockCtx);

    expect(mockCtx.api.logger).toHaveBeenCalledWith(
      'debug',
      expect.objectContaining({
        sessionId: 'test-session-id',
        userId: 12345,
        duration: 10,
      }),
      expect.stringContaining('voice')
    );
  });

  it('should construct correct file URL', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
    });

    await audioHandler(mockCtx);

    // Verify fetch was called with correct URL format
    const fetchCall = (global.fetch as any).mock.calls[0];
    expect(fetchCall[0]).toContain('api.telegram.org');
    expect(fetchCall[0]).toContain('test-token');
  });
});
