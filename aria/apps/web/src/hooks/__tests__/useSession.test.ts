import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSession } from '../useSession';

describe('useSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load session data', async () => {
    const mockResponse = {
      sessionId: 'test-session',
      activeClientId: 'client-123',
      messageCount: 5,
      createdAt: '2024-01-01T00:00:00Z',
      lastMessageAt: '2024-01-02T00:00:00Z',
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = mockFetch as any;

    const { result } = renderHook(() => useSession('test-session'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.session).toEqual(mockResponse);
    expect(result.current.error).toBeNull();
  });

  it('should handle errors gracefully', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Not found' }),
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = mockFetch as any;

    const { result } = renderHook(() => useSession('non-existent'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.session).toBeNull();
    expect(result.current.error).toBe('Failed to load session');
  });

  it('should reload session data', async () => {
    const mockResponse = {
      sessionId: 'test-session',
      activeClientId: 'client-123',
      messageCount: 5,
      createdAt: '2024-01-01T00:00:00Z',
      lastMessageAt: '2024-01-02T00:00:00Z',
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = mockFetch as any;

    const { result, rerender } = renderHook(() => useSession('test-session'));

    await waitFor(() => {
      expect(result.current.session).toEqual(mockResponse);
    });

    // Call reload
    result.current.reload();

    rerender();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
