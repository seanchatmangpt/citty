<template>
  <div class="add-item-form">
    <form @submit.prevent="submitForm">
      <!-- Basic Information -->
      <div class="form-section">
        <h4>Basic Information</h4>
        <div class="form-grid">
          <div class="form-field">
            <label for="itemName">Item Name *</label>
            <input
              id="itemName"
              type="text"
              v-model="form.name"
              required
              placeholder="Enter item name"
              class="form-input"
            />
          </div>
          
          <div class="form-field">
            <label for="category">Category *</label>
            <select
              id="category"
              v-model="form.category"
              required
              class="form-input"
            >
              <option value="">Select category</option>
              <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
            </select>
          </div>
          
          <div class="form-field full-width">
            <label for="description">Description</label>
            <textarea
              id="description"
              v-model="form.description"
              placeholder="Describe your item..."
              rows="3"
              class="form-input"
            ></textarea>
          </div>
          
          <div class="form-field">
            <label for="price">Price *</label>
            <div class="price-input">
              <span class="currency">$</span>
              <input
                id="price"
                type="number"
                v-model="form.price"
                required
                min="0"
                step="0.01"
                placeholder="0.00"
                class="form-input price-field"
              />
            </div>
          </div>
          
          <div class="form-field">
            <label for="tags">Tags</label>
            <input
              id="tags"
              type="text"
              v-model="tagsInput"
              @keydown="handleTagInput"
              placeholder="Add tags (press Enter)"
              class="form-input"
            />
            <div v-if="form.tags.length > 0" class="tags-display">
              <span
                v-for="(tag, index) in form.tags"
                :key="index"
                class="tag"
              >
                {{ tag }}
                <button type="button" @click="removeTag(index)" class="remove-tag">×</button>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Dimensional Attributes -->
      <div class="form-section">
        <div class="section-header">
          <h4>Dimensional Attributes</h4>
          <button type="button" @click="addDimension" class="add-dimension-btn">
            Add Dimension
          </button>
        </div>
        
        <div class="dimensions-list">
          <div
            v-for="(dimension, index) in form.dimensions"
            :key="index"
            class="dimension-row"
          >
            <div class="dimension-name">
              <input
                v-model="dimension.name"
                placeholder="Dimension name"
                class="form-input"
                required
              />
            </div>
            <div class="dimension-type">
              <select
                v-model="dimension.type"
                @change="onDimensionTypeChange(index)"
                class="form-input"
              >
                <option value="number">Number</option>
                <option value="text">Text</option>
                <option value="boolean">Boolean</option>
                <option value="select">Select</option>
              </select>
            </div>
            <div class="dimension-value">
              <!-- Number input -->
              <input
                v-if="dimension.type === 'number'"
                v-model.number="dimension.value"
                type="number"
                step="any"
                placeholder="Value"
                class="form-input"
                required
              />
              
              <!-- Text input -->
              <input
                v-else-if="dimension.type === 'text'"
                v-model="dimension.value"
                type="text"
                placeholder="Text value"
                class="form-input"
                required
              />
              
              <!-- Boolean select -->
              <select
                v-else-if="dimension.type === 'boolean'"
                v-model="dimension.value"
                class="form-input"
                required
              >
                <option value="">Select...</option>
                <option :value="true">Yes</option>
                <option :value="false">No</option>
              </select>
              
              <!-- Select with options -->
              <div v-else-if="dimension.type === 'select'" class="select-dimension">
                <input
                  v-model="dimension.optionInput"
                  @keydown="(e) => handleOptionInput(e, index)"
                  placeholder="Add options (Enter)"
                  class="form-input"
                />
                <select
                  v-if="dimension.options && dimension.options.length > 0"
                  v-model="dimension.value"
                  class="form-input"
                  required
                >
                  <option value="">Choose option</option>
                  <option
                    v-for="option in dimension.options"
                    :key="option"
                    :value="option"
                  >
                    {{ option }}
                  </option>
                </select>
                <div v-if="dimension.options && dimension.options.length > 0" class="options-display">
                  <span
                    v-for="(option, optIndex) in dimension.options"
                    :key="optIndex"
                    class="option-tag"
                  >
                    {{ option }}
                    <button
                      type="button"
                      @click="removeOption(index, optIndex)"
                      class="remove-option"
                    >
                      ×
                    </button>
                  </span>
                </div>
              </div>
            </div>
            <div class="dimension-actions">
              <button
                type="button"
                @click="removeDimension(index)"
                class="remove-dimension-btn"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Form Actions -->
      <div class="form-actions">
        <button type="button" @click="$emit('cancel')" class="form-btn cancel">
          Cancel
        </button>
        <button type="button" @click="saveDraft" class="form-btn draft">
          Save Draft
        </button>
        <button type="submit" :disabled="!isFormValid" class="form-btn submit">
          Add Item
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue';
import type { MarketplaceItem } from '../../types';

