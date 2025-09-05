<template>
  <div class="filter-panels">
    <div class="filter-header">
      <h3>Filters</h3>
      <div class="filter-actions">
        <button @click="addFilter" class="add-filter-btn">Add Filter</button>
        <button @click="clearAllFilters" class="clear-filters-btn">Clear All</button>
      </div>
    </div>

    <!-- Active Filters -->
    <div v-if="Object.keys(filters).length > 0" class="active-filters">
      <div
        v-for="(filter, dimension) in filters"
        :key="dimension"
        class="filter-panel"
      >
        <div class="filter-header-row">
          <h4>{{ filter.label || dimension }}</h4>
          <button @click="removeFilter(dimension)" class="remove-filter-btn">×</button>
        </div>

        <!-- Range Filter -->
        <div v-if="filter.type === 'range'" class="range-filter">
          <div class="range-inputs">
            <label>
              Min:
              <input
                type="number"
                v-model="filter.value.min"
                :min="filter.range?.min"
                :max="filter.range?.max"
                @input="onFilterChanged(dimension, filter)"
              />
            </label>
            <label>
              Max:
              <input
                type="number"
                v-model="filter.value.max"
                :min="filter.range?.min"
                :max="filter.range?.max"
                @input="onFilterChanged(dimension, filter)"
              />
            </label>
          </div>
          
          <div class="range-slider">
            <vue-range-slider
              v-model="filter.value"
              :min="filter.range?.min || 0"
              :max="filter.range?.max || 100"
              :step="1"
              @change="onFilterChanged(dimension, filter)"
            />
          </div>
          
          <div class="range-info">
            Range: {{ filter.range?.min || 0 }} - {{ filter.range?.max || 100 }}
          </div>
        </div>

        <!-- Categorical Filter -->
        <div v-else-if="filter.type === 'categorical'" class="categorical-filter">
          <div class="category-options">
            <label
              v-for="option in filter.options"
              :key="option"
              class="category-option"
            >
              <input
                type="checkbox"
                :value="option"
                v-model="filter.value"
                @change="onFilterChanged(dimension, filter)"
              />
              <span>{{ option }}</span>
              <span class="option-count">({{ getCategoryCount(dimension, option) }})</span>
            </label>
          </div>
          
          <div class="category-actions">
            <button @click="selectAllCategories(dimension, filter)">Select All</button>
            <button @click="selectNoneCategories(dimension, filter)">Select None</button>
          </div>
        </div>

        <!-- Boolean Filter -->
        <div v-else-if="filter.type === 'boolean'" class="boolean-filter">
          <label class="boolean-option">
            <input
              type="radio"
              :name="dimension + '_boolean'"
              :value="true"
              v-model="filter.value"
              @change="onFilterChanged(dimension, filter)"
            />
            <span>Yes</span>
          </label>
          <label class="boolean-option">
            <input
              type="radio"
              :name="dimension + '_boolean'"
              :value="false"
              v-model="filter.value"
              @change="onFilterChanged(dimension, filter)"
            />
            <span>No</span>
          </label>
          <label class="boolean-option">
            <input
              type="radio"
              :name="dimension + '_boolean'"
              :value="null"
              v-model="filter.value"
              @change="onFilterChanged(dimension, filter)"
            />
            <span>Any</span>
          </label>
        </div>

        <!-- Text Filter -->
        <div v-else-if="filter.type === 'text'" class="text-filter">
          <div class="text-input-group">
            <input
              type="text"
              v-model="filter.value"
              :placeholder="'Search in ' + dimension + '...'"
              @input="onFilterChanged(dimension, filter)"
              class="text-input"
            />
            <button
              v-if="filter.value"
              @click="clearTextFilter(dimension, filter)"
              class="clear-text-btn"
            >
              Clear
            </button>
          </div>
          
          <div class="text-options">
            <label>
              <input
                type="checkbox"
                v-model="filter.caseSensitive"
                @change="onFilterChanged(dimension, filter)"
              />
              Case sensitive
            </label>
            <label>
              <input
                type="checkbox"
                v-model="filter.exactMatch"
                @change="onFilterChanged(dimension, filter)"
              />
              Exact match
            </label>
          </div>
        </div>

        <!-- Filter Statistics -->
        <div class="filter-stats">
          <small>
            {{ getFilteredCount(dimension, filter) }} items match this filter
          </small>
        </div>
      </div>
    </div>

    <!-- Add Filter Modal -->
    <div v-if="showAddFilterModal" class="modal-overlay" @click="closeAddFilterModal">
      <div class="add-filter-modal" @click.stop>
        <div class="modal-header">
          <h3>Add Filter</h3>
          <button @click="closeAddFilterModal" class="close-btn">×</button>
        </div>
        
        <div class="modal-content">
          <div class="form-group">
            <label>Dimension:</label>
            <select v-model="newFilter.dimension">
              <option value="">Select dimension...</option>
              <option
                v-for="dim in availableNewDimensions"
                :key="dim"
                :value="dim"
              >
                {{ dim }}
              </option>
            </select>
          </div>
          
          <div v-if="newFilter.dimension" class="form-group">
            <label>Filter Type:</label>
            <select v-model="newFilter.type">
              <option
                v-for="type in getAvailableFilterTypes(newFilter.dimension)"
                :key="type.value"
                :value="type.value"
              >
                {{ type.label }}
              </option>
            </select>
          </div>
          
          <div v-if="newFilter.dimension && newFilter.type" class="form-group">
            <label>Label (optional):</label>
            <input
              type="text"
              v-model="newFilter.label"
              :placeholder="newFilter.dimension"
            />
          </div>
        </div>
        
        <div class="modal-actions">
          <button @click="closeAddFilterModal" class="cancel-btn">Cancel</button>
          <button
            @click="createFilter"
            :disabled="!newFilter.dimension || !newFilter.type"
            class="create-btn"
          >
            Create Filter
          </button>
        </div>
      </div>
    </div>

    <!-- Filter Presets -->
    <div class="filter-presets">
      <h4>Quick Filters</h4>
      <div class="preset-buttons">
        <button
          v-for="preset in filterPresets"
          :key="preset.name"
          @click="applyPreset(preset)"
          class="preset-btn"
        >
          {{ preset.name }}
        </button>
      </div>
    </div>

    <!-- Filter Summary -->
    <div class="filter-summary">
      <div class="summary-stats">
        <div class="stat">
          <span class="stat-label">Active Filters:</span>
          <span class="stat-value">{{ Object.keys(filters).length }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Items Shown:</span>
          <span class="stat-value">{{ filteredItemCount }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Total Items:</span>
          <span class="stat-value">{{ totalItemCount }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { FilterSet, FilterDefinition, MarketplaceItem } from '../../types';

interface Props {
  filters: FilterSet;
  availableDimensions: string[];
  items?: MarketplaceItem[];
}

const props = withDefaults(defineProps<Props>(), {
  items: () => []
});

const emit = defineEmits<{
  filterChanged: [dimension: string, filter: FilterDefinition];
  filterRemoved: [dimension: string];
  filtersCleared: [];
}>();

// Reactive state
const showAddFilterModal = ref(false);
const newFilter = ref({
  dimension: '',
  type: '',
  label: ''
});

// Computed properties
const availableNewDimensions = computed(() => {
  return props.availableDimensions.filter(dim => !props.filters[dim]);
});

const filteredItemCount = computed(() => {
  // This would typically come from the parent component
  // For now, return a placeholder
  return props.items.length;
});

const totalItemCount = computed(() => {
  return props.items.length;
});

// Filter presets
const filterPresets = [
  {
    name: 'High Value Items',
    filters: {
      price: {
        type: 'range' as const,
        dimension: 'price',
        label: 'Price',
        value: { min: 1000, max: Infinity }
      }
    }
  },
  {
    name: 'Recently Added',
    filters: {
      createdAt: {
        type: 'range' as const,
        dimension: 'createdAt',
        label: 'Created Date',
        value: { min: Date.now() - 7 * 24 * 60 * 60 * 1000, max: Date.now() }
      }
    }
  },
  {
    name: 'Active Items Only',
    filters: {
      status: {
        type: 'categorical' as const,
        dimension: 'status',
        label: 'Status',
        options: ['active', 'pending', 'sold', 'draft'],
        value: ['active']
      }
    }
  }
];

// Methods
const addFilter = () => {
  showAddFilterModal.value = true;
  newFilter.value = {
    dimension: '',
    type: '',
    label: ''
  };
};

const closeAddFilterModal = () => {
  showAddFilterModal.value = false;
};

const createFilter = () => {
  const { dimension, type, label } = newFilter.value;
  
  if (!dimension || !type) return;
  
  const filter: FilterDefinition = {
    dimension,
    type: type as any,
    label: label || dimension
  };
  
  // Initialize filter value based on type
  switch (type) {
    case 'range':
      const range = getDimensionRange(dimension);
      filter.range = range;
      filter.value = { min: range.min, max: range.max };
      break;
    case 'categorical':
      filter.options = getDimensionOptions(dimension);
      filter.value = [];
      break;
    case 'boolean':
      filter.value = null;
      break;
    case 'text':
      filter.value = '';
      break;
  }
  
  emit('filterChanged', dimension, filter);
  closeAddFilterModal();
};

const removeFilter = (dimension: string) => {
  emit('filterRemoved', dimension);
};

const clearAllFilters = () => {
  emit('filtersCleared');
};

const onFilterChanged = (dimension: string, filter: FilterDefinition) => {
  emit('filterChanged', dimension, { ...filter });
};

const clearTextFilter = (dimension: string, filter: FilterDefinition) => {
  filter.value = '';
  onFilterChanged(dimension, filter);
};

const selectAllCategories = (dimension: string, filter: FilterDefinition) => {
  if (filter.options) {
    filter.value = [...filter.options];
    onFilterChanged(dimension, filter);
  }
};

const selectNoneCategories = (dimension: string, filter: FilterDefinition) => {
  filter.value = [];
  onFilterChanged(dimension, filter);
};

const applyPreset = (preset: any) => {
  Object.entries(preset.filters).forEach(([dimension, filter]) => {
    emit('filterChanged', dimension, filter as FilterDefinition);
  });
};

// Helper methods
const getAvailableFilterTypes = (dimension: string) => {
  const sampleValues = props.items.map(item => item.dimensions[dimension]).filter(v => v !== undefined);
  
  if (sampleValues.length === 0) {
    return [{ value: 'text', label: 'Text' }];
  }
  
  const types = [];
  
  // Check if numeric
  if (sampleValues.every(v => typeof v === 'number')) {
    types.push({ value: 'range', label: 'Range' });
  }
  
  // Check if boolean
  if (sampleValues.every(v => typeof v === 'boolean')) {
    types.push({ value: 'boolean', label: 'Yes/No' });
  }
  
  // Check if categorical (limited unique values)
  const uniqueValues = new Set(sampleValues);
  if (uniqueValues.size <= 20) {
    types.push({ value: 'categorical', label: 'Categories' });
  }
  
  // Always allow text filter
  types.push({ value: 'text', label: 'Text Search' });
  
  return types;
};

const getDimensionRange = (dimension: string) => {
  const values = props.items
    .map(item => Number(item.dimensions[dimension]))
    .filter(v => !isNaN(v));
  
  if (values.length === 0) {
    return { min: 0, max: 100 };
  }
  
  return {
    min: Math.min(...values),
    max: Math.max(...values)
  };
};

const getDimensionOptions = (dimension: string) => {
  const values = props.items.map(item => item.dimensions[dimension]).filter(v => v !== undefined);
  const uniqueValues = [...new Set(values)];
  return uniqueValues.map(v => String(v)).sort();
};

const getCategoryCount = (dimension: string, option: string) => {
  return props.items.filter(item => String(item.dimensions[dimension]) === option).length;
};

const getFilteredCount = (dimension: string, filter: FilterDefinition) => {
  if (!filter.value) return props.items.length;
  
  return props.items.filter(item => {
    const value = item.dimensions[dimension];
    
    switch (filter.type) {
      case 'range':
        return typeof value === 'number' &&
          value >= filter.value.min &&
          value <= filter.value.max;
      case 'categorical':
        return Array.isArray(filter.value) && filter.value.includes(String(value));
      case 'boolean':
        return filter.value === null || value === filter.value;
      case 'text':
        if (!filter.value) return true;
        const searchText = filter.caseSensitive ? String(value) : String(value).toLowerCase();
        const queryText = filter.caseSensitive ? filter.value : filter.value.toLowerCase();
        return filter.exactMatch ? searchText === queryText : searchText.includes(queryText);
      default:
        return true;
    }
  }).length;
};
</script>

<style scoped>
.filter-panels {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  padding: 1.5rem;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e9ecef;
}

.filter-header h3 {
  margin: 0;
  color: #333;
}

.filter-actions {
  display: flex;
  gap: 0.5rem;
}

.add-filter-btn,
.clear-filters-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #007bff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.add-filter-btn {
  background: #007bff;
  color: white;
}

.add-filter-btn:hover {
  background: #0056b3;
}

.clear-filters-btn {
  background: white;
  color: #007bff;
}

.clear-filters-btn:hover {
  background: #f8f9fa;
}

.active-filters {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.filter-panel {
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 1rem;
  background: #f8f9fa;
}

.filter-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.filter-header-row h4 {
  margin: 0;
  color: #495057;
  font-size: 1rem;
}

.remove-filter-btn {
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-filter-btn:hover {
  background: #c82333;
}

/* Range Filter Styles */
.range-filter {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.range-inputs {
  display: flex;
  gap: 1rem;
}

.range-inputs label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #495057;
}

.range-inputs input {
  padding: 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
}

.range-slider {
  padding: 0.5rem 0;
}

.range-info {
  font-size: 0.75rem;
  color: #6c757d;
  text-align: center;
}

/* Categorical Filter Styles */
.categorical-filter {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.category-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 200px;
  overflow-y: auto;
  padding: 0.5rem;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background: white;
}

.category-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
  cursor: pointer;
  font-size: 0.875rem;
}

.category-option:hover {
  background: #f8f9fa;
}

.option-count {
  color: #6c757d;
  font-size: 0.75rem;
  margin-left: auto;
}

.category-actions {
  display: flex;
  gap: 0.5rem;
}

.category-actions button {
  padding: 0.25rem 0.75rem;
  border: 1px solid #6c757d;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  color: #6c757d;
}

.category-actions button:hover {
  background: #f8f9fa;
}

/* Boolean Filter Styles */
.boolean-filter {
  display: flex;
  gap: 1rem;
}

.boolean-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
}

/* Text Filter Styles */
.text-filter {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.text-input-group {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.text-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
}

.clear-text-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #6c757d;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  color: #6c757d;
}

.clear-text-btn:hover {
  background: #f8f9fa;
}

.text-options {
  display: flex;
  gap: 1rem;
}

.text-options label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.filter-stats {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #dee2e6;
}

.filter-stats small {
  color: #6c757d;
  font-style: italic;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.add-filter-modal {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
  width: 400px;
  max-width: 90vw;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #dee2e6;
}

.modal-header h3 {
  margin: 0;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6c757d;
  line-height: 1;
}

.close-btn:hover {
  color: #333;
}

.modal-content {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 500;
  color: #495057;
}

.form-group select,
.form-group input {
  padding: 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1.5rem;
  border-top: 1px solid #dee2e6;
}

.cancel-btn,
.create-btn {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.cancel-btn {
  border: 1px solid #6c757d;
  background: white;
  color: #6c757d;
}

.cancel-btn:hover {
  background: #f8f9fa;
}

.create-btn {
  border: 1px solid #007bff;
  background: #007bff;
  color: white;
}

.create-btn:hover:not(:disabled) {
  background: #0056b3;
}

.create-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Filter Presets */
.filter-presets {
  margin: 2rem 0;
  padding-top: 1rem;
  border-top: 1px solid #e9ecef;
}

.filter-presets h4 {
  margin: 0 0 1rem 0;
  color: #495057;
  font-size: 0.875rem;
}

.preset-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.preset-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #28a745;
  background: white;
  color: #28a745;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.preset-btn:hover {
  background: #28a745;
  color: white;
}

/* Filter Summary */
.filter-summary {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #e9ecef;
}

.summary-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.stat-label {
  font-size: 0.75rem;
  color: #6c757d;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: bold;
  color: #333;
  margin-top: 0.25rem;
}
</style>