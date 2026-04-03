/**
 * Simple in-memory rate limiter.
 */
export class RateLimiter {
  private maxRequests: number;
  private windowMs: number;
  private requests: { timestamp: number; success: boolean }[] = [];

  constructor(maxRequests = 30, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  isAllowed(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter((req) => now - req.timestamp < this.windowMs);

    if (this.requests.length < this.maxRequests) {
      this.requests.push({ timestamp: now, success: true });
      return true;
    }

    return false;
  }

  getRemaining(): number {
    const now = Date.now();
    const validRequests = this.requests.filter((req) => now - req.timestamp < this.windowMs);
    return Math.max(0, this.maxRequests - validRequests.length);
  }

  getRetryAfter(): number {
    if (this.requests.length === 0) {
      return 0;
    }

    const oldestRequest = this.requests[0];
    if (!oldestRequest) {
      return 0;
    }

    const timeSinceOldest = Date.now() - oldestRequest.timestamp;
    return Math.max(0, this.windowMs - timeSinceOldest);
  }

  reset(): void {
    this.requests = [];
  }
}
