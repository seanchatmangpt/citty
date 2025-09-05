<template>
  <div class="wishlist-manager">
    <div class="wishlist-header">
      <div class="header-stats">
        <span class="item-count">{{ items.length }} items</span>
        <span class="total-value">Total value: ${{ totalValue.toLocaleString() }}</span>
      </div>
      <div class="header-actions">
        <button @click="sortItems" class="sort-btn">
          Sort by {{ sortBy }}
        </button>
        <button @click="clearWishlist" class="clear-btn">
          Clear All
        </button>
      </div>
    </div>

    <div v-if="items.length === 0" class="empty-wishlist">
      <div class="empty-icon">💝</div>
      <h3>Your wishlist is empty</h3>
      <p>Start adding items you're interested in to keep track of them!</p>
    </div>

    <div v-else class="wishlist-grid">
      <div
        v-for="item in sortedItems"
        :key="item.id"
        class="wishlist-item"
        :class="{ 'price-drop': hasPriceDrop(item) }"
      >
        <!-- Price Alert Badge -->
        <div v-if="hasPriceDrop(item)" class="price-alert-badge">
          Price Drop!
        </div>

        <!-- Item Header -->
        <div class="item-header">
          <h4 class="item-name">{{ item.name }}</h4>
          <button
            @click="removeItem(item.id)"
            class="remove-btn"
            title="Remove from wishlist"
          >
            ×
          </button>
        </div>

        <!-- Item Details -->
        <div class="item-details">
          <div class="item-category">{{ item.category }}</div>
          <div class="item-status" :class="item.status">{{ getStatusLabel(item.status) }}</div>
        </div>

        <!-- Price Information -->
        <div class="price-info">
          <div class="current-price">
            ${{ item.price.toLocaleString() }}
            <span v-if="hasPriceDrop(item)" class="price-change">
              -{{ getPriceDropPercentage(item) }}%
            </span>
          </div>
          <div v-if="getOriginalPrice(item)" class="original-price">
            Was: ${{ getOriginalPrice(item).toLocaleString() }}
          </div>
        </div>

        <!-- Key Dimensions -->
        <div class="item-dimensions">
          <div
            v-for="(value, key) in getKeyDimensions(item)"
            :key="key"
            class="dimension"
          >
            <span class="dimension-key">{{ formatDimensionKey(key) }}:</span>
            <span class="dimension-value">{{ formatDimensionValue(value) }}</span>
          </div>
        </div>

        <!-- Added Date -->
        <div class="added-date">
          Added {{ formatAddedDate(item) }}
        </div>

        <!-- Price Alert Settings -->
        <div class="price-alert">
          <div class="alert-toggle">
            <label>
              <input
                type="checkbox"
                :checked="hasAlert(item.id)"
                @change="toggleAlert(item.id, $event)"
              />
              <span>Price Alert</span>
            </label>
          </div>
          <div v-if="hasAlert(item.id)" class="alert-settings">
            <div class="alert-threshold">
              <label>Alert when below:</label>
              <div class="threshold-input">
                <span class="currency">$</span>
                <input
                  type="number"
                  :value="getAlertThreshold(item.id)"
                  @input="updateAlertThreshold(item.id, $event)"
                  min="0"
                  step="0.01"
                  class="threshold-field"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="item-actions">
          <button @click="viewItem(item)" class="action-btn view">
            View Details
          </button>
          <button
            @click="purchaseItem(item)"
            :disabled="item.status !== 'active'"
            class="action-btn purchase"
          >
            {{ item.status === 'active' ? 'Purchase' : 'Unavailable' }}
          </button>
          <button @click="shareItem(item)" class="action-btn share">
            Share
          </button>
        </div>
      </div>
    </div>

    <!-- Wishlist Stats -->
    <div v-if="items.length > 0" class="wishlist-stats">
      <h4>Wishlist Statistics</h4>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ averagePrice.toLocaleString() }}</div>
          <div class="stat-label">Average Price</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ categoryDistribution[0]?.category || 'N/A' }}</div>
          <div class="stat-label">Top Category</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ itemsWithAlerts }}</div>
          <div class="stat-label">Price Alerts</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ availableItems }}</div>
          <div class="stat-label">Available Items</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { MarketplaceItem } from '../../types';

