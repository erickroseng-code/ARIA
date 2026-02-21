import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClickUpTaskService, TaskCreateRequest } from '../ClickUpTaskService';

// Mock fetch
global.fetch = vi.fn();

describe('ClickUpTaskService', () => {
  let service: ClickUpTaskService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ClickUpTaskService('test-api-key', 'default-list-id');
  });

  describe('createTask', () => {
    it('should create task successfully', async () => {
      const mockResponse = {
        id: 'task-123',
        name: 'Test Task',
        url: 'https://app.clickup.com/t/task-123',
        list: { id: 'list-1' },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request: TaskCreateRequest = {
        title: 'Test Task',
        description: 'Test description',
        priority: 'high',
      };

      const result = await service.createTask(request);

      expect(result).toEqual({
        id: 'task-123',
        title: 'Test Task',
        url: 'https://app.clickup.com/t/task-123',
        listId: 'list-1',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/list/default-list-id/task'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'test-api-key',
          }),
        })
      );
    });

    it('should handle 401 unauthorized', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ err: 'Unauthorized' }),
      });

      const request: TaskCreateRequest = {
        title: 'Test Task',
      };

      await expect(service.createTask(request)).rejects.toThrow(
        'invalid_api_key'
      );
    });

    it('should handle 429 rate limit', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ err: 'Rate limited' }),
      });

      const request: TaskCreateRequest = {
        title: 'Test Task',
      };

      await expect(service.createTask(request)).rejects.toThrow(
        'rate_limit'
      );
    });

    it('should format priority correctly', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'task-123',
          name: 'Urgent Task',
          url: 'https://app.clickup.com/t/task-123',
          priority: 1,
        }),
      });

      const request: TaskCreateRequest = {
        title: 'Urgent Task',
        priority: 'urgent',
      };

      await service.createTask(request);

      const callArgs = (global.fetch as any).mock.calls[0];
      const bodyStr = callArgs[1].body;
      const body = JSON.parse(bodyStr);

      expect(body.priority).toBe(1); // urgent = 1
    });

    it('should format due date correctly', async () => {
      const dueDate = new Date('2026-03-15');

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'task-123',
          name: 'Task with deadline',
          url: 'https://app.clickup.com/t/task-123',
          due_date: dueDate.getTime(),
        }),
      });

      const request: TaskCreateRequest = {
        title: 'Task with deadline',
        dueDate,
      };

      await service.createTask(request);

      const callArgs = (global.fetch as any).mock.calls[0];
      const bodyStr = callArgs[1].body;
      const body = JSON.parse(bodyStr);

      expect(body.due_date).toBe(dueDate.getTime());
    });

    it('should handle missing description', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'task-123',
          name: 'Task',
          url: 'https://app.clickup.com/t/task-123',
        }),
      });

      const request: TaskCreateRequest = {
        title: 'Task',
      };

      await service.createTask(request);

      const callArgs = (global.fetch as any).mock.calls[0];
      const bodyStr = callArgs[1].body;
      const body = JSON.parse(bodyStr);

      expect(body.description).toBe('');
    });
  });

  describe('validateConfig', () => {
    it('should validate config successfully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      const result = await service.validateConfig();

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/team'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'test-api-key',
          }),
        })
      );
    });

    it('should return false on validation failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
      });

      const result = await service.validateConfig();

      expect(result).toBe(false);
    });
  });
});
