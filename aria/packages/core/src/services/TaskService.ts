import type { CreateTaskParams, ClickUpTask } from '@aria/shared';
import { ClickUpClient } from '@aria/integrations';
import type { SessionContext } from '../chat/ContextStore';

export interface TaskCreationContext {
  sessionContext: SessionContext;
  userId: string;
}

export interface CreateClickUpTaskParams extends CreateTaskParams {
  listName?: string; // Optional: if provided, will resolve to listId instead of using default
}

export class TaskService {
  constructor(
    private readonly clickUpClient: ClickUpClient,
    private readonly defaultTeamId: string,
  ) {}

  /**
   * Create a task in ClickUp with contextual information
   * - Resolves list name to ID if provided, otherwise uses default list
   * - Enriches description with client context if available
   * - Returns formatted confirmation message with pt-BR date
   */
  async createClickUpTask(
    params: CreateClickUpTaskParams,
    context: TaskCreationContext,
  ): Promise<{
    task: ClickUpTask;
    confirmationMessage: string;
  }> {
    // 1. Resolve list ID
    let listId = this.clickUpClient.getDefaultListId();

    if (params.listName) {
      try {
        const foundList = await this.clickUpClient.findListByName(
          this.defaultTeamId,
          params.listName,
        );
        if (foundList) {
          listId = foundList.id;
        }
      } catch (error) {
        console.warn(`Could not find list "${params.listName}", using default list`, error);
      }
    }

    // 2. Enrich description with client context
    let enrichedDescription = params.description || '';

    if (context.sessionContext.activeClientId) {
      const clientContext = `\n\n---\n**Cliente:** ${context.sessionContext.activeClientId}`;
      enrichedDescription = enrichedDescription ? enrichedDescription + clientContext : clientContext;
    }

    // 3. Create task with enriched parameters
    const task = await this.clickUpClient.createTask(listId, {
      ...params,
      description: enrichedDescription,
    });

    // 4. Format confirmation message with pt-BR date
    const confirmationMessage = this.formatTaskConfirmation(task);

    return {
      task,
      confirmationMessage,
    };
  }

  /**
   * Format task confirmation message in Portuguese (Brazil)
   */
  private formatTaskConfirmation(task: ClickUpTask): string {
    const taskName = task.name;
    const taskUrl = task.url;
    const listName = task.list.name;

    const dateStr = task.due_date
      ? this.formatDatePtBR(new Date(parseInt(task.due_date, 10)))
      : 'Sem prazo';

    return `✅ Tarefa criada com sucesso!\n\n📋 **${taskName}**\nLista: ${listName}\nPrazo: ${dateStr}\nLink: ${taskUrl}`;
  }

  /**
   * Format date in DD/MM/YYYY format for Portuguese (Brazil)
   */
  private formatDatePtBR(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
}
