import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatService, type TaskCreationRequest } from '../ChatService';
import { ContextStore } from '../ContextStore';

describe('ChatService - Task Creation Flow (Integration)', () => {
  let contextStore: ContextStore;
  let chatService: ChatService;

  beforeEach(() => {
    contextStore = new ContextStore();

    const mockClaude = {
      messages: {
        create: async () => ({
          content: [{ type: 'text', text: 'Mock response' }],
        }),
      },
    };

    chatService = new ChatService(mockClaude as any, contextStore);

    // Reset module mocks
    vi.clearAllMocks();
  });

  describe('Task Flow Initialization', () => {
    it('should initialize ChatService with context store', () => {
      expect(chatService).toBeDefined();
      expect(contextStore).toBeDefined();
    });

    it('should have parseAndCreateTask method', () => {
      expect(typeof chatService.parseAndCreateTask).toBe('function');
    });

    it('should have confirmAndCreateTask method', () => {
      expect(typeof chatService.confirmAndCreateTask).toBe('function');
    });
  });

  describe('Pending Task Context Management', () => {
    it('should store and retrieve pending tasks from context', async () => {
      const sessionId = 'test-session';
      const task = {
        intent: {
          title: 'Test Task',
          completeness: 'complete' as const,
          rawText: 'test',
        },
        confidence: 0.9,
        preview: '📝 **Test Task**',
      };

      // Store pending task
      await contextStore.appendPendingTask(sessionId, task);

      // Retrieve pending task
      const retrieved = await contextStore.getPendingTask(sessionId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.intent.title).toBe('Test Task');
    });

    it('should clear pending task after successful creation', async () => {
      const sessionId = 'test-session';
      const task = {
        intent: {
          title: 'Test Task',
          completeness: 'complete' as const,
          rawText: 'test',
        },
        confidence: 0.9,
        preview: '📝 **Test Task**',
      };

      // Store task
      await contextStore.appendPendingTask(sessionId, task);
      let retrieved = await contextStore.getPendingTask(sessionId);
      expect(retrieved).toBeDefined();

      // Clear task
      await contextStore.clearPendingTask(sessionId);
      retrieved = await contextStore.getPendingTask(sessionId);
      expect(retrieved).toBeUndefined();
    });

    it('should not find pending tasks in different sessions', async () => {
      const task = {
        intent: {
          title: 'Test Task',
          completeness: 'complete' as const,
          rawText: 'test',
        },
        confidence: 0.9,
        preview: '📝 **Test Task**',
      };

      // Store in session 1
      await contextStore.appendPendingTask('session-1', task);

      // Try to retrieve from session 2
      const retrieved = await contextStore.getPendingTask('session-2');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should return error when confirming non-existent pending task', async () => {
      const result = await chatService.confirmAndCreateTask('non-existent', true);

      expect(result.status).toBe('error');
      expect(result.error?.toLowerCase()).toContain('nenhuma tarefa pendente');
    });

    it('should handle invalid input gracefully in parseAndCreateTask', async () => {
      const request: TaskCreationRequest = {
        text: '{"malicious": "payload"}', // Suspicious input
        sessionId: 'test-session',
      };

      const result = await chatService.parseAndCreateTask(request);

      // Should not crash, either parse it or return error/clarification
      expect(['error', 'pending_clarification', 'preview_ready']).toContain(result.status);
    });
  });

  describe('Task Confirmation Flow', () => {
    it('should reject task when user declines confirmation', async () => {
      const sessionId = 'test-session';
      const task = {
        intent: {
          title: 'Test Task',
          completeness: 'complete' as const,
          rawText: 'test',
        },
        confidence: 0.9,
        preview: '📝 **Test Task**',
      };

      // Store pending task
      await contextStore.appendPendingTask(sessionId, task);

      // User declines
      const result = await chatService.confirmAndCreateTask(sessionId, false);

      expect(result.status).toBe('error');
      expect(result.error).toContain('cancelada');

      // Pending task should be cleared
      const pending = await contextStore.getPendingTask(sessionId);
      expect(pending).toBeUndefined();
    });

    it('should create task when user confirms', async () => {
      const sessionId = 'test-session';
      const task = {
        intent: {
          title: 'Test Task',
          completeness: 'complete' as const,
          rawText: 'test',
          destination: 'clickup' as const,
        },
        confidence: 0.9,
        preview: '📝 **Test Task**',
      };

      // Store pending task
      await contextStore.appendPendingTask(sessionId, task);

      // User confirms
      const result = await chatService.confirmAndCreateTask(sessionId, true);

      expect(result.status).toBe('created');
      expect(result.taskId).toBeDefined();
      expect(result.notionUrl).toBeDefined();

      // Pending task should be cleared
      const pending = await contextStore.getPendingTask(sessionId);
      expect(pending).toBeUndefined();
    });
  });

  describe('Response Structure Validation', () => {
    it('parseAndCreateTask should return TaskCreationResponse with correct fields', async () => {
      const request: TaskCreationRequest = {
        text: 'Fazer algo',
        sessionId: 'test',
      };

      const result = await chatService.parseAndCreateTask(request);

      expect(result).toHaveProperty('status');
      expect(['error', 'pending_clarification', 'preview_ready']).toContain(result.status);

      // Depending on status, check for relevant fields
      if (result.status === 'preview_ready') {
        expect(result.preview).toBeDefined();
        expect(result.intent).toBeDefined();
        expect(result.confidence).toBeDefined();
      } else if (result.status === 'pending_clarification') {
        expect(result.clarificationQuestion || result.preview).toBeDefined();
      }
    });

    it('confirmAndCreateTask should return TaskCreationResponse with correct fields', async () => {
      const sessionId = 'test';
      const task = {
        intent: {
          title: 'Test',
          completeness: 'complete' as const,
          rawText: 'test',
        },
        confidence: 0.9,
        preview: 'Preview',
      };

      await contextStore.appendPendingTask(sessionId, task);
      const result = await chatService.confirmAndCreateTask(sessionId, true);

      expect(result).toHaveProperty('status');
      expect(['error', 'created']).toContain(result.status);

      if (result.status === 'created') {
        expect(result.taskId).toBeDefined();
        expect(result.notionUrl).toBeDefined();
      }
    });
  });
});
