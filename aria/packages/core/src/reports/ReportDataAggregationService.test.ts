/**
 * ReportDataAggregationService Tests
 * Tasks 6.1-6.5: Unit and integration tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ReportDataAggregationService, ReportData, DateRange } from './ReportDataAggregationService';
import { ClickUpDataCollector } from './ClickUpDataCollector';
import { NotionDataCollector } from './NotionDataCollector';
import { GoogleCalendarDataCollector } from './GoogleCalendarDataCollector';

describe('ReportDataAggregationService', () => {
  let service: ReportDataAggregationService;
  const dateRange: DateRange = {
    start: new Date('2026-02-01'),
    end: new Date('2026-02-28'),
  };

  beforeEach(() => {
    service = new ReportDataAggregationService();
  });

  // Task 6.1-6.5: Main integration tests
  describe('Data aggregation', () => {
    it('should aggregate data with default collectors', async () => {
      const result = await service.aggregateData(dateRange);

      expect(result.clickup).toBeDefined();
      expect(result.notion).toBeDefined();
      expect(result.calendar).toBeDefined();
      expect(result.generatedAt).toBeInstanceOf(Date);
      expect(result.cacheExpiresAt).toBeInstanceOf(Date);
    });

    it('should use custom collectors', async () => {
      const mockClickupCollector = {
        collectData: async () => ({
          tasksCompleted: 10,
          tasksPending: 5,
          tasksOverdue: 2,
          tasksCreated: 3,
        }),
      } as any;

      const mockNotionCollector = {
        collectData: async () => ({
          activeClients: 8,
          plansCreated: 4,
          meetingsRecorded: 6,
          propertiesFilled: 15,
          propertyConflicts: 1,
        }),
      } as any;

      const mockCalendarCollector = {
        collectData: async () => ({
          meetingsScheduled: 12,
          meetingsCompleted: 10,
          hoursInMeetings: 18.5,
        }),
      } as any;

      const customService = new ReportDataAggregationService(
        mockClickupCollector,
        mockNotionCollector,
        mockCalendarCollector
      );

      const result = await customService.aggregateData(dateRange);

      expect(result.clickup.tasksCompleted).toBe(10);
      expect(result.notion.activeClients).toBe(8);
      expect(result.calendar.meetingsScheduled).toBe(12);
      expect(result.isPartialData).toBe(false);
    });

    it('should handle partial aggregation with one source failing', async () => {
      const mockClickupCollector = {
        collectData: async () => ({
          tasksCompleted: 10,
          tasksPending: 5,
          tasksOverdue: 2,
          tasksCreated: 3,
        }),
      } as any;

      const mockNotionCollector = {
        collectData: async () => {
          throw new Error('Notion API error');
        },
      } as any;

      const mockCalendarCollector = {
        collectData: async () => ({
          meetingsScheduled: 12,
          meetingsCompleted: 10,
          hoursInMeetings: 18.5,
        }),
      } as any;

      const customService = new ReportDataAggregationService(
        mockClickupCollector,
        mockNotionCollector,
        mockCalendarCollector
      );

      const result = await customService.aggregateData(dateRange);

      expect(result.clickup.tasksCompleted).toBe(10);
      expect(result.notion.activeClients).toBe(0); // Fallback
      expect(result.calendar.meetingsScheduled).toBe(12);
      expect(result.isPartialData).toBe(true);
      expect(result.errors?.length).toBe(1);
    });

    it('should handle multiple source failures', async () => {
      const errorCollector = {
        collectData: async () => {
          throw new Error('API error');
        },
      } as any;

      const customService = new ReportDataAggregationService(
        errorCollector,
        errorCollector,
        errorCollector
      );

      const result = await customService.aggregateData(dateRange);

      expect(result.isPartialData).toBe(true);
      expect(result.errors?.length).toBe(3);
    });

    it('should have proper metadata', async () => {
      const result = await service.aggregateData(dateRange);

      expect(result.period.start).toEqual(dateRange.start);
      expect(result.period.end).toEqual(dateRange.end);
      expect(result.generatedAt).toBeInstanceOf(Date);
      expect(result.cacheExpiresAt).toBeInstanceOf(Date);
      expect(result.cacheExpiresAt.getTime()).toBeGreaterThan(result.generatedAt.getTime());
    });
  });

  // Task 1.4: Caching tests
  describe('Caching', () => {
    it('should cache results', async () => {
      let callCount = 0;

      const countingCollector = {
        collectData: async () => {
          callCount++;
          return {
            tasksCompleted: callCount,
            tasksPending: 0,
            tasksOverdue: 0,
            tasksCreated: 0,
          };
        },
      } as any;

      const customService = new ReportDataAggregationService(countingCollector);

      // First call
      const result1 = await customService.aggregateData(dateRange);
      expect(result1.clickup.tasksCompleted).toBe(1);

      // Second call should be from cache
      const result2 = await customService.aggregateData(dateRange);
      expect(result2.clickup.tasksCompleted).toBe(1); // Same as first
      expect(callCount).toBe(1); // Collector called only once
    });

    it('should have correct cache size', async () => {
      const customService = new ReportDataAggregationService();

      expect(customService.getCacheSize()).toBe(0);

      await customService.aggregateData(dateRange);
      expect(customService.getCacheSize()).toBe(1);

      const otherRange: DateRange = {
        start: new Date('2026-01-01'),
        end: new Date('2026-01-31'),
      };
      await customService.aggregateData(otherRange);
      expect(customService.getCacheSize()).toBe(2);
    });

    it('should support cache clearing', async () => {
      const customService = new ReportDataAggregationService();

      await customService.aggregateData(dateRange);
      expect(customService.getCacheSize()).toBe(1);

      customService.clearCache();
      expect(customService.getCacheSize()).toBe(0);
    });
  });
});
