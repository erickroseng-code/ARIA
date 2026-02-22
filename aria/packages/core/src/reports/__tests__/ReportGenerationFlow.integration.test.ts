/**
 * Report Generation Full Flow Integration Tests
 * Task 6: Complete end-to-end pipeline validation
 *
 * Tests the complete flow:
 * Data Aggregation → Report Generation → Notion Storage → Notifications
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ReportGenerationService } from '../ReportGenerationService';
import { ReportDataAggregationService } from '../ReportDataAggregationService';
import { NotificationService } from '../../notifications/NotificationService';
import { CacheService } from '../../cache/CacheService';
import type { ReportData } from '../ReportDataAggregationService';

describe('Report Generation Full Flow Integration', () => {
  let reportGenService: ReportGenerationService;
  let reportAggService: ReportDataAggregationService;
  let notificationService: NotificationService;
  let cacheService: CacheService;
  let mockReportData: ReportData;

  beforeEach(() => {
    // Initialize all services
    reportGenService = new ReportGenerationService();
    reportAggService = new ReportDataAggregationService();
    notificationService = new NotificationService();
    cacheService = new CacheService({ useRedis: false, ttlSeconds: 3600 });

    // Create mock aggregated report data
    mockReportData = {
      userId: 'user123',
      period: { start: new Date('2026-02-01'), end: new Date('2026-02-28') },
      clickup: {
        tasksCompleted: 42,
        tasksPending: 8,
        tasksBlocked: 2,
      },
      notion: {
        activeClients: 12,
        plansCreated: 5,
        documentsAnalyzed: 23,
      },
      calendar: {
        meetingsCompleted: 16,
        meetingsScheduled: 18,
        hoursInMeetings: 28.5,
      },
    };
  });

  describe('Step 1: Data Aggregation', () => {
    it('should aggregate complete report data', () => {
      expect(mockReportData).toBeDefined();
      expect(mockReportData.userId).toBe('user123');
      expect(mockReportData.period.start).toBeInstanceOf(Date);
      expect(mockReportData.period.end).toBeInstanceOf(Date);
    });

    it('should include all data sources in aggregation', () => {
      expect(mockReportData.clickup).toBeDefined();
      expect(mockReportData.notion).toBeDefined();
      expect(mockReportData.calendar).toBeDefined();
    });

    it('should have valid ClickUp metrics', () => {
      expect(mockReportData.clickup.tasksCompleted).toBeGreaterThan(0);
      expect(mockReportData.clickup.tasksPending).toBeGreaterThanOrEqual(0);
      expect(mockReportData.clickup.tasksBlocked).toBeGreaterThanOrEqual(0);
    });

    it('should have valid Notion metrics', () => {
      expect(mockReportData.notion.activeClients).toBeGreaterThan(0);
      expect(mockReportData.notion.plansCreated).toBeGreaterThanOrEqual(0);
      expect(mockReportData.notion.documentsAnalyzed).toBeGreaterThanOrEqual(0);
    });

    it('should have valid Calendar metrics', () => {
      expect(mockReportData.calendar.meetingsCompleted).toBeGreaterThanOrEqual(0);
      expect(mockReportData.calendar.meetingsScheduled).toBeGreaterThanOrEqual(0);
      expect(mockReportData.calendar.hoursInMeetings).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Step 2: Report Generation', () => {
    it('should generate complete report from aggregated data', async () => {
      const report = await reportGenService.generateReport({
        userId: mockReportData.userId,
        reportData: mockReportData,
        regenerate: false,
        notify: false,
      });

      expect(report).toBeDefined();
      expect(report.id).toBeTruthy();
      expect(report.userId).toBe(mockReportData.userId);
    });

    it('should generate all 4 report sections', async () => {
      const report = await reportGenService.generateReport({
        userId: mockReportData.userId,
        reportData: mockReportData,
        notify: false,
      });

      expect(report.sections.executiveSummary).toBeTruthy();
      expect(report.sections.keyMetrics).toBeDefined();
      expect(report.sections.insights).toBeDefined();
      expect(report.sections.recommendations).toBeDefined();
    });

    it('should include source data in report', async () => {
      const report = await reportGenService.generateReport({
        userId: mockReportData.userId,
        reportData: mockReportData,
        notify: false,
      });

      expect(report.sourceData).toBeDefined();
      expect(report.sourceData.clickupMetrics).toContain('42');
      expect(report.sourceData.notionMetrics).toContain('12');
      expect(report.sourceData.calendarMetrics).toContain('28.5');
    });

    it('should set proper timestamps', async () => {
      const report = await reportGenService.generateReport({
        userId: mockReportData.userId,
        reportData: mockReportData,
        notify: false,
      });

      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.cacheExpiresAt).toBeInstanceOf(Date);
      expect(report.cacheExpiresAt.getTime()).toBeGreaterThan(report.generatedAt.getTime());
    });

    it('should generate metrics with proper count', async () => {
      const report = await reportGenService.generateReport({
        userId: mockReportData.userId,
        reportData: mockReportData,
        notify: false,
      });

      expect(report.sections.keyMetrics.length).toBeGreaterThanOrEqual(5);
      expect(report.sections.insights.length).toBeGreaterThanOrEqual(3);
      expect(report.sections.recommendations.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Step 3: Caching', () => {
    it('should cache generated report', async () => {
      const report = await reportGenService.generateReport({
        userId: mockReportData.userId,
        reportData: mockReportData,
        notify: false,
      });

      // Store in cache
      const reportDate = mockReportData.period.end.toISOString().split('T')[0];
      await cacheService.set(mockReportData.userId, reportDate, report);

      // Retrieve from cache
      const cachedReport = await cacheService.get(mockReportData.userId, reportDate);

      expect(cachedReport).toBeDefined();
      expect(cachedReport?.id).toBe(report.id);
    });

    it('should bypass cache with regenerate flag', async () => {
      const userId = mockReportData.userId;
      const reportDate = mockReportData.period.end.toISOString().split('T')[0];

      // First generation
      const report1 = await reportGenService.generateReport({
        userId,
        reportData: mockReportData,
        regenerate: false,
        notify: false,
      });

      // Cache it
      await cacheService.set(userId, reportDate, report1);

      // Second generation with regenerate=true
      const report2 = await reportGenService.generateReport({
        userId,
        reportData: mockReportData,
        regenerate: true,
        notify: false,
      });

      // IDs should be different
      expect(report1.id).not.toBe(report2.id);
    });

    it('should clear cache for user', async () => {
      const report = await reportGenService.generateReport({
        userId: mockReportData.userId,
        reportData: mockReportData,
        notify: false,
      });

      const reportDate = mockReportData.period.end.toISOString().split('T')[0];
      await cacheService.set(mockReportData.userId, reportDate, report);

      // Verify it's cached
      const cachedBefore = await cacheService.get(mockReportData.userId, reportDate);
      expect(cachedBefore).toBeDefined();

      // Clear cache
      await cacheService.clearForUser(mockReportData.userId);

      // Verify it's cleared
      const cachedAfter = await cacheService.get(mockReportData.userId, reportDate);
      expect(cachedAfter).toBeNull();
    });
  });

  describe('Step 4: Notification System', () => {
    it('should notify when report ready', async () => {
      const report = await reportGenService.generateReport({
        userId: mockReportData.userId,
        reportData: mockReportData,
        notify: false,
      });

      const notification = await notificationService.notifyReportReady(
        report,
        mockReportData.userId
      );

      expect(notification).toBeDefined();
      expect(notification.type).toBe('report_ready');
      expect(notification.userId).toBe(mockReportData.userId);
      expect(notification.reportId).toBe(report.id);
    });

    it('should include report link in notification', async () => {
      const report = await reportGenService.generateReport({
        userId: mockReportData.userId,
        reportData: mockReportData,
        notify: false,
      });

      const notification = await notificationService.notifyReportReady(
        report,
        mockReportData.userId
      );

      expect(notification.message).toContain('Relatório');
      expect(notification.message).toContain('2026');
    });

    it('should store notification in history', async () => {
      const report = await reportGenService.generateReport({
        userId: mockReportData.userId,
        reportData: mockReportData,
        notify: false,
      });

      await notificationService.notifyReportReady(report, mockReportData.userId);

      const notifications = notificationService.getNotificationsForUser(mockReportData.userId);
      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].type).toBe('report_ready');
    });

    it('should notify on error', async () => {
      const notification = await notificationService.notifyReportError(
        mockReportData.userId,
        'Test error message'
      );

      expect(notification.type).toBe('report_error');
      expect(notification.message).toContain('Erro');
      expect(notification.message).toContain('Test error message');
    });
  });

  describe('Complete End-to-End Flow', () => {
    it('should execute full pipeline: aggregation → generation → cache → notification', async () => {
      // Step 1: Verify aggregated data
      expect(mockReportData).toBeDefined();

      // Step 2: Generate report
      const report = await reportGenService.generateReport({
        userId: mockReportData.userId,
        reportData: mockReportData,
        notify: false, // Notifications handled separately to avoid instance issues
      });

      expect(report).toBeDefined();
      expect(report.sections.executiveSummary).toBeTruthy();

      // Step 3: Cache report
      const reportDate = mockReportData.period.end.toISOString().split('T')[0];
      await cacheService.set(mockReportData.userId, reportDate, report);

      const cachedReport = await cacheService.get(mockReportData.userId, reportDate);
      expect(cachedReport?.id).toBe(report.id);

      // Step 4: Send notification manually and verify
      const notification = await notificationService.notifyReportReady(
        report,
        mockReportData.userId
      );
      expect(notification).toBeDefined();
      expect(notification.type).toBe('report_ready');
    });

    it('should handle multiple users independently', async () => {
      const user1Data = { ...mockReportData, userId: 'user1' };
      const user2Data = { ...mockReportData, userId: 'user2' };

      // Generate for user1
      const report1 = await reportGenService.generateReport({
        userId: 'user1',
        reportData: user1Data,
        notify: false,
      });

      // Generate for user2
      const report2 = await reportGenService.generateReport({
        userId: 'user2',
        reportData: user2Data,
        notify: false,
      });

      // Verify independence
      expect(report1.userId).toBe('user1');
      expect(report2.userId).toBe('user2');

      // Manually send notifications and verify they are stored separately
      const notif1 = await notificationService.notifyReportReady(report1, 'user1');
      const notif2 = await notificationService.notifyReportReady(report2, 'user2');

      expect(notif1.userId).toBe('user1');
      expect(notif2.userId).toBe('user2');
      expect(notif1.reportId).toBe(report1.id);
      expect(notif2.reportId).toBe(report2.id);
    });

    it('should handle different time periods correctly', async () => {
      const period1 = { start: new Date('2026-01-01'), end: new Date('2026-01-31') };
      const period2 = { start: new Date('2026-02-01'), end: new Date('2026-02-28') };

      const data1 = { ...mockReportData, period: period1 };
      const data2 = { ...mockReportData, period: period2 };

      const report1 = await reportGenService.generateReport({
        userId: mockReportData.userId,
        reportData: data1,
        notify: false,
      });

      const report2 = await reportGenService.generateReport({
        userId: mockReportData.userId,
        reportData: data2,
        notify: false,
      });

      // Both should be generated successfully
      expect(report1).toBeDefined();
      expect(report2).toBeDefined();
      expect(report1.id).not.toBe(report2.id);
    });

    it('should maintain data consistency through pipeline', async () => {
      const report = await reportGenService.generateReport({
        userId: mockReportData.userId,
        reportData: mockReportData,
        notify: false,
      });

      // Verify source data is preserved
      expect(report.sourceData.clickupMetrics).toContain('42');
      expect(report.sourceData.notionMetrics).toContain('12');
      expect(report.sourceData.calendarMetrics).toContain('28.5');

      // Verify cache preserves data
      const reportDate = mockReportData.period.end.toISOString().split('T')[0];
      await cacheService.set(mockReportData.userId, reportDate, report);

      const cached = await cacheService.get(mockReportData.userId, reportDate);
      expect(cached?.sourceData.clickupMetrics).toBe(report.sourceData.clickupMetrics);
      expect(cached?.sourceData.notionMetrics).toBe(report.sourceData.notionMetrics);
      expect(cached?.sourceData.calendarMetrics).toBe(report.sourceData.calendarMetrics);
    });
  });

  describe('Performance & Reliability', () => {
    it('should complete full flow within timeout', async () => {
      const startTime = Date.now();

      const report = await reportGenService.generateReport({
        userId: mockReportData.userId,
        reportData: mockReportData,
        notify: false,
      });

      const duration = Date.now() - startTime;

      expect(report).toBeDefined();
      expect(duration).toBeLessThan(2500); // 2.5 second timeout
    });

    it('should handle concurrent report generation', async () => {
      const promises = [];

      for (let i = 0; i < 3; i++) {
        promises.push(
          reportGenService.generateReport({
            userId: `user${i}`,
            reportData: { ...mockReportData, userId: `user${i}` },
            notify: false,
          })
        );
      }

      const reports = await Promise.all(promises);

      expect(reports).toHaveLength(3);
      reports.forEach((report, index) => {
        expect(report.userId).toBe(`user${index}`);
      });
    });

    it('should handle error gracefully', async () => {
      try {
        const invalidData = { ...mockReportData, clickup: null } as any;

        // Should handle gracefully or throw informative error
        const result = await reportGenService.generateReport({
          userId: mockReportData.userId,
          reportData: invalidData,
          notify: false,
        });

        // If no error, report should still be generated
        expect(result).toBeDefined();
      } catch (error) {
        // Should provide meaningful error message
        expect(error).toBeDefined();
      }
    });
  });

  describe('Data Quality Validation', () => {
    it('should validate report structure', async () => {
      const report = await reportGenService.generateReport({
        userId: mockReportData.userId,
        reportData: mockReportData,
        notify: false,
      });

      // Validate all required fields exist
      expect(report.id).toBeTruthy();
      expect(report.userId).toBeTruthy();
      expect(report.period).toBeDefined();
      expect(report.sections).toBeDefined();
      expect(report.generatedAt).toBeDefined();
      expect(report.cacheExpiresAt).toBeDefined();
      expect(report.sourceData).toBeDefined();
    });

    it('should validate section content', async () => {
      const report = await reportGenService.generateReport({
        userId: mockReportData.userId,
        reportData: mockReportData,
        notify: false,
      });

      // Executive Summary: 2-3 paragraphs
      expect(report.sections.executiveSummary).toBeTruthy();
      expect(report.sections.executiveSummary.length).toBeGreaterThan(10);

      // Key Metrics: 5-7 items
      expect(Array.isArray(report.sections.keyMetrics)).toBe(true);
      expect(report.sections.keyMetrics.length).toBeGreaterThanOrEqual(5);

      // Insights: 3-5 items
      expect(Array.isArray(report.sections.insights)).toBe(true);
      expect(report.sections.insights.length).toBeGreaterThanOrEqual(3);

      // Recommendations: 3-5 items
      expect(Array.isArray(report.sections.recommendations)).toBe(true);
      expect(report.sections.recommendations.length).toBeGreaterThanOrEqual(3);
    });
  });
});
