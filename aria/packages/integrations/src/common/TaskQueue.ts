/**
 * Generic retry queue with Redis backend.
 */

import { createClient, RedisClientType } from 'redis';

export interface QueuedTask {
  id: string;
  request: unknown;
  attemptCount: number;
  nextRetryTime: number;
  createdAt: number;
  lastError?: string | undefined;
}

export class TaskQueue {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private queueKey = 'tasks:queue';
  private retryDelays = [5 * 60 * 1000, 10 * 60 * 1000, 15 * 60 * 1000];
  private maxAttempts = 3;

  async connect(redisUrl?: string): Promise<void> {
    try {
      this.client = createClient({
        url: redisUrl || 'redis://localhost:6379',
      }) as RedisClientType;

      this.client.on('error', (err: Error) => console.error('Redis Client Error', err));

      await this.client.connect();
      this.isConnected = true;
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  async enqueue(request: unknown, error?: string): Promise<string> {
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
      nextRetryTime: Date.now() + firstDelay,
      createdAt: Date.now(),
      lastError: error || undefined,
    };

    try {
      await this.client.setEx(`${this.queueKey}:${taskId}`, 86400, JSON.stringify(queuedTask));
      const scoreMembers = [{ score: queuedTask.nextRetryTime, member: taskId }];
      await (this.client.zAdd as any)(this.queueKey, scoreMembers);
      return taskId;
    } catch (err) {
      console.error('Error enqueueing task:', err);
      return '';
    }
  }

  async getNextTask(): Promise<QueuedTask | null> {
    if (!this.isConnected || !this.client) {
      return null;
    }

    try {
      const taskIds = (await (this.client.zRangeByScore as any)(this.queueKey, 0, Date.now())) as
        | string[]
        | null;

      if (!taskIds || taskIds.length === 0) {
        return null;
      }

      const taskId = taskIds[0];
      if (!taskId) {
        return null;
      }

      const taskData = await this.client.get(`${this.queueKey}:${taskId}`);
      if (!taskData) {
        await (this.client.zRem as any)(this.queueKey, [taskId]);
        return null;
      }

      return JSON.parse(taskData) as QueuedTask;
    } catch (err) {
      console.error('Error getting next task:', err);
      return null;
    }
  }

  async updateRetry(taskId: string, error?: string): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const taskData = await this.client.get(`${this.queueKey}:${taskId}`);
      if (!taskData) {
        return false;
      }

      const task: QueuedTask = JSON.parse(taskData);
      task.attemptCount++;
      task.lastError = error || undefined;

      if (task.attemptCount >= this.maxAttempts) {
        await this.client.del(`${this.queueKey}:${taskId}`);
        await (this.client.zRem as any)(this.queueKey, [taskId]);
        return false;
      }

      const delayIndex = Math.min(task.attemptCount - 1, this.retryDelays.length - 1);
      const delay = this.retryDelays[delayIndex] || 15 * 60 * 1000;
      task.nextRetryTime = Date.now() + delay;

      await this.client.setEx(`${this.queueKey}:${taskId}`, 86400, JSON.stringify(task));
      const scoreMembers = [{ score: task.nextRetryTime, member: taskId }];
      await (this.client.zAdd as any)(this.queueKey, scoreMembers);
      return true;
    } catch (err) {
      console.error('Error updating retry:', err);
      return false;
    }
  }

  async complete(taskId: string): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      await this.client.del(`${this.queueKey}:${taskId}`);
      await (this.client.zRem as any)(this.queueKey, [taskId]);
    } catch (err) {
      console.error('Error completing task:', err);
    }
  }

  async getStats(): Promise<{ queuedCount: number; readyCount: number }> {
    if (!this.isConnected || !this.client) {
      return { queuedCount: 0, readyCount: 0 };
    }

    try {
      const queuedCount = await (this.client.zCard as any)(this.queueKey);
      const readyCount = await (this.client.zCount as any)(this.queueKey, 0, Date.now());
      return { queuedCount, readyCount };
    } catch (err) {
      console.error('Error getting stats:', err);
      return { queuedCount: 0, readyCount: 0 };
    }
  }

  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
