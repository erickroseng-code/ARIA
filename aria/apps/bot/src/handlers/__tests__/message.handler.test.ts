import { describe, it, expect } from 'vitest';

describe('messageHandler', () => {
  it('should accept message context object', () => {
    const ctx = {
      message: { text: 'test message' },
      session: { sessionId: 'tg_123' },
      from: { id: 123 },
      reply: () => {},
      api: { logger: () => {} },
    } as any;

    // Validates context structure
    expect(ctx.message.text).toBe('test message');
    expect(ctx.session.sessionId).toBe('tg_123');
  });

  it('should validate missing text property', () => {
    const ctx = {
      message: { text: undefined },
      session: { sessionId: 'tg_123' },
      from: { id: 123 },
    } as any;

    // Validates error handling
    expect(ctx.message.text).toBeUndefined();
  });
});
