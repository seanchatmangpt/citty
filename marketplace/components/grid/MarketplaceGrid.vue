<template>
  <div class="marketplace-grid">
    <!-- Search and Controls -->
    <div class="grid-controls">
      <div class="search-section">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search items..."
          class="search-input"
        />
        <button @click="resetFilters" class="reset-btn">Reset Filters</button>
      </div>
      
      <div class="view-controls">
        <button
          v-for="view in viewModes"
          :key="view.mode"
          :class="['view-btn', { active: currentView === view.mode }]"
          @click="setView(view.mode)"
        >
          {{ view.label }}
        </button>
      </div>
    </div>

    <!-- Filter Panel -->
    <FilterPanels
      v-if="showFilters"
      :filters="activeFilters"
      :available-dimensions="availableDimensions"
      @filter-changed="onFilterChanged"
      @filter-removed="removeFilter"
    />

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading marketplace items...</p>
    </div>

    <!-- Grid View -->
    <div v-else-if="currentView === 'grid'" class="items-grid">
      <div
        v-for="item in filteredItems"
        :key="item.id"
        class="item-card"
        @click="selectItem(item)"
        :class="{ selected: selectedItem?.id === item.id }"
      >
        <div class="item-header">
          <h3>{{ item.name }}</h3>
          <span class="item-price">${{ item.price.toLocaleString() }}</span>
        </div>
        
        <div class="item-dimensions">
          <div
            v-for="(value, dimension) in getDisplayDimensions(item)"
            :key="dimension"
            class="dimension-tag"
          >
            <span class="dimension-name">{{ dimension }}:</span>
            <span class="dimension-value">{{ formatDimensionValue(value) }}</span>
          </div>
        </div>
        
        <div class="item-meta">
          <span class="category">{{ item.category }}</span>
          <span class="status" :class="item.status">{{ item.status }}</span>
        </div>
        
        <div class="item-actions">
          <button @click.stop="viewDetails(item)" class="details-btn">
            View Details
          </button>
          <button
            v-if="item.status === 'active'"
            @click.stop="initiatePurchase(item)"
            class="purchase-btn"
          >
            Purchase
          </button>
        </div>
      </div>
    </div>

    <!-- List View -->
    <div v-else-if="currentView === 'list'" class="items-list">
      <div class="list-header">
        <div
          v-for="column in listColumns"
          :key="column.key"
          class="column-header"
          @click="sortBy(column.key)"
        >
          {{ column.label }}
          <span v-if="sortColumn === column.key" class="sort-indicator">
            {{ sortDirection === 'asc' ? '↑' : '↓' }}
          </span>
        </div>
      </div>
      
      <div
        v-for="item in filteredItems"
        :key="item.id"
        class="list-row"
        @click="selectItem(item)"
        :class="{ selected: selectedItem?.id === item.id }"
      >
        <div class="list-cell name">{{ item.name }}</div>
        <div class="list-cell price">${{ item.price.toLocaleString() }}</div>
        <div class="list-cell category">{{ item.category }}</div>
        <div class="list-cell status" :class="item.status">{{ item.status }}</div>
        <div class="list-cell dimensions">
          {{ Object.keys(item.dimensions).length }} dimensions
        </div>
        <div class="list-cell actions">
          <button @click.stop="viewDetails(item)" class="action-btn">Details</button>
        </div>
      </div>
    </div>

    <!-- Visualization View -->
    <div v-else-if="currentView === 'visualization'" class="visualization-container">
      <NDimensionalVisualization
        :items="filteredItems"
        :config="visualizationConfig"
        :selected-item="selectedItem"
        @item-selected="selectItem"
      />
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="pagination">
      <button
        v-for="page in paginationPages"
        :key="page"
        :class="['page-btn', { active: currentPage === page }]"
        @click="setPage(page)"
        :disabled="page === '...'"
      >
        {{ page }}
      </button>
    </div>

    <!-- Item Details Modal -->
    <ItemDetailView
      v-if="showDetails"
      :item="detailsItem"
      @close="closeDetails"
      @purchase="initiatePurchase"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import type {
  MarketplaceItem,
  FilterSet,
  VisualizationConfig,
  DimensionalVector
} from '../../types';
import FilterPanels from '../filters/FilterPanels.vue';
import NDimensionalVisualization from '../visualization/NDimensionalVisualization.vue';
import ItemDetailView from '../details/ItemDetailView.vue';

