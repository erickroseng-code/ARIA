/**
 * Scheduled Report Service
 * Task 1: ScheduledReportService Setup
 *
 * Manages scheduled report generation and delivery with:
 * - Frequency configuration (daily, weekly, monthly, custom)
 * - Multi-channel delivery (Telegram, email Phase 2, Notion)
 * - Bull queue integration for cron scheduling
 * - Timezone awareness
 * - Pause/resume functionality
 * - Delivery history tracking
 */

import { Queue, Worker } from 'bullmq';
import * as cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';

/**
 * Frequency options for scheduled reports
 */
export type ReportFrequency = 'daily' | 'weekly' | 'monthly' | 'custom';

/**
 * Delivery channels for scheduled reports
 */
export type DeliveryChannel = 'telegram' | 'email' | 'notion';

/**
 * Day of week for weekly scheduling
 */
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

/**
 * User's scheduled report configuration
 */
export interface ScheduledReport {
  id: string;
  userId: string;
  frequency: ReportFrequency;
  dayOfWeek?: DayOfWeek; // For weekly schedules
  dayOfMonth?: number; // For monthly schedules (1-31)
  hour: number; // 0-23
  minute: number; // 0-59
  timezone: string; // e.g., 'America/Sao_Paulo', 'UTC'
  channels: DeliveryChannel[]; // Where to deliver
  isActive: boolean; // Pause/resume status
  createdAt: Date;
  updatedAt: Date;
  lastDeliveryAt?: Date;
  nextDeliveryAt: Date;
  cronExpression?: string; // Computed cron expression
}

/**
 * Delivery history entry
 */
export interface DeliveryHistoryEntry {
  id: string;
  scheduleId: string;
  userId: string;
  deliveryTime: Date;
  channels: DeliveryChannel[];
  success: boolean;
  errorMessage?: string;
  reportId?: string;
  notionPageId?: string;
  retryCount: number;
  nextRetryAt?: Date;
}

/**
 * Configuration for ScheduledReportService
 */
export interface ScheduledReportServiceConfig {
  redisUrl?: string; // Redis URL for Bull queue (default: in-memory)
  maxRetries?: number; // Max retry attempts for failed deliveries
  retryBackoff?: 'fixed' | 'exponential'; // Retry strategy
}

export class ScheduledReportService {
  private schedules: Map<string, ScheduledReport> = new Map();
  private deliveryHistory: Map<string, DeliveryHistoryEntry[]> = new Map();
  private cronTasks: Map<string, cron.ScheduledTask> = new Map();
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private config: Required<ScheduledReportServiceConfig>;

  constructor(config: ScheduledReportServiceConfig = {}) {
    this.config = {
      redisUrl: config.redisUrl || undefined,
      maxRetries: config.maxRetries || 3,
      retryBackoff: config.retryBackoff || 'exponential',
    };

    // Initialize Bull queue if Redis URL provided
    if (this.config.redisUrl) {
      try {
        this.queue = new Queue('scheduled-reports', {
          connection: { url: this.config.redisUrl },
        });
      } catch (error) {
        console.warn('Failed to initialize Bull queue, using in-memory scheduling', error);
      }
    }
  }

  /**
   * Create a new scheduled report
   */
  async createSchedule(
    userId: string,
    frequency: ReportFrequency,
    hour: number,
    minute: number,
    timezone: string,
    channels: DeliveryChannel[],
    options?: {
      dayOfWeek?: DayOfWeek;
      dayOfMonth?: number;
    }
  ): Promise<ScheduledReport> {
    if (hour < 0 || hour > 23) {
      throw new Error('Hour must be between 0 and 23');
    }
    if (minute < 0 || minute > 59) {
      throw new Error('Minute must be between 0 and 59');
    }
    if (channels.length === 0) {
      throw new Error('At least one delivery channel must be specified');
    }

    // Validate frequency-specific options
    if (frequency === 'weekly' && !options?.dayOfWeek) {
      throw new Error('dayOfWeek required for weekly schedules');
    }
    if (frequency === 'monthly' && (!options?.dayOfMonth || options.dayOfMonth < 1 || options.dayOfMonth > 31)) {
      throw new Error('Valid dayOfMonth (1-31) required for monthly schedules');
    }

    const id = uuidv4();
    const cronExpression = this.buildCronExpression(frequency, hour, minute, options?.dayOfWeek, options?.dayOfMonth);

    const schedule: ScheduledReport = {
      id,
      userId,
      frequency,
      dayOfWeek: options?.dayOfWeek,
      dayOfMonth: options?.dayOfMonth,
      hour,
      minute,
      timezone,
      channels,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      nextDeliveryAt: this.calculateNextDelivery(cronExpression, timezone),
      cronExpression,
    };

    this.schedules.set(id, schedule);
    this.deliveryHistory.set(id, []);

    // Setup cron task if using in-memory scheduling
    if (!this.queue) {
      this.setupCronTask(id, schedule);
    }

    return schedule;
  }

