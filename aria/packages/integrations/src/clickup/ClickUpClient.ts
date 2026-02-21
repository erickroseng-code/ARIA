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
  ) {}

  /**
   * Generic request method with error handling
   */
  private async request<T>(
    path: string,
    options?: RequestInit,
  ): Promise<T> {
    const url = `${this.BASE}${path}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': this.apiKey, // NO "Bearer" prefix for ClickUp
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

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

        throw new IntegrationError(
          errorMessage,
          'CLICKUP_001',
          { statusCode: response.status },
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof IntegrationError) {
        throw error;
      }

      throw new IntegrationError(
        `ClickUp API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CLICKUP_001',
        { statusCode: 500 },
      );
    }
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
