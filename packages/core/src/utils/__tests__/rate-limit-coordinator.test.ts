import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimitCoordinator } from '../rate-limit-coordinator';

describe('RateLimitCoordinator', () => {
  let coordinator: RateLimitCoordinator;

  beforeEach(() => {
    coordinator = new RateLimitCoordinator();
  });

  describe('isAllowed', () => {
    it('should allow requests within limit', () => {
      expect(coordinator.isAllowed('notion')).toBe(true);
    });

    it('should block after reaching limit', () => {
      // Notion limit is 3 per second
      coordinator.recordRequest('notion');
      coordinator.recordRequest('notion');
      coordinator.recordRequest('notion');
      expect(coordinator.isAllowed('notion')).toBe(false);
    });

    it('should allow unknown services', () => {
      expect(coordinator.isAllowed('unknown-service')).toBe(true);
    });
  });

  describe('recordRequest', () => {
    it('should increment request counter', () => {
      const status1 = coordinator.getStatus();
      const usage1 = status1.notion.usage;

      coordinator.recordRequest('notion');

      const status2 = coordinator.getStatus();
      const usage2 = status2.notion.usage;

      expect(usage2).toBe(usage1 + 1);
    });
  });

  describe('getWaitTime', () => {
    it('should return 0 when not rate limited', () => {
      const waitTime = coordinator.getWaitTime('notion');
      expect(waitTime).toBe(0);
    });

    it('should return wait time when rate limited', () => {
      // Fill up the limit
      for (let i = 0; i < 3; i++) {
        coordinator.recordRequest('notion');
      }

      const waitTime = coordinator.getWaitTime('notion');
      expect(waitTime).toBeGreaterThan(0);
    });
  });

  describe('getStatus', () => {
    it('should return status for all services', () => {
      const status = coordinator.getStatus();
      expect(status).toHaveProperty('notion');
      expect(status).toHaveProperty('clickup');
      expect(status).toHaveProperty('claude');
      expect(status).toHaveProperty('whisper');
    });

    it('should calculate usage percentage', () => {
      coordinator.recordRequest('notion');
      const status = coordinator.getStatus();
      expect(status.notion.percentage).toBeGreaterThan(0);
      expect(status.notion.percentage).toBeLessThanOrEqual(100);
    });
  });

  describe('getCriticalServices', () => {
    it('should return empty when no services critical', () => {
      const critical = coordinator.getCriticalServices();
      expect(critical).toHaveLength(0);
    });

    it('should return critical services (>80%)', () => {
      // Fill up Notion to critical level
      for (let i = 0; i < 3; i++) {
        coordinator.recordRequest('notion');
      }
      const critical = coordinator.getCriticalServices();
      expect(critical).toContain('notion');
    });
  });

  describe('resetService', () => {
    it('should reset individual service', () => {
      coordinator.recordRequest('notion');
      coordinator.resetService('notion');
      const status = coordinator.getStatus();
      expect(status.notion.usage).toBe(0);
    });
  });

  describe('resetAll', () => {
    it('should reset all services', () => {
      coordinator.recordRequest('notion');
      coordinator.recordRequest('clickup');
      coordinator.resetAll();
      const status = coordinator.getStatus();
      expect(status.notion.usage).toBe(0);
      expect(status.clickup.usage).toBe(0);
    });
  });

  describe('queueWithBackoff', () => {
    it('should execute task immediately if allowed', async () => {
      const task = vi.fn().mockResolvedValue('success');
      const result = await coordinator.queueWithBackoff('notion', task);
      expect(result).toBe('success');
      expect(task).toHaveBeenCalled();
    });

    it('should retry on failure', async () => {
      let callCount = 0;
      const task = vi.fn(async () => {
        callCount++;
        if (callCount === 1) throw new Error('First attempt failed');
        return 'success';
      });

      const result = await coordinator.queueWithBackoff('notion', task, 3);
      expect(result).toBe('success');
      expect(task).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      const task = vi.fn().mockRejectedValue(new Error('Always fails'));
      await expect(
        coordinator.queueWithBackoff('notion', task, 2)
      ).rejects.toThrow();
    });
  });

  describe('custom limits', () => {
    it('should accept custom rate limits', () => {
      const custom = new RateLimitCoordinator({
        custom: {
          serviceName: 'custom',
          maxRequests: 100,
          windowMs: 10000,
        },
      });

      const status = custom.getStatus();
      expect(status.custom).toBeDefined();
      expect(status.custom.limit).toBe(100);
    });
  });
});