interface DimensionInput {
  name: string;
  type: 'number' | 'text' | 'boolean' | 'select';
  value: any;
  options?: string[];
  optionInput?: string;
}

interface ItemForm {
  name: string;
  description: string;
  price: number;
  category: string;
  tags: string[];
  dimensions: DimensionInput[];
}

const emit = defineEmits<{
  itemAdded: [item: MarketplaceItem];
  cancel: [];
}>();

// Form state
const form = reactive<ItemForm>({
  name: '',
  description: '',
  price: 0,
  category: '',
  tags: [],
  dimensions: []
});

const tagsInput = ref('');

// Categories
const categories = [
  'Electronics',
  'Clothing',
  'Books',
  'Home & Garden',
  'Sports',
  'Toys',
  'Health & Beauty',
  'Automotive',
  'Art & Collectibles',
  'Other'
];

// Computed
const isFormValid = computed(() => {
  return form.name.trim() !== '' &&
         form.category !== '' &&
         form.price > 0 &&
         form.dimensions.every(d => 
           d.name.trim() !== '' && 
           d.value !== '' && 
           d.value !== null && 
           d.value !== undefined
         );
});

// Methods
const handleTagInput = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    const tag = tagsInput.value.trim();
    if (tag && !form.tags.includes(tag)) {
      form.tags.push(tag);
      tagsInput.value = '';
    }
  }
};

const removeTag = (index: number) => {
  form.tags.splice(index, 1);
};

const addDimension = () => {
  form.dimensions.push({
    name: '',
    type: 'text',
    value: '',
    options: [],
    optionInput: ''
  });
};

const removeDimension = (index: number) => {
  form.dimensions.splice(index, 1);
};

const onDimensionTypeChange = (index: number) => {
  const dimension = form.dimensions[index];
  
  // Reset value when type changes
  if (dimension.type === 'number') {
    dimension.value = 0;
  } else if (dimension.type === 'boolean') {
    dimension.value = null;
  } else if (dimension.type === 'select') {
    dimension.value = '';
    dimension.options = [];
    dimension.optionInput = '';
  } else {
    dimension.value = '';
  }
};

const handleOptionInput = (event: KeyboardEvent, dimensionIndex: number) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    const dimension = form.dimensions[dimensionIndex];
    const option = dimension.optionInput?.trim();
    
    if (option && !dimension.options?.includes(option)) {
      if (!dimension.options) dimension.options = [];
      dimension.options.push(option);
      dimension.optionInput = '';
    }
  }
};

const removeOption = (dimensionIndex: number, optionIndex: number) => {
  const dimension = form.dimensions[dimensionIndex];
  if (dimension.options) {
    dimension.options.splice(optionIndex, 1);
  }
};

