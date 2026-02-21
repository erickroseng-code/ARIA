/**
 * Rate Limiter for ClickUp API
 * Enforces 30 requests per minute limit
 */

export class RateLimiter {
  private maxRequests: number;
  private windowMs: number;
  private requests: { timestamp: number; success: boolean }[] = [];

  constructor(maxRequests = 30, windowMs = 60000) {
    // 30 requests per 60 seconds
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if request is allowed and track it
   */
  isAllowed(): boolean {
    const now = Date.now();

    // Remove old requests outside the window
    this.requests = this.requests.filter(
      (req) => now - req.timestamp < this.windowMs
    );

    // Check if we're under the limit
    if (this.requests.length < this.maxRequests) {
      this.requests.push({ timestamp: now, success: true });
      return true;
    }

    return false;
  }

  /**
   * Get remaining requests in current window
   */
  getRemaining(): number {
    const now = Date.now();
    const validRequests = this.requests.filter(
      (req) => now - req.timestamp < this.windowMs
    );
    return Math.max(0, this.maxRequests - validRequests.length);
  }

  /**
   * Get time until next slot becomes available (ms)
   */
  getRetryAfter(): number {
    if (this.requests.length === 0) {
      return 0;
    }

    const oldestRequest = this.requests[0];
    if (!oldestRequest) {
      return 0;
    }

    const timeSinceOldest = Date.now() - oldestRequest.timestamp;
    const retryAfter = Math.max(0, this.windowMs - timeSinceOldest);

    return retryAfter;
  }

  /**
   * Reset rate limiter
   */
  reset(): void {
    this.requests = [];
  }
}
