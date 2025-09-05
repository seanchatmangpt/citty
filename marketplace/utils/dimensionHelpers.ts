/**
 * Helper utilities for working with n-dimensional data
 */

import type { MarketplaceItem, DimensionalVector } from '../types';

export interface DimensionStats {
  dimension: string;
  type: 'number' | 'string' | 'boolean';
  min?: number;
  max?: number;
  avg?: number;
  uniqueValues?: Set<any>;
  distribution?: Record<string, number>;
}

export interface SimilarityResult {
  item: MarketplaceItem;
  similarity: number;
  matchingDimensions: string[];
}

/**
 * Analyze dimensions across all items
 */
export function analyzeDimensions(items: MarketplaceItem[]): DimensionStats[] {
  const dimensionMap = new Map<string, any[]>();
  
  // Collect all values for each dimension
  items.forEach(item => {
    Object.entries(item.dimensions).forEach(([dim, value]) => {
      if (!dimensionMap.has(dim)) {
        dimensionMap.set(dim, []);
      }
      dimensionMap.get(dim)!.push(value);
    });
  });
  
  const stats: DimensionStats[] = [];
  
  dimensionMap.forEach((values, dimension) => {
    const stat: DimensionStats = {
      dimension,
      type: inferDimensionType(values),
      uniqueValues: new Set(values)
    };
    
    if (stat.type === 'number') {
      const numericValues = values.filter(v => typeof v === 'number') as number[];
      if (numericValues.length > 0) {
        stat.min = Math.min(...numericValues);
        stat.max = Math.max(...numericValues);
        stat.avg = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
      }
    } else {
      // Calculate distribution for categorical data
      stat.distribution = {};
      values.forEach(value => {
        const key = String(value);
        stat.distribution![key] = (stat.distribution![key] || 0) + 1;
      });
    }
    
    stats.push(stat);
  });
  
  return stats.sort((a, b) => a.dimension.localeCompare(b.dimension));
}

/**
 * Infer the type of a dimension based on its values
 */
export function inferDimensionType(values: any[]): 'number' | 'string' | 'boolean' {
  const nonNullValues = values.filter(v => v !== null && v !== undefined);
  
  if (nonNullValues.length === 0) return 'string';
  
  // Check if all values are boolean
  if (nonNullValues.every(v => typeof v === 'boolean')) {
    return 'boolean';
  }
  
  // Check if all values are numbers
  if (nonNullValues.every(v => typeof v === 'number' && !isNaN(v))) {
    return 'number';
  }
  
  return 'string';
}

/**
 * Calculate similarity between two items based on their dimensions
 */
export function calculateSimilarity(
  item1: MarketplaceItem, 
  item2: MarketplaceItem,
  weights?: Record<string, number>
): number {
  const dims1 = item1.dimensions;
  const dims2 = item2.dimensions;
  
  // Find common dimensions
  const commonDims = Object.keys(dims1).filter(dim => dim in dims2);
  
  if (commonDims.length === 0) return 0;
  
  let totalSimilarity = 0;
  let totalWeight = 0;
  
  commonDims.forEach(dim => {
    const weight = weights?.[dim] || 1;
    const val1 = dims1[dim];
    const val2 = dims2[dim];
    
    let similarity = 0;
    
    if (typeof val1 === 'number' && typeof val2 === 'number') {
      // Numerical similarity (inverse of normalized difference)
      const maxVal = Math.max(Math.abs(val1), Math.abs(val2), 1);
      similarity = 1 - Math.abs(val1 - val2) / maxVal;
    } else if (typeof val1 === 'boolean' && typeof val2 === 'boolean') {
      // Boolean similarity (exact match)
      similarity = val1 === val2 ? 1 : 0;
    } else {
      // String similarity (exact match for now, could use edit distance)
      similarity = String(val1).toLowerCase() === String(val2).toLowerCase() ? 1 : 0;
    }
    
    totalSimilarity += similarity * weight;
    totalWeight += weight;
  });
  
  return totalWeight > 0 ? totalSimilarity / totalWeight : 0;
}

/**
 * Find similar items to a given item
 */
