/**
 * ClickUp REST API v2 Client
 * Handles task creation, list management, and error handling
 *
 * CRITICAL: ClickUp uses Authorization header WITHOUT "Bearer" prefix
 * Example: Authorization: pk_12345... (not "Bearer pk_12345...")
 */

import type { CreateTaskParams, ClickUpTask, ClickUpList } from '@aria/shared';
import { IntegrationError } from '../errors';

export class ClickUpClient {
  private readonly BASE = 'https://api.clickup.com/api/v2';

  constructor(
    private readonly apiKey: string,
    private readonly defaultListId: string,
  ) { }

  /**
   * Generic request method with retry logic and exponential backoff
   * Retries on network errors or 5xx server errors (not on 4xx client errors)
   */
  private async request<T>(
    path: string,
    options?: RequestInit,
  ): Promise<T> {
    const url = `${this.BASE}${path}`;
    const maxRetries = 3;
    const initialBackoffMs = 500;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log('[ClickUpClient.request] Making request to:', url.split('?')[0], '| method:', options?.method ?? 'GET', `| attempt ${attempt + 1}/${maxRetries}`);

        const response = await fetch(url, {
          ...options,
          headers: {
            'Authorization': this.apiKey, // NO "Bearer" prefix for ClickUp
            'Content-Type': 'application/json',
            ...options?.headers,
          },
        });

        console.log('[ClickUpClient.request] Response status:', response.status);

        if (!response.ok) {
          let errorMessage = `ClickUp API error ${response.status}`;
          try {
            const body = (await response.json()) as { err?: string };
            if (body.err) {
              errorMessage = body.err;
            }
          } catch {
            // If JSON parsing fails, use default message
          }

          console.error('[ClickUpClient.request] Error response:', errorMessage);

          // 4xx errors are client errors - don't retry
          if (response.status >= 400 && response.status < 500) {
            throw new IntegrationError(
              errorMessage,
              'CLICKUP_001',
              { statusCode: response.status },
            );
          }

          // 5xx errors - retry with backoff
          if (attempt < maxRetries - 1) {
            const backoffMs = initialBackoffMs * Math.pow(2, attempt);
            console.warn(`[ClickUpClient.request] Server error, retrying in ${backoffMs}ms...`);
            await this.delay(backoffMs);
            continue;
          }

          throw new IntegrationError(
            errorMessage,
            'CLICKUP_001',
            { statusCode: response.status },
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        // Network errors - retry with backoff
        if (!(error instanceof IntegrationError) && attempt < maxRetries - 1) {
          const backoffMs = initialBackoffMs * Math.pow(2, attempt);
          console.warn(`[ClickUpClient.request] Network error, retrying in ${backoffMs}ms:`, error instanceof Error ? error.message : 'Unknown error');
          await this.delay(backoffMs);
          continue;
        }

        if (error instanceof IntegrationError) {
          throw error;
        }

        console.error('[ClickUpClient.request] Request failed:', error);
        throw new IntegrationError(
          `ClickUp API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'CLICKUP_001',
          { statusCode: 500 },
        );
      }
    }

    throw new IntegrationError(
      'Max retries exceeded',
      'CLICKUP_001',
      { statusCode: 503 },
    );
  }

  /**
   * Helper: delay for retry backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a new task in specified list
   * IMPORTANT: due_date must be Unix milliseconds, not seconds
   */
  async createTask(
    listId: string,
    params: CreateTaskParams,
  ): Promise<ClickUpTask> {
    const body = {
      name: params.name,
      description: params.description,
      due_date: params.due_date, // Unix ms
      due_date_time: false, // Date only, no time
      priority: params.priority ?? 3, // Default: normal
      status: params.status ?? 'to do',
    };

    return this.request<ClickUpTask>(`/list/${listId}/task`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Find a list by name (case-insensitive substring match)
   * Returns first match or null if not found
   */
  async findListByName(
    teamId: string,
    name: string,
  ): Promise<ClickUpList | null> {
    try {
      const response = await this.request<{ lists: ClickUpList[] }>(
        `/team/${teamId}/list`,
      );

      const searchTerm = name.toLowerCase();
      const match = response.lists.find((list) =>
        list.name.toLowerCase().includes(searchTerm),
      );

      return match ?? null;
    } catch (error) {
      console.error(`Error finding list "${name}":`, error);
      return null;
    }
  }

  /**
   * Get list details for validation
   */
  async getList(listId: string): Promise<ClickUpList> {
    return this.request<ClickUpList>(`/list/${listId}`);
  }

  /**
   * Get the default list ID configured for this client
   */
  getDefaultListId(): string {
    return this.defaultListId;
  }

  /**
   * Get all tasks in a list (optionally filtering by status)
   */
  async getTasksByList(
    listId: string,
    options?: { includeSubtasks?: boolean; page?: number }
  ): Promise<ClickUpTask[]> {
    console.log('[ClickUpClient.getTasksByList] Fetching tasks from list:', listId);
    const params = new URLSearchParams({
      include_closed: 'false',
      subtasks: options?.includeSubtasks ? 'true' : 'false',
      page: String(options?.page ?? 0),
    });
    const data = await this.request<{ tasks: ClickUpTask[] }>(
      `/list/${listId}/task?${params}`
    );
    console.log('[ClickUpClient.getTasksByList] Got', data.tasks?.length ?? 0, 'tasks');
    return data.tasks ?? [];
  }

  /**
   * Get immediate subtasks of a task
   */
  async getSubtasks(taskId: string): Promise<ClickUpTask[]> {
    const data = await this.request<{ tasks: ClickUpTask[] }>(
      `/task/${taskId}/subtask?include_closed=false`
    );
    return data.tasks ?? [];
  }

  /**
   * Update the status of a task
   */
  async updateTaskStatus(taskId: string, status: string): Promise<ClickUpTask> {
    return this.request<ClickUpTask>(`/task/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  /**
   * Get tasks assigned to a specific user in a team
   */
  async getTasksByAssignee(
    teamId: string,
    assigneeId: number,
    options?: { includeSubtasks?: boolean }
  ): Promise<ClickUpTask[]> {
    console.log('[ClickUpClient.getTasksByAssignee] Fetching tasks for teamId:', teamId, 'assigneeId:', assigneeId);
    const params = new URLSearchParams({
      'assignees[]': String(assigneeId),
      include_closed: 'false',
      subtasks: options?.includeSubtasks ? 'true' : 'false',
    });
    const data = await this.request<{ tasks: ClickUpTask[] }>(
      `/team/${teamId}/task?${params}`
    );
    console.log('[ClickUpClient.getTasksByAssignee] Got', data.tasks?.length ?? 0, 'tasks');
    return data.tasks ?? [];
  }
}

// Singleton instance
let clickupClient: ClickUpClient | null = null;

export function initializeClickUpClient(
  apiKey: string,
  defaultListId: string,
): ClickUpClient {
  if (!clickupClient) {
    clickupClient = new ClickUpClient(apiKey, defaultListId);
  }
  return clickupClient;
}

export function getClickUpClient(): ClickUpClient {
  if (!clickupClient) {
    throw new Error('ClickUpClient not initialized. Call initializeClickUpClient first.');
  }
  return clickupClient;
}
