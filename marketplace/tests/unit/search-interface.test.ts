// Unit Tests for Search Interface Component
import { describe, it, expect, beforeEach } from 'vitest';
import { SearchInterface, formatPrice, formatQuality, formatRelevance } from '../../components/search-interface';
import type { ProductDimension, UserDimension } from '../../types/dimensional-models';

describe('Search Interface Component', () => {
  let searchInterface: SearchInterface;
  let sampleProducts: ProductDimension[];
  let sampleUser: UserDimension;

  beforeEach(() => {
    sampleProducts = [
      {
        id: 'prod_1',
        coordinates: { price: 299.99, quality: 0.8, performance: 0.7, style: 0.6 },
        timestamp: new Date(),
        version: 1,
        name: 'Budget Laptop',
        description: 'Affordable laptop for basic tasks',
        price: { base: 299.99, currency: 'USD' },
        categories: ['electronics', 'computers', 'budget'],
        attributes: { brand: 'BudgetBrand', color: 'black' },
        availability: { total: 50 },
        quality: { score: 0.8 },
        seller: {
          id: 'seller_1',
          reputation: 4.0,
          coordinates: { reliability: 0.8, speed: 0.7 }
        }
      },
      {
        id: 'prod_2',
        coordinates: { price: 1299.99, quality: 0.95, performance: 0.9, style: 0.85 },
        timestamp: new Date(),
        version: 1,
        name: 'Premium Laptop',
        description: 'High-end laptop for professionals',
        price: { base: 1299.99, currency: 'USD' },
        categories: ['electronics', 'computers', 'premium'],
        attributes: { brand: 'PremiumBrand', color: 'silver' },
        availability: { total: 25 },
        quality: { score: 0.95 },
        seller: {
          id: 'seller_2',
          reputation: 4.8,
          coordinates: { reliability: 0.9, speed: 0.9 }
        }
      },
      {
        id: 'prod_3',
        coordinates: { price: 899.99, quality: 0.85, performance: 0.8, style: 0.75 },
        timestamp: new Date(),
        version: 1,
        name: 'Mid-range Laptop',
        description: 'Balanced laptop for most users',
        price: { base: 899.99, currency: 'USD' },
        categories: ['electronics', 'computers', 'mid-range'],
        attributes: { brand: 'MidBrand', color: 'blue' },
        availability: { total: 40 },
        quality: { score: 0.85 },
        seller: {
          id: 'seller_3',
          reputation: 4.5,
          coordinates: { reliability: 0.85, speed: 0.8 }
        }
      }
    ];

    sampleUser = {
      id: 'user_test',
      coordinates: { price_sensitivity: 0.7, quality_preference: 0.9 },
      timestamp: new Date(),
      version: 1,
      profile: {
        name: 'Test User',
        email: 'test@example.com',
        preferences: { 
          price: 0.3,     // Low price preference (prefers higher prices for quality)
          quality: 0.9,   // High quality preference
          performance: 0.8,
          style: 0.6
        }
      },
      behavior: {
        browsingPattern: { electronics: 0.8, computers: 0.9 },
        purchaseHistory: [],
        engagement: {}
      },
      reputation: { score: 4.0, reviews: 10, transactions: 5 }
    };

    searchInterface = new SearchInterface(sampleProducts, {
      dimensions: ['price', 'quality', 'performance', 'style'],
      defaultFilters: { categories: ['electronics'] },
      maxResults: 10,
      enablePersonalization: true,
      enableSuggestions: true
    });
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const state = searchInterface.getState();
      
      expect(state.query).toBe('');
      expect(state.dimensions.price).toBeDefined();
      expect(state.dimensions.quality).toBeDefined();
      expect(state.dimensions.performance).toBeDefined();
      expect(state.dimensions.style).toBeDefined();
      expect(state.filters.categories).toEqual(['electronics']);
      expect(state.sort.dimension).toBe('score');
      expect(state.pagination.limit).toBe(10);
      expect(state.pagination.offset).toBe(0);
    });

    it('should generate dimension controls correctly', () => {
      const controls = searchInterface.getDimensionControls();
      
      expect(controls).toHaveLength(4);
      
      const priceControl = controls.find(c => c.name === 'price');
      expect(priceControl).toBeDefined();
      expect(priceControl?.label).toBe('Price');
      expect(priceControl?.type).toBe('range');
      expect(priceControl?.min).toBe(0);
      expect(priceControl?.max).toBe(10000);

      const qualityControl = controls.find(c => c.name === 'quality');
      expect(qualityControl).toBeDefined();
      expect(qualityControl?.label).toBe('Quality');
      expect(qualityControl?.type).toBe('range');
      expect(qualityControl?.min).toBe(0);
      expect(qualityControl?.max).toBe(1);
    });
  });

  describe('User Personalization', () => {
    it('should apply user preferences to dimension weights', () => {
      searchInterface.setUser(sampleUser);
      const state = searchInterface.getState();
      
      expect(state.dimensions.price.weight).toBe(0.3);
      expect(state.dimensions.quality.weight).toBe(0.9);
      expect(state.dimensions.performance.weight).toBe(0.8);
      expect(state.dimensions.style.weight).toBe(0.6);
    });

    it('should handle user without preferences', () => {
      const userWithoutPrefs = {
        ...sampleUser,
        profile: { ...sampleUser.profile, preferences: {} }
      };

      searchInterface.setUser(userWithoutPrefs);
      const state = searchInterface.getState();
      
      // Should maintain default weights
      expect(state.dimensions.price.weight).toBe(1.0);
      expect(state.dimensions.quality.weight).toBe(1.0);
    });
  });

  describe('Search State Management', () => {
    it('should update query correctly', () => {
      searchInterface.updateQuery('laptop');
      const state = searchInterface.getState();
      
      expect(state.query).toBe('laptop');
      expect(state.pagination.offset).toBe(0); // Should reset pagination
    });

    it('should update dimensions correctly', () => {
      searchInterface.updateDimension('price', {
        min: 500,
        max: 1500,
        preferred: 1000,
        weight: 0.8
      });

      const state = searchInterface.getState();
      expect(state.dimensions.price.min).toBe(500);
      expect(state.dimensions.price.max).toBe(1500);
      expect(state.dimensions.price.preferred).toBe(1000);
      expect(state.dimensions.price.weight).toBe(0.8);
    });

    it('should update filters correctly', () => {
      searchInterface.updateFilter('brand', 'PremiumBrand');
      searchInterface.updateFilter('color', ['black', 'silver']);
      
      const state = searchInterface.getState();
      expect(state.filters.brand).toBe('PremiumBrand');
      expect(state.filters.color).toEqual(['black', 'silver']);
    });

    it('should remove filters when set to null', () => {
      searchInterface.updateFilter('test_filter', 'value');
      searchInterface.updateFilter('test_filter', null);
      
      const state = searchInterface.getState();
      expect(state.filters.test_filter).toBeUndefined();
    });

    it('should update sort correctly', () => {
      searchInterface.updateSort('price', 'asc');
      const state = searchInterface.getState();
      
      expect(state.sort.dimension).toBe('price');
      expect(state.sort.direction).toBe('asc');
    });
  });

  describe('Pagination', () => {
    it('should handle pagination correctly', () => {
      searchInterface.updatePagination(5, 10);
      const state = searchInterface.getState();
      
      expect(state.pagination.limit).toBe(5);
      expect(state.pagination.offset).toBe(10);
    });

    it('should enforce pagination limits', () => {
      searchInterface.updatePagination(150, -5); // Invalid values
      const state = searchInterface.getState();
      
      expect(state.pagination.limit).toBe(100); // Max limit
      expect(state.pagination.offset).toBe(0); // Min offset
    });

    it('should navigate pages correctly', () => {
      searchInterface.updatePagination(5, 0);
      
      searchInterface.nextPage();
      expect(searchInterface.getState().pagination.offset).toBe(5);
      
      searchInterface.nextPage();
      expect(searchInterface.getState().pagination.offset).toBe(10);
      
      searchInterface.previousPage();
      expect(searchInterface.getState().pagination.offset).toBe(5);
      
      searchInterface.previousPage();
      expect(searchInterface.getState().pagination.offset).toBe(0);
      
      searchInterface.previousPage(); // Should not go negative
      expect(searchInterface.getState().pagination.offset).toBe(0);
    });

    it('should calculate page information correctly', () => {
      searchInterface.updatePagination(5, 10);
      
      expect(searchInterface.getCurrentPage()).toBe(3);
      expect(searchInterface.getTotalPages(27)).toBe(6);
      expect(searchInterface.getResultsRange(27)).toEqual({ start: 11, end: 15 });
      
      expect(searchInterface.canGoPrevious()).toBe(true);
      expect(searchInterface.canGoNext(27)).toBe(true);
    });
  });

  describe('Search Execution', () => {
    it('should execute search and return results', async () => {
      searchInterface.updateQuery('laptop');
      searchInterface.updateDimension('price', { min: 200, max: 1000 });
      
      const results = await searchInterface.search();
      
      expect(results.items).toBeDefined();
      expect(results.metadata).toBeDefined();
      expect(results.metadata.total).toBeGreaterThan(0);
      expect(results.metadata.executionTime).toBeGreaterThan(0);
    });

    it('should generate facets correctly', async () => {
      const results = await searchInterface.search();
      
      expect(results.facets).toBeDefined();
      expect(results.facets.categories).toBeDefined();
      expect(results.facets.price_range).toBeDefined();
      expect(results.facets.quality_level).toBeDefined();
      
      // Check category facets
      const categoryFacets = results.facets.categories;
      expect(categoryFacets.some(f => f.value === 'electronics')).toBe(true);
      expect(categoryFacets.some(f => f.value === 'computers')).toBe(true);
      
      // Check price range facets
      const priceFacets = results.facets.price_range;
      expect(priceFacets.some(f => f.value === '100-500')).toBe(true);
      expect(priceFacets.some(f => f.value === '1000-2000')).toBe(true);
    });

    it('should include suggestions when enabled', async () => {
      searchInterface.updateQuery('laptop');
      
      const results = await searchInterface.search();
      
      expect(results.suggestions).toBeDefined();
      expect(Array.isArray(results.suggestions)).toBe(true);
    });

    it('should not include suggestions when query is empty', async () => {
      const results = await searchInterface.search();
      
      expect(results.suggestions).toEqual([]);
    });
  });

  describe('Search Profiles', () => {
    it('should save and load search profiles', () => {
      searchInterface.updateQuery('premium laptop');
      searchInterface.updateDimension('quality', { min: 0.8, weight: 0.9 });
      searchInterface.updateFilter('brand', 'PremiumBrand');
      searchInterface.updateSort('price', 'desc');
      
      const profile = searchInterface.saveSearchProfile('My Premium Search');
      
      expect(profile.name).toBe('My Premium Search');
      expect(profile.query).toBe('premium laptop');
      expect(profile.dimensions.quality.min).toBe(0.8);
      expect(profile.filters.brand).toBe('PremiumBrand');
      expect(profile.sort.dimension).toBe('price');
      
      // Reset interface
      searchInterface.updateQuery('');
      searchInterface.updateDimension('quality', { min: undefined, weight: 1.0 });
      
      // Load profile
      searchInterface.loadSearchProfile(profile);
      const state = searchInterface.getState();
      
      expect(state.query).toBe('premium laptop');
      expect(state.dimensions.quality.min).toBe(0.8);
      expect(state.filters.brand).toBe('PremiumBrand');
      expect(state.sort.dimension).toBe('price');
      expect(state.pagination.offset).toBe(0); // Should reset pagination
    });
  });

  describe('URL Integration', () => {
    it('should generate correct search URL', () => {
      searchInterface.updateQuery('test laptop');
      searchInterface.updateDimension('price', { min: 500, max: 1500, preferred: 1000 });
      searchInterface.updateFilter('brand', 'TestBrand');
      searchInterface.updateSort('price', 'asc');
      searchInterface.updatePagination(10, 20);
      
      const url = searchInterface.getSearchURL();
      
      expect(url).toContain('q=test'); // URL encoding may differ, check for partial match
      expect(url).toContain('price_min=500');
      expect(url).toContain('price_max=1500');
      expect(url).toContain('price_pref=1000');
      expect(url).toContain('filter_brand=TestBrand');
      expect(url).toContain('sort=price%3Aasc'); // URL encoding converts : to %3A
      expect(url).toContain('page=3');
    });

    it('should load state from URL parameters', () => {
      const params = new URLSearchParams([
        ['q', 'test laptop'],
        ['price_min', '500'],
        ['price_max', '1500'],
        ['quality_weight', '0.8'],
        ['filter_brand', 'TestBrand'],
        ['filter_categories', 'electronics,computers'],
        ['sort', 'price:desc'],
        ['page', '2']
      ]);
      
      searchInterface.loadFromURL(params);
      const state = searchInterface.getState();
      
      expect(state.query).toBe('test laptop');
      expect(state.dimensions.price.min).toBe(500);
      expect(state.dimensions.price.max).toBe(1500);
      expect(state.dimensions.quality.weight).toBe(0.8);
      expect(state.filters.brand).toBe('TestBrand');
      expect(state.filters.categories).toEqual(['electronics', 'computers']);
      expect(state.sort.dimension).toBe('price');
      expect(state.sort.direction).toBe('desc');
      expect(state.pagination.offset).toBe(10); // Page 2 with default limit 10
    });
  });

  describe('Analytics', () => {
    it('should provide search analytics', () => {
      searchInterface.updateQuery('test');
      searchInterface.updateDimension('price', { min: 100, max: 500 });
      searchInterface.updateDimension('quality', { preferred: 0.8 });
      searchInterface.updateFilter('brand', 'TestBrand');
      searchInterface.updateSort('price', 'asc');
      searchInterface.updatePagination(10, 20);
      
      const analytics = searchInterface.getSearchAnalytics();
      
      expect(analytics.hasQuery).toBe(true);
      expect(analytics.dimensionsUsed).toContain('price');
      expect(analytics.dimensionsUsed).toContain('quality');
      expect(analytics.filtersUsed).toContain('brand');
      expect(analytics.sortedByDimension).toBe(true);
      expect(analytics.currentPage).toBe(3);
    });

    it('should handle empty search analytics', () => {
      const analytics = searchInterface.getSearchAnalytics();
      
      expect(analytics.hasQuery).toBe(false);
      expect(analytics.dimensionsUsed).toEqual([]);
      expect(analytics.filtersUsed).toContain('categories'); // Default filter
      expect(analytics.sortedByDimension).toBe(false);
      expect(analytics.currentPage).toBe(1);
    });
  });
});

