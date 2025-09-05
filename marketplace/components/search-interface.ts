// Search Interface Component for N-Dimensional Marketplace
import type { 
  SearchQuery, 
  SearchResult, 
  ProductDimension, 
  UserDimension 
} from '../types/dimensional-models';
import { DimensionalSearchEngine } from '../src/dimensional-search';

export interface SearchInterfaceOptions {
  dimensions: string[];
  defaultFilters?: Record<string, any>;
  maxResults?: number;
  enablePersonalization?: boolean;
  enableSuggestions?: boolean;
}

export interface DimensionControl {
  name: string;
  label: string;
  type: 'range' | 'preference' | 'filter';
  min?: number;
  max?: number;
  step?: number;
  weight?: number;
  options?: string[];
}

export interface SearchState {
  query: string;
  dimensions: Record<string, {
    min?: number;
    max?: number;
    preferred?: number;
    weight: number;
  }>;
  filters: Record<string, any>;
  sort: {
    dimension: string;
    direction: 'asc' | 'desc';
  };
  pagination: {
    limit: number;
    offset: number;
  };
}

export interface SearchResults {
  items: Array<{
    product: ProductDimension;
    score: number;
    relevance: Record<string, number>;
    distance?: number;
  }>;
  facets: Record<string, Array<{
    value: string;
    count: number;
  }>>;
  suggestions: string[];
  metadata: {
    total: number;
    executionTime: number;
    algorithm: string;
    dimensions: string[];
  };
}

export class SearchInterface {
  private searchEngine: DimensionalSearchEngine;
  private options: SearchInterfaceOptions;
  private state: SearchState;
  private user?: UserDimension;

  constructor(products: ProductDimension[], options: SearchInterfaceOptions) {
    this.searchEngine = new DimensionalSearchEngine(products);
    this.options = {
      maxResults: 20,
      enablePersonalization: true,
      enableSuggestions: true,
      ...options
    };

    this.state = this.initializeState();
  }

  private initializeState(): SearchState {
    const dimensions: Record<string, any> = {};
    
    for (const dim of this.options.dimensions) {
      dimensions[dim] = {
        weight: 1.0
      };
    }

    return {
      query: '',
      dimensions,
      filters: { ...this.options.defaultFilters },
      sort: {
        dimension: 'score',
        direction: 'desc'
      },
      pagination: {
        limit: this.options.maxResults || 20,
        offset: 0
      }
    };
  }

  setUser(user: UserDimension): void {
    this.user = user;
    
    // Update dimension weights based on user preferences
    if (this.options.enablePersonalization && user.profile.preferences) {
      for (const [dim, preference] of Object.entries(user.profile.preferences)) {
        if (this.state.dimensions[dim]) {
          this.state.dimensions[dim].weight = Math.max(0.1, preference);
        }
      }
    }
  }

  updateQuery(query: string): void {
    this.state.query = query;
    this.resetPagination();
  }

  updateDimension(
    dimension: string, 
    updates: {
      min?: number;
      max?: number;
      preferred?: number;
      weight?: number;
    }
  ): void {
    if (!this.state.dimensions[dimension]) {
      this.state.dimensions[dimension] = { weight: 1.0 };
    }

    this.state.dimensions[dimension] = {
      ...this.state.dimensions[dimension],
      ...updates
    };

    this.resetPagination();
  }

  updateFilter(key: string, value: any): void {
    if (value === null || value === undefined || value === '') {
      delete this.state.filters[key];
    } else {
      this.state.filters[key] = value;
    }
    
    this.resetPagination();
  }

  updateSort(dimension: string, direction: 'asc' | 'desc'): void {
    this.state.sort = { dimension, direction };
    this.resetPagination();
  }

  updatePagination(limit?: number, offset?: number): void {
    if (limit !== undefined) {
      this.state.pagination.limit = Math.max(1, Math.min(100, limit));
    }
    if (offset !== undefined) {
      this.state.pagination.offset = Math.max(0, offset);
    }
  }

  resetPagination(): void {
    this.state.pagination.offset = 0;
  }

  nextPage(): void {
    this.state.pagination.offset += this.state.pagination.limit;
  }

  previousPage(): void {
    this.state.pagination.offset = Math.max(
      0, 
      this.state.pagination.offset - this.state.pagination.limit
    );
  }

