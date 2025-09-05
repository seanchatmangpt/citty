<template>
  <div class="item-detail-overlay" @click="$emit('close')">
    <div class="item-detail-modal" @click.stop>
      <!-- Header -->
      <div class="detail-header">
        <div class="item-title-section">
          <h2>{{ item.name }}</h2>
          <div class="item-meta">
            <span class="item-category">{{ item.category }}</span>
            <span class="item-status" :class="item.status">{{ item.status }}</span>
            <span class="item-date">Added {{ formatDate(item.createdAt) }}</span>
          </div>
        </div>
        <div class="header-actions">
          <div class="item-price">${{ item.price.toLocaleString() }}</div>
          <button @click="$emit('close')" class="close-btn">×</button>
        </div>
      </div>

      <!-- Content -->
      <div class="detail-content">
        <div class="main-content">
          <!-- Description -->
          <div class="description-section">
            <h3>Description</h3>
            <p>{{ item.description || 'No description provided.' }}</p>
          </div>

          <!-- Dimensional Attributes -->
          <div class="dimensions-section">
            <h3>Dimensional Attributes</h3>
            <div class="dimensions-grid">
              <div
                v-for="(value, dimension) in item.dimensions"
                :key="dimension"
                class="dimension-card"
              >
                <div class="dimension-header">
                  <span class="dimension-name">{{ formatDimensionName(dimension) }}</span>
                  <span class="dimension-type">{{ getDimensionType(value) }}</span>
                </div>
                <div class="dimension-value">
                  <span class="value-display">{{ formatDimensionValue(value) }}</span>
                  <div v-if="getDimensionStats(dimension)" class="dimension-stats">
                    <small>{{ getDimensionStats(dimension) }}</small>
                  </div>
                </div>
                <div class="dimension-chart">
                  <DimensionChart
                    :dimension="dimension"
                    :value="value"
                    :item="item"
                    :all-items="allItems"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Tags -->
          <div v-if="item.tags.length > 0" class="tags-section">
            <h3>Tags</h3>
            <div class="tags-list">
              <span
                v-for="tag in item.tags"
                :key="tag"
                class="tag"
              >
                {{ tag }}
              </span>
            </div>
          </div>

          <!-- Transaction History -->
          <div v-if="item.transactionHistory.length > 0" class="history-section">
            <h3>Transaction History</h3>
            <div class="history-timeline">
              <div
                v-for="transaction in item.transactionHistory"
                :key="transaction.id"
                class="history-item"
              >
                <div class="history-date">{{ formatDateTime(transaction.timestamp) }}</div>
                <div class="history-details">
                  <div class="history-type">{{ getTransactionTypeLabel(transaction) }}</div>
                  <div class="history-amount">${{ transaction.amount.toLocaleString() }}</div>
                  <div class="history-status" :class="transaction.status">
                    {{ transaction.status }}
                  </div>
                </div>
                <div v-if="transaction.workflowState" class="workflow-progress">
                  <WorkflowProgress :workflow="transaction.workflowState" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="detail-sidebar">
          <!-- Seller Information -->
          <div class="seller-section">
            <h4>Seller</h4>
            <div class="seller-info">
              <div class="seller-avatar">{{ getSellerInitials(item.sellerId) }}</div>
              <div class="seller-details">
                <div class="seller-name">{{ getSellerName(item.sellerId) }}</div>
                <div class="seller-stats">
                  <span>{{ getSellerRating(item.sellerId) }}⭐</span>
                  <span>{{ getSellerItemCount(item.sellerId) }} items</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Similar Items -->
          <div class="similar-section">
            <h4>Similar Items</h4>
            <div class="similar-items">
              <div
                v-for="similar in similarItems.slice(0, 3)"
                :key="similar.id"
                class="similar-item"
                @click="$emit('itemSelected', similar)"
              >
                <div class="similar-name">{{ similar.name }}</div>
                <div class="similar-price">${{ similar.price.toLocaleString() }}</div>
                <div class="similar-match">{{ getSimilarityScore(similar) }}% match</div>
              </div>
            </div>
          </div>

          <!-- Dimensional Comparison -->
          <div class="comparison-section">
            <h4>Market Position</h4>
            <div class="market-stats">
              <div class="stat-item">
                <span class="stat-label">Price Percentile</span>
                <span class="stat-value">{{ getPricePercentile() }}%</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Dimensional Uniqueness</span>
                <span class="stat-value">{{ getDimensionalUniqueness() }}%</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Category Average</span>
                <span class="stat-value">${{ getCategoryAveragePrice().toLocaleString() }}</span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="action-section">
            <button
              v-if="item.status === 'active'"
              @click="handlePurchase"
              class="purchase-btn primary"
            >
              Purchase Item
            </button>
            <button
              v-else-if="item.status === 'sold'"
              disabled
              class="purchase-btn disabled"
            >
              Item Sold
            </button>
            <button
              v-else-if="item.status === 'pending'"
              disabled
              class="purchase-btn disabled"
            >
              Transaction Pending
            </button>
            
            <button @click="addToWishlist" class="action-btn secondary">
              Add to Wishlist
            </button>
            <button @click="shareItem" class="action-btn secondary">
              Share Item
            </button>
            <button @click="reportItem" class="action-btn danger">
              Report Issue
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { MarketplaceItem, Transaction } from '../../types';
import DimensionChart from './DimensionChart.vue';
import WorkflowProgress from '../workflows/WorkflowProgress.vue';