interface Props {
  items?: MarketplaceItem[];
  pageSize?: number;
  defaultFilters?: FilterSet;
  showFilters?: boolean;
  enableVisualization?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  pageSize: 20,
  defaultFilters: () => ({}),
  showFilters: true,
  enableVisualization: true
});

const emit = defineEmits<{
  itemSelected: [item: MarketplaceItem];
  purchaseInitiated: [item: MarketplaceItem];
  filtersChanged: [filters: FilterSet];
}>();

// Reactive state
const searchQuery = ref('');
const currentView = ref<'grid' | 'list' | 'visualization'>('grid');
const currentPage = ref(1);
const sortColumn = ref<string>('name');
const sortDirection = ref<'asc' | 'desc'>('asc');
const selectedItem = ref<MarketplaceItem | null>(null);
const activeFilters = ref<FilterSet>({ ...props.defaultFilters });
const loading = ref(false);
const showDetails = ref(false);
const detailsItem = ref<MarketplaceItem | null>(null);

// View modes
const viewModes = computed(() => {
  const modes = [
    { mode: 'grid', label: 'Grid' },
    { mode: 'list', label: 'List' }
  ];
  
  if (props.enableVisualization) {
    modes.push({ mode: 'visualization', label: 'Visualization' });
  }
  
  return modes;
});

// List columns configuration
const listColumns = [
  { key: 'name', label: 'Name' },
  { key: 'price', label: 'Price' },
  { key: 'category', label: 'Category' },
  { key: 'status', label: 'Status' },
  { key: 'dimensions', label: 'Dimensions' },
  { key: 'actions', label: 'Actions' }
];

// Available dimensions from all items
const availableDimensions = computed(() => {
  const dimensions = new Set<string>();
  props.items.forEach(item => {
    Object.keys(item.dimensions).forEach(dim => dimensions.add(dim));
  });
  return Array.from(dimensions);
});

// Filtered items based on search and filters
const filteredItems = computed(() => {
  let items = [...props.items];

  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    items = items.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.tags.some(tag => tag.toLowerCase().includes(query))
    );
  }

  // Apply dimensional filters
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

  // Apply sorting
  items.sort((a, b) => {
    let aVal: any = a[sortColumn.value as keyof MarketplaceItem];
    let bVal: any = b[sortColumn.value as keyof MarketplaceItem];

    // Handle dimensional sorting
    if (!aVal && a.dimensions[sortColumn.value] !== undefined) {
      aVal = a.dimensions[sortColumn.value];
      bVal = b.dimensions[sortColumn.value];
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection.value === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection.value === 'asc' ? aVal - bVal : bVal - aVal;
    }

    return 0;
  });

  return items;
});

// Paginated items
const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * props.pageSize;
  const end = start + props.pageSize;
  return filteredItems.value.slice(start, end);
});

// Pagination helpers
const totalPages = computed(() =>
  Math.ceil(filteredItems.value.length / props.pageSize)
);

const paginationPages = computed(() => {
  const pages: (number | string)[] = [];
  const total = totalPages.value;
  const current = currentPage.value;

  if (total <= 7) {
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
  } else {
    pages.push(1);
    
    if (current > 3) pages.push('...');
    
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    if (current < total - 2) pages.push('...');
    
    pages.push(total);
  }

  return pages;
});

// Visualization config
const visualizationConfig = ref<VisualizationConfig>({
  type: '3d',
  dimensions: availableDimensions.value.slice(0, 3),
  colorDimension: 'category',
  sizeDimension: 'price',
  opacity: 0.8,
  showAxes: true,
  showGrid: true
});

// Methods
const setView = (view: 'grid' | 'list' | 'visualization') => {
  currentView.value = view;
};

const setPage = (page: number | string) => {
  if (typeof page === 'number') {
    currentPage.value = page;
  }
};

const sortBy = (column: string) => {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn.value = column;
    sortDirection.value = 'asc';
  }
};

const selectItem = (item: MarketplaceItem) => {
  selectedItem.value = item;
  emit('itemSelected', item);
};

const viewDetails = (item: MarketplaceItem) => {
  detailsItem.value = item;
  showDetails.value = true;
};

const closeDetails = () => {
  showDetails.value = false;
  detailsItem.value = null;
};

const initiatePurchase = (item: MarketplaceItem) => {
  emit('purchaseInitiated', item);
};

