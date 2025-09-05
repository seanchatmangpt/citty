/**
 * Advanced Search Engine - Production Polish Feature
 * Sophisticated search with autocomplete, saved searches, and advanced filters
 */

import { ref, reactive, computed, watch } from 'vue';

export interface SearchQuery {
  text: string;
  filters: Record<string, any>;
  sort: {
    field: string;
    direction: 'asc' | 'desc';
  };
  pagination: {
    page: number;
    limit: number;
  };
}

export interface SearchSuggestion {
  id: string;
  text: string;
  type: 'query' | 'category' | 'product' | 'brand' | 'tag';
  score: number;
  metadata?: Record<string, any>;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: SearchQuery;
  userId: string;
  createdAt: Date;
  lastUsed: Date;
  useCount: number;
  notifications: boolean;
}

export interface SearchFilter {
  id: string;
  name: string;
  type: 'range' | 'select' | 'multiselect' | 'boolean' | 'date' | 'text';
  options?: { value: any; label: string; count?: number }[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  validation?: (value: any) => boolean;
}

export interface SearchIndex {
  id: string;
  content: string;
  tokens: string[];
  metadata: Record<string, any>;
  boost: number;
  categories: string[];
}

export interface SearchResult<T = any> {
  item: T;
  score: number;
  highlights: Record<string, string[]>;
  explanation?: {
    value: number;
    description: string;
    details: Array<{
      value: number;
      description: string;
    }>;
  };
}

export interface SearchAnalytics {
  query: string;
  resultsCount: number;
  clickPosition?: number;
  clickedResult?: any;
  timestamp: Date;
  userId?: string;
  sessionId: string;
  filters: Record<string, any>;
}

export class AdvancedSearchEngine {
  private index: Map<string, SearchIndex> = new Map();
  private suggestions: Map<string, SearchSuggestion[]> = new Map();
  private savedSearches: Map<string, SavedSearch> = new Map();
  private searchHistory: SearchAnalytics[] = [];
  private filters: Map<string, SearchFilter> = new Map();
  private synonyms: Map<string, string[]> = new Map();
  private boostFields: Record<string, number> = {};
  private stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);

  constructor() {
    this.setupDefaultFilters();
    this.loadSynonyms();
  }

  /**
   * Build search index from data
   */
  buildIndex<T>(items: T[], config: {
    idField: string;
    searchableFields: Record<string, number>; // field -> boost factor
    metadataFields?: string[];
    categoryField?: string;
  }): void {
    this.boostFields = config.searchableFields;
    
    items.forEach(item => {
      const id = (item as any)[config.idField];
      let content = '';
      let totalBoost = 0;

      // Extract searchable content with boost factors
      Object.entries(config.searchableFields).forEach(([field, boost]) => {
        const fieldValue = this.getNestedValue(item, field);
        if (fieldValue) {
          content += `${String(fieldValue)} `.repeat(boost);
          totalBoost += boost;
        }
      });

      // Tokenize content
      const tokens = this.tokenize(content);

      // Extract metadata
      const metadata: Record<string, any> = {};
      config.metadataFields?.forEach(field => {
        metadata[field] = this.getNestedValue(item, field);
      });

      // Extract categories
      const categories = config.categoryField 
        ? [this.getNestedValue(item, config.categoryField)].flat().filter(Boolean)
        : [];

      const indexEntry: SearchIndex = {
        id,
        content: content.trim(),
        tokens,
        metadata,
        boost: totalBoost,
        categories
      };

      this.index.set(id, indexEntry);
    });

    this.buildSuggestions();
  }