  /**
   * Get a schedule by ID
   */
  getSchedule(scheduleId: string): ScheduledReport | undefined {
    return this.schedules.get(scheduleId);
  }

  /**
   * Get all schedules for a user
   */
  getUserSchedules(userId: string): ScheduledReport[] {
    return Array.from(this.schedules.values()).filter((s) => s.userId === userId);
  }

  /**
   * Update a schedule
   */
  async updateSchedule(
    scheduleId: string,
    updates: Partial<{
      frequency: ReportFrequency;
      dayOfWeek?: DayOfWeek;
      dayOfMonth?: number;
      hour: number;
      minute: number;
      timezone: string;
      channels: DeliveryChannel[];
    }>
  ): Promise<ScheduledReport> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    // Merge updates
    const updated: ScheduledReport = {
      ...schedule,
      ...updates,
      updatedAt: new Date(),
    };

    // Recalculate cron and next delivery
    if (updates.frequency || updates.hour !== undefined || updates.minute !== undefined) {
      updated.cronExpression = this.buildCronExpression(
        updated.frequency,
        updated.hour,
        updated.minute,
        updated.dayOfWeek,
        updated.dayOfMonth
      );
      updated.nextDeliveryAt = this.calculateNextDelivery(updated.cronExpression, updated.timezone);

      // Update cron task if in-memory
      if (!this.queue) {
        this.removeCronTask(scheduleId);
        this.setupCronTask(scheduleId, updated);
      }
    }

    this.schedules.set(scheduleId, updated);
    return updated;
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(scheduleId: string): Promise<void> {
    if (!this.schedules.has(scheduleId)) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    this.schedules.delete(scheduleId);
    this.deliveryHistory.delete(scheduleId);
    this.removeCronTask(scheduleId);
  }

  /**
   * Pause/resume a schedule
   */
  async pauseSchedule(scheduleId: string): Promise<ScheduledReport> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    schedule.isActive = false;
    schedule.updatedAt = new Date();
    this.schedules.set(scheduleId, schedule);

    if (!this.queue) {
      this.removeCronTask(scheduleId);
    }

