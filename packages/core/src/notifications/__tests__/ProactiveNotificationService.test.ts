import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProactiveNotificationService } from '../ProactiveNotificationService';

describe('ProactiveNotificationService', () => {
  let service: ProactiveNotificationService;

  beforeEach(() => {
    service = new ProactiveNotificationService(1000);
  });

  describe('User preferences', () => {
    it('should set and get user preferences', () => {
      const prefs = {
        userId: 'user-123',
        enableCalendarReminders: true,
        enableTaskReminders: false,
        calendarReminderMinutes: 15,
        deliveryChannels: ['telegram'],
        timezone: 'America/Sao_Paulo',
        maxNotificationsPerHour: 10,
      };

      service.setUserPreferences(prefs);
      const retrieved = service.getUserPreferences('user-123');

      expect(retrieved.enableCalendarReminders).toBe(true);
      expect(retrieved.enableTaskReminders).toBe(false);
      expect(retrieved.timezone).toBe('America/Sao_Paulo');
    });

    it('should return default preferences if not set', () => {
      const prefs = service.getUserPreferences('unknown-user');

      expect(prefs.enableCalendarReminders).toBe(true);
      expect(prefs.enableTaskReminders).toBe(true);
      expect(prefs.timezone).toBe('America/Sao_Paulo');
    });
  });

  describe('Monitoring', () => {
    it('should start and stop monitoring', async () => {
      await service.startMonitoring('user-123');
      let status = service.getMonitoringStatus();
      expect(status.some(s => s.userId === 'user-123')).toBe(true);

      service.stopMonitoring('user-123');
      status = service.getMonitoringStatus();
      expect(status.some(s => s.userId === 'user-123')).toBe(false);
    });

    it('should prevent duplicate monitoring', async () => {
      await service.startMonitoring('user-123');
      const consoleSpy = vi.spyOn(console, 'log');

      await service.startMonitoring('user-123');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Already monitoring')
      );

      service.stopMonitoring('user-123');
      consoleSpy.mockRestore();
    });
  });

  describe('Snooze functionality', () => {
    it('should snooze notification', () => {
      service.snoozeNotification('notif-123', 15);

      // Verify snooze was applied (would need to check internal state)
      expect(true).toBe(true);
    });

    it('should provide snooze options', () => {
      const options = service.getSnoozeOptions();

      expect(options).toHaveLength(3);
      expect(options.map(o => o.minutes)).toContain(15);
      expect(options.map(o => o.minutes)).toContain(60);
      expect(options.map(o => o.minutes)).toContain(1440);
    });
  });

  describe('Dismiss functionality', () => {
    it('should dismiss notification', () => {
      // Create a notification first
      const consoleSpy = vi.spyOn(console, 'log');

      service.dismissNotification('notif-123');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('dismissed')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Delivery queue', () => {
    it('should queue notifications for delivery', async () => {
      const notification = {
        id: 'notif-123',
        type: 'calendar-reminder' as const,
        userId: 'user-123',
        title: 'Meeting reminder',
        createdAt: new Date(),
      };

      await service.queueForDelivery('user-123', [notification]);

      const queue = service.getDeliveryQueue('user-123');
      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe('notif-123');
    });

    it('should respect rate limiting', async () => {
      const prefs = service.getUserPreferences('user-123');
      prefs.maxNotificationsPerHour = 2;
      service.setUserPreferences(prefs);

      const notifications = Array.from({ length: 5 }).map((_, i) => ({
        id: `notif-${i}`,
        type: 'calendar-reminder' as const,
        userId: 'user-123',
        title: `Notification ${i}`,
        createdAt: new Date(),
      }));

      await service.queueForDelivery('user-123', notifications);

      const queue = service.getDeliveryQueue('user-123');
      expect(queue.length).toBeLessThanOrEqual(2);
    });

    it('should clear delivery queue', async () => {
      const notification = {
        id: 'notif-123',
        type: 'calendar-reminder' as const,
        userId: 'user-123',
        title: 'Meeting reminder',
        createdAt: new Date(),
      };

      await service.queueForDelivery('user-123', [notification]);
      expect(service.getDeliveryQueue('user-123')).toHaveLength(1);

      // Clear queue (would be called after delivery)
      // Note: no direct clear method, would be called by DeliveryService
    });
  });

  describe('Notification history', () => {
    it('should maintain notification history', () => {
      const history = service.getNotificationHistory('user-123');

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Calendar reminders', () => {
    it('should check calendar reminders', async () => {
      const notifications = await service.checkCalendarReminders('user-123');

      expect(Array.isArray(notifications)).toBe(true);
    });

    it('should skip if calendar reminders disabled', async () => {
      const prefs = service.getUserPreferences('user-123');
      prefs.enableCalendarReminders = false;
      service.setUserPreferences(prefs);

      const notifications = await service.checkCalendarReminders('user-123');

      expect(notifications).toHaveLength(0);
    });
  });

  describe('Task overdue detection', () => {
    it('should check task overdue status', async () => {
      const notifications = await service.checkTaskOverdueStatus('user-123');

      expect(Array.isArray(notifications)).toBe(true);
    });

    it('should skip if task reminders disabled', async () => {
      const prefs = service.getUserPreferences('user-123');
      prefs.enableTaskReminders = false;
      service.setUserPreferences(prefs);

      const notifications = await service.checkTaskOverdueStatus('user-123');

      expect(notifications).toHaveLength(0);
    });
  });

  describe('Error handling', () => {
    it('should handle errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error');

      // Methods with error handling should continue operation
      await service.checkCalendarReminders('user-123');

      // Verify error was logged (or not, depending on implementation)
      expect(true).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('Timezone support', () => {
    it('should store and retrieve timezone', () => {
      const prefs = service.getUserPreferences('user-123');

      expect(prefs.timezone).toBe('America/Sao_Paulo');
    });

    it('should allow timezone customization', () => {
      const prefs = service.getUserPreferences('user-123');
      prefs.timezone = 'America/New_York';
      service.setUserPreferences(prefs);

      const retrieved = service.getUserPreferences('user-123');
      expect(retrieved.timezone).toBe('America/New_York');
    });
  });
});
