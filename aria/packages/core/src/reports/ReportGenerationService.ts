/**
 * Report Generation Service
 * Task 1-5: Claude Opus integration, Notion storage, notifications, caching
 */

import { ReportData } from './ReportDataAggregationService';
import { NotionDocumentCreator, type ReportContent } from '../integrations/NotionDocumentCreator';
import { NotificationService } from '../notifications/NotificationService';

export interface GeneratedReport {
  id: string;
  userId: string;
  period: { start: Date; end: Date };
  sections: {
    executiveSummary: string; // 2-3 paragraphs
    keyMetrics: string[]; // 5-7 bullet points
    insights: string[]; // 3-5 insights
    recommendations: string[]; // 3-5 actionable items
  };
  notionPageId?: string; // Link to multi-page Notion doc
  generatedAt: Date;
  cacheExpiresAt: Date;
  notificationSentAt?: Date;
  sourceData: {
    clickupMetrics: string;
    notionMetrics: string;
    calendarMetrics: string;
  };
}

export interface GeneratedReportRequest {
  userId: string;
  reportData: ReportData;
  regenerate?: boolean; // Force bypass cache
  createInNotion?: boolean; // Create page in Notion (default: false)
  notify?: boolean; // Send notifications (Telegram + Web UI) (default: true)
}

interface CacheEntry {
  data: GeneratedReport;
  timestamp: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour (Task 5.1)
const REPORT_TIMEOUT_MS = 2.5 * 60 * 1000; // 2.5 minutes (Task 1.4)
const MAX_RETRIES = 2;

export class ReportGenerationService {
  private cache: Map<string, CacheEntry> = new Map();

  // Task 1.3: Queue system placeholder (Bull integration in Phase 2)
  private queue: any[] = [];

  // Task 4: Notification service
  private notificationService: NotificationService;

  // Task 1.2: Claude Opus client (injected for testing)
  constructor(
    private claudeClient?: any,
    telegramBotToken?: string,
    telegramChatId?: string
  ) {
    this.notificationService = new NotificationService(
      telegramBotToken,
      telegramChatId
    );
  }

