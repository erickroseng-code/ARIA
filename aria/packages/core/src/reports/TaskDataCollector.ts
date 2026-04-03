/**
 * Task Data Collector
 */

export interface TaskRecord {
  id: string;
  title: string;
  status: 'open' | 'in_progress' | 'completed' | 'overdue';
  dueDate?: Date;
  createdDate: Date;
}

export interface TaskCollectedData {
  tasksCompleted: number;
  tasksPending: number;
  tasksOverdue: number;
  tasksCreated: number;
}

const API_TIMEOUT_MS = 3000;

export class TaskDataCollector {
  constructor(private taskClient?: any) {}

  async collectData(startDate: Date, endDate: Date): Promise<TaskCollectedData> {
    if (!this.taskClient) {
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
      throw new Error(`Task collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async fetchTasksByStatus(_status: string[]): Promise<TaskRecord[]> {
    if (!this.taskClient) return [];

    try {
      return [];
    } catch (error) {
      throw new Error(`Failed to fetch task data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private countTasksCreatedInRange(tasks: TaskRecord[], startDate: Date, endDate: Date): number {
    return tasks.filter((task) => task.createdDate >= startDate && task.createdDate <= endDate).length;
  }

  private normalizeTask(rawTask: any): TaskRecord {
    return {
      id: rawTask.id,
      title: rawTask.name || rawTask.title,
      status: this.normalizeStatus(rawTask.status?.status),
      dueDate: rawTask.due_date ? new Date(rawTask.due_date) : undefined,
      createdDate: new Date(rawTask.created_at),
    };
  }

  private normalizeStatus(status: string): TaskRecord['status'] {
    if (!status) return 'open';
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('complet')) return 'completed';
    if (lowerStatus.includes('progress')) return 'in_progress';
    if (lowerStatus.includes('overdue')) return 'overdue';
    return 'open';
  }

  private async fetchTasksWithTimeout(_startDate: Date, _endDate: Date): Promise<TaskRecord[]> {
    return Promise.race([
      this.fetchTasksByStatus(['completed', 'open', 'overdue']),
      new Promise<TaskRecord[]>((_, reject) =>
        setTimeout(() => reject(new Error(`Task data timeout (${API_TIMEOUT_MS}ms)`)), API_TIMEOUT_MS)
      ),
    ]);
  }

  private aggregateTasks(tasks: TaskRecord[], startDate: Date, endDate: Date): TaskCollectedData {
    return {
      tasksCompleted: tasks.filter((t) => t.status === 'completed').length,
      tasksPending: tasks.filter((t) => t.status === 'open' || t.status === 'in_progress').length,
      tasksOverdue: tasks.filter((t) => t.status === 'overdue').length,
      tasksCreated: this.countTasksCreatedInRange(tasks, startDate, endDate),
    };
  }
}