interface Props {
  item: MarketplaceItem;
  allItems?: MarketplaceItem[];
}

const props = withDefaults(defineProps<Props>(), {
  allItems: () => []
});

const emit = defineEmits<{
  close: [];
  purchase: [item: MarketplaceItem];
  itemSelected: [item: MarketplaceItem];
}>();

// Computed properties
const similarItems = computed(() => {
  if (props.allItems.length === 0) return [];
  
  return props.allItems
    .filter(other => other.id !== props.item.id)
    .map(other => ({
      ...other,
      similarity: calculateSimilarity(props.item, other)
    }))
    .filter(other => other.similarity > 0.3)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);
});

// Methods
const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(new Date(date));
};

const formatDateTime = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date));
};

const formatDimensionName = (dimension: string) => {
  return dimension
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const formatDimensionValue = (value: any) => {
  if (typeof value === 'number') {
    if (value % 1 === 0) {
      return value.toLocaleString();
    } else {
      return value.toFixed(2);
    }
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return String(value);
};

const getDimensionType = (value: any) => {
  if (typeof value === 'number') return 'Numeric';
  if (typeof value === 'boolean') return 'Boolean';
  if (typeof value === 'string') return 'Text';
  return 'Other';
};

const getDimensionStats = (dimension: string) => {
  const allValues = props.allItems
    .map(item => item.dimensions[dimension])
    .filter(v => v !== undefined && typeof v === 'number');
  
  if (allValues.length === 0) return null;
  
  const avg = allValues.reduce((sum, val) => sum + Number(val), 0) / allValues.length;
  const currentValue = Number(props.item.dimensions[dimension]);
  
  if (currentValue > avg) {
    const percentAbove = ((currentValue - avg) / avg * 100).toFixed(0);
    return `${percentAbove}% above average`;
  } else if (currentValue < avg) {
    const percentBelow = ((avg - currentValue) / avg * 100).toFixed(0);
    return `${percentBelow}% below average`;
  } else {
    return 'At average';
  }
};

const getTransactionTypeLabel = (transaction: Transaction) => {
  switch (transaction.status) {
    case 'completed': return 'Sale Completed';
    case 'pending': return 'Sale Pending';
    case 'failed': return 'Sale Failed';
    case 'refunded': return 'Sale Refunded';
    default: return 'Transaction';
  }
};

const getSellerInitials = (sellerId: string) => {
  // Mock implementation
  return sellerId.substring(0, 2).toUpperCase();
};

const getSellerName = (sellerId: string) => {
  // Mock implementation
  return `Seller ${sellerId.substring(0, 8)}`;
};

const getSellerRating = (sellerId: string) => {
  // Mock implementation
  return (4.0 + Math.random()).toFixed(1);
};

const getSellerItemCount = (sellerId: string) => {
  return props.allItems.filter(item => item.sellerId === sellerId).length;
};

const getSimilarityScore = (item: any) => {
  return Math.round(item.similarity * 100);
};

const calculateSimilarity = (item1: MarketplaceItem, item2: MarketplaceItem) => {
  let similarity = 0;
  let factors = 0;
  
  // Category similarity
  if (item1.category === item2.category) {
    similarity += 0.3;
  }
  factors++;
  
  // Price similarity
  const priceDiff = Math.abs(item1.price - item2.price) / Math.max(item1.price, item2.price);
  similarity += (1 - priceDiff) * 0.2;
  factors++;
  
  // Dimensional similarity
  const commonDimensions = Object.keys(item1.dimensions).filter(
    dim => dim in item2.dimensions
  );
  
  if (commonDimensions.length > 0) {
    let dimSimilarity = 0;
    commonDimensions.forEach(dim => {
      const val1 = item1.dimensions[dim];
      const val2 = item2.dimensions[dim];
      
      if (typeof val1 === 'number' && typeof val2 === 'number') {
        const diff = Math.abs(val1 - val2) / Math.max(Math.abs(val1), Math.abs(val2), 1);
        dimSimilarity += 1 - diff;
      } else if (val1 === val2) {
        dimSimilarity += 1;
      }
    });
    similarity += (dimSimilarity / commonDimensions.length) * 0.5;
    factors++;
  }
  
  return similarity / factors;
};

const getPricePercentile = () => {
  const prices = props.allItems
    .filter(item => item.category === props.item.category)
    .map(item => item.price)
    .sort((a, b) => a - b);
  
  const index = prices.findIndex(price => price >= props.item.price);
  return Math.round((index / prices.length) * 100);
};

const getDimensionalUniqueness = () => {
  // Simplified uniqueness calculation
  const dimensions = Object.keys(props.item.dimensions);
  let uniqueness = 0;
  
  dimensions.forEach(dim => {
    const values = props.allItems.map(item => item.dimensions[dim]);
    const uniqueValues = new Set(values);
    const commonality = uniqueValues.size / values.length;
    uniqueness += commonality;
  });
  
  return Math.round((uniqueness / dimensions.length) * 100);
};

const getCategoryAveragePrice = () => {
  const categoryItems = props.allItems.filter(item => item.category === props.item.category);
  if (categoryItems.length === 0) return 0;
  
  const total = categoryItems.reduce((sum, item) => sum + item.price, 0);
  return total / categoryItems.length;
};

const handlePurchase = () => {
  emit('purchase', props.item);
};

const addToWishlist = () => {
  // Implementation for adding to wishlist
  console.log('Added to wishlist:', props.item.name);
};

const shareItem = () => {
  // Implementation for sharing item
  if (navigator.share) {
    navigator.share({
      title: props.item.name,
      text: props.item.description,
      url: window.location.href
    });
  } else {
    // Fallback to clipboard
    navigator.clipboard.writeText(window.location.href);
  }
};

const reportItem = () => {
  // Implementation for reporting item
  console.log('Reported item:', props.item.name);
};
</script>

<style scoped>
.item-detail-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.item-detail-modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 1200px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 2rem;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
}

.item-title-section h2 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 1.75rem;
  font-weight: 600;
}

