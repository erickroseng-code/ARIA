/**
 * RateLimitCoordinator: Coordinate rate limits across multiple APIs
 * Manages: Whisper (3500 RPM), Claude (abundant), ClickUp (30 req/min), Notion (3 req/sec)
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
  serviceName: string;
}

export interface ServiceLimit {
  serviceName: string;
  maxRequests: number;
  windowMs: number;
  currentRequests: number;
  lastResetTime: number;
  retryAfter?: number;
}

export class RateLimitCoordinator {
  private serviceLimits: Map<string, ServiceLimit> = new Map();

  private readonly defaultLimits: Record<string, RateLimitConfig> = {
    whisper: { serviceName: 'whisper', maxRequests: 3500 / 60, windowMs: 60000 }, // 3500 per minute
    claude: { serviceName: 'claude', maxRequests: 1000, windowMs: 60000 }, // Abundant, safe limit
    clickup: { serviceName: 'clickup', maxRequests: 30, windowMs: 60000 }, // 30 per minute
    notion: { serviceName: 'notion', maxRequests: 3, windowMs: 1000 }, // 3 per second
  };

  constructor(customLimits?: Record<string, RateLimitConfig>) {
    const limits = { ...this.defaultLimits, ...customLimits };
    Object.entries(limits).forEach(([key, config]) => {
      this.serviceLimits.set(key, {
        serviceName: config.serviceName,
        maxRequests: config.maxRequests,
        windowMs: config.windowMs,
        currentRequests: 0,
        lastResetTime: Date.now(),
      });
    });
  }

  /**
   * Check if a request is allowed for a service
   */
  isAllowed(serviceName: string): boolean {
    const limit = this.serviceLimits.get(serviceName);
    if (!limit) {
      console.warn(`Service ${serviceName} not configured`);
      return true; // Allow unknown services
    }

    this.resetIfWindowExpired(limit);
    return limit.currentRequests < limit.maxRequests;
  }

  /**
   * Record a request for rate limiting
   */
  recordRequest(serviceName: string): void {
    const limit = this.serviceLimits.get(serviceName);
    if (!limit) {
      return;
    }

    this.resetIfWindowExpired(limit);
    limit.currentRequests++;
  }

  /**
   * Get time to wait before next request (in milliseconds)
   */
  getWaitTime(serviceName: string): number {
    const limit = this.serviceLimits.get(serviceName);
    if (!limit) {
      return 0;
    }

    this.resetIfWindowExpired(limit);

    if (limit.currentRequests < limit.maxRequests) {
      return 0;
    }

    // Calculate wait time
    const timeElapsed = Date.now() - limit.lastResetTime;
    const waitTime = Math.max(0, limit.windowMs - timeElapsed);
    return waitTime;
  }

  /**
   * Check all services and return which ones are rate-limited
   */
  getStatus(): Record<
    string,
    {
      allowed: boolean;
      usage: number;
      limit: number;
      percentage: number;
      waitTime: number;
    }
  > {
    const status: Record<
      string,
      {
        allowed: boolean;
        usage: number;
        limit: number;
        percentage: number;
        waitTime: number;
      }
    > = {};

    this.serviceLimits.forEach((limit, serviceName) => {
      this.resetIfWindowExpired(limit);
      const percentage = (limit.currentRequests / limit.maxRequests) * 100;

      status[serviceName] = {
        allowed: this.isAllowed(serviceName),
        usage: limit.currentRequests,
        limit: limit.maxRequests,
        percentage,
        waitTime: this.getWaitTime(serviceName),
      };
    });

    return status;
  }

  /**
   * Get critical services that are near limit (>80%)
   */
  getCriticalServices(): string[] {
    const critical: string[] = [];
    this.serviceLimits.forEach((limit, serviceName) => {
      this.resetIfWindowExpired(limit);
      const percentage = (limit.currentRequests / limit.maxRequests) * 100;
      if (percentage > 80) {
        critical.push(serviceName);
      }
    });
    return critical;
  }

  /**
   * Reset a service's counter
   */
  resetService(serviceName: string): void {
    const limit = this.serviceLimits.get(serviceName);
    if (limit) {
      limit.currentRequests = 0;
      limit.lastResetTime = Date.now();
    }
  }

  /**
   * Reset all services
   */
  resetAll(): void {
    const now = Date.now();
    this.serviceLimits.forEach((limit) => {
      limit.currentRequests = 0;
      limit.lastResetTime = now;
    });
  }

  /**
   * Internal: Reset counter if window has expired
   */
  private resetIfWindowExpired(limit: ServiceLimit): void {
    const timeElapsed = Date.now() - limit.lastResetTime;
    if (timeElapsed >= limit.windowMs) {
      limit.currentRequests = 0;
      limit.lastResetTime = Date.now();
    }
  }

  /**
   * Queue a task with exponential backoff
   */
  async queueWithBackoff<T>(
    serviceName: string,
    task: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Check rate limit
      while (!this.isAllowed(serviceName)) {
        const waitTime = this.getWaitTime(serviceName);
        console.log(`Rate limited on ${serviceName}, waiting ${waitTime}ms...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime + 100));
      }

      try {
        // Record and execute
        this.recordRequest(serviceName);
        const result = await task();
        return result;
      } catch (error) {
        lastError = error as Error;

        // Exponential backoff
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.error(
          `Attempt ${attempt + 1} failed for ${serviceName}, retrying in ${backoffMs}ms...`,
          lastError.message
        );

        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    throw lastError || new Error(`Failed to execute task on ${serviceName} after ${maxRetries} attempts`);
  }
}
