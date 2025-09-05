/**
 * Marketplace composable for Vue 3 components
 * Provides reactive state management for marketplace data
 */

import { ref, computed, reactive } from 'vue';
import type { MarketplaceItem, Transaction, FilterSet, User } from '../types';

export interface MarketplaceState {
  items: MarketplaceItem[];
  transactions: Transaction[];
  currentUser: User | null;
  loading: boolean;
  error: string | null;
}

export function useMarketplace() {
  // Reactive state
  const state = reactive<MarketplaceState>({
    items: [],
    transactions: [],
    currentUser: null,
    loading: false,
    error: null
  });

  // Filters
  const activeFilters = ref<FilterSet>({});
  
  // Computed properties
  const filteredItems = computed(() => {
    let items = [...state.items];

    Object.entries(activeFilters.value).forEach(([dimension, filter]) => {
      if (!filter.value) return;

      items = items.filter(item => {
        const value = item.dimensions[dimension];
        
        switch (filter.type) {
          case 'range':
            return typeof value === 'number' &&
              value >= filter.value.min &&
              value <= filter.value.max;
          case 'categorical':
            return filter.value.includes(value);
          case 'boolean':
            return value === filter.value;
          case 'text':
            return String(value).toLowerCase().includes(filter.value.toLowerCase());
          default:
            return true;
        }
      });
    });

    return items;
  });

  const userTransactions = computed(() => {
    if (!state.currentUser) return [];
    
    return state.transactions.filter(
      t => t.buyerId === state.currentUser!.id || t.sellerId === state.currentUser!.id
    );
  });

  const userItems = computed(() => {
    if (!state.currentUser) return [];
    
    return state.items.filter(item => item.sellerId === state.currentUser!.id);
  });

  // Methods
  const setLoading = (loading: boolean) => {
    state.loading = loading;
  };

  const setError = (error: string | null) => {
    state.error = error;
  };

  const loadItems = async (searchParams?: SearchFilters) => {
    setLoading(true);
    setError(null);
    
    try {
      // Build query parameters
      const queryParams = new URLSearchParams();
      
      if (searchParams?.query) queryParams.append('q', searchParams.query);
      if (searchParams?.type && searchParams.type !== 'all') queryParams.append('type', searchParams.type);
      if (searchParams?.category) queryParams.append('category', searchParams.category);
      if (searchParams?.verified) queryParams.append('verified', 'true');
      if (searchParams?.minRating) queryParams.append('minRating', searchParams.minRating.toString());
      if (searchParams?.sortBy) queryParams.append('sortBy', searchParams.sortBy);
      if (searchParams?.sortOrder) queryParams.append('sortOrder', searchParams.sortOrder);
      if (searchParams?.limit) queryParams.append('limit', searchParams.limit.toString());
      if (searchParams?.offset) queryParams.append('offset', searchParams.offset.toString());

      // Call the dimensional search API
      const response = await $fetch('/api/marketplace/search', {
        query: Object.fromEntries(queryParams)
      }) as SearchResults;

      // Transform API results to internal format
      const transformedItems = response.items.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.type === 'template' && 'price' in item ? item.price || 0 : 0,
        sellerId: `seller_${item.id.slice(-1)}`,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        dimensions: {
          complexity: '_score' in item ? Math.round((item._score as number) * 10) : 5,
          popularity: item.downloads,
          rating: item.rating,
          verified: item.verified,
          type: item.type,
          category: 'category' in item ? item.category : 'other'
        },
        category: 'category' in item ? item.category as string : item.type,
        tags: item.keywords || [],
        status: 'active' as const,
        transactionHistory: []
      })) as MarketplaceItem[];
      
      state.items = transformedItems;
      return response;
    } catch (error: any) {
      setError(`Failed to load items: ${error.message || 'Unknown error'}`);
      console.error('Error loading items:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async (userId?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // Call transactions API endpoint
      const queryParams = new URLSearchParams();
      if (userId) queryParams.append('userId', userId);
      
      const response = await $fetch('/api/marketplace/transactions', {
        query: Object.fromEntries(queryParams)
      });
      
      state.transactions = response.transactions || [];
      return response;
    } catch (error: any) {
      // For development, return mock transactions if API fails
      console.warn('Transactions API not available, using mock data:', error.message);
      
      const mockTransactions: Transaction[] = [
        {
          id: 'txn_dev_1',
          itemId: 'product_1',
          buyerId: 'buyer1',
          sellerId: 'seller1',
          amount: 0,
          timestamp: new Date('2024-01-16'),
          status: 'completed',
          workflowState: {
            currentStep: 'delivery_confirmation',
            completedSteps: ['payment_processing', 'item_preparation', 'shipping'],
            remainingSteps: [],
            progress: 1.0,
            metadata: {
              tracking_number: 'DEV_TRK123456',
              estimated_delivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
            }
          }
        }
      ];
      
      state.transactions = mockTransactions;
      return { transactions: mockTransactions };
    } finally {
      setLoading(false);
    }
  };

  const addItem = (item: MarketplaceItem) => {
    state.items.push(item);
  };

  const updateItem = (itemId: string, updates: Partial<MarketplaceItem>) => {
    const index = state.items.findIndex(item => item.id === itemId);
    if (index > -1) {
      state.items[index] = { ...state.items[index], ...updates, updatedAt: new Date() };
    }
  };

  const removeItem = (itemId: string) => {
    const index = state.items.findIndex(item => item.id === itemId);
    if (index > -1) {
      state.items.splice(index, 1);
    }
  };

  const setCurrentUser = (user: User | null) => {
    state.currentUser = user;
  };

  const updateFilters = (filters: FilterSet) => {
    activeFilters.value = { ...filters };
  };

  // Search functionality
  const search = async (filters: SearchFilters) => {
    const result = await loadItems(filters);
    if (result) {
      total.value = result.total;
      hasMore.value = result.hasMore;
    }
    return result;
  };

  const setSearchQuery = (query: string) => {
    return search({ query });
  };

  const setType = (type: ItemType | 'all') => {
    return search({ type });
  };

  const setSort = (sortBy: SortBy, sortOrder: SortOrder) => {
    return search({ sortBy, sortOrder });
  };

  const clearFilters = () => {
    activeFilters.value = {};
    return loadItems();
  };

  const loadMore = async () => {
    if (state.loading || !hasMoreItems.value) return;
    
    const currentOffset = state.items.length;
    const moreResults = await loadItems({ offset: currentOffset, limit: 20 });
    
    if (moreResults?.items) {
      const transformedItems = moreResults.items.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.type === 'template' && 'price' in item ? item.price || 0 : 0,
        sellerId: `seller_${item.id.slice(-1)}`,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        dimensions: {
          complexity: '_score' in item ? Math.round((item._score as number) * 10) : 5,
          popularity: item.downloads,
          rating: item.rating,
          verified: item.verified,
          type: item.type,
          category: 'category' in item ? item.category : 'other'
        },
        category: 'category' in item ? item.category as string : item.type,
        tags: item.keywords || [],
        status: 'active' as const,
        transactionHistory: []
      })) as MarketplaceItem[];
      
      state.items.push(...transformedItems);
    }
  };

  // Add computed properties for search results
  const total = ref(0);
  const hasMore = ref(false);

  const hasMoreItems = computed(() => hasMore.value);

  // Initialize
  const initialize = async () => {
    const results = await Promise.allSettled([
      loadItems(),
      loadTransactions()
    ]);
    
    // Handle any initialization errors gracefully
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.warn(`Failed to initialize ${index === 0 ? 'items' : 'transactions'}:`, result.reason);
      }
    });
  };

  return {
    // State
    state,
    activeFilters,
    total,
    hasMore,
    
    // Computed
    filteredItems,
    userTransactions,
    userItems,
    hasMoreItems,
    
    // Methods
    loadItems,
    loadTransactions,
    addItem,
    updateItem,
    removeItem,
    setCurrentUser,
    updateFilters,
    clearFilters,
    setLoading,
    setError,
    initialize,
    search,
    setSearchQuery,
    setType,
    setSort,
    loadMore
  };
}