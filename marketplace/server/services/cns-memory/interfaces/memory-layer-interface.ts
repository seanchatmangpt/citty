import { MemoryEntry, MemoryQuery, MemoryMetrics, MemoryLayer } from './memory-types';

/**
 * Base interface for all memory layers in the CNS system
 */
export interface IMemoryLayer {
  readonly layer: MemoryLayer;
  readonly maxSize: number;
  readonly compressionEnabled: boolean;
  
  /**
   * Store data in the memory layer
   */
  store<T>(key: string, value: T, options?: {
    ttl?: number;
    priority?: number;
    tags?: string[];
  }): Promise<MemoryEntry<T>>;
  
  /**
   * Retrieve data from the memory layer
   */
  retrieve<T>(key: string): Promise<MemoryEntry<T> | null>;
  
  /**
   * Query multiple entries
   */
  query(query: MemoryQuery): Promise<MemoryEntry[]>;
  
  /**
   * Delete entry from memory
   */
  delete(key: string): Promise<boolean>;
  
  /**
   * Clear all entries in the layer
   */
  clear(): Promise<void>;
  
  /**
   * Get layer metrics
   */
  getMetrics(): Promise<MemoryMetrics>;
  
  /**
   * Compress layer data (if supported)
   */
  compress(): Promise<void>;
  
  /**
   * Validate layer integrity
   */
  validate(): Promise<boolean>;
  
  /**
   * Heal corrupted entries
   */
  heal(): Promise<number>;
}