const submitForm = () => {
  if (!isFormValid.value) return;

  // Convert form data to MarketplaceItem
  const dimensionsObject: Record<string, any> = {};
  form.dimensions.forEach(d => {
    if (d.name.trim()) {
      dimensionsObject[d.name.trim()] = d.value;
    }
  });

  const newItem: MarketplaceItem = {
    id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: form.name.trim(),
    description: form.description.trim(),
    price: form.price,
    sellerId: 'current_seller', // This would come from auth context
    createdAt: new Date(),
    updatedAt: new Date(),
    dimensions: dimensionsObject,
    category: form.category,
    tags: [...form.tags],
    status: 'active',
    transactionHistory: []
  };

  emit('itemAdded', newItem);
  resetForm();
};

const saveDraft = () => {
  // Convert form data with draft status
  const dimensionsObject: Record<string, any> = {};
  form.dimensions.forEach(d => {
    if (d.name.trim()) {
      dimensionsObject[d.name.trim()] = d.value;
    }
  });

  const draftItem: MarketplaceItem = {
    id: `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: form.name.trim() || 'Untitled Draft',
    description: form.description.trim(),
    price: form.price || 0,
    sellerId: 'current_seller',
    createdAt: new Date(),
    updatedAt: new Date(),
    dimensions: dimensionsObject,
    category: form.category || 'Other',
    tags: [...form.tags],
    status: 'draft',
    transactionHistory: []
  };

  emit('itemAdded', draftItem);
  resetForm();
};

const resetForm = () => {
  form.name = '';
  form.description = '';
  form.price = 0;
  form.category = '';
  form.tags = [];
  form.dimensions = [];
  tagsInput.value = '';
};
</script>

<style scoped>
.add-item-form {
  max-width: 800px;
  margin: 0 auto;
}

.form-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.form-section h4 {
  margin: 0 0 1.5rem 0;
  color: #333;
  font-size: 1.125rem;
  font-weight: 600;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.section-header h4 {
  margin: 0;
}

.add-dimension-btn {
  padding: 0.5rem 1rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.add-dimension-btn:hover {
  background: #0056b3;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-field.full-width {
  grid-column: 1 / -1;
}

.form-field label {
  font-weight: 500;
  color: #333;
  font-size: 0.875rem;
}

.form-input {
  padding: 0.75rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.form-input:invalid {
  border-color: #dc3545;
}

.price-input {
  position: relative;
  display: flex;
  align-items: center;
}

.currency {
  position: absolute;
  left: 0.75rem;
  color: #6c757d;
  font-weight: 500;
  z-index: 1;
}

.price-field {
  padding-left: 2rem;
}

.tags-display {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: #007bff;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
}

.remove-tag {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0;
}

.remove-tag:hover {
  opacity: 0.7;
}

.dimensions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dimension-row {
  display: grid;
  grid-template-columns: 2fr 1fr 2fr auto;
  gap: 1rem;
  align-items: start;
  padding: 1rem;
  background: white;
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.dimension-name,
.dimension-type,
.dimension-value {
  display: flex;
  flex-direction: column;
}

.select-dimension {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.options-display {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.option-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: #28a745;
  color: white;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  font-size: 0.75rem;
}

.remove-option {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 0.875rem;
  line-height: 1;
  padding: 0;
}

.remove-option:hover {
  opacity: 0.7;
}

.dimension-actions {
  display: flex;
  align-items: center;
}

.remove-dimension-btn {
  padding: 0.5rem 0.75rem;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.remove-dimension-btn:hover {
  background: #c82333;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding-top: 2rem;
  border-top: 1px solid #dee2e6;
}

.form-btn {
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.form-btn.cancel {
  background: white;
  color: #6c757d;
  border: 1px solid #6c757d;
}

.form-btn.cancel:hover {
  background: #6c757d;
  color: white;
}

.form-btn.draft {
  background: white;
  color: #ffc107;
  border: 1px solid #ffc107;
}

.form-btn.draft:hover {
  background: #ffc107;
  color: #333;
}

.form-btn.submit {
  background: #007bff;
  color: white;
  border: none;
}

.form-btn.submit:hover:not(:disabled) {
  background: #0056b3;
}

.form-btn.submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  
  .dimension-row {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .form-btn {
    text-align: center;
  }
}
</style>