/**
 * Task Queue with Redis
 * Handles failed task creation with exponential retry backoff
 */

import { createClient, RedisClientType } from 'redis';
import { TaskCreateRequest } from './ClickUpTaskService';

export interface QueuedTask {
  id: string;
  request: TaskCreateRequest;
  attemptCount: number;
  nextRetryTime: number;
  createdAt: number;
  lastError?: string | undefined;
}

export class TaskQueue {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private queueKey = 'clickup:task:queue';
  private retryDelays = [5 * 60 * 1000, 10 * 60 * 1000, 15 * 60 * 1000]; // 5, 10, 15 minutes
  private maxAttempts = 3;

  constructor() {}

  async connect(redisUrl?: string): Promise<void> {
    try {
      this.client = createClient({
        url: redisUrl || 'redis://localhost:6379',
      }) as RedisClientType;

      this.client.on('error', (err: Error) =>
        console.error('Redis Client Error', err)
      );

      await this.client.connect();
      this.isConnected = true;
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      // Graceful degradation: queue operations will be no-ops
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  /**
   * Add task to queue for retry
   */
  async enqueue(request: TaskCreateRequest, error?: string): Promise<string> {
    if (!this.isConnected || !this.client) {
      console.warn('Redis not connected, skipping queue');
      return '';
    }

    const taskId = this.generateTaskId();
    const firstDelay = this.retryDelays[0] || 5 * 60 * 1000;
    const queuedTask: QueuedTask = {
      id: taskId,
      request,
      attemptCount: 0,
      nextRetryTime: Date.now() + firstDelay, // 5 minutes
      createdAt: Date.now(),
      lastError: error || undefined,
    };

    try {
      // Store task with expiration (24 hours)
      await this.client.setEx(
        `${this.queueKey}:${taskId}`,
        86400,
        JSON.stringify(queuedTask)
      );

      // Add to sorted set for retry scheduling (ordered by nextRetryTime)
      const scoreMembers = [{
        score: queuedTask.nextRetryTime,
        member: taskId,
      }];
      await (this.client.zAdd as any)(this.queueKey, scoreMembers);

      return taskId;
    } catch (error: unknown) {
      console.error('Error enqueueing task:', error);
      return '';
    }
  }

  /**
   * Get next task due for retry
   */
  async getNextTask(): Promise<QueuedTask | null> {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      // Get tasks that are ready for retry (nextRetryTime <= now)
      const taskIds = (await (this.client.zRangeByScore as any)(
        this.queueKey,
        0,
        Date.now()
      )) as string[] | null;

      if (!taskIds || taskIds.length === 0) {
        return null;
      }

      const taskId = taskIds[0];
      if (!taskId) {
        return null;
      }

      const taskData = await this.client.get(
        `${this.queueKey}:${taskId}`
      );

      if (!taskData) {
        // Task was deleted, remove from sorted set
        await (this.client.zRem as any)(this.queueKey, [taskId]);
        return null;
      }

      return JSON.parse(taskData) as QueuedTask;
    } catch (error: unknown) {
      console.error('Error getting next task:', error);
      return null;
    }
  }

  /**
   * Update task attempt and reschedule
   */
  async updateRetry(
    taskId: string,
    error?: string
  ): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const taskData = await this.client.get(
        `${this.queueKey}:${taskId}`
      );
      if (!taskData) {
        return false;
      }

      const task: QueuedTask = JSON.parse(taskData);
      task.attemptCount++;
      task.lastError = error || undefined;

      if (task.attemptCount >= this.maxAttempts) {
        // Max attempts reached, remove from queue
        await this.client.del(`${this.queueKey}:${taskId}`);
        await (this.client.zRem as any)(this.queueKey, [taskId]);
        return false;
      }

      // Schedule next retry
      const delayIndex = Math.min(
        task.attemptCount - 1,
        this.retryDelays.length - 1
      );
      const delay = this.retryDelays[delayIndex] || 15 * 60 * 1000;
      task.nextRetryTime = Date.now() + delay;

      // Update in Redis
      await this.client.setEx(
        `${this.queueKey}:${taskId}`,
        86400,
        JSON.stringify(task)
      );

      // Update score in sorted set
      const scoreMembers = [{
        score: task.nextRetryTime,
        member: taskId,
      }];
      await (this.client.zAdd as any)(this.queueKey, scoreMembers);

      return true;
    } catch (error: unknown) {
      console.error('Error updating retry:', error);
      return false;
    }
  }

  /**
   * Mark task as complete and remove from queue
   */
  async complete(taskId: string): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      await this.client.del(`${this.queueKey}:${taskId}`);
      await (this.client.zRem as any)(this.queueKey, [taskId]);
    } catch (error) {
      console.error('Error completing task:', error);
    }
  }

  /**
   * Get queue stats
   */
  async getStats(): Promise<{
    queuedCount: number;
    readyCount: number;
  }> {
    if (!this.isConnected || !this.client) {
      return { queuedCount: 0, readyCount: 0 };
    }

    try {
      const queuedCount = await (this.client.zCard as any)(this.queueKey);
      const readyCount = await (this.client.zCount as any)(
        this.queueKey,
        0,
        Date.now()
      );

      return { queuedCount, readyCount };
    } catch (error) {
      console.error('Error getting stats:', error);
      return { queuedCount: 0, readyCount: 0 };
    }
  }

  private generateTaskId(): string {
    return `clickup-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }
}
