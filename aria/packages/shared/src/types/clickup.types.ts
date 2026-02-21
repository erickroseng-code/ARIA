/**
 * ClickUp API v2 Types
 * Used by packages/integrations/src/clickup/ClickUpClient
 * and packages/core/src/services/TaskService
 */

export interface CreateTaskParams {
  name: string;
  description?: string;
  due_date?: number; // Unix milliseconds
  priority?: 1 | 2 | 3 | 4;
  status?: string;
}

export interface ClickUpTask {
  id: string;
  name: string;
  url: string;
  status: {
    status: string;
    color: string;
  };
  priority: {
    id: string;
    priority: string;
    color: string;
  } | null;
  due_date: string | null; // Unix ms as string
  list: {
    id: string;
    name: string;
  };
}

export interface ClickUpList {
  id: string;
  name: string;
  space: {
    id: string;
    name: string;
  };
}

export type TaskPriority = 'urgent' | 'high' | 'normal' | 'low';

export const PRIORITY_MAP: Record<TaskPriority, 1 | 2 | 3 | 4> = {
  urgent: 1,
  high: 2,
  normal: 3,
  low: 4,
};

export const PRIORITY_LABELS_PT: Record<number, string> = {
  1: 'urgente',
  2: 'alta',
  3: 'normal',
  4: 'baixa',
};

export type TaskDestination = 'clickup' | 'notion' | 'both' | null;

export interface TaskCreationInput {
  title: string;
  description?: string;
  dueDateMs?: number;
  priority?: TaskPriority;
  listName?: string;
  destination?: TaskDestination;
}

export interface TaskCreationResult {
  task: ClickUpTask;
  confirmationMessage: string;
}

// For API response
export interface CreateTaskResponse {
  task: ClickUpTask;
  message: string;
}