interface PriceAlert {
  itemId: string;
  threshold: number;
  enabled: boolean;
}

interface Props {
  items: MarketplaceItem[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  itemRemoved: [itemId: string];
  itemPurchased: [item: MarketplaceItem];
  alertToggled: [itemId: string, enabled: boolean, threshold: number];
}>();

// Reactive state
const sortBy = ref<'name' | 'price' | 'added' | 'category'>('added');
const sortDirection = ref<'asc' | 'desc'>('desc');
const priceAlerts = ref<PriceAlert[]>([]);
const itemAddedDates = ref<Record<string, Date>>({});
const originalPrices = ref<Record<string, number>>({});

// Computed properties
const totalValue = computed(() =>
  props.items.reduce((sum, item) => sum + item.price, 0)
);

const averagePrice = computed(() =>
  props.items.length > 0 ? totalValue.value / props.items.length : 0
);

const categoryDistribution = computed(() => {
  const categories: Record<string, number> = {};
  props.items.forEach(item => {
    categories[item.category] = (categories[item.category] || 0) + 1;
  });
  
  return Object.entries(categories)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
});

const itemsWithAlerts = computed(() =>
  priceAlerts.value.filter(alert => alert.enabled).length
);

const availableItems = computed(() =>
  props.items.filter(item => item.status === 'active').length
);

const sortedItems = computed(() => {
  const sorted = [...props.items];
  
  sorted.sort((a, b) => {
    let aVal: any;
    let bVal: any;
    
    switch (sortBy.value) {
      case 'name':
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case 'price':
        aVal = a.price;
        bVal = b.price;
        break;
      case 'category':
        aVal = a.category.toLowerCase();
        bVal = b.category.toLowerCase();
        break;
      case 'added':
      default:
        aVal = itemAddedDates.value[a.id]?.getTime() || 0;
        bVal = itemAddedDates.value[b.id]?.getTime() || 0;
        break;
    }
    
    if (sortDirection.value === 'asc') {
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    } else {
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    }
  });
  
  return sorted;
});

// Methods
const removeItem = (itemId: string) => {
  emit('itemRemoved', itemId);
  
  // Remove associated alert
  const alertIndex = priceAlerts.value.findIndex(alert => alert.itemId === itemId);
  if (alertIndex > -1) {
    priceAlerts.value.splice(alertIndex, 1);
  }
  
  // Remove added date
  delete itemAddedDates.value[itemId];
  delete originalPrices.value[itemId];
};

const purchaseItem = (item: MarketplaceItem) => {
  if (item.status === 'active') {
    emit('itemPurchased', item);
  }
};

const viewItem = (item: MarketplaceItem) => {
  console.log('View item:', item.name);
  // This would typically open the item detail view or navigate to item page
};

const shareItem = (item: MarketplaceItem) => {
  if (navigator.share) {
    navigator.share({
      title: item.name,
      text: `Check out this item: ${item.name}`,
      url: window.location.origin + `/items/${item.id}`
    });
  } else {
    // Fallback to clipboard
    const shareText = `Check out this item: ${item.name} - ${window.location.origin}/items/${item.id}`;
    navigator.clipboard.writeText(shareText).then(() => {
      alert('Link copied to clipboard!');
    });
  }
};

const sortItems = () => {
  const sortOptions: Array<typeof sortBy.value> = ['added', 'name', 'price', 'category'];
  const currentIndex = sortOptions.indexOf(sortBy.value);
  const nextIndex = (currentIndex + 1) % sortOptions.length;
  sortBy.value = sortOptions[nextIndex];
  
  // Toggle direction for same sort field
  if (sortBy.value === 'price' || sortBy.value === 'added') {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  }
};

const clearWishlist = () => {
  if (confirm(`Are you sure you want to remove all ${props.items.length} items from your wishlist?`)) {
    props.items.forEach(item => removeItem(item.id));
  }
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    active: 'Available',
    sold: 'Sold',
    pending: 'Pending Sale',
    draft: 'Not Listed'
  };
  return labels[status] || status;
};

