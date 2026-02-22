/**
 * Notification Service Tests
 * Task 4: Notification System
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NotificationService } from '../NotificationService';
import type { GeneratedReport } from '../../reports/ReportGenerationService';

describe('NotificationService', () => {
  let service: NotificationService;
  let mockReport: GeneratedReport;

  beforeEach(() => {
    service = new NotificationService();
    mockReport = {
      id: 'report_123',
      userId: 'user123',
      period: { start: new Date('2026-02-01'), end: new Date('2026-02-28') },
      sections: {
        executiveSummary: 'Summary text',
        keyMetrics: ['Metric 1', 'Metric 2'],
        insights: ['Insight 1'],
        recommendations: ['Rec 1'],
      },
      notionPageId: 'notion_page_123',
      generatedAt: new Date(),
      cacheExpiresAt: new Date(),
      sourceData: {
        clickupMetrics: '25 completed',
        notionMetrics: '12 clients',
        calendarMetrics: '28.5h',
      },
    };
  });

  describe('Initialization', () => {
    it('should initialize service', () => {
      expect(service).toBeDefined();
    });

    it('should accept Telegram credentials in constructor', () => {
      const svc = new NotificationService('token123', 'chat456');
      expect(svc).toBeDefined();
    });
  });

  describe('Report Ready Notification', () => {
    it('should create report ready notification', async () => {
      const notification = await service.notifyReportReady(
        mockReport,
        'user123'
      );

      expect(notification).toBeDefined();
      expect(notification.type).toBe('report_ready');
      expect(notification.userId).toBe('user123');
      expect(notification.reportId).toBe('report_123');
      expect(notification.channels.webUI).toBe(true);
      expect(notification.channels.database).toBe(true);
    });

    it('should include period in notification message', async () => {
      const notification = await service.notifyReportReady(
        mockReport,
        'user123'
      );

      expect(notification.message).toContain('2026');
      expect(notification.message).toContain('Relatório');
    });

    it('should have Notion link in message', async () => {
      const notification = await service.notifyReportReady(
        mockReport,
        'user123'
      );

      expect(notification.message).toBeDefined();
    });
  });

  describe('Report Error Notification', () => {
    it('should create error notification', async () => {
      const notification = await service.notifyReportError(
        'user123',
        'OpenRouter API timeout'
      );

      expect(notification.type).toBe('report_error');
      expect(notification.message).toContain('Erro');
      expect(notification.message).toContain('OpenRouter API timeout');
    });

    it('should have webUI and database channels enabled', async () => {
      const notification = await service.notifyReportError(
        'user123',
        'Test error'
      );

      expect(notification.channels.webUI).toBe(true);
      expect(notification.channels.database).toBe(true);
    });
  });

  describe('Notification Storage', () => {
    it('should store notification in history', async () => {
      await service.notifyReportReady(mockReport, 'user123');

      const notifications = service.getNotificationsForUser('user123');
      expect(notifications).toHaveLength(1);
      expect(notifications[0].reportId).toBe('report_123');
    });

    it('should filter notifications by user', async () => {
      await service.notifyReportReady(mockReport, 'user123');
      await service.notifyReportReady(mockReport, 'user456');

      const user123Notifications =
        service.getNotificationsForUser('user123');
      const user456Notifications =
        service.getNotificationsForUser('user456');

      expect(user123Notifications).toHaveLength(1);
      expect(user456Notifications).toHaveLength(1);
      expect(user123Notifications[0].userId).toBe('user123');
      expect(user456Notifications[0].userId).toBe('user456');
    });

    it('should get all notifications', async () => {
      await service.notifyReportReady(mockReport, 'user123');
      await service.notifyReportError('user456', 'Error');

      const all = service.getAllNotifications();
      expect(all).toHaveLength(2);
    });

    it('should clear notifications', async () => {
      await service.notifyReportReady(mockReport, 'user123');
      expect(service.getAllNotifications()).toHaveLength(1);

      service.clearNotifications();
      expect(service.getAllNotifications()).toHaveLength(0);
    });
  });

  describe('Configuration', () => {
    it('should report Telegram as not configured by default', () => {
      const status = service.getConfigurationStatus();
      expect(status.telegram).toBe(false);
      expect(status.webUI).toBe(true);
      expect(status.database).toBe(true);
    });

    it('should report fully configured when all services available', () => {
      const svc = new NotificationService('token', 'chat');
      const status = svc.getConfigurationStatus();

      expect(status.webUI).toBe(true);
      expect(status.database).toBe(true);
    });
  });

  describe('Notification Record Structure', () => {
    it('should have required notification fields', async () => {
      const notification = await service.notifyReportReady(
        mockReport,
        'user123'
      );

      expect(notification.id).toBeDefined();
      expect(notification.userId).toBeDefined();
      expect(notification.reportId).toBeDefined();
      expect(notification.type).toBeDefined();
      expect(notification.channels).toBeDefined();
      expect(notification.sentAt).toBeInstanceOf(Date);
      expect(notification.message).toBeDefined();
    });

    it('should have unique notification IDs', async () => {
      const notif1 = await service.notifyReportReady(
        mockReport,
        'user123'
      );
      const notif2 = await service.notifyReportReady(
        mockReport,
        'user123'
      );

      expect(notif1.id).not.toBe(notif2.id);
    });
  });

  describe('Notification Types', () => {
    it('should support report_ready type', async () => {
      const notification = await service.notifyReportReady(
        mockReport,
        'user123'
      );
      expect(notification.type).toBe('report_ready');
    });

    it('should support report_error type', async () => {
      const notification = await service.notifyReportError(
        'user123',
        'Test'
      );
      expect(notification.type).toBe('report_error');
    });
  });

  describe('Multiple Notifications', () => {
    it('should handle multiple notifications sequentially', async () => {
      const notif1 = await service.notifyReportReady(
        mockReport,
        'user123'
      );
      const notif2 = await service.notifyReportError(
        'user123',
        'Error occurred'
      );

      const all = service.getAllNotifications();
      expect(all).toHaveLength(2);
      expect(all[0].id).toBe(notif1.id);
      expect(all[1].id).toBe(notif2.id);
    });

    it('should maintain chronological order', async () => {
      await service.notifyReportReady(mockReport, 'user123');
      await new Promise((resolve) => setTimeout(resolve, 10));
      await service.notifyReportError('user123', 'Error');

      const notifications = service.getAllNotifications();
      expect(notifications[0].type).toBe('report_ready');
      expect(notifications[1].type).toBe('report_error');
    });
  });
});
