import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter } from '../RateLimiter';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new RateLimiter(3, 10000); // 3 requests per 10 seconds
  });

  it('should allow requests up to limit', () => {
    expect(limiter.isAllowed()).toBe(true);
    expect(limiter.isAllowed()).toBe(true);
    expect(limiter.isAllowed()).toBe(true);
  });

  it('should block requests after limit', () => {
    limiter.isAllowed();
    limiter.isAllowed();
    limiter.isAllowed();

    expect(limiter.isAllowed()).toBe(false);
  });

  it('should track remaining requests', () => {
    expect(limiter.getRemaining()).toBe(3);

    limiter.isAllowed();
    expect(limiter.getRemaining()).toBe(2);

    limiter.isAllowed();
    expect(limiter.getRemaining()).toBe(1);

    limiter.isAllowed();
    expect(limiter.getRemaining()).toBe(0);
  });

  it('should reset after window expires', () => {
    limiter.isAllowed();
    limiter.isAllowed();
    limiter.isAllowed();

    expect(limiter.getRemaining()).toBe(0);
    expect(limiter.isAllowed()).toBe(false);

    // Advance time past window
    vi.advanceTimersByTime(10001);

    expect(limiter.getRemaining()).toBe(3);
    expect(limiter.isAllowed()).toBe(true);
  });

  it('should calculate retry after time correctly', () => {
    const time1 = limiter.getRetryAfter();
    expect(time1).toBe(0); // No requests yet

    limiter.isAllowed();
    vi.advanceTimersByTime(5000);

    const time2 = limiter.getRetryAfter();
    expect(time2).toBeCloseTo(5000, -3); // ~5000ms remaining
  });

  it('should reset correctly', () => {
    limiter.isAllowed();
    limiter.isAllowed();
    limiter.isAllowed();

    expect(limiter.getRemaining()).toBe(0);

    limiter.reset();
    expect(limiter.getRemaining()).toBe(3);
    expect(limiter.isAllowed()).toBe(true);
  });

  it('should handle rapid requests', () => {
    for (let i = 0; i < 10; i++) {
      const allowed = limiter.isAllowed();
      if (i < 3) {
        expect(allowed).toBe(true);
      } else {
        expect(allowed).toBe(false);
      }
    }
  });
});