  /**
   * Perform advanced search with scoring and filtering
   */
  search<T>(
    items: T[],
    query: SearchQuery,
    options: {
      fuzzyMatch?: boolean;
      enableSynonyms?: boolean;
      highlightFields?: string[];
      maxResults?: number;
    } = {}
  ): {
    results: SearchResult<T>[];
    totalCount: number;
    facets: Record<string, { value: any; count: number }[]>;
    suggestions: SearchSuggestion[];
    correctedQuery?: string;
  } {
    const startTime = performance.now();
    
    // Record search analytics
    const analytics: SearchAnalytics = {
      query: query.text,
      resultsCount: 0,
      timestamp: new Date(),
      sessionId: this.generateSessionId(),
      filters: query.filters
    };

    let results: SearchResult<T>[] = [];
    const facets: Record<string, { value: any; count: number }[]> = {};

    // Step 1: Text search
    if (query.text.trim()) {
      results = this.performTextSearch(items, query.text, options);
    } else {
      // No text query, include all items
      results = items.map(item => ({
        item,
        score: 1,
        highlights: {}
      }));
    }

    // Step 2: Apply filters
    if (Object.keys(query.filters).length > 0) {
      results = this.applyFilters(results, query.filters);
    }

    // Step 3: Calculate facets
    this.calculateFacets(results.map(r => r.item), facets);

    // Step 4: Sort results
    results = this.sortResults(results, query.sort);

    // Step 5: Apply pagination
    const totalCount = results.length;
    const startIndex = (query.pagination.page - 1) * query.pagination.limit;
    results = results.slice(startIndex, startIndex + query.pagination.limit);

    // Step 6: Get search suggestions
    const suggestions = this.getSuggestions(query.text);

    // Update analytics
    analytics.resultsCount = totalCount;
    this.searchHistory.push(analytics);

    const searchTime = performance.now() - startTime;
    console.debug(`Search completed in ${searchTime.toFixed(2)}ms`);

    return {
      results,
      totalCount,
      facets,
      suggestions,
      correctedQuery: this.getQueryCorrection(query.text)
    };
  }

  /**
   * Get autocomplete suggestions
   */
  getAutocompleteSuggestions(
    input: string,
    limit: number = 10,
    types: SearchSuggestion['type'][] = ['query', 'product', 'category']
  ): SearchSuggestion[] {
    if (input.length < 2) return [];

    const normalizedInput = input.toLowerCase();
    const suggestions: SearchSuggestion[] = [];

    // Get cached suggestions
    const cached = this.suggestions.get(normalizedInput);
    if (cached) {
      return cached.filter(s => types.includes(s.type)).slice(0, limit);
    }

    // Generate suggestions from index
    this.index.forEach((indexEntry, id) => {
      const matchScore = this.calculateMatchScore(normalizedInput, indexEntry.content);
      if (matchScore > 0.3) {
        suggestions.push({
          id,
          text: indexEntry.content.substring(0, 100),
          type: 'product',
          score: matchScore,
          metadata: indexEntry.metadata
        });
      }
    });

    // Add query suggestions from search history
    const queryFrequency = new Map<string, number>();
    this.searchHistory.forEach(search => {
      if (search.query.toLowerCase().includes(normalizedInput)) {
        queryFrequency.set(search.query, (queryFrequency.get(search.query) || 0) + 1);
      }
    });

    queryFrequency.forEach((count, query) => {
      suggestions.push({
        id: `query-${query}`,
        text: query,
        type: 'query',
        score: Math.min(count / 10, 1),
        metadata: { frequency: count }
      });
    });

    // Sort by score and limit
    const result = suggestions
      .filter(s => types.includes(s.type))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Cache result
    this.suggestions.set(normalizedInput, result);

    return result;
  }

  /**
   * Save search for later use
   */
  saveSearch(search: Omit<SavedSearch, 'id' | 'createdAt' | 'lastUsed' | 'useCount'>): SavedSearch {
    const savedSearch: SavedSearch = {
      ...search,
      id: this.generateId(),
      createdAt: new Date(),
      lastUsed: new Date(),
      useCount: 1
    };

    this.savedSearches.set(savedSearch.id, savedSearch);
    return savedSearch;
  }

