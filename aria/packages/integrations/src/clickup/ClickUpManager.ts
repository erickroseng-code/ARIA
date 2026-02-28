/**
 * ClickUp Manager
 * Orchestrates task creation with rate limiting and retry queue
 */

import { ClickUpTaskService, TaskCreateRequest, Task } from './ClickUpTaskService';
import { RateLimiter } from './RateLimiter';
import { TaskQueue } from './TaskQueue';

export class ClickUpManager {
  private taskService: ClickUpTaskService;
  private rateLimiter: RateLimiter;
  private queue: TaskQueue;

  constructor(
    apiKey: string,
    defaultListId: string,
    redisUrl?: string
  ) {
    this.taskService = new ClickUpTaskService(apiKey, defaultListId);
    this.rateLimiter = new RateLimiter(30, 60000); // 30 req/min
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
  async createTask(request: TaskCreateRequest): Promise<{
    success: boolean;
    task?: Task;
    queued?: boolean;
    message: string;
  }> {
    // Check rate limit
    if (!this.rateLimiter.isAllowed()) {
      const retryAfter = this.rateLimiter.getRetryAfter();
      const queuedId = await this.queue.enqueue(
        request,
        'rate_limit'
      );

      return {
        success: false,
        queued: true,
        message: `Rate limit reached. Task queued for retry in ${Math.ceil(
          retryAfter / 1000
        )}s. Queue ID: ${queuedId}`,
      };
    }

    // Try to create immediately
    try {
      const task = await this.taskService.createTask(request);
      return {
        success: true,
        task,
        message: `✅ Tarefa criada com sucesso: ${task.title}`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Queue for retry on failure
      const queuedId = await this.queue.enqueue(request, errorMsg);

      return {
        success: false,
        queued: true,
        message: `Task creation failed: ${errorMsg}. Queued for retry. Queue ID: ${queuedId}`,
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
        const result = await this.taskService.createTask(nextTask.request);
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
   * Validate ClickUp configuration
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
