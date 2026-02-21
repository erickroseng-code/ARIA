import { describe, it, expect, beforeEach } from 'vitest';
import { ContextStore } from '../ContextStore';

describe('ContextStore', () => {
  let store: ContextStore;

  beforeEach(() => {
    store = new ContextStore();
  });

  describe('activeClient management', () => {
    it('should set and get active client', async () => {
      await store.setActiveClient('user-123', 'client-456');
      const clientId = await store.getActiveClient('user-123');
      expect(clientId).toBe('client-456');
    });

    it('should return undefined for non-existent user', async () => {
      const clientId = await store.getActiveClient('non-existent');
      expect(clientId).toBeUndefined();
    });

    it('should update active client', async () => {
      await store.setActiveClient('user-123', 'client-456');
      await store.setActiveClient('user-123', 'client-789');
      const clientId = await store.getActiveClient('user-123');
      expect(clientId).toBe('client-789');
    });
  });

  describe('session context', () => {
    it('should get session context', async () => {
      const context = await store.get('session-123');
      expect(context.sessionId).toBe('session-123');
      expect(context.history).toEqual([]);
    });

    it('should return session context by id', async () => {
      const context = await store.get('session-123');
      await store.append('session-123', {
        role: 'user',
        content: 'Hello',
      });

      const retrieved = await store.getSessionContext('session-123');
      expect(retrieved).toBeDefined();
      expect(retrieved?.history).toHaveLength(1);
    });

    it('should return undefined for non-existent session', async () => {
      const retrieved = await store.getSessionContext('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('get all contexts', () => {
    it('should return all contexts', async () => {
      await store.get('session-1');
      await store.get('session-2');
      await store.get('session-3');

      const allContexts = await store.getAllContexts();
      expect(allContexts.size).toBe(3);
      expect(allContexts.has('session-1')).toBe(true);
      expect(allContexts.has('session-2')).toBe(true);
      expect(allContexts.has('session-3')).toBe(true);
    });

    it('should return empty map when no contexts', async () => {
      const allContexts = await store.getAllContexts();
      expect(allContexts.size).toBe(0);
    });
  });

  describe('history rolling window', () => {
    it('should maintain max history of 10 messages', async () => {
      const sessionId = 'session-123';
      await store.get(sessionId);

      for (let i = 0; i < 15; i++) {
        await store.append(sessionId, {
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
        });
      }

      const context = await store.getSessionContext(sessionId);
      expect(context).toBeDefined();
      expect(context!.history).toHaveLength(10);
      expect(context!.history[0].content).toBe('Message 5');
      expect(context!.history[9].content).toBe('Message 14');
    });
  });
});
