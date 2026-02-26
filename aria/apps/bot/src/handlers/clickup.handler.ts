/**
 * ClickUp Task Creation Handler
 * Handles task creation via ClickUp API for Telegram users
 */

import { ClickUpManager } from '@aria/integrations';
import { env } from '../config/env';
import { contextStore } from '@aria/core';

let clickUpManager: ClickUpManager | null = null;

/**
 * Initialize ClickUp manager (lazy load)
 */
function getClickUpManager(): ClickUpManager | null {
  const apiKey = (env as any).CLICKUP_API_TOKEN || (env as any).CLICKUP_API_KEY;
  const listId = (env as any).CLICKUP_DEFAULT_LIST_ID || (env as any).CLICKUP_ID_LIST;

  if (!apiKey || !listId) {
    return null;
  }

  if (!clickUpManager) {
    clickUpManager = new ClickUpManager(
      apiKey,
      listId,
      env.REDIS_URL
    );
  }

  return clickUpManager;
}

/**
 * Create task via ClickUp
 */
export async function createClickUpTask(
  title: string,
  description?: string,
  dueDate?: Date,
  priority?: 'low' | 'medium' | 'high' | 'urgent',
  listName?: string,
  sessionId?: string
) {
  const manager = getClickUpManager();

  if (!manager) {
    return {
      success: false,
      message: '❌ ClickUp not configured. Please set CLICKUP_API_KEY and CLICKUP_DEFAULT_LIST_ID.',
    };
  }

  try {
    const taskRequest: any = {
      title,
    };

    if (description) taskRequest.description = description;
    if (dueDate) taskRequest.dueDate = dueDate;
    if (priority) taskRequest.priority = priority;
    if (listName) taskRequest.listName = listName;

    const result = await manager.createTask(taskRequest);

    // Log to context if session exists
    if (sessionId) {
      const context = await contextStore.get(sessionId);
      if (context && !('lastAction' in context)) {
        // Store action log as custom property (ignore TypeScript)
        (context as any).lastAction = {
          timestamp: new Date(),
          action: 'clickup_task_create',
          status: result.success ? 'success' : 'queued',
          details: result.message,
        };
      }
    }

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      queued: false,
      message: `❌ Error creating task: ${errorMsg}`,
    };
  }
}

/**
 * Process queued tasks (should run periodically, e.g., every 5 minutes)
 */
export async function processClickUpQueue(): Promise<void> {
  const manager = getClickUpManager();

  if (!manager) {
    return;
  }

  try {
    await manager.processQueue();
  } catch (error) {
    console.error('Error processing ClickUp queue:', error);
  }
}

/**
 * Get queue statistics
 */
export async function getClickUpQueueStats(): Promise<{
  queuedCount: number;
  readyCount: number;
  rateLimitRemaining: number;
} | null> {
  const manager = getClickUpManager();

  if (!manager) {
    return null;
  }

  return manager.getQueueStats();
}

/**
 * Cleanup on shutdown
 */
export async function shutdownClickUp(): Promise<void> {
  if (clickUpManager) {
    await clickUpManager.shutdown();
    clickUpManager = null;
  }
}
