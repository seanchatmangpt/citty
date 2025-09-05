// Multi-Dimensional Search Engine for Marketplace
import type { ProductDimension, SearchQuery, SearchResult, UserDimension } from '../types/dimensional-models';
import { DimensionalMath } from '../types/dimensional-models';

export interface SearchIndex {
  dimensions: string[];
  products: Map<string, ProductDimension>;
  clusters: Map<string, ProductDimension[]>;
  tree?: KDTree;
}

export class KDTreeNode {
  constructor(
    public point: ProductDimension,
    public dimension: number,
    public left?: KDTreeNode,
    public right?: KDTreeNode
  ) {}
}

export class KDTree {
  private root?: KDTreeNode;
  private dimensions: string[];

  constructor(products: ProductDimension[], dimensions: string[]) {
    this.dimensions = dimensions;
    this.root = this.buildTree(products, 0);
  }

  private buildTree(products: ProductDimension[], depth: number): KDTreeNode | undefined {
    if (products.length === 0) return undefined;

    const dim = depth % this.dimensions.length;
    const dimension = this.dimensions[dim];

    // Sort products by current dimension
    products.sort((a, b) => {
      const aVal = a.coordinates[dimension] || 0;
      const bVal = b.coordinates[dimension] || 0;
      return aVal - bVal;
    });

    const medianIndex = Math.floor(products.length / 2);
    const medianProduct = products[medianIndex];

    return new KDTreeNode(
      medianProduct,
      dim,
      this.buildTree(products.slice(0, medianIndex), depth + 1),
      this.buildTree(products.slice(medianIndex + 1), depth + 1)
    );
  }

  nearestNeighbors(query: Record<string, number>, k: number): ProductDimension[] {
    const results: Array<{ product: ProductDimension; distance: number }> = [];
    this.searchKNN(this.root, query, k, results);
    
    return results
      .sort((a, b) => a.distance - b.distance)
      .slice(0, k)
      .map(r => r.product);
  }

  private searchKNN(
    node: KDTreeNode | undefined,
    query: Record<string, number>,
    k: number,
    results: Array<{ product: ProductDimension; distance: number }>
  ): void {
    if (!node) return;

    const distance = DimensionalMath.euclideanDistance(query, node.point.coordinates);
    
    if (results.length < k) {
      results.push({ product: node.point, distance });
    } else {
      const maxIndex = results.reduce((maxIdx, curr, idx) => 
        curr.distance > results[maxIdx].distance ? idx : maxIdx, 0);
      
      if (distance < results[maxIndex].distance) {
        results[maxIndex] = { product: node.point, distance };
      }
    }

    const dimension = this.dimensions[node.dimension];
    const queryVal = query[dimension] || 0;
    const nodeVal = node.point.coordinates[dimension] || 0;

    const nearSide = queryVal <= nodeVal ? node.left : node.right;
    const farSide = queryVal <= nodeVal ? node.right : node.left;

    this.searchKNN(nearSide, query, k, results);

    // Check if we need to search the far side
    if (results.length < k || Math.abs(queryVal - nodeVal) < Math.max(...results.map(r => r.distance))) {
      this.searchKNN(farSide, query, k, results);
    }
  }
}

export class DimensionalSearchEngine {
  public index: SearchIndex;

  constructor(products: ProductDimension[]) {
    this.index = this.buildIndex(products);
  }

  private buildIndex(products: ProductDimension[]): SearchIndex {
    const dimensionsSet = new Set<string>();
    const productMap = new Map<string, ProductDimension>();
    const clusters = new Map<string, ProductDimension[]>();

    // Extract all dimensions
    for (const product of products) {
      productMap.set(product.id, product);
      Object.keys(product.coordinates).forEach(dim => dimensionsSet.add(dim));
    }

    const dimensions = Array.from(dimensionsSet);

    // Build KD-Tree for fast nearest neighbor search
    const tree = new KDTree(products, dimensions);

    // Create clusters based on similarity
    for (const product of products) {
      const clusterKey = this.getClusterKey(product, dimensions);
      if (!clusters.has(clusterKey)) {
        clusters.set(clusterKey, []);
      }
      clusters.get(clusterKey)!.push(product);
    }

    return {
      dimensions,
      products: productMap,
      clusters,
      tree
    };
  }

  private getClusterKey(product: ProductDimension, dimensions: string[]): string {
    // Create cluster key based on discretized coordinates
    return dimensions.map(dim => {
      const value = product.coordinates[dim] || 0;
      return Math.floor(value / 10) * 10; // Cluster by tens
    }).join(',');
  }

