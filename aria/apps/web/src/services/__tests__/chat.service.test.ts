import { describe, it, expect, beforeEach, vi } from 'vitest';
import { streamMessage } from '../chat.service';

describe('streamMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should parse SSE chunks correctly', async () => {
    const chunks: string[] = [];

    const mockResponse = {
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {"type":"chunk","content":"Hello"}\n'),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {"type":"chunk","content":" world"}\n'),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {"type":"done"}\n'),
            })
            .mockResolvedValueOnce({ done: true, value: undefined }),
        }),
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = vi.fn().mockResolvedValue(mockResponse) as any;

    for await (const chunk of streamMessage('test', 'test-session')) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['Hello', ' world']);
  });

  it('should handle stream completion signal', async () => {
    const mockResponse = {
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {"type":"done"}\n'),
            })
            .mockResolvedValueOnce({ done: true, value: undefined }),
        }),
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = vi.fn().mockResolvedValue(mockResponse) as any;

    const chunks: string[] = [];
    for await (const chunk of streamMessage('test', 'test-session')) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(0);
  });

  it('should throw on API error', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = vi.fn().mockResolvedValue(mockResponse) as any;

    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const chunk of streamMessage('test', 'test-session')) {
        // iteration
      }
      expect.fail('Should have thrown');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      expect(error.message).toContain('API error');
    }
  });
});
