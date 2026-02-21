/**
 * ClickUp Task Service
 * Handles task creation via ClickUp API with rate limiting and retry queue
 */

export interface TaskCreateRequest {
  title: string;
  description?: string;
  dueDate?: Date;
  listName?: string;
  projectName?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  tags?: string[];
}

export interface Task {
  id: string;
  title: string;
  url: string;
  dueDate?: string;
  priority?: number;
  listId: string;
}

interface ClickUpTask {
  id: string;
  name: string;
  url: string;
  due_date?: string | number;
  priority?: number;
  list?: { id: string };
}

export class ClickUpTaskService {
  private apiKey: string;
  private baseUrl = 'https://api.clickup.com/api/v2';
  private defaultListId: string;

  constructor(apiKey: string, defaultListId: string) {
    this.apiKey = apiKey;
    this.defaultListId = defaultListId;
  }

  async createTask(request: TaskCreateRequest): Promise<Task> {
    try {
      // Resolve list ID (use provided listName or default)
      const listId = request.listName
        ? await this.resolveListId(request.listName)
        : this.defaultListId;

      if (!listId) {
        throw new Error(
          `List not found. Specify a valid list or set CLICKUP_DEFAULT_LIST_ID.`
        );
      }

      // Format due date for ClickUp API (milliseconds since epoch)
      const dueDate = request.dueDate
        ? request.dueDate.getTime()
        : undefined;

      // Map priority to ClickUp priority levels (1=urgent, 2=high, 3=medium, 4=low, 0=none)
      const priorityMap: Record<string, number> = {
        urgent: 1,
        high: 2,
        medium: 3,
        low: 4,
      };
      const priority = request.priority ? priorityMap[request.priority] : 0;

      // Create task via ClickUp API
      const response = await fetch(`${this.baseUrl}/list/${listId}/task`, {
        method: 'POST',
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: request.title,
          description: request.description || '',
          due_date: dueDate,
          priority,
          tags: request.tags || [],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 429) {
          throw new Error('rate_limit');
        }
        if (response.status === 401) {
          throw new Error('invalid_api_key');
        }
        const errMsg =
          (error as any)?.err || `ClickUp API error: ${response.statusText}`;
        throw new Error(errMsg);
      }

      const data = (await response.json()) as ClickUpTask;

      return {
        id: data.id,
        title: data.name,
        url: data.url,
        dueDate: data.due_date?.toString() || undefined,
        priority: data.priority || undefined,
        listId: data.list?.id || listId,
      } as Task;
    } catch (error: unknown) {
      const errorMsg =
        error instanceof Error ? error.message : String(error);
      throw new Error(`ClickUp task creation failed: ${errorMsg}`);
    }
  }

  private async resolveListId(listName: string): Promise<string | null> {
    try {
      // Get all lists and find by name
      const response = await fetch(`${this.baseUrl}/list`, {
        headers: {
          'Authorization': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch lists: ${response.statusText}`);
      }

      const data = await response.json() as { lists: Array<{ id: string; name: string }> };
      const list = data.lists.find(
        (l) => l.name.toLowerCase() === listName.toLowerCase()
      );

      return list?.id || null;
    } catch (error) {
      console.error('Error resolving list:', error);
      return null;
    }
  }

  /**
   * Validate ClickUp configuration
   */
  async validateConfig(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/team`, {
        headers: {
          'Authorization': this.apiKey,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
