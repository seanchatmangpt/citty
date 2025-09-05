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

  const loadItems = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Mock API call - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock data
      const mockItems: MarketplaceItem[] = [
        {
          id: 'item1',
          name: 'Wireless Headphones Pro',
          description: 'Premium wireless headphones with noise cancellation',
          price: 299,
          sellerId: 'seller1',
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15'),
          dimensions: {
            battery_life: 30,
            noise_reduction: 35,
            weight: 250,
            wireless: true,
            brand: 'TechPro'
          },
          category: 'Electronics',
          tags: ['audio', 'wireless', 'premium'],
          status: 'active',
          transactionHistory: []
        },
        {
          id: 'item2',
          name: 'Smart Fitness Tracker',
          description: 'Advanced fitness tracking with heart rate monitoring',
          price: 199,
          sellerId: 'seller2',
          createdAt: new Date('2024-01-10'),
          updatedAt: new Date('2024-01-12'),
          dimensions: {
            battery_life: 7,
            water_resistance: true,
            gps: true,
            screen_size: 1.4,
            health_sensors: 'heart rate, SpO2, sleep'
          },
          category: 'Health & Fitness',
          tags: ['fitness', 'health', 'wearable'],
          status: 'active',
          transactionHistory: []
        }
      ];
      
      state.items = mockItems;
    } catch (error) {
      setError('Failed to load items');
      console.error('Error loading items:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const mockTransactions: Transaction[] = [
        {
          id: 'txn1',
          itemId: 'item1',
          buyerId: 'buyer1',
          sellerId: 'seller1',
          amount: 299,
          timestamp: new Date('2024-01-16'),
          status: 'completed',
          workflowState: {
            currentStep: 'delivery_confirmation',
            completedSteps: ['payment_processing', 'item_preparation', 'shipping'],
            remainingSteps: [],
            progress: 1.0,
            metadata: {
              tracking_number: 'TRK123456',
              estimated_delivery: '2024-01-18'
            }
          }
        }
      ];
      
      state.transactions = mockTransactions;
    } catch (error) {
      setError('Failed to load transactions');
      console.error('Error loading transactions:', error);
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

  const clearFilters = () => {
    activeFilters.value = {};
  };

  // Initialize
  const initialize = async () => {
    await Promise.all([
      loadItems(),
      loadTransactions()
    ]);
  };

  return {
    // State
    state,
    activeFilters,
    
    // Computed
    filteredItems,
    userTransactions,
    userItems,
    
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
    initialize
  };
}