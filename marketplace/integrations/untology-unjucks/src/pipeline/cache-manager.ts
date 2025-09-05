import { promises as fs } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { CacheEntry } from '../types.js';

export class CacheManager {
  private memoryCache: Map<string, CacheEntry>;
  private persistentCacheDir: string;
  private maxMemorySize: number;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor(options: {
    persistentCacheDir?: string;
    maxMemorySize?: number;
    cleanupIntervalMs?: number;
  } = {}) {
    this.memoryCache = new Map();
    this.persistentCacheDir = options.persistentCacheDir || './.unjucks-cache';
    this.maxMemorySize = options.maxMemorySize || 100; // Max number of entries
    
    // Start cleanup interval
    if (options.cleanupIntervalMs !== 0) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, options.cleanupIntervalMs || 60000); // Default 1 minute
    } else {
      this.cleanupInterval = null;
    }
  }

  async get(key: string): Promise<any> {
    this.trackAccess();
    
    // Check memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && this.isValid(memoryEntry)) {
      this.trackHit();
      return memoryEntry.data;
    }

    // Check persistent cache
    try {
      const persistentEntry = await this.getPersistent(key);
      if (persistentEntry && this.isValid(persistentEntry)) {
        // Promote to memory cache
        this.memoryCache.set(key, persistentEntry);
        this.trackHit();
        return persistentEntry.data;
      }
    } catch (error) {
      // Persistent cache miss or error - continue
    }

    return null;
  }

  set(key: string, data: any, ttlSeconds: number = 3600, dependencies: string[] = []): void {
    const entry: CacheEntry = {
      key,
      data,
      timestamp: new Date(),
      ttl: ttlSeconds * 1000, // Convert to milliseconds
      dependencies,
    };

    // Add to memory cache
    this.memoryCache.set(key, entry);

    // Evict oldest entries if cache is full
    if (this.memoryCache.size > this.maxMemorySize) {
      this.evictOldest();
    }

    // Store in persistent cache asynchronously
    this.setPersistent(key, entry).catch(error => {
      console.warn('Failed to write to persistent cache:', error.message);
    });
  }

  async invalidate(key: string): Promise<void> {
    // Remove from memory cache
    this.memoryCache.delete(key);

    // Remove from persistent cache
    try {
      await this.deletePersistent(key);
    } catch (error) {
      // Ignore errors - cache might not exist
    }
  }

  async invalidateByDependency(dependency: string): Promise<void> {
    // Find all entries that depend on the given file/resource
    const keysToInvalidate: string[] = [];

    for (const [key, entry] of this.memoryCache) {
      if (entry.dependencies.includes(dependency)) {
        keysToInvalidate.push(key);
      }
    }

    // Invalidate found entries
    await Promise.all(keysToInvalidate.map(key => this.invalidate(key)));
  }

  clear(): void {
    this.memoryCache.clear();
    
    // Clear persistent cache asynchronously
    this.clearPersistent().catch(error => {
      console.warn('Failed to clear persistent cache:', error.message);
    });
  }

  private isValid(entry: CacheEntry): boolean {
    const now = Date.now();
    const entryTime = entry.timestamp.getTime();
    return (now - entryTime) < entry.ttl;
  }

  private evictOldest(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.memoryCache) {
      if (entry.timestamp.getTime() < oldestTime) {
        oldestTime = entry.timestamp.getTime();
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.memoryCache) {
      if (!this.isValid(entry)) {
        expiredKeys.push(key);
      }
    }

    // Remove expired entries
    expiredKeys.forEach(key => this.memoryCache.delete(key));
  }

  private async ensureCacheDir(): Promise<void> {
    try {
      await fs.mkdir(this.persistentCacheDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  private getCacheFilePath(key: string): string {
    const hash = createHash('md5').update(key).digest('hex');
    return join(this.persistentCacheDir, `${hash}.json`);
  }

  private async getPersistent(key: string): Promise<CacheEntry | null> {
    await this.ensureCacheDir();
    
    const filePath = this.getCacheFilePath(key);
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const entry = JSON.parse(content) as CacheEntry;
      
      // Parse timestamp back to Date object
      entry.timestamp = new Date(entry.timestamp);
      
      return entry;
    } catch (error) {
      return null;
    }
  }

  private async setPersistent(key: string, entry: CacheEntry): Promise<void> {
    await this.ensureCacheDir();
    
    const filePath = this.getCacheFilePath(key);
    const content = JSON.stringify(entry, null, 2);
    
    await fs.writeFile(filePath, content, 'utf-8');
  }

  private async deletePersistent(key: string): Promise<void> {
    const filePath = this.getCacheFilePath(key);
    
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // File might not exist - ignore error
    }
  }

  private async clearPersistent(): Promise<void> {
    try {
      await this.ensureCacheDir();
      
      const files = await fs.readdir(this.persistentCacheDir);
      
      await Promise.all(
        files
          .filter(file => file.endsWith('.json'))
          .map(file => fs.unlink(join(this.persistentCacheDir, file)))
      );
    } catch (error) {
      // Directory might not exist - ignore error
    }
  }

  // Utility methods for cache management

  getStats(): {
    memoryEntries: number;
    memorySize: string;
    hitRate: number;
    accessCount: number;
    hitCount: number;
  } {
    const memoryEntries = this.memoryCache.size;
    
    // Estimate memory usage
    let memoryBytes = 0;
    for (const entry of this.memoryCache.values()) {
      memoryBytes += JSON.stringify(entry).length * 2; // Rough estimate
    }
    
    const memorySize = this.formatBytes(memoryBytes);
    
    return {
      memoryEntries,
      memorySize,
      hitRate: this.getHitRate(),
      accessCount: this.accessCount,
      hitCount: this.hitCount,
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async vacuum(): Promise<void> {
    // Remove expired entries from persistent cache
    try {
      await this.ensureCacheDir();
      
      const files = await fs.readdir(this.persistentCacheDir);
      const now = Date.now();
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        try {
          const filePath = join(this.persistentCacheDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const entry = JSON.parse(content) as CacheEntry;
          
          entry.timestamp = new Date(entry.timestamp);
          
          if (!this.isValid(entry)) {
            await fs.unlink(filePath);
          }
        } catch (error) {
          // Delete corrupted cache files
          await fs.unlink(join(this.persistentCacheDir, file));
        }
      }
    } catch (error) {
      console.warn('Failed to vacuum cache:', error.message);
    }
  }

  // Generate cache key from multiple components
  static generateKey(...components: (string | number | object)[]): string {
    const normalized = components.map(comp => {
      if (typeof comp === 'object') {
        return JSON.stringify(comp);
      }
      return String(comp);
    }).join(':');
    
    return createHash('sha256').update(normalized).digest('hex');
  }

  // Intelligent caching strategies
  async getOrCompute<T>(key: string, computeFn: () => Promise<T>, ttl: number = 3600, dependencies: string[] = []): Promise<T> {
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    const computed = await computeFn();
    this.set(key, computed, ttl, dependencies);
    return computed;
  }

  createOntologyKey(ontologyPath: string, operation: string, ...params: string[]): string {
    return CacheManager.generateKey('ontology', ontologyPath, operation, ...params);
  }

  createTemplateKey(templatePath: string, contextHash: string): string {
    return CacheManager.generateKey('template', templatePath, contextHash);
  }

  createQueryKey(sparql: string, contextHash: string): string {
    return CacheManager.generateKey('query', createHash('md5').update(sparql).digest('hex'), contextHash);
  }

  // Cache warming for better performance
  async warmCache(warmupFunctions: Array<{ key: string; fn: () => Promise<unknown>; ttl?: number; dependencies?: string[] }>): Promise<void> {
    const promises = warmupFunctions.map(async ({ key, fn, ttl, dependencies }) => {
      try {
        const data = await fn();
        this.set(key, data, ttl, dependencies);
      } catch (error) {
        console.warn(`Cache warmup failed for key ${key}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  // Statistics tracking
  private accessCount = 0;
  private hitCount = 0;

  trackAccess(): void {
    this.accessCount++;
  }

  trackHit(): void {
    this.hitCount++;
  }

  getHitRate(): number {
    return this.accessCount > 0 ? this.hitCount / this.accessCount : 0;
  }

  resetStats(): void {
    this.accessCount = 0;
    this.hitCount = 0;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.clear();
  }
}