  /**
   * Task 3: Create report page in Notion (bot humano)
   */
  async createReportInNotion(report: GeneratedReport): Promise<string> {
    const creator = new NotionDocumentCreator();

    const content: ReportContent = {
      title: `📊 Report - ${report.period.start.toLocaleDateString('pt-BR')} a ${report.period.end.toLocaleDateString('pt-BR')}`,
      executiveSummary: report.sections.executiveSummary,
      keyMetrics: report.sections.keyMetrics,
      insights: report.sections.insights,
      recommendations: report.sections.recommendations,
      period: report.period,
    };

    try {
      await creator.createFullReport(content);
      return report.id; // Return page ID (will be enhanced in future)
    } catch (error) {
      console.error('Erro ao criar página no Notion:', error);
      throw new Error(
        `Failed to create Notion page: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Task 1.2: Main method to generate report from aggregated data
   */
  async generateReport(request: GeneratedReportRequest): Promise<GeneratedReport> {
    const {
      userId,
      reportData,
      regenerate = false,
      createInNotion = false,
      notify = true,
    } = request;

    // Task 5.1: Check cache if not regenerating
    const cacheKey = this.getCacheKey(userId, reportData.period);
    if (!regenerate) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      // Task 1.4: Setup timeout for report generation
      const report = await this.withTimeout(
        this.generateReportInternal(userId, reportData),
        REPORT_TIMEOUT_MS,
        'Report generation'
      );

      // Task 3: Create page in Notion if requested
      if (createInNotion) {
        try {
          const notionPageId = await this.createReportInNotion(report);
          report.notionPageId = notionPageId;
        } catch (notionError) {
          console.error('Warning: Notion page creation failed:', notionError);
          // Don't fail the entire report generation if Notion fails
          // Report is still generated and cached
        }
      }

      // Task 4: Send notifications if enabled
      if (notify) {
        try {
          report.notificationSentAt = new Date();
          await this.notificationService.notifyReportReady(report, userId);
        } catch (notificationError) {
          console.error('Warning: Notification failed:', notificationError);
          // Don't fail the entire report generation if notification fails
        }
      }

      // Task 5.1: Store in cache
      this.setCache(cacheKey, report);

      return report;
    } catch (error) {
      // Task 1.5: Queue for retry on failure
      this.queueForRetry(request, 0);
      throw new Error(
        `Report generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Task 1.2: Internal report generation logic
   */
  private async generateReportInternal(
    userId: string,
    reportData: ReportData
  ): Promise<GeneratedReport> {
    // Task 2.6: Parse Claude response into structured format
    // (Mock implementation - will be replaced with actual Claude call in Task 2)
    const sections = {
      executiveSummary: this.generateSummaryMock(reportData),
      keyMetrics: this.generateMetricsMock(reportData),
      insights: this.generateInsightsMock(reportData),
      recommendations: this.generateRecommendationsMock(reportData),
    };

    const generatedAt = new Date();
    const cacheExpiresAt = new Date(generatedAt.getTime() + CACHE_TTL_MS);

    return {
      id: this.generateId(),
      userId,
      period: reportData.period,
      sections,
      generatedAt,
      cacheExpiresAt,
      sourceData: {
        clickupMetrics: `${reportData.clickup.tasksCompleted} completed`,
        notionMetrics: `${reportData.notion.activeClients} active clients`,
        calendarMetrics: `${reportData.calendar.hoursInMeetings}h meetings`,
      },
    };
  }

  /**
   * Task 1.4: Timeout wrapper for async operations
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operation: string
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${operation} timeout (${timeoutMs}ms)`)), timeoutMs)
      ),
    ]);
  }

  /**
   * Task 1.5: Queue failed report generation for retry
   */
  private queueForRetry(request: GeneratedReportRequest, attempt: number): void {
    if (attempt >= MAX_RETRIES) {
      console.error(`Max retries reached for report generation: ${request.userId}`);
      return;
    }

    // Task 1.3: Add to queue with exponential backoff
    const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s...
    const queueItem = {
      request,
      attempt: attempt + 1,
      retryAt: new Date(Date.now() + delayMs),
    };

    this.queue.push(queueItem);
  }

  /**
   * Task 5: Cache management
   */
  private getCacheKey(userId: string, period: { start: Date; end: Date }): string {
    return `report:${userId}:${period.start.toISOString()}:${period.end.toISOString()}`;
  }

  private getFromCache(key: string): GeneratedReport | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const age = now - entry.timestamp;

    if (age > CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache(key: string, data: GeneratedReport): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Task 5.3: Manual refresh endpoint
   */
  async refreshReport(userId: string, reportData: ReportData): Promise<GeneratedReport> {
    return this.generateReport({
      userId,
      reportData,
      regenerate: true, // Force new generation
    });
  }

  /**
   * Mock implementations for initial testing (replaced in Task 2)
   */
  private generateSummaryMock(reportData: ReportData): string {
    return `During the period ${reportData.period.start.toLocaleDateString()} to ${reportData.period.end.toLocaleDateString()}, the team achieved significant progress. Completed ${reportData.clickup.tasksCompleted} tasks while managing ${reportData.notion.activeClients} active clients. Meeting activity indicates strong engagement with ${reportData.calendar.meetingsCompleted} meetings completed.`;
  }

  private generateMetricsMock(reportData: ReportData): string[] {
    return [
      `Tasks Completed: ${reportData.clickup.tasksCompleted} (${reportData.clickup.tasksPending} still pending)`,
      `Active Clients: ${reportData.notion.activeClients}`,
      `Plans Created: ${reportData.notion.plansCreated}`,
      `Meetings: ${reportData.calendar.meetingsCompleted}/${reportData.calendar.meetingsScheduled} completed`,
      `Total Meeting Hours: ${reportData.calendar.hoursInMeetings}h`,
    ];
  }

  private generateInsightsMock(reportData: ReportData): string[] {
    const pendingRatio = (
      (reportData.clickup.tasksPending /
        (reportData.clickup.tasksCompleted + reportData.clickup.tasksPending)) *
      100
    ).toFixed(1);

    return [
      `Task velocity remains strong with ${reportData.clickup.tasksCompleted} completions`,
      `${pendingRatio}% of tasks still pending - may indicate capacity constraints`,
      `High meeting engagement suggests active client collaboration`,
      `${reportData.notion.plansCreated} new plans created indicates strategic planning activity`,
    ];
  }

  private generateRecommendationsMock(_reportData: ReportData): string[] {
    return [
      'Focus on clearing pending tasks to improve completion rate',
      'Schedule regular check-ins with all active clients',
      'Document lessons learned from completed plans',
      'Consider task prioritization framework to manage workload',
    ];
  }

  /**
   * Utility: Generate unique ID
   */
  private generateId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Utility: Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Utility: Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Utility: Get queue size (for monitoring)
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Task 4.3: Get notifications for user
   */
  getUserNotifications(userId: string) {
    return this.notificationService.getNotificationsForUser(userId);
  }

  /**
   * Utility: Get notification configuration status
   */
  getNotificationStatus() {
    return this.notificationService.getConfigurationStatus();
  }
}
