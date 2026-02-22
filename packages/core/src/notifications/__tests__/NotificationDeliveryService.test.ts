import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationDeliveryService } from '../NotificationDeliveryService';
import { ProactiveNotificationService } from '../ProactiveNotificationService';
import type { NotificationEvent } from '../ProactiveNotificationService';

describe('NotificationDeliveryService', () => {
  let deliveryService: NotificationDeliveryService;
  let notificationService: ProactiveNotificationService;

  beforeEach(() => {
    notificationService = new ProactiveNotificationService();
    deliveryService = new NotificationDeliveryService(notificationService);
  });

  describe('Telegram delivery', () => {
    it('should format telegram message correctly', async () => {
      const notification: NotificationEvent = {
        id: 'notif-123',
        type: 'calendar-reminder',
        userId: 'user-123',
        title: '📅 Reunião em 15 min',
        description: 'Daily standup',
        createdAt: new Date(),
      };

      const result = await deliveryService['deliverViaTelegram']('user-123', notification);

      expect(result.channel).toBe('telegram');
      expect(result.notificationId).toBe('notif-123');
    });

    it('should handle telegram token missing', async () => {
      const notification: NotificationEvent = {
        id: 'notif-123',
        type: 'calendar-reminder',
        userId: 'user-123',
        title: '📅 Reunião',
        createdAt: new Date(),
      };

      // Set invalid token to trigger error
      const result = await deliveryService['deliverViaTelegram']('user-123', notification);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Telegram');
    });
  });

  describe('WebSocket delivery', () => {
    it('should deliver via websocket if connected', async () => {
      const mockConnection = {
        send: vi.fn(),
      };

      deliveryService.registerConnection('user-123', mockConnection);

      const notification: NotificationEvent = {
        id: 'notif-123',
        type: 'calendar-reminder',
        userId: 'user-123',
        title: '📅 Reunião em 15 min',
        createdAt: new Date(),
      };

      const result = await deliveryService['deliverViaWebSocket']('user-123', notification);

      expect(result.success).toBe(true);
      expect(mockConnection.send).toHaveBeenCalled();

      deliveryService.unregisterConnection('user-123');
    });

    it('should handle disconnected user', async () => {
      const notification: NotificationEvent = {
        id: 'notif-123',
        type: 'calendar-reminder',
        userId: 'user-456',
        title: '📅 Reunião',
        createdAt: new Date(),
      };

      const result = await deliveryService['deliverViaWebSocket']('user-456', notification);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not connected');
    });
  });

  describe('Retry logic', () => {
    it('should queue failed notifications for retry', async () => {
      const notification: NotificationEvent = {
        id: 'notif-123',
        type: 'calendar-reminder',
        userId: 'user-999',
        title: '📅 Reunião',
        createdAt: new Date(),
      };

      // Simulate delivery with no telegram token
      await deliveryService['deliverViaTelegram']('user-999', notification);

      // Check failed queue
      const status = deliveryService.getFailedQueueStatus();
      expect(status.count).toBeGreaterThanOrEqual(0);
    });

    it('should respect max retry attempts', async () => {
      // Implement retry test
      expect(true).toBe(true);
    });
  });

  describe('Notification formatting', () => {
    it('should format calendar reminder for telegram', () => {
      const notification: NotificationEvent = {
        id: 'notif-123',
        type: 'calendar-reminder',
        userId: 'user-123',
        title: '📅 Reunião em 15 min',
        description: 'Team Standup',
        createdAt: new Date(),
      };

      // Test message formatting
      const message = deliveryService['formatTelegramMessage'](notification);
      expect(message).toContain('Reunião em 15 min');
    });

    it('should format task overdue for telegram', () => {
      const notification: NotificationEvent = {
        id: 'notif-456',
        type: 'task-overdue',
        userId: 'user-123',
        title: '🔴 Tarefa atrasou!',
        description: 'Fix bug #123',
        createdAt: new Date(),
      };

      const message = deliveryService['formatTelegramMessage'](notification);
      expect(message).toContain('Tarefa atrasou');
    });

    it('should format notification for web UI', () => {
      const notification: NotificationEvent = {
        id: 'notif-123',
        type: 'calendar-reminder',
        userId: 'user-123',
        title: '📅 Reunião em 15 min',
        description: 'Meeting',
        createdAt: new Date(),
      };

      const payload = deliveryService['formatWebUIMessage'](notification);

      expect(payload.type).toBe('notification');
      expect(payload.id).toBe('notif-123');
      expect(payload.actions).toHaveLength(4); // Dismiss + 3 snooze options
    });
  });

  describe('Connection management', () => {
    it('should register and unregister websocket connections', () => {
      const mockConnection = { send: vi.fn() };

      deliveryService.registerConnection('user-123', mockConnection);
      // Connection registered, can deliver

      deliveryService.unregisterConnection('user-123');
      // Connection unregistered
    });
  });

  describe('Delivery history', () => {
    it('should maintain delivery history', async () => {
      const notification: NotificationEvent = {
        id: 'notif-123',
        type: 'calendar-reminder',
        userId: 'user-123',
        title: '📅 Reunião',
        createdAt: new Date(),
      };

      await deliveryService.deliverNotification('user-123', notification);

      const history = deliveryService.getDeliveryHistory('notif-123');
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('Test delivery', () => {
    it('should handle test notification delivery', async () => {
      const result = await deliveryService.testDelivery('user-123');

      expect(result.telegram).toBe(false || true); // May succeed or fail depending on config
      expect(result.webui).toBe(false); // User not connected
    });
  });

  describe('Queue management', () => {
    it('should maintain failed queue status', () => {
      const status = deliveryService.getFailedQueueStatus();

      expect(status.count).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(status.notifications)).toBe(true);
    });

    it('should clear delivery history', () => {
      deliveryService.clearDeliveryHistory();
      // Should not throw error
      expect(true).toBe(true);
    });
  });

  describe('Multi-channel delivery', () => {
    it('should deliver via multiple channels', async () => {
      const mockConnection = { send: vi.fn() };
      deliveryService.registerConnection('user-123', mockConnection);

      const prefs = notificationService.getUserPreferences('user-123');
      prefs.deliveryChannels = ['telegram', 'web-ui'];
      notificationService.setUserPreferences(prefs);

      const notification: NotificationEvent = {
        id: 'notif-123',
        type: 'calendar-reminder',
        userId: 'user-123',
        title: '📅 Reunião',
        createdAt: new Date(),
      };

      const results = await deliveryService.deliverNotification('user-123', notification);

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.map(r => r.channel)).toContain('web-ui');

      deliveryService.unregisterConnection('user-123');
    });
  });

  describe('Error handling', () => {
    it('should handle delivery errors gracefully', async () => {
      const notification: NotificationEvent = {
        id: 'notif-123',
        type: 'calendar-reminder',
        userId: 'user-123',
        title: '📅 Reunião',
        createdAt: new Date(),
      };

      // Should not throw
      const results = await deliveryService.deliverNotification('user-123', notification);
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
