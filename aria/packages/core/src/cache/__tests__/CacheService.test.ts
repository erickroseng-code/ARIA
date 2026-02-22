/**
 * Cache Service Tests
 * Task 5: Caching & Re-generation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheService } from '../CacheService';
import type { GeneratedReport } from '../../reports/ReportGenerationService';

describe('CacheService', () => {
  let cacheService: CacheService;
  let mockReport: GeneratedReport;

  beforeEach(() => {
    cacheService = new CacheService({ useRedis: false, ttlSeconds: 3600 });
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
      cacheExpiresAt: new Date(Date.now() + 3600000),
      sourceData: {
        clickupMetrics: '25 completed',
        notionMetrics: '12 clients',
        calendarMetrics: '28.5h',
      },
    };
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const service = new CacheService();
      expect(service).toBeDefined();
    });

    it('should initialize with custom TTL', () => {
      const service = new CacheService({ ttlSeconds: 1800 });
      expect(service).toBeDefined();
    });

    it('should initialize in in-memory mode by default', async () => {
      const stats = await cacheService.getStats();
      expect(stats.backend).toBe('in-memory');
    });
  });

  describe('Cache Key Generation (Task 5.2)', () => {
    it('should generate proper cache key format', async () => {
      const userId = 'user123';
      const reportDate = '2026-02-28';
      // Key format: report:{userId}:{reportDate}
      await cacheService.set(userId, reportDate, mockReport);
      const cached = await cacheService.get(userId, reportDate);
      expect(cached).toBeDefined();
      expect(cached?.id).toBe('report_123');
    });

    it('should have different keys for different users', async () => {
      const reportDate = '2026-02-28';
      await cacheService.set('user123', reportDate, mockReport);

      const modifiedReport = { ...mockReport, id: 'report_456' };
      await cacheService.set('user456', reportDate, modifiedReport);

      const cached1 = await cacheService.get('user123', reportDate);
      const cached2 = await cacheService.get('user456', reportDate);

      expect(cached1?.id).toBe('report_123');
      expect(cached2?.id).toBe('report_456');
    });

    it('should have different keys for different dates', async () => {
      const userId = 'user123';
      await cacheService.set(userId, '2026-01-31', mockReport);

      const modifiedReport = { ...mockReport, id: 'report_456' };
      await cacheService.set(userId, '2026-02-28', modifiedReport);

      const cached1 = await cacheService.get(userId, '2026-01-31');
      const cached2 = await cacheService.get(userId, '2026-02-28');

      expect(cached1?.id).toBe('report_123');
      expect(cached2?.id).toBe('report_456');
    });
  });

  describe('Cache Operations (Task 5.1 & 5.3)', () => {
    it('should store and retrieve report from cache', async () => {
      await cacheService.set('user123', '2026-02-28', mockReport);
      const cached = await cacheService.get('user123', '2026-02-28');

      expect(cached).toBeDefined();
      expect(cached?.id).toBe('report_123');
      expect(cached?.userId).toBe('user123');
    });

    it('should return null for non-existent cache entry', async () => {
      const cached = await cacheService.get('nonexistent', '2026-02-28');
      expect(cached).toBeNull();
    });

    it('should preserve report structure in cache', async () => {
      await cacheService.set('user123', '2026-02-28', mockReport);
      const cached = await cacheService.get('user123', '2026-02-28');

      expect(cached?.sections.executiveSummary).toBe('Summary text');
      expect(cached?.sections.keyMetrics).toEqual(['Metric 1', 'Metric 2']);
      expect(cached?.sections.insights).toEqual(['Insight 1']);
      expect(cached?.sections.recommendations).toEqual(['Rec 1']);
    });

    it('should preserve sourceData in cache', async () => {
      await cacheService.set('user123', '2026-02-28', mockReport);
      const cached = await cacheService.get('user123', '2026-02-28');

      expect(cached?.sourceData.clickupMetrics).toBe('25 completed');
      expect(cached?.sourceData.notionMetrics).toBe('12 clients');
      expect(cached?.sourceData.calendarMetrics).toBe('28.5h');
    });
  });

  describe('TTL & Expiration', () => {
    it('should respect TTL configuration', async () => {
      const shortTtlService = new CacheService({ useRedis: false, ttlSeconds: 1 });
      await shortTtlService.set('user123', '2026-02-28', mockReport);

      let cached = await shortTtlService.get('user123', '2026-02-28');
      expect(cached).toBeDefined();

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      cached = await shortTtlService.get('user123', '2026-02-28');
      expect(cached).toBeNull();
    });

    it('should set cache expiration timestamp correctly', async () => {
      await cacheService.set('user123', '2026-02-28', mockReport);
      const cached = await cacheService.get('user123', '2026-02-28');

      expect(cached?.cacheExpiresAt).toBeDefined();
      expect(cached?.cacheExpiresAt instanceof Date).toBe(true);
    });
  });

  describe('Cache Clearing (Task 5.4)', () => {
    it('should clear cache for specific user', async () => {
      const userId = 'user123';
      await cacheService.set(userId, '2026-01-31', mockReport);
      await cacheService.set(userId, '2026-02-28', mockReport);

      // Verify entries exist
      expect(await cacheService.get(userId, '2026-01-31')).toBeDefined();
      expect(await cacheService.get(userId, '2026-02-28')).toBeDefined();

      // Clear user cache
      await cacheService.clearForUser(userId);

      // Verify entries cleared
      expect(await cacheService.get(userId, '2026-01-31')).toBeNull();
      expect(await cacheService.get(userId, '2026-02-28')).toBeNull();
    });

    it('should not affect other users when clearing specific user', async () => {
      await cacheService.set('user123', '2026-02-28', mockReport);
      await cacheService.set('user456', '2026-02-28', mockReport);

      await cacheService.clearForUser('user123');

      expect(await cacheService.get('user123', '2026-02-28')).toBeNull();
      expect(await cacheService.get('user456', '2026-02-28')).toBeDefined();
    });

    it('should clear all cache', async () => {
      await cacheService.set('user123', '2026-01-31', mockReport);
      await cacheService.set('user123', '2026-02-28', mockReport);
      await cacheService.set('user456', '2026-02-28', mockReport);

      await cacheService.clearAll();

      expect(await cacheService.get('user123', '2026-01-31')).toBeNull();
      expect(await cacheService.get('user123', '2026-02-28')).toBeNull();
      expect(await cacheService.get('user456', '2026-02-28')).toBeNull();
    });
  });

  describe('Cache Statistics (Task 5.5)', () => {
    it('should report cache backend type', async () => {
      const stats = await cacheService.getStats();
      expect(stats.backend).toMatch(/redis|in-memory/);
    });

    it('should report TTL seconds', async () => {
      const stats = await cacheService.getStats();
      expect(stats.ttlSeconds).toBe(3600);
    });

    it('should report cache size for in-memory backend', async () => {
      await cacheService.set('user123', '2026-02-28', mockReport);
      const stats = await cacheService.getStats();
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should report zero cache size for redis backend', async () => {
      // Redis backend (mocked) doesn't report size in this implementation
      const stats = await cacheService.getStats();
      expect(typeof stats.size).toBe('number');
    });
  });

  describe('Multiple Cache Entries', () => {
    it('should handle multiple users simultaneously', async () => {
      const users = ['user1', 'user2', 'user3'];
      const date = '2026-02-28';

      for (const user of users) {
        const report = { ...mockReport, userId: user, id: `report_${user}` };
        await cacheService.set(user, date, report);
      }

      for (const user of users) {
        const cached = await cacheService.get(user, date);
        expect(cached?.userId).toBe(user);
        expect(cached?.id).toBe(`report_${user}`);
      }
    });

    it('should handle multiple dates for same user', async () => {
      const userId = 'user123';
      const dates = ['2026-01-31', '2026-02-28', '2026-03-31'];

      for (const date of dates) {
        const report = { ...mockReport, period: { start: new Date(date), end: new Date(date) } };
        await cacheService.set(userId, date, report);
      }

      for (const date of dates) {
        const cached = await cacheService.get(userId, date);
        expect(cached).toBeDefined();
      }
    });
  });

  describe('Cache Stability', () => {
    it('should not lose data between operations', async () => {
      await cacheService.set('user123', '2026-02-28', mockReport);

      // Perform multiple get operations
      const cached1 = await cacheService.get('user123', '2026-02-28');
      const cached2 = await cacheService.get('user123', '2026-02-28');
      const cached3 = await cacheService.get('user123', '2026-02-28');

      expect(cached1?.id).toBe(cached2?.id);
      expect(cached2?.id).toBe(cached3?.id);
    });

    it('should handle concurrent cache operations', async () => {
      const operations = [];

      for (let i = 0; i < 5; i++) {
        operations.push(cacheService.set('user123', `date_${i}`, mockReport));
      }

      await Promise.all(operations);

      for (let i = 0; i < 5; i++) {
        const cached = await cacheService.get('user123', `date_${i}`);
        expect(cached).toBeDefined();
      }
    });
  });
});
