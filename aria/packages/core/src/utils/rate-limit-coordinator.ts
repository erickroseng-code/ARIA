/**
 * RateLimitCoordinator - Centralized rate limiting for all external APIs
 * Coordinates limits across Whisper, ClickUp, Notion, and Claude APIs
 */

export interface RateLimitConfig {
  service: 'whisper' | 'clickup' | 'notion' | 'claude';
  requestsPerMinute: number;
  requestsPerSecond: number;
  burstAllowance: number; // Extra requests allowed in a burst
  retryAfterMs: number; // Wait time before retrying after hitting limit
}

export interface RateLimitStatus {
  service: string;
  currentUsage: number;
  limit: number;
  resetAt: number;
  isLimited: boolean;
  waitTimeMs: number;
}

export interface ApiMetrics {
  service: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTimeMs: number;
  lastRequestAt: number;
  nextAvailableAt: number;
}

/**
 * Rate limit configurations for each API
 * Based on official API documentation
 */
const DEFAULT_CONFIGS: Record<RateLimitConfig['service'], RateLimitConfig> = {
  whisper: {
    service: 'whisper',
    requestsPerMinute: 60, // Conservative estimate
    requestsPerSecond: 1,
    burstAllowance: 5,
    retryAfterMs: 60000,
  },
  clickup: {
    service: 'clickup',
    requestsPerMinute: 100,
    requestsPerSecond: 2,
    burstAllowance: 10,
    retryAfterMs: 60000,
  },
  notion: {
    service: 'notion',
    requestsPerMinute: 180, // 3 requests/second
    requestsPerSecond: 3,
    burstAllowance: 5,
    retryAfterMs: 30000,
  },
  claude: {
    service: 'claude',
    requestsPerMinute: 3600, // Abundant
    requestsPerSecond: 60,
    burstAllowance: 100,
    retryAfterMs: 0,
  },
};

export class RateLimitCoordinator {
  private requestQueues: Map<string, number[]> = new Map();
  private metrics: Map<string, ApiMetrics> = new Map();
  private configs: Map<string, RateLimitConfig> = new Map();

  constructor(customConfigs?: Partial<Record<RateLimitConfig['service'], RateLimitConfig>>) {
    // Initialize with default configs
    Object.values(DEFAULT_CONFIGS).forEach((config) => {
      this.configs.set(config.service, config);
      this.requestQueues.set(config.service, []);
      this.metrics.set(config.service, {
        service: config.service,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTimeMs: 0,
        lastRequestAt: 0,
        nextAvailableAt: 0,
      });
    });

    // Override with custom configs if provided
    if (customConfigs) {
      Object.entries(customConfigs).forEach(([service, config]) => {
        if (config) {
          this.configs.set(service, config);
        }
      });
    }
  }

  /**
   * Check if a request can proceed for a given service
   */
  canProceed(service: string): boolean {
    const status = this.getStatus(service);
    return !status.isLimited;
  }

  /**
   * Get current rate limit status for a service
   */
  getStatus(service: string): RateLimitStatus {
    const config = this.configs.get(service);
    const queue = this.requestQueues.get(service);
    const now = Date.now();

    if (!config || !queue) {
      return {
        service,
        currentUsage: 0,
        limit: 0,
        resetAt: 0,
        isLimited: false,
        waitTimeMs: 0,
      };
    }

    // Remove old requests outside of 1-minute window
    const oneMinuteAgo = now - 60000;
    const recentRequests = queue.filter((timestamp) => timestamp > oneMinuteAgo);
    this.requestQueues.set(service, recentRequests);

    const isLimited = recentRequests.length >= config.requestsPerMinute;
    const nextResetAt = recentRequests.length > 0 ? recentRequests[0]! + 60000 : 0;
    const waitTime = isLimited ? Math.max(0, nextResetAt - now) : 0;

    return {
      service,
      currentUsage: recentRequests.length,
      limit: config.requestsPerMinute,
      resetAt: nextResetAt,
      isLimited,
      waitTimeMs: waitTime,
    };
  }

