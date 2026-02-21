import { describe, it, expect, vi } from 'vitest';
import { whitelistMiddleware } from '../whitelist.middleware';

describe('whitelistMiddleware', () => {
  it('should call next for authorized user', async () => {
    const next = vi.fn();
    const middleware = whitelistMiddleware([123, 456]);
    const ctx = {
      from: { id: 123 },
    } as any;

    await middleware(ctx, next);
    expect(next).toHaveBeenCalled();
  });

  it('should not call next for unauthorized user', async () => {
    const next = vi.fn();
    const middleware = whitelistMiddleware([123, 456]);
    const ctx = {
      from: { id: 789 },
    } as any;

    await middleware(ctx, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('should not call next if no user ID', async () => {
    const next = vi.fn();
    const middleware = whitelistMiddleware([123, 456]);
    const ctx = {
      from: undefined,
    } as any;

    await middleware(ctx, next);
    expect(next).not.toHaveBeenCalled();
  });
});
