import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '../history/[sessionId]/route';
import { NextRequest } from 'next/server';

// Mock ContextStore
vi.mock('@aria/core/chat/ContextStore', () => {
  return {
    ContextStore: class MockContextStore {
      async getSessionContext(sessionId: string) {
        if (sessionId === 'test-session') {
          return {
            sessionId: 'test-session',
            activeClientId: 'client-123',
            history: [
              {
                role: 'user',
                content: 'Hello',
                timestamp: new Date('2024-01-01'),
              },
              {
                role: 'assistant',
                content: 'Hi there',
                timestamp: new Date('2024-01-01'),
              },
            ],
          };
        }
        return null;
      }
    },
  };
});

describe('GET /api/chat/history/[sessionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return session history', async () => {
    const mockRequest = new NextRequest(
      'http://localhost:3000/api/chat/history/test-session'
    );
    const response = await GET(mockRequest, {
      params: { sessionId: 'test-session' },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sessionId).toBe('test-session');
    expect(data.activeClientId).toBe('client-123');
    expect(data.history).toHaveLength(2);
  });

  it('should return 404 for non-existent session', async () => {
    const mockRequest = new NextRequest(
      'http://localhost:3000/api/chat/history/non-existent'
    );
    const response = await GET(mockRequest, {
      params: { sessionId: 'non-existent' },
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Session not found');
  });

  it('should return 400 for missing sessionId', async () => {
    const mockRequest = new NextRequest(
      'http://localhost:3000/api/chat/history/'
    );
    const response = await GET(mockRequest, {
      params: { sessionId: '' },
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Missing sessionId');
  });
});