const hasPriceDrop = (item: MarketplaceItem) => {
  const original = originalPrices.value[item.id];
  return original && original > item.price;
};

const getOriginalPrice = (item: MarketplaceItem) => {
  return originalPrices.value[item.id];
};

const getPriceDropPercentage = (item: MarketplaceItem) => {
  const original = originalPrices.value[item.id];
  if (!original || original <= item.price) return 0;
  return Math.round(((original - item.price) / original) * 100);
};

const getKeyDimensions = (item: MarketplaceItem) => {
  const dimensions = Object.entries(item.dimensions || {});
  return Object.fromEntries(dimensions.slice(0, 3)); // Show first 3 dimensions
};

const formatDimensionKey = (key: string) => {
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const formatDimensionValue = (value: any) => {
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return String(value);
};

const formatAddedDate = (item: MarketplaceItem) => {
  const addedDate = itemAddedDates.value[item.id];
  if (!addedDate) return 'recently';
  
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - addedDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
  return `${Math.ceil(diffDays / 30)} months ago`;
};

const hasAlert = (itemId: string) => {
  return priceAlerts.value.some(alert => alert.itemId === itemId && alert.enabled);
};

const getAlertThreshold = (itemId: string) => {
  const alert = priceAlerts.value.find(alert => alert.itemId === itemId);
  return alert?.threshold || 0;
};

const toggleAlert = (itemId: string, event: Event) => {
  const enabled = (event.target as HTMLInputElement).checked;
  const existingAlert = priceAlerts.value.find(alert => alert.itemId === itemId);
  
  if (existingAlert) {
    existingAlert.enabled = enabled;
  } else if (enabled) {
    const item = props.items.find(i => i.id === itemId);
    const defaultThreshold = item ? Math.round(item.price * 0.9) : 0; // 10% below current price
    
    priceAlerts.value.push({
      itemId,
      threshold: defaultThreshold,
      enabled: true
    });
  }
  
  const alert = priceAlerts.value.find(a => a.itemId === itemId);
  if (alert) {
    emit('alertToggled', itemId, enabled, alert.threshold);
  }
};

const updateAlertThreshold = (itemId: string, event: Event) => {
  const threshold = parseFloat((event.target as HTMLInputElement).value);
  const alert = priceAlerts.value.find(alert => alert.itemId === itemId);
  
  if (alert) {
    alert.threshold = threshold;
    emit('alertToggled', itemId, alert.enabled, threshold);
  }
};

// Initialize component
onMounted(() => {
  // Set mock added dates for items
  props.items.forEach(item => {
    if (!itemAddedDates.value[item.id]) {
      const daysAgo = Math.floor(Math.random() * 30) + 1;
      itemAddedDates.value[item.id] = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    }
    
    // Set mock original prices (some items might have price drops)
    if (!originalPrices.value[item.id] && Math.random() > 0.7) {
      const increasePercent = 0.1 + Math.random() * 0.3; // 10-40% higher
      originalPrices.value[item.id] = Math.round(item.price * (1 + increasePercent));
    }
  });
});
</script>

<style scoped>
.wishlist-manager {
  max-width: 1200px;
  margin: 0 auto;
}

.wishlist-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #dee2e6;
}

.header-stats {
  display: flex;
  gap: 2rem;
  align-items: center;
}

.item-count {
  font-weight: 600;
  color: #333;
}