  /**
   * Get saved searches for user
   */
  getSavedSearches(userId: string): SavedSearch[] {
    return Array.from(this.savedSearches.values())
      .filter(search => search.userId === userId)
      .sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime());
  }

  /**
   * Execute saved search
   */
  executeSavedSearch<T>(searchId: string, items: T[]): SearchResult<T>[] {
    const savedSearch = this.savedSearches.get(searchId);
    if (!savedSearch) {
      throw new Error('Saved search not found');
    }

    // Update usage statistics
    savedSearch.lastUsed = new Date();
    savedSearch.useCount++;

    const searchResult = this.search(items, savedSearch.query);
    return searchResult.results;
  }

  /**
   * Add custom filter
   */
  addFilter(filter: SearchFilter): void {
    this.filters.set(filter.id, filter);
  }

  /**
   * Get available filters with current counts
   */
  getAvailableFilters<T>(items: T[]): SearchFilter[] {
    const filters = Array.from(this.filters.values());
    
    // Update option counts for select/multiselect filters
    filters.forEach(filter => {
      if (filter.type === 'select' || filter.type === 'multiselect') {
        const counts = new Map<any, number>();
        
        items.forEach(item => {
          const value = this.getNestedValue(item, filter.id);
          if (value !== undefined && value !== null) {
            const values = Array.isArray(value) ? value : [value];
            values.forEach(v => {
              counts.set(v, (counts.get(v) || 0) + 1);
            });
          }
        });

        if (filter.options) {
          filter.options = filter.options.map(option => ({
            ...option,
            count: counts.get(option.value) || 0
          }));
        }
      }
    });

    return filters;
  }

  /**
   * Get search analytics
   */
  getSearchAnalytics(): {
    totalSearches: number;
    averageResultsCount: number;
    topQueries: { query: string; count: number; avgResults: number }[];
    noResultQueries: string[];
    clickThroughRate: number;
  } {
    const totalSearches = this.searchHistory.length;
    const averageResultsCount = this.searchHistory.reduce((sum, s) => sum + s.resultsCount, 0) / totalSearches;
    
    // Calculate top queries
    const queryStats = new Map<string, { count: number; totalResults: number; clicks: number }>();
    
    this.searchHistory.forEach(search => {
      const stats = queryStats.get(search.query) || { count: 0, totalResults: 0, clicks: 0 };
      stats.count++;
      stats.totalResults += search.resultsCount;
      if (search.clickPosition !== undefined) {
        stats.clicks++;
      }
      queryStats.set(search.query, stats);
    });

    const topQueries = Array.from(queryStats.entries())
      .map(([query, stats]) => ({
        query,
        count: stats.count,
        avgResults: stats.totalResults / stats.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // No result queries
    const noResultQueries = this.searchHistory
      .filter(s => s.resultsCount === 0)
      .map(s => s.query);

    // Click-through rate
    const totalClicks = this.searchHistory.filter(s => s.clickPosition !== undefined).length;
    const clickThroughRate = totalSearches > 0 ? totalClicks / totalSearches : 0;

    return {
      totalSearches,
      averageResultsCount,
      topQueries,
      noResultQueries,
      clickThroughRate
    };
  }

  // Private helper methods
  private performTextSearch<T>(
    items: T[],
    query: string,
    options: { fuzzyMatch?: boolean; enableSynonyms?: boolean; highlightFields?: string[] }
  ): SearchResult<T>[] {
    const queryTokens = this.tokenize(query);
    const results: SearchResult<T>[] = [];

    items.forEach(item => {
      const itemId = (item as any).id || JSON.stringify(item);
      const indexEntry = this.index.get(itemId);
      
      if (!indexEntry) return;

      let score = 0;
      const highlights: Record<string, string[]> = {};

      // Calculate text match score
      queryTokens.forEach(token => {
        const tokenScore = this.calculateTokenScore(token, indexEntry, options.enableSynonyms);
        score += tokenScore;
      });

      if (score > 0) {
        // Apply boost factor
        score *= indexEntry.boost;

        // Generate highlights
        if (options.highlightFields) {
          this.generateHighlights(item, queryTokens, options.highlightFields, highlights);
        }

        results.push({
          item,
          score,
          highlights
        });
      }
    });

    return results.sort((a, b) => b.score - a.score);
  }

  private calculateTokenScore(token: string, indexEntry: SearchIndex, enableSynonyms = false): number {
    let score = 0;
    const content = indexEntry.content.toLowerCase();
    const tokens = indexEntry.tokens;

    // Exact match in tokens
    if (tokens.includes(token)) {
      score += 10;
    }

    // Partial match in content
    if (content.includes(token)) {
      score += 5;
    }

    // Fuzzy match
    const fuzzyScore = this.calculateFuzzyScore(token, tokens);
    score += fuzzyScore;

    // Synonym match
    if (enableSynonyms) {
      const synonymScore = this.calculateSynonymScore(token, tokens);
      score += synonymScore;
    }

    return score;
  }

  private calculateFuzzyScore(token: string, tokens: string[]): number {
    let maxScore = 0;

    tokens.forEach(indexToken => {
      const distance = this.levenshteinDistance(token, indexToken);
      const similarity = 1 - (distance / Math.max(token.length, indexToken.length));
      
      if (similarity > 0.7) {
        maxScore = Math.max(maxScore, similarity * 3);
      }
    });

    return maxScore;
  }

  private calculateSynonymScore(token: string, tokens: string[]): number {
    const synonyms = this.synonyms.get(token) || [];
    let score = 0;

    synonyms.forEach(synonym => {
      if (tokens.includes(synonym)) {
        score += 3;
      }
    });

    return score;
  }

  private applyFilters<T>(results: SearchResult<T>[], filters: Record<string, any>): SearchResult<T>[] {
    return results.filter(result => {
      return Object.entries(filters).every(([filterId, filterValue]) => {
        const filter = this.filters.get(filterId);
        if (!filter) return true;

        const itemValue = this.getNestedValue(result.item, filterId);
        
        switch (filter.type) {
          case 'range':
            return itemValue >= filterValue.min && itemValue <= filterValue.max;
          case 'select':
            return itemValue === filterValue;
          case 'multiselect':
            return Array.isArray(filterValue) 
              ? filterValue.some(v => Array.isArray(itemValue) ? itemValue.includes(v) : itemValue === v)
              : Array.isArray(itemValue) ? itemValue.includes(filterValue) : itemValue === filterValue;
          case 'boolean':
            return Boolean(itemValue) === Boolean(filterValue);
          case 'date':
            const itemDate = new Date(itemValue);
            const filterDate = new Date(filterValue);
            return itemDate >= filterDate;
          case 'text':
            return String(itemValue).toLowerCase().includes(String(filterValue).toLowerCase());
          default:
            return true;
        }
      });
    });
  }

  private calculateFacets<T>(items: T[], facets: Record<string, { value: any; count: number }[]>): void {
    this.filters.forEach(filter => {
      if (filter.type === 'select' || filter.type === 'multiselect') {
        const valueCounts = new Map<any, number>();

        items.forEach(item => {
          const value = this.getNestedValue(item, filter.id);
          if (value !== undefined && value !== null) {
            const values = Array.isArray(value) ? value : [value];
            values.forEach(v => {
              valueCounts.set(v, (valueCounts.get(v) || 0) + 1);
            });
          }
        });

        facets[filter.id] = Array.from(valueCounts.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count);
      }
    });
  }

  private sortResults<T>(results: SearchResult<T>[], sort: SearchQuery['sort']): SearchResult<T>[] {
    if (sort.field === 'relevance') {
      return results; // Already sorted by score
    }

    return results.sort((a, b) => {
      const aValue = this.getNestedValue(a.item, sort.field);
      const bValue = this.getNestedValue(b.item, sort.field);

      if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  private generateHighlights<T>(
    item: T,
    queryTokens: string[],
    fields: string[],
    highlights: Record<string, string[]>
  ): void {
    fields.forEach(field => {
      const fieldValue = String(this.getNestedValue(item, field) || '');
      const fieldHighlights: string[] = [];

      queryTokens.forEach(token => {
        const regex = new RegExp(`(${this.escapeRegex(token)})`, 'gi');
        const matches = fieldValue.match(regex);
        if (matches) {
          fieldHighlights.push(...matches);
        }
      });

      if (fieldHighlights.length > 0) {
        highlights[field] = fieldHighlights;
      }
    });
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 1 && !this.stopWords.has(token));
  }

  private buildSuggestions(): void {
    // Build suggestions from index content
    const suggestions = new Map<string, SearchSuggestion[]>();

    this.index.forEach((indexEntry, id) => {
      indexEntry.tokens.forEach(token => {
        if (token.length > 2) {
          for (let i = 2; i <= token.length; i++) {
            const prefix = token.substring(0, i);
            
            if (!suggestions.has(prefix)) {
              suggestions.set(prefix, []);
            }

            suggestions.get(prefix)!.push({
              id,
              text: indexEntry.content,
              type: 'product',
              score: indexEntry.boost,
              metadata: indexEntry.metadata
            });
          }
        }
      });
    });

    this.suggestions = suggestions;
  }

  private setupDefaultFilters(): void {
    this.addFilter({
      id: 'price',
      name: 'Price',
      type: 'range',
      min: 0,
      max: 10000,
      step: 10
    });

    this.addFilter({
      id: 'category',
      name: 'Category',
      type: 'multiselect',
      options: []
    });

    this.addFilter({
      id: 'inStock',
      name: 'In Stock',
      type: 'boolean'
    });

    this.addFilter({
      id: 'rating',
      name: 'Rating',
      type: 'range',
      min: 0,
      max: 5,
      step: 0.5
    });
  }

  private loadSynonyms(): void {
    const synonymGroups = [
      ['phone', 'mobile', 'smartphone', 'cell'],
      ['laptop', 'computer', 'notebook', 'pc'],
      ['car', 'vehicle', 'automobile', 'auto'],
      ['shirt', 'top', 'blouse', 'tee'],
      ['shoes', 'sneakers', 'boots', 'footwear']
    ];

    synonymGroups.forEach(group => {
      group.forEach(word => {
        this.synonyms.set(word, group.filter(w => w !== word));
      });
    });
  }

  private getSuggestions(query: string): SearchSuggestion[] {
    return this.getAutocompleteSuggestions(query, 5);
  }

  private getQueryCorrection(query: string): string | undefined {
    // Simple spell correction (would use more sophisticated algorithms in production)
    return undefined;
  }

  private calculateMatchScore(input: string, content: string): number {
    const inputWords = input.split(/\s+/);
    const contentWords = content.toLowerCase().split(/\s+/);
    
    let matches = 0;
    inputWords.forEach(inputWord => {
      if (contentWords.some(contentWord => contentWord.includes(inputWord))) {
        matches++;
      }
    });

    return matches / inputWords.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
}

/**
 * Vue 3 Composable for Advanced Search
 */
export function useAdvancedSearch<T>() {
  const engine = reactive(new AdvancedSearchEngine());
  const isSearching = ref(false);
  const searchResults = ref<SearchResult<T>[]>([]);
  const totalResults = ref(0);
  const suggestions = ref<SearchSuggestion[]>([]);
  const filters = ref<SearchFilter[]>([]);
  const savedSearches = ref<SavedSearch[]>([]);

  const buildIndex = (items: T[], config: Parameters<AdvancedSearchEngine['buildIndex']>[1]) => {
    engine.buildIndex(items, config);
    filters.value = engine.getAvailableFilters(items);
  };

  const search = async (items: T[], query: SearchQuery, options?: any) => {
    isSearching.value = true;
    
    try {
      const result = engine.search(items, query, options);
      searchResults.value = result.results;
      totalResults.value = result.totalCount;
      suggestions.value = result.suggestions;
      return result;
    } finally {
      isSearching.value = false;
    }
  };

  const getAutocompleteSuggestions = (input: string, limit?: number, types?: SearchSuggestion['type'][]) => {
    return engine.getAutocompleteSuggestions(input, limit, types);
  };

  const saveSearch = (search: Omit<SavedSearch, 'id' | 'createdAt' | 'lastUsed' | 'useCount'>) => {
    const saved = engine.saveSearch(search);
    savedSearches.value = engine.getSavedSearches(search.userId);
    return saved;
  };

  const loadSavedSearches = (userId: string) => {
    savedSearches.value = engine.getSavedSearches(userId);
  };

  const analytics = computed(() => engine.getSearchAnalytics());

  return {
    buildIndex,
    search,
    getAutocompleteSuggestions,
    saveSearch,
    loadSavedSearches,
    isSearching: readonly(isSearching),
    searchResults: readonly(searchResults),
    totalResults: readonly(totalResults),
    suggestions: readonly(suggestions),
    filters: readonly(filters),
    savedSearches: readonly(savedSearches),
    analytics
  };
}