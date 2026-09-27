import { DirectoryCacheService } from '../../../../src/modules/directory/infrastructure/directory-cache.service';

describe('DirectoryCacheService Unit Tests', () => {
  let cache: DirectoryCacheService;

  beforeEach(() => {
    cache = new DirectoryCacheService(1, 3); // 1s TTL, 3 max entries
  });

  it('should store and retrieve cached items', () => {
    cache.set('key1', { message: 'hello' });
    const result = cache.get<{ message: string }>('key1');
    expect(result).toEqual({ message: 'hello' });
  });

  it('should return null on cache miss', () => {
    const result = cache.get('nonexistent');
    expect(result).toBeNull();
  });

  it('should expire items after TTL', async () => {
    cache.set('key-exp', 'value', 0.05); // 50ms TTL
    expect(cache.get('key-exp')).toBe('value');

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(cache.get('key-exp')).toBeNull();
  });

  it('should evict oldest items when max capacity is reached', () => {
    cache.set('k1', 1);
    cache.set('k2', 2);
    cache.set('k3', 3);
    expect(cache.size()).toBe(3);

    // Adding 4th item must evict k1
    cache.set('k4', 4);
    expect(cache.size()).toBe(3);
    expect(cache.get('k1')).toBeNull();
    expect(cache.get('k2')).toBe(2);
    expect(cache.get('k4')).toBe(4);
  });

  it('should clear all cache entries', () => {
    cache.set('k1', 1);
    cache.set('k2', 2);
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.get('k1')).toBeNull();
  });
});
