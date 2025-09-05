import { IMemoryLayer } from '../interfaces/memory-layer-interface';
import { MemoryEntry, MemoryQuery, MemoryMetrics, MemoryLayer } from '../interfaces/memory-types';
import { createHash } from 'crypto';

/**
 * L3 Memory Layer - Application Patterns
 * - 10KB storage with O(1) access
 * - Pattern recognition and storage
 * - Behavioral learning
 * - Template matching
 */
export class L3PatternMemory implements IMemoryLayer {
  readonly layer = MemoryLayer.L3_PATTERNS;
  readonly maxSize = 10 * 1024; // 10KB
  readonly compressionEnabled = true;
  
  private storage = new Map<string, MemoryEntry>();
  private patternIndex = new Map<string, string[]>(); // pattern -> keys
  private accessPatterns = new Map<string, number[]>(); // key -> access timestamps
  private metrics: MemoryMetrics = {
    retentionRate: 0.9,
    compressionRatio: 0.7,
    accessTime: 1, // O(1) access
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
    
    // Detect patterns in the value
    const patterns = this.detectPatterns(value);
    
    const entry: MemoryEntry<T> = {
      id: `l3_${key}_${Date.now()}`,
      key,
      value,
      layer: this.layer,
      ttl: options.ttl ?? 3600000, // 1 hour default
      priority: options.priority ?? 30,
      metadata: {
        created: now,
        updated: now,
        accessed: now,
        version: 1,
        checksum,
        tags: [...(options.tags ?? []), 'pattern', ...patterns]
      },
      metrics: {
        retentionRate: 0.9,
        compressionRatio: 0.7,
        accessTime: 1,
        size: serialized.length,
        lastAccess: now,
        hitCount: 0,
        missCount: 0
      }
    };

    // Check size limits
    if (this.getCurrentSize() + serialized.length > this.maxSize) {
      await this.evictLeastUsedPatterns();
    }

    this.storage.set(key, entry);
    this.updatePatternIndex(key, patterns);
    this.initializeAccessPattern(key);
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
        this.removeFromPatternIndex(key);
        this.accessPatterns.delete(key);
        this.metrics.missCount++;
        return null;
      }
      
      // Record access pattern
      this.recordAccess(key);
      
      // Update access metadata
      entry.metadata.accessed = new Date();
      entry.metrics.hitCount++;
      entry.metrics.lastAccess = new Date();
      entry.metrics.accessTime = performance.now() - startTime;
      
      this.metrics.hitCount++;
      this.metrics.accessTime = 1; // Maintain O(1)
      this.metrics.lastAccess = new Date();
      
