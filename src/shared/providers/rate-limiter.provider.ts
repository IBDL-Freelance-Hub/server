export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

export interface IRateLimiterProvider {
  isRateLimited(key: string, options: RateLimitOptions): Promise<boolean>;
  reset(key?: string): Promise<void>;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
  lastAccessed: number;
}

/**
 * MemoryRateLimiter
 * High-performance, bounded, in-memory rate limiter with LRU/TTL eviction.
 * Completely timerless to prevent Node.js event loop handles or Jest open handle leaks.
 */
export class MemoryRateLimiter implements IRateLimiterProvider {
  private readonly cache = new Map<string, RateLimitEntry>();

  constructor(private readonly maxCapacity = 5000) {}

  async isRateLimited(key: string, options: RateLimitOptions): Promise<boolean> {
    const now = Date.now();
    let entry = this.cache.get(key);

    if (entry) {
      // Lazy TTL Eviction: Check if window has expired
      if (now - entry.windowStart > options.windowMs) {
        entry.count = 0;
        entry.windowStart = now;
      }
      entry.lastAccessed = now;
    } else {
      // Bounded LRU Eviction: Evict oldest entry if capacity reached
      if (this.cache.size >= this.maxCapacity) {
        this.evictOldestEntry();
      }

      entry = {
        count: 0,
        windowStart: now,
        lastAccessed: now,
      };
    }

    entry.count += 1;
    this.cache.set(key, entry);

    return entry.count > options.maxRequests;
  }

  async reset(key?: string): Promise<void> {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Evicts the least recently accessed key to maintain hard upper bound memory safety.
   */
  private evictOldestEntry(): void {
    let oldestKey: string | null = null;
    let oldestAccessTime = Infinity;

    for (const [k, v] of this.cache.entries()) {
      if (v.lastAccessed < oldestAccessTime) {
        oldestAccessTime = v.lastAccessed;
        oldestKey = k;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}
