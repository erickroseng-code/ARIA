/**
 * ReportDataAggregationService: Aggregate data from tasks, Notion, and Google Calendar
 * Subtasks 1.1-1.5: Service setup, parallel API calls, caching, error handling
 * Tasks 2-4: Uses TaskDataCollector, NotionDataCollector, GoogleCalendarDataCollector
 * Task 5: Data normalization into ReportData model
 */

import { TaskDataCollector } from './TaskDataCollector';
import { NotionDataCollector } from './NotionDataCollector';
import { GoogleCalendarDataCollector } from './GoogleCalendarDataCollector';

export interface ReportData {
  period: { start: Date; end: Date };
  tasks: {
    tasksCompleted: number;
    tasksPending: number;
    tasksOverdue: number;
    tasksCreated: number;
  };
  notion: {
    activeClients: number;
    plansCreated: number;
    meetingsRecorded: number;
    propertiesFilled: number;
    propertyConflicts: number;
  };
  calendar: {
    meetingsScheduled: number;
    meetingsCompleted: number;
    hoursInMeetings: number;
  };
  generatedAt: Date;
  cacheExpiresAt: Date;
  isPartialData: boolean;
  errors?: string[];
}

export interface DateRange {
  start: Date;
  end: Date;
}

interface CacheEntry {
  data: ReportData;
  timestamp: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour (Task 1.4)

export class ReportDataAggregationService {
  private cache: Map<string, CacheEntry> = new Map();

  // Tasks 2-4: Use data collectors for API calls
  private taskCollector: TaskDataCollector;
  private notionCollector: NotionDataCollector;
  private calendarCollector: GoogleCalendarDataCollector;

  // Task 1.1: Allow dependency injection for testing
  constructor(
    taskCollector?: TaskDataCollector,
    notionCollector?: NotionDataCollector,
    calendarCollector?: GoogleCalendarDataCollector
  ) {
    this.taskCollector = taskCollector || new TaskDataCollector();
    this.notionCollector = notionCollector || new NotionDataCollector();
    this.calendarCollector = calendarCollector || new GoogleCalendarDataCollector();
  }

  /**
   * Task 1.2: Implement aggregateData(dateRange) → ReportData
   * Main method to aggregate data from all sources
   */
  async aggregateData(dateRange: DateRange): Promise<ReportData> {
    // Task 1.4: Check cache first
    const cacheKey = this.getCacheKey(dateRange);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const errors: string[] = [];

    // Task 1.3: Setup parallel API calls with timeout (Tasks 2, 3, 4)
    const taskPromise = this.taskCollector
      .collectData(dateRange.start, dateRange.end)
      .catch((error) => {
        errors.push(`Task data error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return {
          tasksCompleted: 0,
          tasksPending: 0,
          tasksOverdue: 0,
          tasksCreated: 0,
        };
      });

    const notionPromise = this.notionCollector
      .collectData(dateRange.start, dateRange.end)
      .catch((error) => {
        errors.push(`Notion error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return {
          activeClients: 0,
          plansCreated: 0,
          meetingsRecorded: 0,
          propertiesFilled: 0,
          propertyConflicts: 0,
        };
      });

    const calendarPromise = this.calendarCollector
      .collectData(dateRange.start, dateRange.end)
      .catch((error) => {
        errors.push(
          `Google Calendar error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        return {
          meetingsScheduled: 0,
          meetingsCompleted: 0,
          hoursInMeetings: 0,
        };
      });

    const [tasks, notion, calendar] = await Promise.all([
      taskPromise,
      notionPromise,
      calendarPromise,
    ]);

    // Task 5.5: Add metadata
    const generatedAt = new Date();
    const cacheExpiresAt = new Date(generatedAt.getTime() + CACHE_TTL_MS);

    const reportData: ReportData = {
      period: dateRange,
      tasks,
      notion,
      calendar,
      generatedAt,
      cacheExpiresAt,
      isPartialData: errors.length > 0,
      ...(errors.length > 0 && { errors }),
    };

    // Task 1.4: Store in cache
    this.setCache(cacheKey, reportData);

    return reportData;
  }


  /**
   * Task 1.4: Generate cache key from date range
   */
  private getCacheKey(dateRange: DateRange): string {
    return `${dateRange.start.toISOString()}_${dateRange.end.toISOString()}`;
  }

  /**
   * Task 1.4: Get from cache with TTL validation
   */
  private getFromCache(key: string): ReportData | null {
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

  /**
   * Task 1.4: Store in cache with timestamp
   */
  private setCache(key: string, data: ReportData): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}