.item-meta {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.item-category {
  background: #e9ecef;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  color: #495057;
  font-weight: 500;
}

.item-status {
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  text-transform: capitalize;
}

.item-status.active {
  background: #d1ecf1;
  color: #0c5460;
}

.item-status.sold {
  background: #d4edda;
  color: #155724;
}

.item-status.pending {
  background: #fff3cd;
  color: #856404;
}

.item-status.draft {
  background: #f8d7da;
  color: #721c24;
}

.item-date {
  color: #6c757d;
  font-size: 0.875rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.item-price {
  font-size: 2rem;
  font-weight: bold;
  color: #28a745;
}

.close-btn {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.5rem;
  color: #6c757d;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #e9ecef;
  color: #333;
}

.detail-content {
  display: grid;
  grid-template-columns: 1fr 300px;
  flex: 1;
  overflow: hidden;
}

.main-content {
  padding: 2rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.description-section h3,
.dimensions-section h3,
.tags-section h3,
.history-section h3 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1.25rem;
  font-weight: 600;
}

.description-section p {
  color: #495057;
  line-height: 1.6;
  margin: 0;
}

.dimensions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.dimension-card {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 1.5rem;
  transition: all 0.2s;
}

.dimension-card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.dimension-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.dimension-name {
  font-weight: 600;
  color: #333;
}

.dimension-type {
  font-size: 0.75rem;
  color: #6c757d;
  background: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid #dee2e6;
}

.value-display {
  font-size: 1.5rem;
  font-weight: bold;
  color: #007bff;
}

.dimension-stats {
  margin-top: 0.5rem;
}

.dimension-stats small {
  color: #6c757d;
  font-style: italic;
}

.dimension-chart {
  margin-top: 1rem;
  height: 100px;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag {
  background: #007bff;
  color: white;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
}

.history-timeline {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.history-item {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 1rem;
}

.history-date {
  font-size: 0.875rem;
  color: #6c757d;
  margin-bottom: 0.5rem;
}

.history-details {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1rem;
}

.history-type {
  font-weight: 600;
  color: #333;
}

.history-amount {
  font-weight: bold;
  color: #28a745;
}

.history-status {
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: capitalize;
}

.history-status.completed {
  background: #d4edda;
  color: #155724;
}

.history-status.pending {
  background: #fff3cd;
  color: #856404;
}

.history-status.failed {
  background: #f8d7da;
  color: #721c24;
}

.history-status.refunded {
  background: #d1ecf1;
  color: #0c5460;
}

.detail-sidebar {
  background: #f8f9fa;
  border-left: 1px solid #dee2e6;
  padding: 2rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.seller-section h4,
.similar-section h4,
.comparison-section h4 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1rem;
  font-weight: 600;
}

.seller-info {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.seller-avatar {
  width: 48px;
  height: 48px;
  background: #007bff;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 1rem;
}

.seller-details {
  flex: 1;
}

.seller-name {
  font-weight: 600;
  color: #333;
  margin-bottom: 0.25rem;
}

.seller-stats {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: #6c757d;
}

.similar-items {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.similar-item {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.similar-item:hover {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  border-color: #007bff;
}

.similar-name {
  font-weight: 600;
  color: #333;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.similar-price {
  color: #28a745;
  font-weight: bold;
  margin-bottom: 0.25rem;
}

.similar-match {
  font-size: 0.75rem;
  color: #6c757d;
}

.market-stats {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 6px;
}

.stat-label {
  font-size: 0.875rem;
  color: #6c757d;
}

.stat-value {
  font-weight: bold;
  color: #333;
}

.action-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: auto;
}

.purchase-btn {
  padding: 1rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.purchase-btn.primary {
  background: #007bff;
  color: white;
}

.purchase-btn.primary:hover {
  background: #0056b3;
}

.purchase-btn.disabled {
  background: #e9ecef;
  color: #6c757d;
  cursor: not-allowed;
}

.action-btn {
  padding: 0.75rem 1rem;
  border: 1px solid;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.action-btn.secondary {
  border-color: #6c757d;
  background: white;
  color: #6c757d;
}

.action-btn.secondary:hover {
  background: #6c757d;
  color: white;
}

.action-btn.danger {
  border-color: #dc3545;
  background: white;
  color: #dc3545;
}

.action-btn.danger:hover {
  background: #dc3545;
  color: white;
}

@media (max-width: 768px) {
  .item-detail-overlay {
    padding: 1rem;
  }
  
  .detail-content {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr auto;
  }
  
  .detail-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .header-actions {
    justify-content: space-between;
  }
  
  .dimensions-grid {
    grid-template-columns: 1fr;
  }
}
</style>