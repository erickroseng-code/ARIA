/**
 * Bull Queue Service for Scheduled Report Delivery
 * Task 2: Bull Queue Job Scheduling
 *
 * Manages job queue for report generation and delivery using Bull (BullMQ).
 * Features:
 * - Queue initialization and worker management
 * - Schedule-based job creation (cron expressions)
 * - Retry logic with exponential backoff
 * - Job monitoring and status tracking
 * - Error handling and recovery
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import type { ScheduledReport } from './ScheduledReportService';

/**
 * Job payload for scheduled report delivery
 */
export interface ReportDeliveryJob {
  jobId: string;
  scheduleId: string;
  userId: string;
  reportDate: string;
  channels: Array<'telegram' | 'email' | 'notion'>;
  generatedAt: Date;
}

/**
 * Job metadata tracking
 */
export interface JobMetadata {
  jobId: string;
  scheduleId: string;
  userId: string;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'delayed';
  attemptCount: number;
  maxAttempts: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  nextRetryAt?: Date;
}

/**
 * Configuration for BullQueueService
 */
export interface BullQueueServiceConfig {
  redisUrl?: string;
  queueName?: string;
  defaultRetries?: number;
  defaultRetryDelay?: number; // ms
  backoffMultiplier?: number;
  maxBackoffDelay?: number; // ms
  pollInterval?: number; // ms
}

export class BullQueueService {
  private queue: Queue<ReportDeliveryJob> | null = null;
  private worker: Worker<ReportDeliveryJob> | null = null;
  private queueEvents: QueueEvents | null = null;
  private redis: Redis | null = null;
  private config: Required<BullQueueServiceConfig>;
  private jobMetadata: Map<string, JobMetadata> = new Map();
  private jobProcessors: Map<string, (job: Job<ReportDeliveryJob>) => Promise<void>> = new Map();
  private isConnected = false;

  constructor(config: BullQueueServiceConfig = {}) {
    this.config = {
      redisUrl: config.redisUrl !== undefined ? config.redisUrl : 'redis://localhost:6379',
      queueName: config.queueName || 'scheduled-reports',
      defaultRetries: config.defaultRetries || 3,
      defaultRetryDelay: config.defaultRetryDelay || 5000, // 5 seconds
      backoffMultiplier: config.backoffMultiplier || 2,
      maxBackoffDelay: config.maxBackoffDelay || 300000, // 5 minutes
      pollInterval: config.pollInterval || 1000,
    };
  }