.total-value {
  color: #28a745;
  font-weight: 600;
  font-size: 1.125rem;
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.sort-btn,
.clear-btn {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.sort-btn {
  background: white;
  color: #007bff;
  border: 1px solid #007bff;
}

.sort-btn:hover {
  background: #007bff;
  color: white;
}

.clear-btn {
  background: white;
  color: #dc3545;
  border: 1px solid #dc3545;
}

.clear-btn:hover {
  background: #dc3545;
  color: white;
}

.empty-wishlist {
  text-align: center;
  padding: 4rem 2rem;
  color: #6c757d;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-wishlist h3 {
  color: #333;
  margin-bottom: 0.5rem;
}

.wishlist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.wishlist-item {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 1.5rem;
  position: relative;
  transition: all 0.2s;
}

.wishlist-item:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

.wishlist-item.price-drop {
  border-color: #28a745;
  box-shadow: 0 0 0 1px rgba(40, 167, 69, 0.2);
}

.price-alert-badge {
  position: absolute;
  top: -8px;
  right: 1rem;
  background: #28a745;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.item-name {
  margin: 0;
  color: #333;
  font-size: 1.125rem;
  font-weight: 600;
  flex: 1;
  line-height: 1.3;
}

.remove-btn {
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.remove-btn:hover {
  background: #c82333;
}

.item-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.item-category {
  background: #f8f9fa;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  color: #495057;
}

.item-status {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.item-status.active {
  background: #d1ecf1;
  color: #0c5460;
}

.item-status.sold {
  background: #f8d7da;
  color: #721c24;
}

.item-status.pending {
  background: #fff3cd;
  color: #856404;
}

.price-info {
  margin-bottom: 1rem;
}

.current-price {
  font-size: 1.25rem;
  font-weight: bold;
  color: #28a745;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.price-change {
  background: #28a745;
  color: white;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  font-size: 0.75rem;
}

.original-price {
  font-size: 0.875rem;
  color: #6c757d;
  text-decoration: line-through;
  margin-top: 0.25rem;
}

.item-dimensions {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 4px;
}

.dimension {
  display: flex;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.dimension-key {
  color: #6c757d;
  font-weight: 500;
  min-width: 80px;
}

.dimension-value {
  color: #333;
}

.added-date {
  font-size: 0.875rem;
  color: #6c757d;
  margin-bottom: 1rem;
  font-style: italic;
}

.price-alert {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 4px;
}

.alert-toggle {
  margin-bottom: 0.5rem;
}

.alert-toggle label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: #333;
}

.alert-settings {
  margin-top: 0.75rem;
}

.alert-threshold {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.alert-threshold label {
  font-size: 0.875rem;
  color: #6c757d;
  font-weight: 500;
}

.threshold-input {
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

.threshold-field {
  padding: 0.5rem 0.75rem 0.5rem 2rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.875rem;
  width: 120px;
}

.threshold-field:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.item-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  flex: 1;
  padding: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
  text-align: center;
}

.action-btn.view {
  background: white;
  color: #007bff;
  border: 1px solid #007bff;
}

.action-btn.view:hover {
  background: #007bff;
  color: white;
}

.action-btn.purchase {
  background: #28a745;
  color: white;
  border: none;
}

.action-btn.purchase:hover:not(:disabled) {
  background: #1e7e34;
}

.action-btn.purchase:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.action-btn.share {
  background: white;
  color: #6c757d;
  border: 1px solid #6c757d;
}

.action-btn.share:hover {
  background: #6c757d;
  color: white;
}

.wishlist-stats {
  margin-top: 2rem;
  padding: 1.5rem;
  background: white;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.wishlist-stats h4 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1.125rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.stat-card {
  text-align: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #333;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.875rem;
  color: #6c757d;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

@media (max-width: 768px) {
  .wishlist-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .header-stats {
    justify-content: space-between;
  }
  
  .wishlist-grid {
    grid-template-columns: 1fr;
  }
  
  .item-actions {
    flex-direction: column;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>