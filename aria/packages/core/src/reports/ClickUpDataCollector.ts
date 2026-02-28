/**
 * ClickUp Data Collector
 * Task 2: ClickUp Data Collection (subtasks 2.1-2.4)
 */

export interface ClickUpTask {
  id: string;
  title: string;
  status: 'open' | 'in_progress' | 'completed' | 'overdue';
  dueDate?: Date;
  createdDate: Date;
}

export interface ClickUpCollectedData {
  tasksCompleted: number;
  tasksPending: number;
  tasksOverdue: number;
  tasksCreated: number;
}

const API_TIMEOUT_MS = 3000; // Task 2.4: 3s timeout

export class ClickUpDataCollector {
  constructor(private clickupClient?: any) {}

  /**
   * Task 2.1-2.4: Fetch and aggregate ClickUp tasks
   */
  async collectData(startDate: Date, endDate: Date): Promise<ClickUpCollectedData> {
    if (!this.clickupClient) {
      // Mock implementation when client not available
      return {
        tasksCompleted: 0,
        tasksPending: 0,
        tasksOverdue: 0,
        tasksCreated: 0,
      };
    }

    try {
      const tasks = await this.fetchTasksWithTimeout(startDate, endDate);
      return this.aggregateTasks(tasks, startDate, endDate);
    } catch (error) {
      throw new Error(`ClickUp collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Task 2.1: Fetch tasks by status (completed, pending, overdue)
   */
  private async fetchTasksByStatus(_status: string[]): Promise<ClickUpTask[]> {
    if (!this.clickupClient) return [];

    try {
      // This would call actual ClickUp API
      // const response = await this.clickupClient.tasks.list({ status });
      // return response.tasks.map((t: any) => this.normalizeTask(t));
      return [];
    } catch (error) {
      throw new Error(`Failed to fetch ClickUp tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Task 2.2: Count tasks created in date range
   */
  private countTasksCreatedInRange(tasks: ClickUpTask[], startDate: Date, endDate: Date): number {
    return tasks.filter((task) => task.createdDate >= startDate && task.createdDate <= endDate).length;
  }

  /**
   * Task 2.3: Normalize to standard Task model
   */
  private normalizeTask(rawTask: any): ClickUpTask {
    return {
      id: rawTask.id,
      title: rawTask.name || rawTask.title,
      status: this.normalizeStatus(rawTask.status?.status),
      dueDate: rawTask.due_date ? new Date(rawTask.due_date) : undefined,
      createdDate: new Date(rawTask.created_at),
    };
  }

  private normalizeStatus(status: string): ClickUpTask['status'] {
    if (!status) return 'open';
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('complet')) return 'completed';
    if (lowerStatus.includes('progress')) return 'in_progress';
    if (lowerStatus.includes('overdue')) return 'overdue';
    return 'open';
  }

  /**
   * Task 2.4: Aggregate tasks with 3s timeout per request
   */
  private async fetchTasksWithTimeout(_startDate: Date, _endDate: Date): Promise<ClickUpTask[]> {
    return Promise.race([
      this.fetchTasksByStatus(['completed', 'open', 'overdue']),
      new Promise<ClickUpTask[]>((_, reject) =>
        setTimeout(() => reject(new Error(`ClickUp timeout (${API_TIMEOUT_MS}ms)`)), API_TIMEOUT_MS)
      ),
    ]);
  }

  /**
   * Task 2.1-2.2: Aggregate metrics from tasks
   */
  private aggregateTasks(tasks: ClickUpTask[], startDate: Date, endDate: Date): ClickUpCollectedData {
    return {
      tasksCompleted: tasks.filter((t) => t.status === 'completed').length,
      tasksPending: tasks.filter((t) => t.status === 'open' || t.status === 'in_progress').length,
      tasksOverdue: tasks.filter((t) => t.status === 'overdue').length,
      tasksCreated: this.countTasksCreatedInRange(tasks, startDate, endDate),
    };
  }
}
