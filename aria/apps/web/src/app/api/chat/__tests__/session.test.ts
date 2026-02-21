import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '../session/[sessionId]/route';
import { NextRequest } from 'next/server';

// Mock ContextStore
vi.mock('@aria/core/chat/ContextStore', () => {
  return {
    ContextStore: class MockContextStore {
      async getSessionContext(sessionId: string) {
        if (sessionId === 'test-session') {
          const createdAt = new Date('2024-01-01');
          const lastAt = new Date('2024-01-02');
          return {
            sessionId: 'test-session',
            activeClientId: 'client-123',
            history: [
              {
                role: 'user',
                content: 'Hello',
                timestamp: createdAt,
              },
              {
                role: 'assistant',
                content: 'Hi there',
                timestamp: lastAt,
              },
            ],
          };
        }
        return null;
      }
    },
  };
});

describe('GET /api/chat/session/[sessionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return session info', async () => {
    const mockRequest = new NextRequest(
      'http://localhost:3000/api/chat/session/test-session'
    );
    const response = await GET(mockRequest, {
      params: { sessionId: 'test-session' },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sessionId).toBe('test-session');
    expect(data.activeClientId).toBe('client-123');
    expect(data.messageCount).toBe(2);
    expect(data.createdAt).toBeTruthy();
    expect(data.lastMessageAt).toBeTruthy();
  });

  it('should return 404 for non-existent session', async () => {
    const mockRequest = new NextRequest(
      'http://localhost:3000/api/chat/session/non-existent'
    );
    const response = await GET(mockRequest, {
      params: { sessionId: 'non-existent' },
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Session not found');
  });
});