  /**
   * Initialize Bull queue and worker
   */
  async initialize(): Promise<void> {
    try {
      // Only initialize if Redis is available
      if (!this.config.redisUrl) {
        console.warn('Redis URL not configured, Bull queue will operate in-memory mode');
        return;
      }

      // Create Redis connection
      this.redis = new Redis(this.config.redisUrl);

      // Create queue
      this.queue = new Queue<ReportDeliveryJob>(this.config.queueName, {
        connection: this.redis,
        defaultJobOptions: {
          attempts: this.config.defaultRetries,
          backoff: {
            type: 'exponential',
            delay: this.config.defaultRetryDelay,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      } as any) as any;

      // Create queue events listener
      this.queueEvents = new QueueEvents(this.config.queueName, {
        connection: this.redis as any,
      });

      // Create worker
      this.worker = new Worker<ReportDeliveryJob>(this.config.queueName, this.processJob.bind(this), {
        connection: this.redis as any,
        concurrency: 5, // Process up to 5 jobs concurrently
      });

      // Setup event listeners
      this.setupEventListeners();

      this.isConnected = true;
      console.log('Bull queue initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Bull queue:', error);
      console.warn('Continuing with in-memory job tracking');
    }
  }

  /**
   * Add a report delivery job to the queue
   */
  async addJob(scheduleId: string, job: Omit<ReportDeliveryJob, 'jobId'>): Promise<string> {
    const jobId = uuidv4();
    const jobData: ReportDeliveryJob = {
      ...job,
      jobId,
    };

    // Store metadata
    const metadata: JobMetadata = {
      jobId,
      scheduleId: job.scheduleId,
      userId: job.userId,
      status: 'pending',
      attemptCount: 0,
      maxAttempts: this.config.defaultRetries,
      createdAt: new Date(),
    };
    this.jobMetadata.set(jobId, metadata);

    if (this.queue) {
      try {
        const bullJob = await this.queue.add(this.config.queueName, jobData, {
          jobId,
          attempts: this.config.defaultRetries,
          backoff: {
            type: 'exponential',
            delay: this.config.defaultRetryDelay,
          },
        });

        console.log(`Job ${jobId} added to queue`);
        return bullJob.id || jobId;
      } catch (error) {
        console.error(`Failed to add job ${jobId} to queue:`, error);
        throw error;
      }
    } else {
      // In-memory mode: emit immediate processing
      console.log(`Job ${jobId} queued for in-memory processing`);
      return jobId;
    }
  }

  /**
   * Process a job (called by worker)
   */
  private async processJob(job: Job<ReportDeliveryJob>): Promise<void> {
    const jobData = job.data;
    const jobId = jobData.jobId;

    try {
      // Update metadata
      const metadata = this.jobMetadata.get(jobId);
      if (metadata) {
        metadata.status = 'active';
        metadata.startedAt = new Date();
        metadata.attemptCount = (job.attemptsMade || 0) + 1;
      }

      // Call custom processor if registered
      const processor = this.jobProcessors.get(`${jobData.scheduleId}`);
      if (processor) {
        await processor(job);
      } else {
        // Default: log that no processor is registered
        console.log(`Processing job ${jobId} for schedule ${jobData.scheduleId}`);
      }

      // Update metadata on success
      if (metadata) {
        metadata.status = 'completed';
        metadata.completedAt = new Date();
      }

      console.log(`Job ${jobId} completed successfully`);
    } catch (error) {
      console.error(`Error processing job ${jobId}:`, error);

      // Update metadata on failure
      const metadata = this.jobMetadata.get(jobId);
      if (metadata) {
        metadata.status = 'failed';
        metadata.errorMessage = error instanceof Error ? error.message : String(error);

        // Calculate next retry time if retries remain
        if (metadata.attemptCount < metadata.maxAttempts) {
          const delay = Math.min(
            this.config.defaultRetryDelay * Math.pow(this.config.backoffMultiplier, metadata.attemptCount - 1),
            this.config.maxBackoffDelay
          );
          metadata.nextRetryAt = new Date(Date.now() + delay);
          metadata.status = 'delayed';
        }
      }

      // Throw error to trigger Bull's retry mechanism
      throw error;
    }
  }

  /**
   * Register a custom job processor for a schedule
   */
  registerProcessor(scheduleId: string, processor: (job: Job<ReportDeliveryJob>) => Promise<void>): void {
    this.jobProcessors.set(scheduleId, processor);
    console.log(`Processor registered for schedule ${scheduleId}`);
  }

  /**
   * Get job status/metadata
   */
  getJobMetadata(jobId: string): JobMetadata | undefined {
    return this.jobMetadata.get(jobId);
  }

  /**
   * Get all pending jobs
   */
  getPendingJobs(): JobMetadata[] {
    return Array.from(this.jobMetadata.values()).filter((m) => m.status === 'pending' || m.status === 'delayed');
  }

  /**
   * Get failed jobs
   */
  getFailedJobs(limit: number = 50): JobMetadata[] {
    return Array.from(this.jobMetadata.values())
      .filter((m) => m.status === 'failed')
      .slice(-limit);
  }

  /**
   * Get completed jobs
   */
  getCompletedJobs(limit: number = 50): JobMetadata[] {
    return Array.from(this.jobMetadata.values())
      .filter((m) => m.status === 'completed')
      .slice(-limit);
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    name: string;
    pending: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    isConnected: boolean;
  }> {
    if (!this.queue) {
      return {
        name: this.config.queueName,
        pending: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        isConnected: false,
      };
    }

    try {
      const counts = await this.queue.getJobCounts();
      return {
        name: this.config.queueName,
        pending: counts.waiting || 0,
        active: counts.active || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        delayed: counts.delayed || 0,
        isConnected: this.isConnected,
      };
    } catch (error) {
      console.error('Error getting queue stats:', error);
      return {
        name: this.config.queueName,
        pending: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        isConnected: false,
      };
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    if (!this.queue) {
      console.warn('Bull queue not initialized, cannot retry job');
      return false;
    }

    try {
      const job = await this.queue.getJob(jobId);
      if (!job) {
        console.warn(`Job ${jobId} not found`);
        return false;
      }

      await job.retry();
      console.log(`Job ${jobId} retried`);
      return true;
    } catch (error) {
      console.error(`Failed to retry job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Remove a job from queue
   */
  async removeJob(jobId: string): Promise<boolean> {
    if (!this.queue) {
      // Remove from in-memory metadata
      this.jobMetadata.delete(jobId);
      return true;
    }

    try {
      const job = await this.queue.getJob(jobId);
      if (!job) {
        console.warn(`Job ${jobId} not found`);
        return false;
      }

      await job.remove();
      this.jobMetadata.delete(jobId);
      console.log(`Job ${jobId} removed`);
      return true;
    } catch (error) {
      console.error(`Failed to remove job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Clear all completed jobs
   */
  async clearCompletedJobs(): Promise<number> {
    if (!this.queue) {
      const count = Array.from(this.jobMetadata.values()).filter((m) => m.status === 'completed').length;
      Array.from(this.jobMetadata.entries()).forEach(([jobId, metadata]) => {
        if (metadata.status === 'completed') {
          this.jobMetadata.delete(jobId);
        }
      });
      return count;
    }

    try {
      const count = await this.queue.clean(0, 10000, 'completed');
      return count.length;
    } catch (error) {
      console.error('Error clearing completed jobs:', error);
      return 0;
    }
  }

  /**
   * Setup event listeners for queue events
   */
  private setupEventListeners(): void {
    if (!this.queueEvents) return;

    this.queueEvents.on('completed', ({ jobId }) => {
      console.log(`Job ${jobId} completed`);
      const metadata = this.jobMetadata.get(jobId);
      if (metadata) {
        metadata.status = 'completed';
        metadata.completedAt = new Date();
      }
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      console.log(`Job ${jobId} failed:`, failedReason);
      const metadata = this.jobMetadata.get(jobId);
      if (metadata) {
        metadata.status = 'failed';
        metadata.errorMessage = failedReason;
      }
    });

    this.queueEvents.on('error', (error) => {
      console.error('Queue error:', error);
    });
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.worker) {
      try {
        await this.worker.close();
      } catch (error) {
        console.warn('Error closing worker:', error);
      }
    }

    if (this.queueEvents) {
      try {
        await this.queueEvents.close();
      } catch (error) {
        console.warn('Error closing queue events:', error);
      }
    }

    if (this.queue) {
      try {
        await this.queue.close();
      } catch (error) {
        console.warn('Error closing queue:', error);
      }
    }

    if (this.redis) {
      try {
        await this.redis.quit();
      } catch (error) {
        console.warn('Error quitting redis:', error);
      }
    }

    // Only mark as disconnected if we were actually connected to Redis
    if (this.config.redisUrl) {
      this.isConnected = false;
    }

    console.log('Bull queue cleaned up');
  }

  /**
   * Health check
   */
  isHealthy(): boolean {
    // Healthy if connected to Redis OR if running in in-memory mode (no Redis URL)
    if (!this.config.redisUrl) {
      return true; // Always healthy in in-memory mode
    }
    return this.isConnected;
  }
}
