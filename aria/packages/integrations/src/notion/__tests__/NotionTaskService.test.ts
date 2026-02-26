import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotionTaskService } from '../NotionTaskService';

// Mock Notion client
const mockNotionClient = {
  pages: {
    create: vi.fn(),
    update: vi.fn(),
  },
  databases: {
    retrieve: vi.fn(),
  },
};

describe('NotionTaskService', () => {
  let service: NotionTaskService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotionTaskService(
      mockNotionClient as any,
      'test-database-id'
    );
  });

  describe('createTask', () => {
    it('should create task successfully', async () => {
      const mockResponse = {
        id: 'page-123',
        url: 'https://notion.so/page-123',
      };

      mockNotionClient.pages.create.mockResolvedValueOnce(mockResponse);

      const result = await service.createTask({
        title: 'Test Task',
        description: 'Test description',
        status: 'A fazer',
      });

      expect(result).toEqual({
        id: 'page-123',
        title: 'Test Task',
        url: 'https://notion.so/page-123',
        status: 'A fazer',
        linkedClientId: undefined,
      });

      expect(mockNotionClient.pages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          parent: expect.objectContaining({
            database_id: 'test-database-id',
          }),
          properties: expect.any(Object),
        })
      );
    });

    it('should link to client if provided', async () => {
      mockNotionClient.pages.create.mockResolvedValueOnce({
        id: 'page-123',
        url: 'https://notion.so/page-123',
      });

      await service.createTask({
        title: 'Test Task',
        clientId: 'client-456',
      });

      const callArgs = mockNotionClient.pages.create.mock.calls[0];
      expect(callArgs[0].properties.Client).toEqual({
        relation: [{ id: 'client-456' }],
      });
    });

    it('should format due date correctly', async () => {
      const dueDate = new Date('2026-03-15');

      mockNotionClient.pages.create.mockResolvedValueOnce({
        id: 'page-123',
        url: 'https://notion.so/page-123',
      });

      await service.createTask({
        title: 'Task with deadline',
        dueDate,
      });

      const callArgs = mockNotionClient.pages.create.mock.calls[0];
      expect(callArgs[0].properties['Due Date']).toEqual({
        date: {
          start: '2026-03-15',
        },
      });
    });

    it('should handle missing database', async () => {
      const emptyService = new NotionTaskService(
        mockNotionClient as any,
        ''
      );

      await expect(
        emptyService.createTask({ title: 'Test' })
      ).rejects.toThrow('Tasks database not configured');
    });

    it('should handle API errors', async () => {
      mockNotionClient.pages.create.mockRejectedValueOnce(
        new Error('API Error')
      );

      await expect(
        service.createTask({ title: 'Test' })
      ).rejects.toThrow('Notion task creation failed');
    });
  });

  describe('linkTaskToClient', () => {
    it('should link task to client', async () => {
      mockNotionClient.pages.update.mockResolvedValueOnce({ id: 'page-123' });

      await service.linkTaskToClient('page-123', 'client-456');

      expect(mockNotionClient.pages.update).toHaveBeenCalledWith(
        expect.objectContaining({
          page_id: 'page-123',
          properties: expect.objectContaining({
            'Client': {
              relation: [{ id: 'client-456' }],
            },
          }),
        })
      );
    });

    it('should handle linking errors', async () => {
      mockNotionClient.pages.update.mockRejectedValueOnce(
        new Error('Link failed')
      );

      await expect(
        service.linkTaskToClient('page-123', 'client-456')
      ).rejects.toThrow('Failed to link task');
    });
  });

  describe('validateConfig', () => {
    it('should validate configuration', async () => {
      mockNotionClient.databases.retrieve.mockResolvedValueOnce({
        id: 'test-database-id',
      });

      const result = await service.validateConfig();

      expect(result).toBe(true);
    });

    it('should return false on invalid config', async () => {
      mockNotionClient.databases.retrieve.mockRejectedValueOnce(
        new Error('Not found')
      );

      const result = await service.validateConfig();

      expect(result).toBe(false);
    });
  });
});
