/**
 * API Response Caching System - Phase 3
 * 
 * Implements intelligent caching for API responses with TTL, invalidation,
 * and memory management following ASGI compliance patterns.
 */

import { featureFlags } from './featureFlags';

export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  key: string;
  version: number;
}

export interface CacheOptions {
  ttl?: number; // Default 5 minutes
  version?: number; // For cache invalidation
  maxSize?: number; // Max cache entries
}

class APICache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 100; // Prevent memory bloat
  private version = 1;

  /**
   * Get cached data if valid, otherwise return null
   */
  get<T>(key: string): T | null {
    if (!featureFlags.isEnabled('enableApiCaching')) {
      return null;
    }

    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry is expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      if (featureFlags.isEnabled('enableDebugMode')) {
        console.log(`[APICache] Expired entry removed: ${key}`);
      }
      return null;
    }

    // Check if entry is from old version (for invalidation)
    if (entry.version < this.version) {
      this.cache.delete(key);
      if (featureFlags.isEnabled('enableDebugMode')) {
        console.log(`[APICache] Stale version removed: ${key}`);
      }
      return null;
    }

    if (featureFlags.isEnabled('enableDebugMode')) {
      console.log(`[APICache] Cache hit: ${key}`);
    }

    return entry.data as T;
  }

  /**
   * Store data in cache with options
   */
  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    if (!featureFlags.isEnabled('enableApiCaching')) {
      return;
    }

    // Enforce cache size limits
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictOldest();
    }

    const ttl = options.ttl || this.DEFAULT_TTL;
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      key,
      version: options.version || this.version
    };

    this.cache.set(key, entry);

    if (featureFlags.isEnabled('enableDebugMode')) {
      console.log(`[APICache] Cached: ${key} (TTL: ${ttl}ms)`);
    }
  }

  /**
   * Remove specific cache entry
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted && featureFlags.isEnabled('enableDebugMode')) {
      console.log(`[APICache] Deleted: ${key}`);
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    if (featureFlags.isEnabled('enableDebugMode')) {
      console.log(`[APICache] Cleared ${size} entries`);
    }
  }

  /**
   * Invalidate all cache entries by bumping version
   */
  invalidateAll(): void {
    this.version++;
    if (featureFlags.isEnabled('enableDebugMode')) {
      console.log(`[APICache] Invalidated all entries (version ${this.version})`);
    }
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  invalidatePattern(pattern: string | RegExp): number {
    let count = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    if (featureFlags.isEnabled('enableDebugMode')) {
      console.log(`[APICache] Invalidated ${count} entries matching ${pattern}`);
    }

    return count;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let expiredCount = 0;
    let validCount = 0;

    for (const entry of this.cache.values()) {
      if (now - entry.timestamp > entry.ttl || entry.version < this.version) {
        expiredCount++;
      } else {
        validCount++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries: validCount,
      expiredEntries: expiredCount,
      currentVersion: this.version,
      maxSize: this.MAX_CACHE_SIZE
    };
  }

  /**
   * Clean expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl || entry.version < this.version) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0 && featureFlags.isEnabled('enableDebugMode')) {
      console.log(`[APICache] Cleaned ${cleaned} expired entries`);
    }

    return cleaned;
  }

  /**
   * Remove oldest entries when cache is full
   */
  private evictOldest(): void {
    const entries = Array.from(this.cache.entries());
    entries.sort(([, a], [, b]) => a.timestamp - b.timestamp);
    
    // Remove oldest 20% of entries
    const toRemove = Math.ceil(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }

    if (featureFlags.isEnabled('enableDebugMode')) {
      console.log(`[APICache] Evicted ${toRemove} oldest entries`);
    }
  }
}

// Singleton instance
export const apiCache = new APICache();

// Auto-cleanup every 10 minutes
if (typeof window !== 'undefined') {
  setInterval(() => apiCache.cleanup(), 10 * 60 * 1000);
}

/**
 * Higher-order function to wrap API calls with caching
 */
export function withCache<T extends (...args: never[]) => Promise<unknown>>(
  fn: T,
  getCacheKey: (...args: Parameters<T>) => string,
  options?: CacheOptions
): T {
  return (async (...args: Parameters<T>) => {
    const cacheKey = getCacheKey(...args);
    
    // Try cache first
    const cached = apiCache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Call original function
    const result = await fn(...args);
    
    // Cache the result
    apiCache.set(cacheKey, result, options);
    
    return result;
  }) as T;
}