describe('Utility Functions', () => {
  describe('formatPrice', () => {
    it('should format prices correctly', () => {
      expect(formatPrice(99.99)).toBe('$99.99');
      expect(formatPrice(1299.99)).toBe('$1,299.99');
      expect(formatPrice(0)).toBe('$0.00');
    });

    it('should handle different currencies', () => {
      expect(formatPrice(99.99, 'EUR')).toContain('99.99');
    });
  });

  describe('formatQuality', () => {
    it('should format quality scores correctly', () => {
      expect(formatQuality(0.95)).toBe('Excellent');
      expect(formatQuality(0.85)).toBe('Very Good');
      expect(formatQuality(0.75)).toBe('Good');
      expect(formatQuality(0.65)).toBe('Fair');
      expect(formatQuality(0.45)).toBe('Basic');
    });
  });

  describe('formatRelevance', () => {
    it('should format relevance scores correctly', () => {
      const relevance = {
        price: 0.8,
        quality: 0.95,
        performance: 0.6,
        brand_value: 0.75
      };
      
      const formatted = formatRelevance(relevance);
      
      expect(formatted).toHaveLength(4);
      expect(formatted[0]).toEqual({
        dimension: 'quality',
        score: 0.95,
        label: 'Quality'
      });
      expect(formatted[1]).toEqual({
        dimension: 'price',
        score: 0.8,
        label: 'Price'
      });
      
      // Check formatting of compound dimension names
      const brandEntry = formatted.find(f => f.dimension === 'brand_value');
      expect(brandEntry?.label).toBe('Brand Value');
    });

    it('should handle empty relevance object', () => {
      const formatted = formatRelevance({});
      expect(formatted).toEqual([]);
    });
  });
});