const onFilterChanged = (dimension: string, filter: any) => {
  activeFilters.value[dimension] = filter;
  emit('filtersChanged', { ...activeFilters.value });
  currentPage.value = 1; // Reset to first page
};

const removeFilter = (dimension: string) => {
  delete activeFilters.value[dimension];
  emit('filtersChanged', { ...activeFilters.value });
  currentPage.value = 1;
};

const resetFilters = () => {
  activeFilters.value = {};
  searchQuery.value = '';
  emit('filtersChanged', {});
  currentPage.value = 1;
};

const getDisplayDimensions = (item: MarketplaceItem): Record<string, any> => {
  // Show only the first 3 most important dimensions in grid view
  const dimensions = Object.entries(item.dimensions);
  return Object.fromEntries(dimensions.slice(0, 3));
};

const formatDimensionValue = (value: any): string => {
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return String(value);
};

// Update visualization config when available dimensions change
watch(availableDimensions, (newDims) => {
  visualizationConfig.value.dimensions = newDims.slice(0, 3);
});

// Watch for external filter changes
watch(() => props.defaultFilters, (newFilters) => {
  activeFilters.value = { ...newFilters };
}, { deep: true });

onMounted(() => {
  // Initialize component
  if (availableDimensions.value.length > 0) {
    visualizationConfig.value.dimensions = availableDimensions.value.slice(0, 3);
  }
});
</script>

<style scoped>
.marketplace-grid {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1rem;
}

.grid-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.search-section {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.search-input {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  min-width: 300px;
}

.reset-btn {
  padding: 0.5rem 1rem;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}

.reset-btn:hover {
  background: #e0e0e0;
}

.view-controls {
  display: flex;
  gap: 0.5rem;
}

.view-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.view-btn:hover {
  background: #f0f0f0;
}

.view-btn.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem;
  color: #666;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.item-card {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.item-card:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
  transform: translateY(-2px);
}

.item-card.selected {
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.item-header h3 {
  margin: 0;
  font-size: 1.25rem;
  color: #333;
}

.item-price {
  font-size: 1.25rem;
  font-weight: bold;
  color: #28a745;
}

.item-dimensions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.dimension-tag {
  background: #f8f9fa;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  border: 1px solid #e9ecef;
}

.dimension-name {
  color: #666;
  font-weight: 500;
}

.dimension-value {
  color: #333;
  margin-left: 0.25rem;
}

.item-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.category {
  background: #e9ecef;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  color: #495057;
}

.status {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  text-transform: capitalize;
}

.status.active {
  background: #d1ecf1;
  color: #0c5460;
}

.status.sold {
  background: #d4edda;
  color: #155724;
}

.status.pending {
  background: #fff3cd;
  color: #856404;
}

.status.draft {
  background: #f8d7da;
  color: #721c24;
}

.item-actions {
  display: flex;
  gap: 0.5rem;
}

.details-btn,
.purchase-btn {
  flex: 1;
  padding: 0.5rem 1rem;
  border: 1px solid #007bff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.details-btn {
  background: white;
  color: #007bff;
}

.details-btn:hover {
  background: #f8f9fa;
}

.purchase-btn {
  background: #007bff;
  color: white;
}

.purchase-btn:hover {
  background: #0056b3;
}

.items-list {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.list-header {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
}

.column-header {
  padding: 1rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-right: 1px solid #dee2e6;
}

.column-header:hover {
  background: #e9ecef;
}

.sort-indicator {
  font-size: 0.75rem;
  color: #007bff;
}

.list-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr;
  cursor: pointer;
  transition: background 0.2s;
}

.list-row:hover {
  background: #f8f9fa;
}

.list-row.selected {
  background: rgba(0,123,255,0.1);
}

.list-cell {
  padding: 1rem;
  border-right: 1px solid #dee2e6;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  align-items: center;
}

.list-cell.actions {
  justify-content: center;
}

.action-btn {
  padding: 0.25rem 0.75rem;
  border: 1px solid #007bff;
  background: white;
  color: #007bff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
}

.action-btn:hover {
  background: #f8f9fa;
}

.visualization-container {
  height: 600px;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.pagination {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 2rem;
}

.page-btn {
  padding: 0.5rem 0.75rem;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: #f8f9fa;
}

.page-btn.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.page-btn:disabled {
  cursor: default;
  opacity: 0.5;
}
</style>