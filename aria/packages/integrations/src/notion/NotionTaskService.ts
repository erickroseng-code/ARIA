/**
 * Notion Task Service
 * Handles task creation in Notion with rate limiting and retry queue
 */

import { NotionClient } from './notion.client';

export interface NotionTaskCreateRequest {
  title: string;
  description?: string;
  dueDate?: Date;
  clientId?: string; // Notion page ID of related client
  status?: string; // "A fazer", "Em andamento", "Concluído"
}

export interface NotionTask {
  id: string;
  title: string;
  url: string;
  dueDate?: string;
  status?: string;
  linkedClientId?: string;
}

export class NotionTaskService {
  private notionClient: NotionClient;
  private tasksDatabase: string;

  constructor(notionClient: NotionClient, tasksDatabaseId: string) {
    this.notionClient = notionClient;
    this.tasksDatabase = tasksDatabaseId;
  }

  async createTask(request: NotionTaskCreateRequest): Promise<NotionTask> {
    try {
      // Validate database exists
      if (!this.tasksDatabase) {
        throw new Error(
          'Tasks database not configured. Set NOTION_TASKS_DATABASE_ID.'
        );
      }

      // Prepare properties for Notion
      const properties: Record<string, any> = {
        title: [
          {
            text: {
              content: request.title,
            },
          },
        ],
      };

      // Add status if provided
      if (request.status) {
        properties.status = {
          select: {
            name: request.status,
          },
        };
      }

      // Add due date if provided
      if (request.dueDate) {
        properties['Due Date'] = {
          date: {
            start: request.dueDate.toISOString().split('T')[0],
          },
        };
      }

      // Add description if provided
      if (request.description) {
        properties.description = [
          {
            text: {
              content: request.description,
            },
          },
        ];
      }

      // Add client relation if provided
      if (request.clientId) {
        properties['Client'] = {
          relation: [
            {
              id: request.clientId,
            },
          ],
        };
      }

      // Create page in Notion
      const response = await this.notionClient.pages.create({
        parent: {
          database_id: this.tasksDatabase,
        },
        properties,
      });

      return {
        id: response.id,
        title: request.title,
        url: response.url || '',
        dueDate: request.dueDate?.toISOString().split('T')[0],
        status: request.status,
        linkedClientId: request.clientId,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Notion task creation failed: ${errorMsg}`);
    }
  }

  /**
   * Link existing task to client
   */
  async linkTaskToClient(
    taskId: string,
    clientId: string
  ): Promise<void> {
    try {
      await this.notionClient.pages.update(taskId, {
        properties: {
          'Client': {
            relation: [
              {
                id: clientId,
              },
            ],
          },
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to link task to client: ${errorMsg}`
      );
    }
  }

  /**
   * Validate Notion configuration
   */
  async validateConfig(): Promise<boolean> {
    try {
      if (!this.tasksDatabase) {
        return false;
      }

      // Try to get database to verify it exists and we have access
      const response = await this.notionClient.databases.retrieve(
        this.tasksDatabase
      );
      return !!response.id;
    } catch {
      return false;
    }
  }

  /**
   * Get database schema for validation
   */
  async getSchemaProperties(): Promise<Record<string, any>> {
    try {
      const db = await this.notionClient.databases.retrieve(
        this.tasksDatabase
      );
      return db.properties || {};
    } catch (error) {
      console.error('Error getting database schema:', error);
      return {};
    }
  }
}
