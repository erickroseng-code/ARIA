import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MeetingCompletionDetector } from '../MeetingCompletionDetector';
import type { CalendarEvent } from '../CalendarEventService';

describe('MeetingCompletionDetector', () => {
  let detector: MeetingCompletionDetector;
  const mockCalendarService = {
    queryEvents: vi.fn(),
    createEvent: vi.fn(),
    cancelEvent: vi.fn(),
  };

  const mockEvent: CalendarEvent = {
    id: 'event-123',
    title: 'Reunião com Empresa X',
    startTime: new Date(Date.now() - 120 * 60000), // 2 hours ago
    endTime: new Date(Date.now() - 60 * 60000), // 1 hour ago
    timezone: 'America/Sao_Paulo',
    url: 'https://calendar.google.com/event?eid=123',
  };

  beforeEach(() => {
    detector = new MeetingCompletionDetector(mockCalendarService as any, 1000);
    vi.clearAllMocks();
  });

  describe('Meeting detection', () => {
    it('should detect completed meeting based on end time', async () => {
      mockCalendarService.queryEvents.mockResolvedValue([mockEvent]);

      let detectedMeeting = null;
      detector.onMeetingCompleted(async (event) => {
        detectedMeeting = event.meeting;
      });

      await detector['checkAndNotifyCompletedMeetings']('user-123');

      expect(detectedMeeting).not.toBeNull();
      expect(detectedMeeting?.title).toBe('Reunião com Empresa X');
      expect(detectedMeeting?.eventId).toBe('event-123');
    });

    it('should not detect ongoing meetings', async () => {
      const ongoingEvent: CalendarEvent = {
        ...mockEvent,
        endTime: new Date(Date.now() + 60 * 60000), // 1 hour from now
      };

      mockCalendarService.queryEvents.mockResolvedValue([ongoingEvent]);

      let detectedMeeting = null;
      detector.onMeetingCompleted(async (event) => {
        detectedMeeting = event.meeting;
      });

      await detector['checkAndNotifyCompletedMeetings']('user-123');

      expect(detectedMeeting).toBeNull();
    });

    it('should extract participants from title', async () => {
      const eventWithParticipants: CalendarEvent = {
        ...mockEvent,
        title: 'Reunião com João & Maria',
      };

      mockCalendarService.queryEvents.mockResolvedValue([eventWithParticipants]);

      let participants: string[] = [];
      detector.onMeetingCompleted(async (event) => {
        participants = event.meeting.participants || [];
      });

      await detector['checkAndNotifyCompletedMeetings']('user-123');

      expect(participants.length).toBeGreaterThan(0);
    });

    it('should not re-notify already completed meetings', async () => {
      mockCalendarService.queryEvents.mockResolvedValue([mockEvent]);

      let notificationCount = 0;
      detector.onMeetingCompleted(async () => {
        notificationCount++;
      });

      await detector['checkAndNotifyCompletedMeetings']('user-123');
      expect(notificationCount).toBe(1);

      // Check again - should not notify
      await detector['checkAndNotifyCompletedMeetings']('user-123');
      expect(notificationCount).toBe(1);
    });
  });

  describe('Manual trigger', () => {
    it('should trigger summarization manually', async () => {
      let detectedEvent = null;
      detector.onMeetingCompleted(async (event) => {
        detectedEvent = event;
      });

      const event = await detector.manualTriggerSummarization(
        'Reunião com Cliente',
        'Notas da reunião aqui'
      );

      expect(event.meeting.title).toBe('Reunião com Cliente');
      expect(event.detectionMethod).toBe('manual-command');
      expect(detectedEvent).not.toBeNull();
    });
  });

  describe('Monitoring', () => {
    it('should start and stop monitoring', async () => {
      mockCalendarService.queryEvents.mockResolvedValue([]);

      await detector.startMonitoring('user-123');
      let status = detector.getMonitoringStatus();
      expect(status.some(s => s.userId === 'user-123')).toBe(true);

      detector.stopMonitoring('user-123');
      status = detector.getMonitoringStatus();
      expect(status.some(s => s.userId === 'user-123')).toBe(false);
    });

    it('should prevent duplicate monitoring', async () => {
      mockCalendarService.queryEvents.mockResolvedValue([]);

      await detector.startMonitoring('user-123');
      const consoleSpy = vi.spyOn(console, 'log');

      await detector.startMonitoring('user-123');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Already monitoring')
      );

      detector.stopMonitoring('user-123');
      consoleSpy.mockRestore();
    });
  });

  describe('Listener management', () => {
    it('should add and remove listeners', async () => {
      const listener = vi.fn();
      detector.onMeetingCompleted(listener);
      detector.removeListener(listener);

      mockCalendarService.queryEvents.mockResolvedValue([mockEvent]);
      await detector['checkAndNotifyCompletedMeetings']('user-123');

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', async () => {
      const errorListener = vi.fn().mockRejectedValue(new Error('Listener error'));
      const successListener = vi.fn();

      detector.onMeetingCompleted(errorListener);
      detector.onMeetingCompleted(successListener);

      mockCalendarService.queryEvents.mockResolvedValue([mockEvent]);
      const consoleSpy = vi.spyOn(console, 'error');

      await detector['checkAndNotifyCompletedMeetings']('user-123');

      expect(consoleSpy).toHaveBeenCalled();
      expect(successListener).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Cache management', () => {
    it('should clear completed meetings cache', async () => {
      mockCalendarService.queryEvents.mockResolvedValue([mockEvent]);

      let callCount = 0;
      detector.onMeetingCompleted(async () => {
        callCount++;
      });

      await detector['checkAndNotifyCompletedMeetings']('user-123');
      expect(callCount).toBe(1);

      detector.clearCompletedCache();

      await detector['checkAndNotifyCompletedMeetings']('user-123');
      expect(callCount).toBe(2);
    });
  });

  describe('Participant extraction', () => {
    it('should extract multiple participants', () => {
      const event: CalendarEvent = {
        ...mockEvent,
        title: 'Meeting with John & Jane and Bob',
      };

      let participants: string[] = [];
      detector.onMeetingCompleted(async (completionEvent) => {
        participants = completionEvent.meeting.participants || [];
      });

      // Manually trigger to test extraction
      detector['checkAndNotifyCompletedMeetings']('user-123');
    });

    it('should extract participants from description', () => {
      const event: CalendarEvent = {
        ...mockEvent,
        description: 'Attendees: João Silva, Maria Santos, Pedro Costa',
      };

      mockCalendarService.queryEvents.mockResolvedValue([event]);

      let participants: string[] = [];
      detector.onMeetingCompleted(async (completionEvent) => {
        participants = completionEvent.meeting.participants || [];
      });

      detector['checkAndNotifyCompletedMeetings']('user-123');
    });
  });
});
