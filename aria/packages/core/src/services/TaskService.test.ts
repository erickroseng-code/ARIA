import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskService } from './TaskService';
import type { SessionContext } from '../chat/ContextStore';
import type { ClickUpTask } from '@aria/shared';

// Mock ClickUpClient
const mockClickUpClient = {
  createTask: vi.fn(),
  findListByName: vi.fn(),
  getDefaultListId: vi.fn(),
  getList: vi.fn(),
};

describe('TaskService', () => {
  let taskService: TaskService;
  const defaultTeamId = 'team_123';
  const defaultListId = 'list_default_456';

  beforeEach(() => {
    mockClickUpClient.getDefaultListId.mockReturnValue(defaultListId);
    taskService = new TaskService(mockClickUpClient as any, defaultTeamId);
    vi.clearAllMocks();
  });

  describe('createClickUpTask', () => {
    it('should create task with default list when no listName provided', async () => {
      const mockTask: ClickUpTask = {
        id: 'task_789',
        name: 'Implementar API',
        url: 'https://app.clickup.com/t/task_789',
        status: { status: 'to do', color: 'blue' },
        priority: { id: '1', priority: 'urgent', color: 'red' },
        due_date: '1740700800000', // Unix ms
        list: { id: defaultListId, name: 'Backlog' },
      };

      mockClickUpClient.createTask.mockResolvedValue(mockTask);

      const context: SessionContext = {
        sessionId: 'session_123',
        history: [],
      };

      const result = await taskService.createClickUpTask(
        {
          name: 'Implementar API',
          priority: 1,
          due_date: 1740700800000,
        },
        {
          sessionContext: context,
          userId: 'user_123',
        },
      );

      expect(mockClickUpClient.createTask).toHaveBeenCalledOnce();
      expect(mockClickUpClient.createTask).toHaveBeenCalledWith(defaultListId, {
        name: 'Implementar API',
        priority: 1,
        due_date: 1740700800000,
        description: '',
      });

      expect(result.task).toEqual(mockTask);
      expect(result.confirmationMessage).toContain('✅ Tarefa criada');
      expect(result.confirmationMessage).toContain('Implementar API');
    });

    it('should resolve list by name if provided', async () => {
      const mockTask: ClickUpTask = {
        id: 'task_789',
        name: 'Teste',
        url: 'https://app.clickup.com/t/task_789',
        status: { status: 'to do', color: 'blue' },
        priority: null,
        due_date: null,
        list: { id: 'list_custom_789', name: 'Marketing' },
      };

      mockClickUpClient.findListByName.mockResolvedValue({
        id: 'list_custom_789',
        name: 'Marketing',
        space: { id: 'space_1', name: 'Work' },
      });

      mockClickUpClient.createTask.mockResolvedValue(mockTask);

      const context: SessionContext = {
        sessionId: 'session_123',
        history: [],
      };

      const result = await taskService.createClickUpTask(
        {
          name: 'Teste',
          listName: 'marketing',
        },
        {
          sessionContext: context,
          userId: 'user_123',
        },
      );

      expect(mockClickUpClient.findListByName).toHaveBeenCalledWith(defaultTeamId, 'marketing');
      expect(mockClickUpClient.createTask).toHaveBeenCalledWith('list_custom_789', {
        name: 'Teste',
        listName: 'marketing',
        description: '',
      });

      expect(result.task).toEqual(mockTask);
    });

    it('should enrich description with client context if activeClientId present', async () => {
      const mockTask: ClickUpTask = {
        id: 'task_789',
        name: 'Tarefa com contexto',
        url: 'https://app.clickup.com/t/task_789',
        status: { status: 'to do', color: 'blue' },
        priority: null,
        due_date: null,
        list: { id: defaultListId, name: 'Backlog' },
      };

      mockClickUpClient.createTask.mockResolvedValue(mockTask);

      const context: SessionContext = {
        sessionId: 'session_123',
        history: [],
        activeClientId: 'client_456',
      };

      const result = await taskService.createClickUpTask(
        {
          name: 'Tarefa com contexto',
          description: 'Descrição original',
        },
        {
          sessionContext: context,
          userId: 'user_123',
        },
      );

      // Verify description was enriched
      const callArgs = mockClickUpClient.createTask.mock.calls[0];
      const enrichedParams = callArgs[1];
      expect(enrichedParams.description).toContain('Descrição original');
      expect(enrichedParams.description).toContain('client_456');

      expect(result.confirmationMessage).toContain('✅ Tarefa criada');
    });

    it('should handle missing description gracefully', async () => {
      const mockTask: ClickUpTask = {
        id: 'task_789',
        name: 'Sem descrição',
        url: 'https://app.clickup.com/t/task_789',
        status: { status: 'to do', color: 'blue' },
        priority: null,
        due_date: null,
        list: { id: defaultListId, name: 'Backlog' },
      };

      mockClickUpClient.createTask.mockResolvedValue(mockTask);

      const context: SessionContext = {
        sessionId: 'session_123',
        history: [],
        activeClientId: 'client_456',
      };

      const result = await taskService.createClickUpTask(
        {
          name: 'Sem descrição',
        },
        {
          sessionContext: context,
          userId: 'user_123',
        },
      );

      const callArgs = mockClickUpClient.createTask.mock.calls[0];
      const enrichedParams = callArgs[1];
      // Should only have client context
      expect(enrichedParams.description).toContain('client_456');

      expect(result.task).toEqual(mockTask);
    });

    it('should use default list if list name resolution fails', async () => {
      const mockTask: ClickUpTask = {
        id: 'task_789',
        name: 'Fallback',
        url: 'https://app.clickup.com/t/task_789',
        status: { status: 'to do', color: 'blue' },
        priority: null,
        due_date: null,
        list: { id: defaultListId, name: 'Backlog' },
      };

      mockClickUpClient.findListByName.mockResolvedValue(null);
      mockClickUpClient.createTask.mockResolvedValue(mockTask);

      const context: SessionContext = {
        sessionId: 'session_123',
        history: [],
      };

      await taskService.createClickUpTask(
        {
          name: 'Fallback',
          listName: 'nonexistent',
        },
        {
          sessionContext: context,
          userId: 'user_123',
        },
      );

      // Should use default list when findListByName returns null
      expect(mockClickUpClient.createTask).toHaveBeenCalledWith(defaultListId, expect.any(Object));
    });

    it('should format confirmation message with due date in pt-BR format', async () => {
      const mockTask: ClickUpTask = {
        id: 'task_789',
        name: 'Tarefa com prazo',
        url: 'https://app.clickup.com/t/task_789',
        status: { status: 'to do', color: 'blue' },
        priority: null,
        due_date: '1740700800000', // Feb 28, 2025 in UTC
        list: { id: defaultListId, name: 'Backlog' },
      };

      mockClickUpClient.createTask.mockResolvedValue(mockTask);

      const context: SessionContext = {
        sessionId: 'session_123',
        history: [],
      };

      const result = await taskService.createClickUpTask(
        {
          name: 'Tarefa com prazo',
          due_date: 1740700800000,
        },
        {
          sessionContext: context,
          userId: 'user_123',
        },
      );

      // Date format should be DD/MM/YYYY
      expect(result.confirmationMessage).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(result.confirmationMessage).toContain('Tarefa com prazo');
      expect(result.confirmationMessage).toContain('Link:');
    });

    it('should format confirmation message with "Sem prazo" when no due_date', async () => {
      const mockTask: ClickUpTask = {
        id: 'task_789',
        name: 'Tarefa sem prazo',
        url: 'https://app.clickup.com/t/task_789',
        status: { status: 'to do', color: 'blue' },
        priority: null,
        due_date: null,
        list: { id: defaultListId, name: 'Backlog' },
      };

      mockClickUpClient.createTask.mockResolvedValue(mockTask);

      const context: SessionContext = {
        sessionId: 'session_123',
        history: [],
      };

      const result = await taskService.createClickUpTask(
        {
          name: 'Tarefa sem prazo',
        },
        {
          sessionContext: context,
          userId: 'user_123',
        },
      );

      expect(result.confirmationMessage).toContain('Sem prazo');
      expect(result.confirmationMessage).toContain('Tarefa sem prazo');
    });

    it('should include list name in confirmation message', async () => {
      const mockTask: ClickUpTask = {
        id: 'task_789',
        name: 'Tarefa',
        url: 'https://app.clickup.com/t/task_789',
        status: { status: 'to do', color: 'blue' },
        priority: null,
        due_date: null,
        list: { id: 'list_custom', name: 'Desenvolvimento' },
      };

      mockClickUpClient.createTask.mockResolvedValue(mockTask);

      const context: SessionContext = {
        sessionId: 'session_123',
        history: [],
      };

      const result = await taskService.createClickUpTask(
        {
          name: 'Tarefa',
        },
        {
          sessionContext: context,
          userId: 'user_123',
        },
      );

      expect(result.confirmationMessage).toContain('Desenvolvimento');
      expect(result.confirmationMessage).toContain('Lista:');
    });
  });
});