  async search(): Promise<SearchResults> {
    const query: SearchQuery = {
      query: this.state.query,
      dimensions: this.state.dimensions,
      filters: this.state.filters,
      sort: this.state.sort,
      limit: this.state.pagination.limit,
      offset: this.state.pagination.offset
    };

    const searchResult = await this.searchEngine.search(query, this.user);
    
    // Generate facets
    const facets = this.generateFacets(searchResult);
    
    // Get suggestions if enabled
    let suggestions: string[] = [];
    if (this.options.enableSuggestions && this.state.query) {
      suggestions = this.searchEngine.getSuggestions(this.state.query);
    }

    return {
      items: searchResult.items,
      facets,
      suggestions,
      metadata: searchResult.metadata
    };
  }

  private generateFacets(searchResult: SearchResult): Record<string, Array<{
    value: string;
    count: number;
  }>> {
    const facets: Record<string, Record<string, number>> = {};
    
    // Category facets
    facets.categories = {};
    for (const item of searchResult.items) {
      for (const category of item.product.categories) {
        facets.categories[category] = (facets.categories[category] || 0) + 1;
      }
    }

    // Price range facets
    facets.price_range = {};
    for (const item of searchResult.items) {
      const price = item.product.price.base;
      let range: string;
      
      if (price < 100) range = '0-100';
      else if (price < 500) range = '100-500';
      else if (price < 1000) range = '500-1000';
      else if (price < 2000) range = '1000-2000';
      else range = '2000+';
      
      facets.price_range[range] = (facets.price_range[range] || 0) + 1;
    }

    // Quality facets
    facets.quality_level = {};
    for (const item of searchResult.items) {
      const quality = item.product.quality.score;
      let level: string;
      
      if (quality < 0.3) level = 'Basic';
      else if (quality < 0.6) level = 'Good';
      else if (quality < 0.8) level = 'High';
      else level = 'Premium';
      
      facets.quality_level[level] = (facets.quality_level[level] || 0) + 1;
    }

    // Convert to sorted arrays
    const result: Record<string, Array<{ value: string; count: number }>> = {};
    
    for (const [facetName, values] of Object.entries(facets)) {
      result[facetName] = Object.entries(values)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);
    }