    return schedule;
  }

  /**
   * Resume a schedule
   */
  async resumeSchedule(scheduleId: string): Promise<ScheduledReport> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    schedule.isActive = true;
    schedule.updatedAt = new Date();
    schedule.nextDeliveryAt = this.calculateNextDelivery(schedule.cronExpression!, schedule.timezone);
    this.schedules.set(scheduleId, schedule);

    if (!this.queue) {
      this.setupCronTask(scheduleId, schedule);
    }

    return schedule;
  }

  /**
   * Get delivery history for a schedule
   */
  getDeliveryHistory(scheduleId: string, limit: number = 50): DeliveryHistoryEntry[] {
    const history = this.deliveryHistory.get(scheduleId) || [];
    return history.slice(-limit);
  }

  /**
   * Record a delivery attempt
   */
  async recordDelivery(
    scheduleId: string,
    delivery: Omit<DeliveryHistoryEntry, 'id' | 'userId'>
  ): Promise<DeliveryHistoryEntry> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    const entry: DeliveryHistoryEntry = {
      id: uuidv4(),
      userId: schedule.userId,
      ...delivery,
    };

    const history = this.deliveryHistory.get(scheduleId) || [];
    history.push(entry);
    this.deliveryHistory.set(scheduleId, history);

    // Update last delivery time and next delivery if successful
    if (delivery.success) {
      schedule.lastDeliveryAt = delivery.deliveryTime;
      schedule.nextDeliveryAt = this.calculateNextDelivery(schedule.cronExpression!, schedule.timezone);
      this.schedules.set(scheduleId, schedule);
    }

    return entry;
  }

  /**
   * Get next delivery time for a schedule
   */
  getNextDelivery(scheduleId: string): Date | null {
    const schedule = this.schedules.get(scheduleId);
    return schedule?.nextDeliveryAt || null;
  }

  /**
   * Get active schedules that need delivery
   */
  getSchedulesForDelivery(): ScheduledReport[] {
    const now = new Date();
    return Array.from(this.schedules.values()).filter((s) => {
      if (!s.isActive) return false;
      if (!s.nextDeliveryAt) return false;
      // Consider ±5 min tolerance as per acceptance criteria
      const tolerance = 5 * 60 * 1000;
      return now.getTime() >= s.nextDeliveryAt.getTime() - tolerance;
    });
  }

  /**
   * Build cron expression from frequency and time
   */
  private buildCronExpression(
    frequency: ReportFrequency,
    hour: number,
    minute: number,
    dayOfWeek?: DayOfWeek,
    dayOfMonth?: number
  ): string {
    switch (frequency) {
      case 'daily':
        return `${minute} ${hour} * * *`; // Every day at HH:MM

      case 'weekly':
        if (!dayOfWeek) throw new Error('dayOfWeek required for weekly');
        const dayNumber = this.dayOfWeekToNumber(dayOfWeek);
        return `${minute} ${hour} * * ${dayNumber}`; // Every week on day at HH:MM

      case 'monthly':
        if (!dayOfMonth) throw new Error('dayOfMonth required for monthly');
        return `${minute} ${hour} ${dayOfMonth} * *`; // Every month on day at HH:MM

      case 'custom':
        // Custom cron expression should be passed as cronExpression
        return `${minute} ${hour} * * *`; // Default to daily

      default:
        throw new Error(`Unknown frequency: ${frequency}`);
    }
  }

  /**
   * Convert day name to cron day number (0-6, 0=Sunday)
   */
  private dayOfWeekToNumber(day: DayOfWeek): number {
    const map: Record<DayOfWeek, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    return map[day];
  }

  /**
   * Calculate next delivery time based on cron expression and timezone
   */
  private calculateNextDelivery(cronExpression: string, timezone: string): Date {
    try {
      // Parse next execution time using cron expression
      const task = cron.schedule(cronExpression, () => {}, { scheduled: false });
      const interval = task.nextDate().toDate();
      task.stop();
      return interval;
    } catch (error) {
      // Fallback: next hour
      const next = new Date();
      next.setHours(next.getHours() + 1);
      return next;
    }
  }

  /**
   * Setup in-memory cron task for a schedule
   */
  private setupCronTask(scheduleId: string, schedule: ScheduledReport): void {
    if (!schedule.cronExpression) return;

    try {
      const task = cron.schedule(schedule.cronExpression, async () => {
        if (schedule.isActive) {
          // This will be handled by the DeliveryExecutionService in Task 4
          console.log(`[ScheduledReport] Delivery triggered for ${scheduleId}`);
        }
      });

      this.cronTasks.set(scheduleId, task);
    } catch (error) {
      console.error(`Failed to setup cron task for ${scheduleId}:`, error);
    }
  }

  /**
   * Remove cron task for a schedule
   */
  private removeCronTask(scheduleId: string): void {
    const task = this.cronTasks.get(scheduleId);
    if (task) {
      task.stop();
      this.cronTasks.delete(scheduleId);
    }
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalSchedules: number;
    activeSchedules: number;
    schedulesNeedingDelivery: number;
  } {
    const all = Array.from(this.schedules.values());
    const active = all.filter((s) => s.isActive);
    const needsDelivery = this.getSchedulesForDelivery();

    return {
      totalSchedules: all.length,
      activeSchedules: active.length,
      schedulesNeedingDelivery: needsDelivery.length,
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Stop all cron tasks
    for (const task of this.cronTasks.values()) {
      task.stop();
    }
    this.cronTasks.clear();

    // Close Bull queue if initialized
    if (this.queue) {
      await this.queue.close();
    }
    if (this.worker) {
      await this.worker.close();
    }
  }
}
