/**
 * Cache Service with Redis Integration
 * Task 5: Caching & Re-generation strategy
 *
 * Provides distributed caching with TTL for reports
 * Supports both in-memory (fallback) and Redis backends
 */

import { createClient, RedisClientType } from 'redis';
import { GeneratedReport } from '../reports/ReportGenerationService';

export interface CacheConfig {
  ttlSeconds?: number; // Default: 3600 (1 hour)
  redisUrl?: string;
  useRedis?: boolean;
}

export class CacheService {
  private redisClient: RedisClientType | null = null;
  private inMemoryCache: Map<string, { data: GeneratedReport; expiresAt: number }> = new Map();
  private ttlSeconds: number;
  private useRedis: boolean;

  constructor(config: CacheConfig = {}) {
    this.ttlSeconds = config.ttlSeconds || 3600; // 1 hour default
    this.useRedis = config.useRedis ?? false;

    if (this.useRedis && config.redisUrl) {
      this.initializeRedis(config.redisUrl);
    }
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(redisUrl: string): Promise<void> {
    try {
      this.redisClient = createClient({ url: redisUrl });
      this.redisClient.on('error', (err) => console.error('Redis error:', err));
      await this.redisClient.connect();
      console.log('✅ Redis connected for caching');
    } catch (error) {
      console.error('⚠️  Failed to connect to Redis, falling back to in-memory cache:', error);
      this.redisClient = null;
      this.useRedis = false;
    }
  }

  /**
   * Task 5.2: Generate cache key
   * Format: report:{userId}:{reportDate}
   */
  private generateCacheKey(userId: string, reportDate: string): string {
    return `report:${userId}:${reportDate}`;
  }

  /**
   * Task 5.1 & 5.3: Get report from cache
   */
  async get(userId: string, reportDate: string): Promise<GeneratedReport | null> {
    const key = this.generateCacheKey(userId, reportDate);

    if (this.useRedis && this.redisClient) {
      try {
        const cached = await this.redisClient.get(key);
        if (cached) {
          console.log(`✅ Cache HIT: ${key}`);
          return JSON.parse(cached) as GeneratedReport;
        }
        console.log(`❌ Cache MISS: ${key}`);
        return null;
      } catch (error) {
        console.error('Redis get error:', error);
        return this.getFromInMemory(key);
      }
    }

    return this.getFromInMemory(key);
  }

  /**
   * Fallback: Get from in-memory cache
   */
  private getFromInMemory(key: string): GeneratedReport | null {
    const entry = this.inMemoryCache.get(key);
    if (!entry) return null;

    if (entry.expiresAt < Date.now()) {
      this.inMemoryCache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Task 5.1 & 5.3: Set report in cache with TTL
   */
  async set(userId: string, reportDate: string, report: GeneratedReport): Promise<void> {
    const key = this.generateCacheKey(userId, reportDate);

    if (this.useRedis && this.redisClient) {
      try {
        await this.redisClient.setEx(key, this.ttlSeconds, JSON.stringify(report));
        console.log(`✅ Cached: ${key} (TTL: ${this.ttlSeconds}s)`);
        return;
      } catch (error) {
        console.error('Redis set error:', error);
        // Fall through to in-memory cache
      }
    }

    this.inMemoryCache.set(key, {
      data: report,
      expiresAt: Date.now() + this.ttlSeconds * 1000,
    });
    console.log(`✅ Cached (in-memory): ${key} (TTL: ${this.ttlSeconds}s)`);
  }

  /**
   * Task 5.4: Clear cache for a specific user
   */
  async clearForUser(userId: string): Promise<void> {
    if (this.useRedis && this.redisClient) {
      try {
        const pattern = `report:${userId}:*`;
        const keys = await this.redisClient.keys(pattern);
        if (keys.length > 0) {
          await this.redisClient.del(keys);
          console.log(`✅ Cleared ${keys.length} cache entries for user ${userId}`);
        }
        return;
      } catch (error) {
        console.error('Redis delete error:', error);
      }
    }

    // In-memory fallback
    const keysToDelete = Array.from(this.inMemoryCache.keys()).filter((key) =>
      key.startsWith(`report:${userId}:`)
    );
    keysToDelete.forEach((key) => this.inMemoryCache.delete(key));
    console.log(`✅ Cleared ${keysToDelete.length} in-memory cache entries for user ${userId}`);
  }

  /**
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    if (this.useRedis && this.redisClient) {
      try {
        const keys = await this.redisClient.keys('report:*');
        if (keys.length > 0) {
          await this.redisClient.del(keys);
          console.log(`✅ Cleared all ${keys.length} cache entries`);
        }
        return;
      } catch (error) {
        console.error('Redis flush error:', error);
      }
    }

    this.inMemoryCache.clear();
    console.log(`✅ Cleared all in-memory cache entries`);
  }

  /**
   * Task 5.5: Get cache statistics
   */
  async getStats(): Promise<{
    backend: 'redis' | 'in-memory';
    size: number;
    ttlSeconds: number;
  }> {
    const size = this.useRedis && this.redisClient ? 0 : this.inMemoryCache.size;
    return {
      backend: this.useRedis && this.redisClient ? 'redis' : 'in-memory',
      size,
      ttlSeconds: this.ttlSeconds,
    };
  }

  /**
   * Graceful shutdown
   */
  async disconnect(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
      console.log('✅ Redis disconnected');
    }
  }
}
