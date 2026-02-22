import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CalendarEventService, CalendarEvent, GoogleOAuthToken } from '../CalendarEventService';

describe('CalendarEventService', () => {
  let service: CalendarEventService;
  let mockToken: GoogleOAuthToken;

  beforeEach(() => {
    mockToken = {
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      tokenType: 'Bearer',
    };

    let storedToken = mockToken;

    service = new CalendarEventService(
      async () => storedToken,
      async (token) => {
        storedToken = token;
      },
      'test-client-id',
      'test-client-secret'
    );

    // Mock fetch
    global.fetch = vi.fn();
  });

  describe('createEvent', () => {
    it('should create an event successfully', async () => {
      const mockResponse = {
        id: 'event123',
        summary: 'Meeting with Client',
        start: { dateTime: '2026-02-22T14:00:00' },
        end: { dateTime: '2026-02-22T15:00:00' },
        htmlLink: 'https://calendar.google.com/calendar/...',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const startTime = new Date('2026-02-22T14:00:00');
      const endTime = new Date('2026-02-22T15:00:00');

      const event = await service.createEvent(
        'Meeting with Client',
        startTime,
        endTime,
        'America/Sao_Paulo',
        'Quarterly review'
      );

      expect(event.id).toBe('event123');
      expect(event.title).toBe('Meeting with Client');
      expect(event.timezone).toBe('America/Sao_Paulo');
    });

    it('should throw error on API failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const startTime = new Date('2026-02-22T14:00:00');
      const endTime = new Date('2026-02-22T15:00:00');

      await expect(
        service.createEvent('Meeting', startTime, endTime, 'America/Sao_Paulo')
      ).rejects.toThrow('Failed to create calendar event');
    });

    it('should handle API timeout', async () => {
      (global.fetch as any).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({}),
                }),
              15000
            );
          })
      );

      const startTime = new Date('2026-02-22T14:00:00');
      const endTime = new Date('2026-02-22T15:00:00');

      await expect(
        service.createEvent('Meeting', startTime, endTime, 'America/Sao_Paulo')
      ).rejects.toThrow('API timeout');
    });
  });

  describe('queryEvents', () => {
    it('should return events for date range', async () => {
      const mockResponse = {
        items: [
          {
            id: 'event1',
            summary: 'Meeting 1',
            start: { dateTime: '2026-02-22T14:00:00' },
            end: { dateTime: '2026-02-22T15:00:00' },
            htmlLink: 'https://calendar.google.com/...',
          },
          {
            id: 'event2',
            summary: 'Meeting 2',
            start: { dateTime: '2026-02-22T16:00:00' },
            end: { dateTime: '2026-02-22T17:00:00' },
            htmlLink: 'https://calendar.google.com/...',
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const startDate = new Date('2026-02-22T00:00:00');
      const endDate = new Date('2026-02-22T23:59:59');

      const events = await service.queryEvents(startDate, endDate);

      expect(events).toHaveLength(2);
      expect(events[0].id).toBe('event1');
      expect(events[1].id).toBe('event2');
    });

    it('should cache query results', async () => {
      const mockResponse = {
        items: [
          {
            id: 'event1',
            summary: 'Meeting',
            start: { dateTime: '2026-02-22T14:00:00' },
            end: { dateTime: '2026-02-22T15:00:00' },
            htmlLink: 'https://calendar.google.com/...',
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const startDate = new Date('2026-02-22T00:00:00');
      const endDate = new Date('2026-02-22T23:59:59');

      // First call
      const events1 = await service.queryEvents(startDate, endDate);
      expect(events1).toHaveLength(1);

      // Second call should use cache (no new fetch)
      const events2 = await service.queryEvents(startDate, endDate);
      expect(events2).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should return empty list when no events', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      });

      const startDate = new Date('2026-02-22T00:00:00');
      const endDate = new Date('2026-02-22T23:59:59');

      const events = await service.queryEvents(startDate, endDate);
      expect(events).toHaveLength(0);
    });
  });

  describe('cancelEvent', () => {
    it('should cancel event successfully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      await service.cancelEvent('event123');
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should throw error if cancel fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(service.cancelEvent('nonexistent')).rejects.toThrow('Failed to cancel event');
    });
  });

  describe('token refresh', () => {
    it('should refresh token when expired', async () => {
      const expiredToken: GoogleOAuthToken = {
        accessToken: 'old-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() - 1000), // Expired
        tokenType: 'Bearer',
      };

      let storedToken = expiredToken;

      const refreshService = new CalendarEventService(
        async () => storedToken,
        async (token) => {
          storedToken = token;
        },
        'test-client-id',
        'test-client-secret'
      );

      // Mock token refresh response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      });

      // Mock event query (which triggers token check)
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      });

      const startDate = new Date();
      const endDate = new Date(Date.now() + 86400000);

      await refreshService.queryEvents(startDate, endDate);

      expect(storedToken.accessToken).toBe('new-token');
    });

    it('should throw error if no token available', async () => {
      const noTokenService = new CalendarEventService(
        async () => null,
        async () => {}
      );

      const startDate = new Date();
      const endDate = new Date(Date.now() + 86400000);

      await expect(noTokenService.queryEvents(startDate, endDate)).rejects.toThrow(
        'No OAuth token found'
      );
    });
  });

  describe('timezone handling', () => {
    it('should preserve timezone in created event', async () => {
      const mockResponse = {
        id: 'event123',
        summary: 'Meeting',
        start: { dateTime: '2026-02-22T14:00:00', timeZone: 'America/Sao_Paulo' },
        end: { dateTime: '2026-02-22T15:00:00', timeZone: 'America/Sao_Paulo' },
        htmlLink: 'https://calendar.google.com/...',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const startTime = new Date('2026-02-22T14:00:00');
      const endTime = new Date('2026-02-22T15:00:00');

      const event = await service.createEvent(
        'Meeting',
        startTime,
        endTime,
        'America/Sao_Paulo'
      );

      expect(event.timezone).toBe('America/Sao_Paulo');
    });
  });
});
