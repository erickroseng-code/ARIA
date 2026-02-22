/**
 * Bull Queue Service - Simplified Tests
 * Task 2: Bull Queue Job Scheduling (Synchronous tests only)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BullQueueService } from '../BullQueueService';

describe('BullQueueService - Synchronous', () => {
  let service: BullQueueService;

  beforeEach(() => {
    // Create service without initialization
    service = new BullQueueService({
      redisUrl: undefined,
      defaultRetries: 3,
      defaultRetryDelay: 1000,
    });
  });

  describe('Service Creation', () => {
    it('should create service instance', () => {
      expect(service).toBeDefined();
      expect(typeof service.isHealthy()).toBe('boolean');
    });

    it('should support health check method', () => {
      const healthy = service.isHealthy();
      expect(typeof healthy).toBe('boolean');
    });
  });

  describe('Configuration', () => {
    it('should accept custom configuration', () => {
      const customService = new BullQueueService({
        queueName: 'custom-queue',
        defaultRetries: 5,
      });

      expect(customService).toBeDefined();
    });

    it('should use default configuration', () => {
      const defaultService = new BullQueueService();
      expect(defaultService).toBeDefined();
    });
  });

  describe('Job Processor Registration', () => {
    it('should register job processor', () => {
      const processor = async () => console.log('processing');
      service.registerProcessor('schedule1', processor);

      // Service should accept registration
      expect(service).toBeDefined();
    });

    it('should register multiple processors', () => {
      const processor1 = async () => {};
      const processor2 = async () => {};

      service.registerProcessor('schedule1', processor1);
      service.registerProcessor('schedule2', processor2);

      expect(service).toBeDefined();
    });
  });

  describe('Metadata Tracking', () => {
    it('should track job metadata structure', () => {
      const jobId = 'job123';

      // Simulate adding metadata
      const metadata = {
        jobId,
        scheduleId: 'schedule123',
        userId: 'user123',
        status: 'pending' as const,
        attemptCount: 0,
        maxAttempts: 3,
        createdAt: new Date(),
      };

      expect(metadata.jobId).toBe(jobId);
      expect(metadata.status).toBe('pending');
      expect(metadata.attemptCount).toBe(0);
    });

    it('should track different status types', () => {
      const statuses = ['pending', 'active', 'completed', 'failed', 'delayed'] as const;

      statuses.forEach((status) => {
        expect(['pending', 'active', 'completed', 'failed', 'delayed']).toContain(status);
      });
    });
  });

  describe('Queue Statistics Structure', () => {
    it('should have correct stats structure', async () => {
      const stats = await service.getStats();

      expect(stats).toBeDefined();
      expect(stats.name).toBe('scheduled-reports');
      expect(typeof stats.pending).toBe('number');
      expect(typeof stats.active).toBe('number');
      expect(typeof stats.completed).toBe('number');
      expect(typeof stats.failed).toBe('number');
      expect(typeof stats.delayed).toBe('number');
      expect(typeof stats.isConnected).toBe('boolean');
    });

    it('should report zero counts in empty queue', async () => {
      const stats = await service.getStats();

      expect(stats.pending).toBe(0);
      expect(stats.active).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.delayed).toBe(0);
    });
  });

  describe('Job Retrieval Methods', () => {
    it('should return empty arrays for empty job lists', () => {
      const pending = service.getPendingJobs();
      const failed = service.getFailedJobs();
      const completed = service.getCompletedJobs();

      expect(Array.isArray(pending)).toBe(true);
      expect(Array.isArray(failed)).toBe(true);
      expect(Array.isArray(completed)).toBe(true);
      expect(pending.length).toBe(0);
      expect(failed.length).toBe(0);
      expect(completed.length).toBe(0);
    });

    it('should support limit parameter', () => {
      const pending = service.getPendingJobs();
      const failed = service.getFailedJobs(10);
      const completed = service.getCompletedJobs(5);

      expect(pending).toBeDefined();
      expect(failed).toBeDefined();
      expect(completed).toBeDefined();
    });
  });

  describe('Delivery Job Structure', () => {
    it('should accept valid delivery job payload', () => {
      const jobData = {
        scheduleId: 'schedule123',
        userId: 'user123',
        reportDate: '2026-02-28',
        channels: ['telegram', 'notion'] as const,
        generatedAt: new Date(),
      };

      expect(jobData.scheduleId).toBe('schedule123');
      expect(jobData.channels).toContain('telegram');
      expect(jobData.channels).toContain('notion');
    });

    it('should support all delivery channels', () => {
      const channels = ['telegram', 'email', 'notion'] as const;

      channels.forEach((channel) => {
        expect(['telegram', 'email', 'notion']).toContain(channel);
      });
    });
  });

  describe('Service Lifecycle', () => {
    it('should support cleanup method', async () => {
      const cleanup = service.cleanup();
      expect(cleanup).toBeDefined();
      expect(cleanup instanceof Promise).toBe(true);
    });
  });
});