    return result;
  }

  getState(): SearchState {
    return { ...this.state };
  }

  setState(state: Partial<SearchState>): void {
    this.state = { ...this.state, ...state };
  }

  getDimensionControls(): DimensionControl[] {
    return this.options.dimensions.map(dim => ({
      name: dim,
      label: this.formatLabel(dim),
      type: this.getDimensionType(dim),
      min: this.getDimensionMin(dim),
      max: this.getDimensionMax(dim),
      step: this.getDimensionStep(dim),
      weight: this.state.dimensions[dim]?.weight || 1.0
    }));
  }

  private formatLabel(dimension: string): string {
    return dimension
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private getDimensionType(dimension: string): 'range' | 'preference' | 'filter' {
    const rangeTypes = ['price', 'quality', 'performance', 'rating'];
    const preferenceTypes = ['style', 'brand', 'color'];
    
    if (rangeTypes.some(type => dimension.includes(type))) {
      return 'range';
    } else if (preferenceTypes.some(type => dimension.includes(type))) {
      return 'preference';
    } else {
      return 'filter';
    }
  }

  private getDimensionMin(dimension: string): number {
    switch (dimension) {
      case 'price': return 0;
      case 'quality': case 'rating': case 'performance': return 0;
      default: return 0;
    }
  }

  private getDimensionMax(dimension: string): number {
    switch (dimension) {
      case 'price': return 10000;
      case 'quality': case 'rating': case 'performance': return 1;
      default: return 100;
    }
  }

  private getDimensionStep(dimension: string): number {
    switch (dimension) {
      case 'price': return 10;
      case 'quality': case 'rating': case 'performance': return 0.1;
      default: return 1;
    }
  }

  // Utility methods for UI integration
  hasResults(): boolean {
    return this.state.pagination.offset === 0;
  }

  canGoNext(totalResults: number): boolean {
    return this.state.pagination.offset + this.state.pagination.limit < totalResults;
  }

  canGoPrevious(): boolean {
    return this.state.pagination.offset > 0;
  }

  getCurrentPage(): number {
    return Math.floor(this.state.pagination.offset / this.state.pagination.limit) + 1;
  }

  getTotalPages(totalResults: number): number {
    return Math.ceil(totalResults / this.state.pagination.limit);
  }

  getResultsRange(totalResults: number): { start: number; end: number } {
    const start = this.state.pagination.offset + 1;
    const end = Math.min(
      this.state.pagination.offset + this.state.pagination.limit,
      totalResults
    );
    
    return { start, end };
  }

  // Advanced features
  saveSearchProfile(name: string): SearchProfile {
    return {
      name,
      query: this.state.query,
      dimensions: { ...this.state.dimensions },
      filters: { ...this.state.filters },
      sort: { ...this.state.sort },
      timestamp: new Date()
    };
  }

  loadSearchProfile(profile: SearchProfile): void {
    this.state.query = profile.query;
    this.state.dimensions = { ...profile.dimensions };
    this.state.filters = { ...profile.filters };
    this.state.sort = { ...profile.sort };
    this.resetPagination();
  }

  getSearchURL(): string {
    const params = new URLSearchParams();
    
    if (this.state.query) {
      params.set('q', this.state.query);
    }
    
    for (const [dim, config] of Object.entries(this.state.dimensions)) {
      if (config.min !== undefined) params.set(`${dim}_min`, config.min.toString());
      if (config.max !== undefined) params.set(`${dim}_max`, config.max.toString());
      if (config.preferred !== undefined) params.set(`${dim}_pref`, config.preferred.toString());
      if (config.weight !== 1.0) params.set(`${dim}_weight`, config.weight.toString());
    }
    
    for (const [key, value] of Object.entries(this.state.filters)) {
      params.set(`filter_${key}`, Array.isArray(value) ? value.join(',') : value.toString());
    }
    
    if (this.state.sort.dimension !== 'score') {
      params.set('sort', `${this.state.sort.dimension}:${this.state.sort.direction}`);
    }
    
    if (this.state.pagination.offset > 0) {
      params.set('page', this.getCurrentPage().toString());
    }
    
    return `?${params.toString()}`;
  }

  loadFromURL(searchParams: URLSearchParams): void {
    // Load query
    const query = searchParams.get('q');
    if (query) this.state.query = query;
    
    // Load dimensions
    for (const dim of this.options.dimensions) {
      const min = searchParams.get(`${dim}_min`);
      const max = searchParams.get(`${dim}_max`);
      const preferred = searchParams.get(`${dim}_pref`);
      const weight = searchParams.get(`${dim}_weight`);
      
      if (min || max || preferred || weight) {
        this.state.dimensions[dim] = {
          min: min ? parseFloat(min) : undefined,
          max: max ? parseFloat(max) : undefined,
          preferred: preferred ? parseFloat(preferred) : undefined,
          weight: weight ? parseFloat(weight) : 1.0
        };
      }
    }
    
    // Load filters
    for (const [key, value] of searchParams.entries()) {
      if (key.startsWith('filter_')) {
        const filterName = key.replace('filter_', '');
        this.state.filters[filterName] = value.includes(',') ? value.split(',') : value;
      }
    }
    
    // Load sort
    const sort = searchParams.get('sort');
    if (sort) {
      const [dimension, direction] = sort.split(':');
      this.state.sort = { 
        dimension, 
        direction: (direction as 'asc' | 'desc') || 'desc' 
      };
    }
    
    // Load pagination
    const page = searchParams.get('page');
    if (page) {
      const pageNum = parseInt(page, 10);
      if (pageNum > 1) {
        this.state.pagination.offset = (pageNum - 1) * this.state.pagination.limit;
      }
    }
  }

  // Analytics methods
  getSearchAnalytics(): SearchAnalytics {
    return {
      dimensionsUsed: Object.keys(this.state.dimensions).filter(
        dim => this.state.dimensions[dim].min !== undefined || 
               this.state.dimensions[dim].max !== undefined ||
               this.state.dimensions[dim].preferred !== undefined
      ),
      filtersUsed: Object.keys(this.state.filters),
      hasQuery: this.state.query.length > 0,
      sortedByDimension: this.state.sort.dimension !== 'score',
      currentPage: this.getCurrentPage()
    };
  }
}

// Supporting interfaces
export interface SearchProfile {
  name: string;
  query: string;
  dimensions: Record<string, any>;
  filters: Record<string, any>;
  sort: { dimension: string; direction: 'asc' | 'desc' };
  timestamp: Date;
}

export interface SearchAnalytics {
  dimensionsUsed: string[];
  filtersUsed: string[];
  hasQuery: boolean;
  sortedByDimension: boolean;
  currentPage: number;
}

// Utility functions for UI components
export function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(price);
}

export function formatQuality(score: number): string {
  if (score >= 0.9) return 'Excellent';
  if (score >= 0.8) return 'Very Good';
  if (score >= 0.7) return 'Good';
  if (score >= 0.6) return 'Fair';
  return 'Basic';
}

export function formatRelevance(relevance: Record<string, number>): Array<{
  dimension: string;
  score: number;
  label: string;
}> {
  return Object.entries(relevance)
    .map(([dimension, score]) => ({
      dimension,
      score,
      label: dimension.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
    }))
    .sort((a, b) => b.score - a.score);
}