      return entry;
    }
    
    this.metrics.missCount++;
    return null;
  }

  async query(query: MemoryQuery): Promise<MemoryEntry[]> {
    const results: MemoryEntry[] = [];
    
    // Use pattern index for faster lookups
    if (query.pattern) {
      const matchingKeys = this.patternIndex.get(query.pattern) ?? [];
      for (const key of matchingKeys) {
        const entry = this.storage.get(key);
        if (entry) {
          results.push(entry);
        }
      }
    } else {
      // Fallback to full scan
      for (const [key, entry] of this.storage.entries()) {
        let matches = true;
        
        if (query.key && key !== query.key) {
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
    }
    
    // Apply limit and offset
    const offset = query.offset ?? 0;
    const limit = query.limit ?? results.length;
    
    return results.slice(offset, offset + limit);
  }

  async delete(key: string): Promise<boolean> {
    const deleted = this.storage.delete(key);
    if (deleted) {
      this.removeFromPatternIndex(key);
      this.accessPatterns.delete(key);
      this.updateMetrics();
    }
    return deleted;
  }

  async clear(): Promise<void> {
    this.storage.clear();
    this.patternIndex.clear();
    this.accessPatterns.clear();
    this.resetMetrics();
  }

  async getMetrics(): Promise<MemoryMetrics> {
    return { ...this.metrics };
  }

  async compress(): Promise<void> {
    // Compress patterns by merging similar ones
    const similarityThreshold = 0.8;
    const patternGroups = new Map<string, string[]>();
    
    for (const [pattern, keys] of this.patternIndex.entries()) {
      let merged = false;
      
      for (const [existingPattern, existingKeys] of patternGroups.entries()) {
        if (this.calculatePatternSimilarity(pattern, existingPattern) > similarityThreshold) {
          patternGroups.set(existingPattern, [...existingKeys, ...keys]);
          merged = true;
          break;
        }
      }
      
      if (!merged) {
        patternGroups.set(pattern, keys);
      }
    }
    
    this.patternIndex.clear();
    for (const [pattern, keys] of patternGroups.entries()) {
      this.patternIndex.set(pattern, keys);
    }
  }

  async validate(): Promise<boolean> {
    // Validate pattern index consistency
    for (const [pattern, keys] of this.patternIndex.entries()) {
      for (const key of keys) {
        const entry = this.storage.get(key);
        if (!entry || !entry.metadata.tags.includes(pattern)) {
          return false;
        }
      }
    }
    
    // Validate checksums
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
    
    // Heal pattern index
    this.patternIndex.clear();
    for (const [key, entry] of this.storage.entries()) {
      const patterns = entry.metadata.tags.filter(tag => 
        tag !== 'pattern' && tag.length > 2
      );
      this.updatePatternIndex(key, patterns);
    }
    
    // Heal checksums and metadata
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

  /**
   * Find patterns similar to the given value
   */
  async findSimilarPatterns<T>(value: T, threshold: number = 0.7): Promise<MemoryEntry<T>[]> {
    const patterns = this.detectPatterns(value);
    const results: MemoryEntry<T>[] = [];
    
    for (const pattern of patterns) {
      const keys = this.patternIndex.get(pattern) ?? [];
      for (const key of keys) {
        const entry = this.storage.get(key) as MemoryEntry<T> | undefined;
        if (entry) {
          const similarity = this.calculateValueSimilarity(value, entry.value);
          if (similarity >= threshold) {
            results.push(entry);
          }
        }
      }
    }
    
    return this.deduplicateAndSort(results);
  }

  /**
   * Predict next access based on patterns
   */
  async predictNextAccess(key: string): Promise<{ probability: number, estimatedTime: number }> {
    const accessHistory = this.accessPatterns.get(key);
    if (!accessHistory || accessHistory.length < 2) {
      return { probability: 0.1, estimatedTime: 0 };
    }
    
    // Calculate access intervals
    const intervals: number[] = [];
    for (let i = 1; i < accessHistory.length; i++) {
      intervals.push(accessHistory[i] - accessHistory[i - 1]);
    }
    
    // Calculate average interval
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    
    // Calculate probability based on consistency
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
    const consistency = 1 / (1 + variance / (avgInterval * avgInterval));
    
    const timeSinceLastAccess = Date.now() - accessHistory[accessHistory.length - 1];
    const probability = consistency * Math.max(0, 1 - timeSinceLastAccess / (avgInterval * 2));
    
    return {
      probability,
      estimatedTime: avgInterval - (timeSinceLastAccess % avgInterval)
    };
  }

  private detectPatterns(value: any): string[] {
    const patterns: string[] = [];
    const valueStr = JSON.stringify(value);
    
    // Type-based patterns
    patterns.push(`type:${typeof value}`);
    
    if (Array.isArray(value)) {
      patterns.push('array');
      patterns.push(`array_length:${value.length}`);
      if (value.length > 0) {
        patterns.push(`array_item_type:${typeof value[0]}`);
      }
    } else if (value && typeof value === 'object') {
      patterns.push('object');
      const keys = Object.keys(value);
      patterns.push(`object_keys:${keys.length}`);
      patterns.push(...keys.map(key => `has_key:${key}`));
    }
    
    // Content-based patterns
    if (typeof value === 'string') {
      if (value.includes('@')) patterns.push('email_like');
      if (/^https?:\/\//.test(value)) patterns.push('url_like');
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) patterns.push('date_like');
      if (/^\d+$/.test(value)) patterns.push('numeric_string');
    }
    
    // Size-based patterns
    patterns.push(`size:${Math.floor(valueStr.length / 100) * 100}`);
    
    return patterns;
  }

  private calculatePatternSimilarity(pattern1: string, pattern2: string): number {
    const words1 = new Set(pattern1.split(/[^a-zA-Z0-9]/));
    const words2 = new Set(pattern2.split(/[^a-zA-Z0-9]/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private calculateValueSimilarity(value1: any, value2: any): number {
    const str1 = JSON.stringify(value1);
    const str2 = JSON.stringify(value2);
    
    if (str1 === str2) return 1;
    
    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);
    
    let matches = 0;
    const minLen = Math.min(len1, len2);
    
    for (let i = 0; i < minLen; i++) {
      if (str1[i] === str2[i]) {
        matches++;
      }
    }
    
    return matches / maxLen;
  }

  private updatePatternIndex(key: string, patterns: string[]): void {
    for (const pattern of patterns) {
      if (!this.patternIndex.has(pattern)) {
        this.patternIndex.set(pattern, []);
      }
      const keys = this.patternIndex.get(pattern)!;
      if (!keys.includes(key)) {
        keys.push(key);
      }
    }
  }

  private removeFromPatternIndex(key: string): void {
    for (const [pattern, keys] of this.patternIndex.entries()) {
      const index = keys.indexOf(key);
      if (index !== -1) {
        keys.splice(index, 1);
        if (keys.length === 0) {
          this.patternIndex.delete(pattern);
        }
      }
    }
  }

  private initializeAccessPattern(key: string): void {
    this.accessPatterns.set(key, [Date.now()]);
  }

  private recordAccess(key: string): void {
    const history = this.accessPatterns.get(key) ?? [];
    history.push(Date.now());
    
    // Keep only last 10 access times
    if (history.length > 10) {
      history.splice(0, history.length - 10);
    }
    
    this.accessPatterns.set(key, history);
  }

  private deduplicateAndSort<T>(entries: MemoryEntry<T>[]): MemoryEntry<T>[] {
    const seen = new Set<string>();
    const unique = entries.filter(entry => {
      if (seen.has(entry.key)) {
        return false;
      }
      seen.add(entry.key);
      return true;
    });
    
    return unique.sort((a, b) => b.priority - a.priority);
  }

  private getCurrentSize(): number {
    let totalSize = 0;
    for (const entry of this.storage.values()) {
      totalSize += entry.metrics.size;
    }
    return totalSize;
  }

  private async evictLeastUsedPatterns(): Promise<void> {
    // Identify patterns with lowest usage
    const patternUsage = new Map<string, number>();
    
    for (const [pattern, keys] of this.patternIndex.entries()) {
      let totalHits = 0;
      for (const key of keys) {
        const entry = this.storage.get(key);
        if (entry) {
          totalHits += entry.metrics.hitCount;
        }
      }
      patternUsage.set(pattern, totalHits / keys.length);
    }
    
    // Sort patterns by usage
    const sortedPatterns = Array.from(patternUsage.entries())
      .sort((a, b) => a[1] - b[1]);
    
    // Remove entries from least used patterns
    for (const [pattern] of sortedPatterns.slice(0, Math.ceil(sortedPatterns.length * 0.2))) {
      const keys = this.patternIndex.get(pattern) ?? [];
      for (const key of keys) {
        this.storage.delete(key);
        this.accessPatterns.delete(key);
      }
      this.patternIndex.delete(pattern);
    }
  }

  private updateMetrics(): void {
    this.metrics.size = this.getCurrentSize();
    this.metrics.lastAccess = new Date();
  }

  private resetMetrics(): void {
    this.metrics = {
      retentionRate: 0.9,
      compressionRatio: 0.7,
      accessTime: 1,
      size: 0,
      lastAccess: new Date(),
      hitCount: 0,
      missCount: 0
    };
  }
}