  async search(query: SearchQuery, user?: UserDimension): Promise<SearchResult> {
    const startTime = performance.now();
    const results: Array<{
      product: ProductDimension;
      score: number;
      relevance: Record<string, number>;
      distance?: number;
    }> = [];

    // Convert query dimensions to coordinates
    const queryPoint: Record<string, number> = {};
    for (const [dim, spec] of Object.entries(query.dimensions)) {
      if (spec.preferred !== undefined) {
        queryPoint[dim] = spec.preferred;
      } else {
        queryPoint[dim] = ((spec.min || 0) + (spec.max || 100)) / 2;
      }
    }

    // Use KD-Tree for efficient spatial search
    if (this.index.tree) {
      const candidates = this.index.tree.nearestNeighbors(queryPoint, query.limit * 3);
      
      for (const product of candidates) {
        const score = this.calculateRelevanceScore(product, query, user);
        if (score > 0) {
          const distance = DimensionalMath.euclideanDistance(queryPoint, product.coordinates);
          const relevance = this.calculateDimensionalRelevance(product, query);
          
          results.push({
            product,
            score,
            relevance,
            distance
          });
        }
      }
    }

    // Apply filters
    const filteredResults = results.filter(result => 
      this.applyFilters(result.product, query.filters || {})
    );

    // Sort by score or specified dimension
    if (query.sort) {
      filteredResults.sort((a, b) => {
        const aVal = a.product.coordinates[query.sort!.dimension] || 0;
        const bVal = b.product.coordinates[query.sort!.dimension] || 0;
        return query.sort!.direction === 'asc' ? aVal - bVal : bVal - aVal;
      });
    } else {
      filteredResults.sort((a, b) => b.score - a.score);
    }

    // Paginate
    const paginatedResults = filteredResults.slice(
      query.offset,
      query.offset + query.limit
    );

    const executionTime = performance.now() - startTime;

    return {
      items: paginatedResults,
      metadata: {
        total: filteredResults.length,
        dimensions: this.index.dimensions,
        executionTime,
        algorithm: 'kd-tree-multidimensional'
      }
    };
  }

  private calculateRelevanceScore(
    product: ProductDimension,
    query: SearchQuery,
    user?: UserDimension
  ): number {
    let totalScore = 0;
    let totalWeight = 0;

    // Calculate dimensional relevance
    for (const [dim, spec] of Object.entries(query.dimensions)) {
      const productVal = product.coordinates[dim] || 0;
      const weight = spec.weight;
      totalWeight += weight;

      let dimScore = 0;

      // Range matching
      if (spec.min !== undefined && productVal < spec.min) {
        dimScore = Math.max(0, 1 - (spec.min - productVal) / spec.min);
      } else if (spec.max !== undefined && productVal > spec.max) {
        dimScore = Math.max(0, 1 - (productVal - spec.max) / spec.max);
      } else {
        dimScore = 1;
      }

      // Preference matching
      if (spec.preferred !== undefined) {
        const prefDistance = Math.abs(productVal - spec.preferred);
        const maxDistance = Math.max(spec.max || 100, Math.abs(spec.min || 0));
        dimScore *= Math.max(0, 1 - prefDistance / maxDistance);
      }

      totalScore += dimScore * weight;
    }

    let baseScore = totalWeight > 0 ? totalScore / totalWeight : 0;

    // User preference boost
    if (user) {
      const userSimilarity = DimensionalMath.cosineSimilarity(
        user.coordinates,
        product.coordinates
      );
      baseScore *= (1 + userSimilarity * 0.2);
    }

    // Quality and reputation boost
    baseScore *= (0.8 + product.quality.score * 0.2);
    baseScore *= (0.8 + product.seller.reputation / 5 * 0.2);

    return Math.min(1, baseScore);
  }

  private calculateDimensionalRelevance(
    product: ProductDimension,
    query: SearchQuery
  ): Record<string, number> {
    const relevance: Record<string, number> = {};

    for (const [dim, spec] of Object.entries(query.dimensions)) {
      const productVal = product.coordinates[dim] || 0;
      
      if (spec.preferred !== undefined) {
        const distance = Math.abs(productVal - spec.preferred);
        const maxDistance = Math.max(spec.max || 100, Math.abs(spec.min || 0));
        relevance[dim] = Math.max(0, 1 - distance / maxDistance);
      } else {
        relevance[dim] = 1; // Perfect match if no preference
      }
    }

    return relevance;
  }

  private applyFilters(
    product: ProductDimension,
    filters: Record<string, unknown>
  ): boolean {
    for (const [key, value] of Object.entries(filters)) {
      switch (key) {
        case 'categories':
          if (Array.isArray(value) && !value.some(cat => product.categories.includes(cat))) {
            return false;
          }
          break;
        case 'minPrice':
          if (typeof value === 'number' && product.price.base < value) {
            return false;
          }
          break;
        case 'maxPrice':
          if (typeof value === 'number' && product.price.base > value) {
            return false;
          }
          break;
        case 'minRating':
          if (typeof value === 'number' && product.seller.reputation < value) {
            return false;
          }
          break;
      }
    }
    return true;
  }

  // Update index when new products are added
  updateIndex(products: ProductDimension[]): void {
    this.index = this.buildIndex(products);
  }

  // Get search suggestions based on partial query
  getSuggestions(partialQuery: string, dimension?: string): string[] {
    // Simple implementation - in production would use more sophisticated NLP
    const suggestions = new Set<string>();
    
    for (const product of this.index.products.values()) {
      if (product.name.toLowerCase().includes(partialQuery.toLowerCase())) {
        suggestions.add(product.name);
      }
      
      for (const category of product.categories) {
        if (category.toLowerCase().includes(partialQuery.toLowerCase())) {
          suggestions.add(category);
        }
      }
    }

    return Array.from(suggestions).slice(0, 10);
  }
}