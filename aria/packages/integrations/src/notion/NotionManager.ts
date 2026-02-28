/**
 * Notion Manager
 * Orchestrates task creation with rate limiting and retry queue
 */

import { NotionTaskService, NotionTaskCreateRequest, NotionTask } from './NotionTaskService';
import { RateLimiter } from '../clickup/RateLimiter';
import { TaskQueue } from '../clickup/TaskQueue';

export class NotionManager {
  private taskService: NotionTaskService;
  private rateLimiter: RateLimiter;
  private queue: TaskQueue;

  constructor(
    notionService: NotionTaskService,
    redisUrl?: string
  ) {
    this.taskService = notionService;
    this.rateLimiter = new RateLimiter(3, 1000); // 3 requests per second
    this.queue = new TaskQueue();

    // Initialize queue connection
    if (redisUrl) {
      this.queue.connect(redisUrl).catch((err) =>
        console.error('Failed to initialize queue:', err)
      );
    }
  }

  /**
   * Create task with rate limiting and retry queue
   */
  async createTask(request: NotionTaskCreateRequest): Promise<{
    success: boolean;
    task?: NotionTask;
    queued?: boolean;
    message: string;
  }> {
    // Check rate limit
    if (!this.rateLimiter.isAllowed()) {
      const retryAfter = this.rateLimiter.getRetryAfter();
      const queuedId = await this.queue.enqueue(request as any, 'rate_limit');

      return {
        success: false,
        queued: true,
        message: `Rate limit reached. Task queued for retry in ${Math.ceil(
          retryAfter / 1000
        )}ms. Queue ID: ${queuedId}`,
      };
    }

    // Try to create immediately
    try {
      const task = await this.taskService.createTask(request);
      return {
        success: true,
        task,
        message: `✅ Tarefa criada no Notion: ${task.title}`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Queue for retry on failure
      const queuedId = await this.queue.enqueue(request as any, errorMsg);

      return {
        success: false,
        queued: true,
        message: `Task creation failed: ${errorMsg}. Queued for retry. Queue ID: ${queuedId}`,
      };
    }
  }

  /**
   * Link task to client with rate limiting
   */
  async linkTaskToClient(
    taskId: string,
    clientId: string
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    if (!this.rateLimiter.isAllowed()) {
      return {
        success: false,
        message: 'Rate limit reached. Could not link task to client.',
      };
    }

    try {
      await this.taskService.linkTaskToClient(taskId, clientId);
      return {
        success: true,
        message: 'Task linked to client successfully.',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Failed to link task: ${errorMsg}`,
      };
    }
  }

  /**
   * Process queued tasks (should run periodically)
   */
  async processQueue(): Promise<void> {
    let nextTask = await this.queue.getNextTask();

    while (nextTask) {
      try {
        const result = await this.taskService.createTask(
          nextTask.request as NotionTaskCreateRequest
        );
        console.log(`✅ Queued task completed: ${result.title}`);
        await this.queue.complete(nextTask.id);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`❌ Queued task failed: ${errorMsg}`);

        const shouldRetry = await this.queue.updateRetry(
          nextTask.id,
          errorMsg
        );

        if (!shouldRetry) {
          console.error(
            `Task ${nextTask.id} exceeded max retries and was removed from queue`
          );
        }
      }

      nextTask = await this.queue.getNextTask();
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    queuedCount: number;
    readyCount: number;
    rateLimitRemaining: number;
  }> {
    const queueStats = await this.queue.getStats();

    return {
      queuedCount: queueStats.queuedCount,
      readyCount: queueStats.readyCount,
      rateLimitRemaining: this.rateLimiter.getRemaining(),
    };
  }

  /**
   * Validate Notion configuration
   */
  async validateConfig(): Promise<boolean> {
    return this.taskService.validateConfig();
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    await this.queue.disconnect();
  }
}
