/**
 * Short-TTL Bounded In-Memory Cache for Public Directory Queries
 * Prevents redundant database queries under heavy concurrent load (PERF-01).
 */
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class DirectoryCacheService {
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTtlMs: number;
  private readonly maxEntries: number;

  constructor(defaultTtlSeconds = 30, maxEntries = 500) {
    this.defaultTtlMs = defaultTtlSeconds * 1000;
    this.maxEntries = maxEntries;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlSeconds?: number): void {
    // Evict oldest entries if capacity reached to avoid memory leaks
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const ttlMs = ttlSeconds !== undefined ? ttlSeconds * 1000 : this.defaultTtlMs;
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const directoryCacheService = new DirectoryCacheService(30, 500);
