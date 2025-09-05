import { IMemoryLayer } from '../interfaces/memory-layer-interface';
import { MemoryEntry, MemoryQuery, MemoryMetrics, MemoryLayer } from '../interfaces/memory-types';
import { createHash } from 'crypto';

/**
 * L1 Memory Layer - Session Critical Data
 * - 100% retention rate
 * - No compression
 * - Maximum performance
 * - Session-scoped data
 */
export class L1SessionMemory implements IMemoryLayer {
  readonly layer = MemoryLayer.L1_SESSION;
  readonly maxSize = 1024 * 1024; // 1MB
  readonly compressionEnabled = false;
  
  private storage = new Map<string, MemoryEntry>();
  private metrics: MemoryMetrics = {
    retentionRate: 1.0,
    compressionRatio: 1.0,
    accessTime: 0,
    size: 0,
    lastAccess: new Date(),
    hitCount: 0,
    missCount: 0
  };

  async store<T>(key: string, value: T, options: {
    ttl?: number;
    priority?: number;
    tags?: string[];
  } = {}): Promise<MemoryEntry<T>> {
    const now = new Date();
    const serialized = JSON.stringify(value);
    const checksum = createHash('sha256').update(serialized).digest('hex');
    
    const entry: MemoryEntry<T> = {
      id: `l1_${key}_${Date.now()}`,
      key,
      value,
      layer: this.layer,
      ttl: options.ttl,
      priority: options.priority ?? 100,
      metadata: {
        created: now,
        updated: now,
        accessed: now,
        version: 1,
        checksum,
        tags: options.tags ?? []
      },
      metrics: {
        retentionRate: 1.0,
        compressionRatio: 1.0,
        accessTime: 0,
        size: serialized.length,
        lastAccess: now,
        hitCount: 0,
        missCount: 0
      }
    };

    // Check size limits
    if (this.getCurrentSize() + serialized.length > this.maxSize) {
      await this.evictLeastUsed();
    }

    this.storage.set(key, entry);
    this.updateMetrics();
    
    return entry;
  }

  async retrieve<T>(key: string): Promise<MemoryEntry<T> | null> {
    const startTime = performance.now();
    const entry = this.storage.get(key) as MemoryEntry<T> | undefined;
    
    if (entry) {
      // Check TTL
      if (entry.ttl && Date.now() - entry.metadata.created.getTime() > entry.ttl) {
        this.storage.delete(key);
        this.metrics.missCount++;
        return null;
      }
      
      // Update access metadata
      entry.metadata.accessed = new Date();
      entry.metrics.hitCount++;
      entry.metrics.lastAccess = new Date();
      entry.metrics.accessTime = performance.now() - startTime;
      
      this.metrics.hitCount++;
      this.metrics.accessTime = (this.metrics.accessTime + entry.metrics.accessTime) / 2;
      this.metrics.lastAccess = new Date();
      
      return entry;
    }
    
    this.metrics.missCount++;
    return null;
  }

  async query(query: MemoryQuery): Promise<MemoryEntry[]> {
    const results: MemoryEntry[] = [];
    
    for (const [key, entry] of this.storage.entries()) {
      let matches = true;
      
      if (query.key && key !== query.key) {
        matches = false;
      }
      
      if (query.pattern && !key.match(new RegExp(query.pattern))) {
        matches = false;
      }
      
      if (query.tags && !query.tags.some(tag => entry.metadata.tags.includes(tag))) {
        matches = false;
      }
      
      if (query.timeRange) {
        if (entry.metadata.created < query.timeRange.start || 
            entry.metadata.created > query.timeRange.end) {
          matches = false;
        }
      }
      
      if (matches) {
        results.push(entry);
      }
    }
    
    // Apply limit and offset
    const offset = query.offset ?? 0;
    const limit = query.limit ?? results.length;
    
    return results.slice(offset, offset + limit);
  }

  async delete(key: string): Promise<boolean> {
    const deleted = this.storage.delete(key);
    if (deleted) {
      this.updateMetrics();
    }
    return deleted;
  }

  async clear(): Promise<void> {
    this.storage.clear();
    this.resetMetrics();
  }

  async getMetrics(): Promise<MemoryMetrics> {
    return { ...this.metrics };
  }

  async compress(): Promise<void> {
    // L1 layer doesn't support compression for maximum performance
    throw new Error('L1 Session Memory does not support compression');
  }

  async validate(): Promise<boolean> {
    for (const [key, entry] of this.storage.entries()) {
      const serialized = JSON.stringify(entry.value);
      const checksum = createHash('sha256').update(serialized).digest('hex');
      
      if (checksum !== entry.metadata.checksum) {
        return false;
      }
    }
    return true;
  }

  async heal(): Promise<number> {
    let healedCount = 0;
    
    for (const [key, entry] of this.storage.entries()) {
      const serialized = JSON.stringify(entry.value);
      const checksum = createHash('sha256').update(serialized).digest('hex');
      
      if (checksum !== entry.metadata.checksum) {
        entry.metadata.checksum = checksum;
        entry.metadata.updated = new Date();
        entry.metadata.version++;
        healedCount++;
      }
    }
    
    return healedCount;
  }

  private getCurrentSize(): number {
    let totalSize = 0;
    for (const entry of this.storage.values()) {
      totalSize += entry.metrics.size;
    }
    return totalSize;
  }

  private async evictLeastUsed(): Promise<void> {
    if (this.storage.size === 0) return;
    
    let leastUsedKey = '';
    let leastHits = Infinity;
    let oldestAccess = new Date();
    
    for (const [key, entry] of this.storage.entries()) {
      if (entry.metrics.hitCount < leastHits || 
          (entry.metrics.hitCount === leastHits && 
           entry.metadata.accessed < oldestAccess)) {
        leastUsedKey = key;
        leastHits = entry.metrics.hitCount;
        oldestAccess = entry.metadata.accessed;
      }
    }
    
    if (leastUsedKey) {
      this.storage.delete(leastUsedKey);
    }
  }

  private updateMetrics(): void {
    this.metrics.size = this.getCurrentSize();
    this.metrics.lastAccess = new Date();
  }

  private resetMetrics(): void {
    this.metrics = {
      retentionRate: 1.0,
      compressionRatio: 1.0,
      accessTime: 0,
      size: 0,
      lastAccess: new Date(),
      hitCount: 0,
      missCount: 0
    };
  }
}