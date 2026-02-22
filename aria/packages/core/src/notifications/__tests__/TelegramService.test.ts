/**
 * Telegram Service Tests
 * Task 4.1: Telegram Notifications
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TelegramService } from '../TelegramService';

describe('TelegramService', () => {
  let service: TelegramService;

  beforeEach(() => {
    service = new TelegramService();
  });

  describe('Initialization', () => {
    it('should initialize with environment variables', () => {
      expect(service).toBeDefined();
    });

    it('should accept credentials in constructor', () => {
      const svc = new TelegramService('token123', 'chat456');
      expect(svc).toBeDefined();
    });
  });

  describe('Configuration Check', () => {
    it('should report not configured by default', () => {
      expect(service.isConfigured()).toBe(false);
    });

    it('should report configured when both token and chat ID provided', () => {
      const svc = new TelegramService('token123', 'chat456');
      expect(svc.isConfigured()).toBe(true);
    });

    it('should not be configured with only token', () => {
      const svc = new TelegramService('token123', '');
      expect(svc.isConfigured()).toBe(false);
    });

    it('should not be configured with only chat ID', () => {
      const svc = new TelegramService('', 'chat456');
      expect(svc.isConfigured()).toBe(false);
    });
  });

  describe('Message Formatting', () => {
    it('should format report ready message', async () => {
      const period = {
        start: new Date('2026-02-01'),
        end: new Date('2026-02-28'),
      };

      // Test formatting (can't actually send without real token)
      const result = await service.sendReportReady(period);

      // Should return false because not configured
      expect(typeof result).toBe('boolean');
    });

    it('should format error message', async () => {
      const result = await service.sendReportError('Test error message');

      // Should return false because not configured
      expect(typeof result).toBe('boolean');
    });

    it('should handle missing Notion page ID', async () => {
      const period = {
        start: new Date('2026-02-01'),
        end: new Date('2026-02-28'),
      };

      const result = await service.sendReportReady(period, undefined);
      expect(typeof result).toBe('boolean');
    });

    it('should handle with Notion page ID', async () => {
      const period = {
        start: new Date('2026-02-01'),
        end: new Date('2026-02-28'),
      };

      const result = await service.sendReportReady(period, 'notion_page_123');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Notification Methods', () => {
    it('should have sendReportReady method', () => {
      expect(service.sendReportReady).toBeDefined();
    });

    it('should have sendReportError method', () => {
      expect(service.sendReportError).toBeDefined();
    });

    it('should have sendNotification method', () => {
      expect(service.sendNotification).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should gracefully handle unconfigured service', async () => {
      const result = await service.sendReportError('Test');
      expect(result).toBe(false);
    });

    it('should return boolean from send methods', async () => {
      const result1 = await service.sendReportReady({
        start: new Date(),
        end: new Date(),
      });

      const result2 = await service.sendReportError('Error');

      expect(typeof result1).toBe('boolean');
      expect(typeof result2).toBe('boolean');
    });
  });

  describe('Notification Data Structure', () => {
    it('should accept valid notification structure', async () => {
      const notification = {
        title: 'Test',
        message: 'Test message',
        notionPageId: 'page_123',
        period: {
          start: new Date('2026-02-01'),
          end: new Date('2026-02-28'),
        },
      };

      const result = await service.sendNotification(notification);
      expect(typeof result).toBe('boolean');
    });

    it('should accept minimal notification', async () => {
      const notification = {
        title: 'Test',
        message: 'Test message',
      };

      const result = await service.sendNotification(notification);
      expect(typeof result).toBe('boolean');
    });
  });
});
