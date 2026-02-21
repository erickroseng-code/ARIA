import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimitCoordinator, getRateLimitCoordinator, type RateLimitConfig } from '../rate-limit-coordinator';

describe('RateLimitCoordinator', () => {
  let coordinator: RateLimitCoordinator;

  beforeEach(() => {
    vi.clearAllMocks();
    coordinator = new RateLimitCoordinator();
  });

  describe('Initialization', () => {
    it('should initialize with default configs', () => {
      expect(coordinator.canProceed('clickup')).toBeTruthy();
      expect(coordinator.canProceed('notion')).toBeTruthy();
      expect(coordinator.canProceed('whisper')).toBeTruthy();
      expect(coordinator.canProceed('claude')).toBeTruthy();
    });

    it('should allow custom configs', () => {
      const customConfigs = {
        clickup: {
          service: 'clickup',
          requestsPerMinute: 10,
          requestsPerSecond: 1,
          burstAllowance: 2,
          retryAfterMs: 30000,
        },
      };

      const customCoordinator = new RateLimitCoordinator(customConfigs);
      expect(customCoordinator.canProceed('clickup')).toBeTruthy();
    });
  });

  describe('canProceed', () => {
    it('should allow request when under limit', () => {
      expect(coordinator.canProceed('clickup')).toBeTruthy();
    });

    it('should deny request when at limit', () => {
      const config = coordinator['configs'].get('clickup');
      if (config) {
        // Fill the queue to limit
        for (let i = 0; i < config.requestsPerMinute; i++) {
          coordinator.recordRequest('clickup');
        }
        expect(coordinator.canProceed('clickup')).toBeFalsy();
      }
    });

    it('should allow request again after limit resets', (done) => {
      const config = coordinator['configs'].get('clickup');
      if (config) {
        // Fill the queue
        for (let i = 0; i < config.requestsPerMinute; i++) {
          coordinator.recordRequest('clickup');
        }
        expect(coordinator.canProceed('clickup')).toBeFalsy();

        // After old requests expire, should allow again
        setTimeout(() => {
          expect(coordinator.canProceed('clickup')).toBeTruthy();
          done();
        }, 1100); // Wait for 1 minute window to reset
      }
    });
  });

  describe('getStatus', () => {
    it('should return accurate status', () => {
      coordinator.recordRequest('clickup');
      coordinator.recordRequest('clickup');

      const status = coordinator.getStatus('clickup');

      expect(status.service).toBe('clickup');
      expect(status.currentUsage).toBe(2);
      expect(status.limit).toBeGreaterThan(2);
      expect(status.isLimited).toBeFalsy();
      expect(status.waitTimeMs).toBe(0);
    });

    it('should show wait time when limited', () => {
      const config = coordinator['configs'].get('clickup');
      if (config) {
        // Fill the queue to limit
        for (let i = 0; i < config.requestsPerMinute; i++) {
          coordinator.recordRequest('clickup');
        }

        const status = coordinator.getStatus('clickup');
        expect(status.isLimited).toBeTruthy();
        expect(status.waitTimeMs).toBeGreaterThan(0);
      }
    });

    it('should return default values for unknown service', () => {
      const status = coordinator.getStatus('unknown-service');

      expect(status.service).toBe('unknown-service');
      expect(status.currentUsage).toBe(0);
      expect(status.limit).toBe(0);
      expect(status.isLimited).toBeFalsy();
    });
  });

  describe('recordRequest/recordSuccess/recordFailure', () => {
    it('should increment total requests', () => {
      coordinator.recordRequest('clickup');
      let metrics = coordinator.getMetrics('clickup');
      expect(metrics?.totalRequests).toBe(1);

      coordinator.recordRequest('clickup');
      metrics = coordinator.getMetrics('clickup');
      expect(metrics?.totalRequests).toBe(2);
    });

    it('should track successful requests', () => {
      coordinator.recordSuccess('clickup', 100);
      coordinator.recordSuccess('clickup', 150);

      const metrics = coordinator.getMetrics('clickup');
      expect(metrics?.successfulRequests).toBe(2);
      expect(metrics?.totalRequests).toBe(2);
    });

    it('should track failed requests', () => {
      coordinator.recordFailure('clickup', 200);
      coordinator.recordFailure('clickup', 300);

      const metrics = coordinator.getMetrics('clickup');
      expect(metrics?.failedRequests).toBe(2);
      expect(metrics?.totalRequests).toBe(2);
    });

    it('should calculate average response time', () => {
      coordinator.recordSuccess('clickup', 100);
      coordinator.recordSuccess('clickup', 200);
      coordinator.recordSuccess('clickup', 300);

      const metrics = coordinator.getMetrics('clickup');
      expect(metrics?.averageResponseTimeMs).toBe(200); // (100+200+300)/3
    });

    it('should update last request time', () => {
      const before = Date.now();
      coordinator.recordRequest('clickup');
      const after = Date.now();

      const metrics = coordinator.getMetrics('clickup');
      expect(metrics!.lastRequestAt).toBeGreaterThanOrEqual(before);
      expect(metrics!.lastRequestAt).toBeLessThanOrEqual(after + 10);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics for known service', () => {
      coordinator.recordSuccess('clickup', 150);
      const metrics = coordinator.getMetrics('clickup');

      expect(metrics).toBeDefined();
      expect(metrics?.service).toBe('clickup');
      expect(metrics?.successfulRequests).toBe(1);
    });

    it('should return null for unknown service', () => {
      const metrics = coordinator.getMetrics('unknown');
      expect(metrics).toBeNull();
    });

    it('should track metrics for multiple services', () => {
      coordinator.recordSuccess('clickup', 100);
      coordinator.recordSuccess('notion', 200);
      coordinator.recordFailure('whisper', 150);

      const clickupMetrics = coordinator.getMetrics('clickup');
      const notionMetrics = coordinator.getMetrics('notion');
      const whisperMetrics = coordinator.getMetrics('whisper');

      expect(clickupMetrics?.successfulRequests).toBe(1);
      expect(notionMetrics?.successfulRequests).toBe(1);
      expect(whisperMetrics?.failedRequests).toBe(1);
    });
  });

  describe('getAllMetrics', () => {
    it('should return metrics for all services', () => {
      coordinator.recordSuccess('clickup', 100);
      coordinator.recordSuccess('notion', 200);
      coordinator.recordSuccess('whisper', 50);
      coordinator.recordSuccess('claude', 150);

      const allMetrics = coordinator.getAllMetrics();

      expect(allMetrics.length).toBeGreaterThanOrEqual(4);
      expect(allMetrics.map((m) => m.service)).toContain('clickup');
      expect(allMetrics.map((m) => m.service)).toContain('notion');
    });
  });

  describe('areAllServicesAvailable', () => {
    it('should return true when all services are available', () => {
      expect(coordinator.areAllServicesAvailable()).toBeTruthy();
    });

    it('should return false when any service is limited', () => {
      const config = coordinator['configs'].get('clickup');
      if (config) {
        for (let i = 0; i < config.requestsPerMinute; i++) {
          coordinator.recordRequest('clickup');
        }
        expect(coordinator.areAllServicesAvailable()).toBeFalsy();
      }
    });
  });

  describe('getLimitedServices', () => {
    it('should return empty array when no services are limited', () => {
      const limited = coordinator.getLimitedServices();
      expect(limited).toHaveLength(0);
    });

    it('should return limited services', () => {
      const config = coordinator['configs'].get('clickup');
      if (config) {
        for (let i = 0; i < config.requestsPerMinute; i++) {
          coordinator.recordRequest('clickup');
        }
      }

      const limited = coordinator.getLimitedServices();
      expect(limited).toContain('clickup');
    });
  });

  describe('calculateBackoff', () => {
    it('should return 0 for unknown service', () => {
      const backoff = coordinator.calculateBackoff('unknown', 0);
      expect(backoff).toBe(0);
    });

    it('should calculate exponential backoff', () => {
      const attempt0 = coordinator.calculateBackoff('clickup', 0);
      const attempt1 = coordinator.calculateBackoff('clickup', 1);
      const attempt2 = coordinator.calculateBackoff('clickup', 2);

      expect(attempt0).toBeGreaterThan(0);
      expect(attempt1).toBeGreaterThan(attempt0);
      expect(attempt2).toBeGreaterThan(attempt1);
    });

    it('should cap backoff at retryAfterMs', () => {
      const backoff = coordinator.calculateBackoff('clickup', 20); // Very large attempt number
      const config = coordinator['configs'].get('clickup');

      if (config) {
        expect(backoff).toBeLessThanOrEqual(config.retryAfterMs);
      }
    });
  });

  describe('waitUntilAvailable', () => {
    it('should resolve immediately when service is available', async () => {
      const result = await coordinator.waitUntilAvailable('clickup', 1000);
      expect(result).toBeTruthy();
    });

    it('should timeout when service stays limited', async () => {
      const config = coordinator['configs'].get('clickup');
      if (config) {
        // Fill queue before limit time can expire
        for (let i = 0; i < config.requestsPerMinute; i++) {
          coordinator.recordRequest('clickup');
        }

        const result = await coordinator.waitUntilAvailable('clickup', 100);
        expect(result).toBeFalsy();
      }
    });
  });

  describe('reset', () => {
    it('should reset all metrics and queues', () => {
      coordinator.recordSuccess('clickup', 100);
      coordinator.recordSuccess('notion', 200);

      const beforeClickup = coordinator.getMetrics('clickup');
      const beforeNotion = coordinator.getMetrics('notion');
      expect(beforeClickup?.totalRequests).toBe(1);
      expect(beforeNotion?.totalRequests).toBe(1);

      coordinator.reset();

      const afterClickup = coordinator.getMetrics('clickup');
      const afterNotion = coordinator.getMetrics('notion');
      expect(afterClickup?.totalRequests).toBe(0);
      expect(afterNotion?.totalRequests).toBe(0);
    });
  });

  describe('resetService', () => {
    it('should reset metrics for specific service', () => {
      coordinator.recordSuccess('clickup', 100);
      coordinator.recordSuccess('notion', 200);

      coordinator.resetService('clickup');

      const clickupMetrics = coordinator.getMetrics('clickup');
      const notionMetrics = coordinator.getMetrics('notion');

      expect(clickupMetrics?.totalRequests).toBe(0);
      expect(notionMetrics?.totalRequests).toBe(1);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const coordinator1 = getRateLimitCoordinator();
      const coordinator2 = getRateLimitCoordinator();

      expect(coordinator1).toBe(coordinator2);
    });
  });

  describe('Integration - Multiple Service Coordination', () => {
    it('should track multiple services independently', () => {
      // Record requests on different services
      coordinator.recordSuccess('clickup', 100);
      coordinator.recordSuccess('clickup', 150);
      coordinator.recordSuccess('notion', 200);
      coordinator.recordFailure('whisper', 50);

      const clickupStatus = coordinator.getStatus('clickup');
      const notionStatus = coordinator.getStatus('notion');
      const whisperStatus = coordinator.getStatus('whisper');

      expect(clickupStatus.currentUsage).toBe(2);
      expect(notionStatus.currentUsage).toBe(1);
      expect(whisperStatus.currentUsage).toBe(1);

      // All should still be available
      expect(coordinator.areAllServicesAvailable()).toBeTruthy();
    });

    it('should handle burst allowance', () => {
      // Should be able to handle burst requests without immediate limiting
      for (let i = 0; i < 5; i++) {
        coordinator.recordRequest('claude');
      }

      const status = coordinator.getStatus('claude');
      expect(status.currentUsage).toBe(5);
      expect(status.isLimited).toBeFalsy();
    });

    it('should coordinate rate limits across multiple services', () => {
      const config = coordinator['configs'].get('clickup');
      if (config) {
        // Limit ClickUp
        for (let i = 0; i < config.requestsPerMinute; i++) {
          coordinator.recordRequest('clickup');
        }

        // Notion should still be available
        expect(coordinator.canProceed('clickup')).toBeFalsy();
        expect(coordinator.canProceed('notion')).toBeTruthy();

        // Record to Notion until it's also limited
        const notionConfig = coordinator['configs'].get('notion');
        if (notionConfig) {
          for (let i = 0; i < notionConfig.requestsPerMinute; i++) {
            coordinator.recordRequest('notion');
          }

          expect(coordinator.canProceed('notion')).toBeFalsy();
          expect(coordinator.areAllServicesAvailable()).toBeFalsy();
          expect(coordinator.getLimitedServices()).toHaveLength(2);
        }
      }
    });
  });
});