  /**
   * Record a request for a service
   */
  recordRequest(service: string, duration: number = 0): void {
    const queue = this.requestQueues.get(service);
    const metrics = this.metrics.get(service);

    if (!queue || !metrics) {
      return;
    }

    const now = Date.now();
    queue.push(now);
    metrics.totalRequests++;
    metrics.lastRequestAt = now;
    metrics.nextAvailableAt = this.getStatus(service).resetAt;

    // Update average response time
    if (duration > 0) {
      const totalTime = metrics.averageResponseTimeMs * (metrics.totalRequests - 1) + duration;
      metrics.averageResponseTimeMs = totalTime / metrics.totalRequests;
    }
  }

  /**
   * Record a successful request
   */
  recordSuccess(service: string, duration: number = 0): void {
    this.recordRequest(service, duration);
    const metrics = this.metrics.get(service);
    if (metrics) {
      metrics.successfulRequests++;
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(service: string, duration: number = 0): void {
    this.recordRequest(service, duration);
    const metrics = this.metrics.get(service);
    if (metrics) {
      metrics.failedRequests++;
    }
  }

  /**
   * Get metrics for a service
   */
  getMetrics(service: string): ApiMetrics | null {
    return this.metrics.get(service) || null;
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): ApiMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Check if all services are available
   */
  areAllServicesAvailable(): boolean {
    return Array.from(this.configs.keys()).every((service) => this.canProceed(service));
  }

  /**
   * Get services that are currently rate limited
   */
  getLimitedServices(): string[] {
    return Array.from(this.configs.keys())
      .filter((service) => !this.canProceed(service));
  }

  /**
   * Calculate backoff time using exponential backoff
   */
  calculateBackoff(service: string, attemptNumber: number): number {
    const config = this.configs.get(service);
    if (!config) {
      return 0;
    }

    // Exponential backoff: base * (2^attempt), capped at config's retryAfterMs
    const baseDelay = 100; // Base delay in ms
    const backoff = baseDelay * Math.pow(2, attemptNumber);
    return Math.min(backoff, config.retryAfterMs);
  }

  /**
   * Wait until a service is available
   */
  async waitUntilAvailable(service: string, maxWaitMs: number = 60000): Promise<boolean> {
    const startTime = Date.now();

    while (!this.canProceed(service)) {
      const status = this.getStatus(service);
      const elapsed = Date.now() - startTime;

      if (elapsed > maxWaitMs) {
        return false; // Timeout
      }

      // Wait for the required time, with a small buffer
      const waitTime = Math.min(status.waitTimeMs + 100, maxWaitMs - elapsed);
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, waitTime)));
    }

    return true;
  }

  /**
   * Reset all metrics and queues
   */
  reset(): void {
    this.requestQueues.forEach((queue) => queue.length = 0);
    this.metrics.forEach((metrics) => {
      metrics.totalRequests = 0;
      metrics.successfulRequests = 0;
      metrics.failedRequests = 0;
      metrics.averageResponseTimeMs = 0;
      metrics.lastRequestAt = 0;
      metrics.nextAvailableAt = 0;
    });
  }

  /**
   * Reset metrics for a specific service
   */
  resetService(service: string): void {
    const queue = this.requestQueues.get(service);
    const metrics = this.metrics.get(service);

    if (queue) {
      queue.length = 0;
    }

    if (metrics) {
      metrics.totalRequests = 0;
      metrics.successfulRequests = 0;
      metrics.failedRequests = 0;
      metrics.averageResponseTimeMs = 0;
      metrics.lastRequestAt = 0;
      metrics.nextAvailableAt = 0;
    }
  }
}

// Singleton instance
let coordinator: RateLimitCoordinator | null = null;

export function getRateLimitCoordinator(): RateLimitCoordinator {
  if (!coordinator) {
    coordinator = new RateLimitCoordinator();
  }
  return coordinator;
}
