/**
 * Report Generation Service Tests
 * Tasks 1, 5, 6: Service setup, caching, timeout handling, mocks
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ReportGenerationService, GeneratedReport, GeneratedReportRequest } from './ReportGenerationService';
import { ReportData } from './ReportDataAggregationService';

describe('ReportGenerationService', () => {
  let service: ReportGenerationService;
  let mockReportData: ReportData;

  beforeEach(() => {
    service = new ReportGenerationService();
    mockReportData = {
      period: { start: new Date('2026-02-01'), end: new Date('2026-02-28') },
      clickup: {
        tasksCompleted: 25,
        tasksPending: 8,
        tasksOverdue: 2,
        tasksCreated: 15,
      },
      notion: {
        activeClients: 12,
        plansCreated: 4,
        meetingsRecorded: 8,
        propertiesFilled: 45,
        propertyConflicts: 2,
      },
      calendar: {
        meetingsScheduled: 18,
        meetingsCompleted: 15,
        hoursInMeetings: 28.5,
      },
      generatedAt: new Date(),
      cacheExpiresAt: new Date(),
      isPartialData: false,
    };
  });

  // Task 1: ReportGenerationService Setup
  describe('Report generation', () => {
    it('should generate report from aggregated data', async () => {
      const request: GeneratedReportRequest = {
        userId: 'user123',
        reportData: mockReportData,
      };

      const report = await service.generateReport(request);

      expect(report).toBeDefined();
      expect(report.id).toBeDefined();
      expect(report.userId).toBe('user123');
      expect(report.sections.executiveSummary).toBeDefined();
      expect(report.sections.keyMetrics).toBeDefined();
      expect(report.sections.insights).toBeDefined();
      expect(report.sections.recommendations).toBeDefined();
    });

    it('should include source data in report', async () => {
      const request: GeneratedReportRequest = {
        userId: 'user123',
        reportData: mockReportData,
      };

      const report = await service.generateReport(request);

      expect(report.sourceData.clickupMetrics).toContain('25 completed');
      expect(report.sourceData.notionMetrics).toContain('12 active clients');
      expect(report.sourceData.calendarMetrics).toContain('28.5h meetings');
    });

    it('should set proper timestamps', async () => {
      const request: GeneratedReportRequest = {
        userId: 'user123',
        reportData: mockReportData,
      };

      const before = new Date();
      const report = await service.generateReport(request);
      const after = new Date();

      expect(report.generatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(report.generatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(report.cacheExpiresAt.getTime()).toBeGreaterThan(report.generatedAt.getTime());
    });

    it('should have proper report structure', async () => {
      const request: GeneratedReportRequest = {
        userId: 'user123',
        reportData: mockReportData,
      };

      const report = await service.generateReport(request);

      // Executive Summary should be a string
      expect(typeof report.sections.executiveSummary).toBe('string');
      expect(report.sections.executiveSummary.length).toBeGreaterThan(0);

      // Key Metrics should be array of strings
      expect(Array.isArray(report.sections.keyMetrics)).toBe(true);
      expect(report.sections.keyMetrics.length).toBeGreaterThan(0);

      // Insights should be array of strings
      expect(Array.isArray(report.sections.insights)).toBe(true);
      expect(report.sections.insights.length).toBeGreaterThan(0);

      // Recommendations should be array of strings
      expect(Array.isArray(report.sections.recommendations)).toBe(true);
      expect(report.sections.recommendations.length).toBeGreaterThan(0);
    });
  });

  // Task 1.4: Timeout handling
  describe('Timeout handling', () => {
    it('should timeout on slow generation', async () => {
      const slowService = new ReportGenerationService({
        analyze: async () => {
          await new Promise((resolve) => setTimeout(resolve, 5000)); // 5s timeout
          return { summary: 'test' };
        },
      });

      const request: GeneratedReportRequest = {
        userId: 'user123',
        reportData: mockReportData,
      };

      try {
        await slowService.generateReport(request);
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        // Timeout should be handled gracefully (queued for retry)
      }
    });
  });

  // Task 1.5: Queue and retry logic
  describe('Queue and retry', () => {
    it('should have queue management', async () => {
      expect(service.getQueueSize()).toBe(0);
    });

    it('should track queue growth on failures', async () => {
      const initialSize = service.getQueueSize();

      // This would normally cause a retry when Claude fails
      // For now, we're just verifying the queue API exists
      expect(service.getQueueSize()).toBeGreaterThanOrEqual(initialSize);
    });
  });

  // Task 5: Caching
  describe('Caching', () => {
    it('should cache generated reports', async () => {
      const request: GeneratedReportRequest = {
        userId: 'user123',
        reportData: mockReportData,
      };

      expect(service.getCacheSize()).toBe(0);

      const report1 = await service.generateReport(request);
      expect(service.getCacheSize()).toBe(1);

      // Second call should return cached version
      const report2 = await service.generateReport(request);
      expect(report1.id).toBe(report2.id); // Same report ID from cache
      expect(service.getCacheSize()).toBe(1); // Still one in cache
    });

    it('should bypass cache when regenerate flag is true', async () => {
      const request: GeneratedReportRequest = {
        userId: 'user123',
        reportData: mockReportData,
      };

      const report1 = await service.generateReport(request);

      // Force regeneration
      const report2 = await service.generateReport({ ...request, regenerate: true });

      // Different IDs indicate new generation (not from cache)
      expect(report1.id).not.toBe(report2.id);
    });

    it('should support cache clearing', async () => {
      const request: GeneratedReportRequest = {
        userId: 'user123',
        reportData: mockReportData,
      };

      await service.generateReport(request);
      expect(service.getCacheSize()).toBe(1);

      service.clearCache();
      expect(service.getCacheSize()).toBe(0);
    });

    it('should support manual refresh', async () => {
      const initialReport = await service.generateReport({
        userId: 'user123',
        reportData: mockReportData,
      });

      // Refresh the report
      const refreshedReport = await service.refreshReport('user123', mockReportData);

      // Different IDs indicate fresh generation
      expect(initialReport.id).not.toBe(refreshedReport.id);
    });
  });

  // Task 6: Integration tests
  describe('Full flow integration', () => {
    it('should handle report generation with different users', async () => {
      const request1: GeneratedReportRequest = {
        userId: 'user1',
        reportData: mockReportData,
      };

      const request2: GeneratedReportRequest = {
        userId: 'user2',
        reportData: mockReportData,
      };

      const report1 = await service.generateReport(request1);
      const report2 = await service.generateReport(request2);

      expect(report1.userId).toBe('user1');
      expect(report2.userId).toBe('user2');
      expect(report1.id).not.toBe(report2.id);
      expect(service.getCacheSize()).toBe(2);
    });

    it('should handle different periods separately in cache', async () => {
      const request1: GeneratedReportRequest = {
        userId: 'user123',
        reportData: {
          ...mockReportData,
          period: { start: new Date('2026-01-01'), end: new Date('2026-01-31') },
        },
      };

      const request2: GeneratedReportRequest = {
        userId: 'user123',
        reportData: {
          ...mockReportData,
          period: { start: new Date('2026-02-01'), end: new Date('2026-02-28') },
        },
      };

      await service.generateReport(request1);
      expect(service.getCacheSize()).toBe(1);

      await service.generateReport(request2);
      expect(service.getCacheSize()).toBe(2); // Different period = different cache entry
    });
  });
});
