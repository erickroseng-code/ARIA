import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClickUpClient } from '../clickup/ClickUpClient';
import type { ClickUpTask, ClickUpList } from '@aria/shared';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ClickUpClient', () => {
  let client: ClickUpClient;
  const apiKey = 'pk_test_api_key_12345';
  const defaultListId = 'list_abc123';

  beforeEach(() => {
    client = new ClickUpClient(apiKey, defaultListId);
    vi.clearAllMocks();
  });

  describe('createTask', () => {
    it('should create task with POST request to correct endpoint', async () => {
      const mockTask: ClickUpTask = {
        id: 'task_123',
        name: 'Test Task',
        url: 'https://app.clickup.com/t/task_123',
        status: { status: 'to do', color: 'blue' },
        priority: { id: '2', priority: 'high', color: 'red' },
        due_date: '1740700800000',
        list: { id: 'list_abc123', name: 'My List' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTask,
      });

      const result = await client.createTask('list_abc123', {
        name: 'Test Task',
        priority: 2,
        due_date: 1740700800000,
      });

      expect(result).toEqual(mockTask);
      expect(mockFetch).toHaveBeenCalledOnce();

      const callArgs = mockFetch.mock.calls[0];
      const url = callArgs[0] as string;
      const options = callArgs[1] as RequestInit;

      expect(url).toBe('https://api.clickup.com/api/v2/list/list_abc123/task');
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({
        Authorization: apiKey, // NO "Bearer"
        'Content-Type': 'application/json',
      });

      const body = JSON.parse(options.body as string);
      expect(body.name).toBe('Test Task');
      expect(body.priority).toBe(2);
      expect(body.due_date).toBe(1740700800000); // milliseconds
      expect(body.status).toBe('to do');
    });

    it('should use default priority (3=normal) when not specified', async () => {
      const mockTask: ClickUpTask = {
        id: 'task_456',
        name: 'No Priority Task',
        url: 'https://app.clickup.com/t/task_456',
        status: { status: 'to do', color: 'blue' },
        priority: null,
        due_date: null,
        list: { id: 'list_abc123', name: 'My List' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTask,
      });

      await client.createTask('list_abc123', { name: 'No Priority Task' });

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(body.priority).toBe(3); // default
    });

    it('should handle API error (401) and throw AppError with CLICKUP_001', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ err: 'Unauthorized' }),
      });

      await expect(
        client.createTask('list_invalid', { name: 'Test' }),
      ).rejects.toMatchObject({
        message: 'Unauthorized',
        code: 'CLICKUP_001',
      });
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      await expect(
        client.createTask('list_abc123', { name: 'Test' }),
      ).rejects.toMatchObject({
        code: 'CLICKUP_001',
      });
    });
  });

  describe('findListByName', () => {
    it('should find list by exact name (case-insensitive)', async () => {
      const mockLists: { lists: ClickUpList[] } = {
        lists: [
          {
            id: 'list_1',
            name: 'Marketing',
            space: { id: 'space_1', name: 'Work' },
          },
          {
            id: 'list_2',
            name: 'Sales',
            space: { id: 'space_1', name: 'Work' },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockLists,
      });

      const result = await client.findListByName('team_123', 'marketing');

      expect(result).toEqual(mockLists.lists[0]);
    });

    it('should find list by substring match', async () => {
      const mockLists: { lists: ClickUpList[] } = {
        lists: [
          {
            id: 'list_1',
            name: 'Marketing Digital',
            space: { id: 'space_1', name: 'Work' },
          },
          {
            id: 'list_2',
            name: 'Sales Operations',
            space: { id: 'space_1', name: 'Work' },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockLists,
      });

      const result = await client.findListByName('team_123', 'marketing');

      expect(result).toEqual(mockLists.lists[0]);
    });

    it('should return null if no list found', async () => {
      const mockLists: { lists: ClickUpList[] } = {
        lists: [
          {
            id: 'list_1',
            name: 'Marketing',
            space: { id: 'space_1', name: 'Work' },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockLists,
      });

      const result = await client.findListByName('team_123', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      const result = await client.findListByName('team_123', 'marketing');

      expect(result).toBeNull();
    });
  });

  describe('getList', () => {
    it('should retrieve list details', async () => {
      const mockList: ClickUpList = {
        id: 'list_abc123',
        name: 'My List',
        space: { id: 'space_1', name: 'Work' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockList,
      });

      const result = await client.getList('list_abc123');

      expect(result).toEqual(mockList);
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toBe('https://api.clickup.com/api/v2/list/list_abc123');
    });
  });

  describe('getDefaultListId', () => {
    it('should return the default list ID', () => {
      const listId = client.getDefaultListId();
      expect(listId).toBe(defaultListId);
    });
  });

  describe('singleton pattern', () => {
    it('should initialize and retrieve client', async () => {
      const { initializeClickUpClient, getClickUpClient } = await import(
        '../clickup/ClickUpClient'
      );

      initializeClickUpClient('pk_test', 'list_test');
      const retrievedClient = getClickUpClient();

      expect(retrievedClient).toBeDefined();
      expect(retrievedClient.getDefaultListId()).toBe('list_test');
    });

    it('should throw error if not initialized', async () => {
      // Create a new instance without initializing
      const module = await import('../clickup/ClickUpClient');

      // Reset the singleton by reimporting
      vi.resetModules();
      const { getClickUpClient: getClientUninitialized } = await import(
        '../clickup/ClickUpClient'
      );

      expect(() => getClientUninitialized()).toThrow(
        'ClickUpClient not initialized',
      );
    });
  });
});