export function findSimilarItems(
  targetItem: MarketplaceItem,
  items: MarketplaceItem[],
  options: {
    limit?: number;
    minSimilarity?: number;
    weights?: Record<string, number>;
    excludeIds?: string[];
  } = {}
): SimilarityResult[] {
  const {
    limit = 10,
    minSimilarity = 0.1,
    weights,
    excludeIds = []
  } = options;
  
  const results: SimilarityResult[] = [];
  
  items.forEach(item => {
    if (item.id === targetItem.id || excludeIds.includes(item.id)) {
      return;
    }
    
    const similarity = calculateSimilarity(targetItem, item, weights);
    
    if (similarity >= minSimilarity) {
      const matchingDims = Object.keys(targetItem.dimensions)
        .filter(dim => dim in item.dimensions);
      
      results.push({
        item,
        similarity,
        matchingDimensions: matchingDims
      });
    }
  });
  
  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Normalize dimensional values for visualization
 */
export function normalizeDimensions(
  items: MarketplaceItem[],
  dimensions: string[]
): Array<{ item: MarketplaceItem; normalizedValues: number[] }> {
  const stats = analyzeDimensions(items);
  const dimensionStats = new Map(stats.map(s => [s.dimension, s]));
  
  return items.map(item => {
    const normalizedValues = dimensions.map(dim => {
      const value = item.dimensions[dim];
      const stat = dimensionStats.get(dim);
      
      if (!stat) return 0;
      
      if (stat.type === 'number' && typeof value === 'number') {
        if (stat.min === stat.max) return 0.5;
        return (value - (stat.min || 0)) / ((stat.max || 1) - (stat.min || 0));
      } else if (stat.type === 'boolean') {
        return value ? 1 : 0;
      } else {
        // For categorical, use hash of string value
        return (hashString(String(value)) % 100) / 100;
      }
    });
    
    return {
      item,
      normalizedValues
    };
  });
}

/**
 * Perform Principal Component Analysis on dimensional data
 */
export function performPCA(
  items: MarketplaceItem[],
  dimensions: string[],
  components: number = 2
): Array<{ item: MarketplaceItem; components: number[] }> {
  const normalized = normalizeDimensions(items, dimensions);
  
  if (normalized.length === 0 || dimensions.length === 0) {
    return items.map(item => ({ item, components: [0, 0] }));
  }
  
  // Simplified PCA - in production, use a proper math library
  const matrix = normalized.map(n => n.normalizedValues);
  
  // Center the data
  const means = dimensions.map((_, dimIndex) => {
    const sum = matrix.reduce((acc, row) => acc + row[dimIndex], 0);
    return sum / matrix.length;
  });
  
  const centeredMatrix = matrix.map(row =>
    row.map((value, index) => value - means[index])
  );
  
  // For simplicity, just project onto first two dimensions
  // In a real implementation, you'd compute eigenvectors of covariance matrix
  return normalized.map((n, index) => ({
    item: n.item,
    components: centeredMatrix[index].slice(0, components)
  }));
}

/**
 * Create clusters of similar items
 */
export function clusterItems(
  items: MarketplaceItem[],
  options: {
    numClusters?: number;
    dimensions?: string[];
    maxIterations?: number;
  } = {}
): Array<{ cluster: number; items: MarketplaceItem[] }> {
  const {
    numClusters = 3,
    dimensions = Object.keys(items[0]?.dimensions || {}),
    maxIterations = 10
  } = options;
  
  if (items.length === 0 || dimensions.length === 0) {
    return [{ cluster: 0, items: [...items] }];
  }
  
  const normalized = normalizeDimensions(items, dimensions);
  
  // Simple k-means clustering implementation
  // Initialize centroids randomly
  const centroids: number[][] = [];
  for (let i = 0; i < numClusters; i++) {
    centroids.push(dimensions.map(() => Math.random()));
  }
  
  let assignments = new Array(items.length).fill(0);
  
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    // Assign points to nearest centroid
    const newAssignments = normalized.map((n, index) => {
      let minDistance = Infinity;
      let bestCluster = 0;
      
      centroids.forEach((centroid, clusterIndex) => {
        const distance = euclideanDistance(n.normalizedValues, centroid);
        if (distance < minDistance) {
          minDistance = distance;
          bestCluster = clusterIndex;
        }
      });
      
      return bestCluster;
    });
    
    // Check for convergence
    if (newAssignments.every((a, i) => a === assignments[i])) {
      break;
    }
    
    assignments = newAssignments;
    
    // Update centroids
    for (let cluster = 0; cluster < numClusters; cluster++) {
      const clusterPoints = normalized.filter((_, i) => assignments[i] === cluster);
      
      if (clusterPoints.length > 0) {
        centroids[cluster] = dimensions.map((_, dimIndex) => {
          const sum = clusterPoints.reduce((acc, point) => acc + point.normalizedValues[dimIndex], 0);
          return sum / clusterPoints.length;
        });
      }
    }
  }
  
  // Group items by cluster
  const clusters: Array<{ cluster: number; items: MarketplaceItem[] }> = [];
  
  for (let cluster = 0; cluster < numClusters; cluster++) {
    const clusterItems = items.filter((_, i) => assignments[i] === cluster);
    if (clusterItems.length > 0) {
      clusters.push({ cluster, items: clusterItems });
    }
  }
  
  return clusters;
}

/**
 * Helper functions
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

function euclideanDistance(point1: number[], point2: number[]): number {
  const sumSquaredDiffs = point1.reduce((sum, val, index) => {
    const diff = val - point2[index];
    return sum + (diff * diff);
  }, 0);
  
  return Math.sqrt(sumSquaredDiffs);
}

/**
 * Format dimension value for display
 */
export function formatDimensionValue(value: any): string {
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return value.toLocaleString();
    } else {
      return value.toFixed(2);
    }
  }
  
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  
  return String(value);
}

/**
 * Format dimension name for display
 */
export function formatDimensionName(dimension: string): string {
  return dimension
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}