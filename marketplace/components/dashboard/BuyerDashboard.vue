<template>
  <div class="buyer-dashboard">
    <!-- Dashboard Header -->
    <div class="dashboard-header">
      <div class="header-info">
        <h2>Buyer Dashboard</h2>
        <p class="header-subtitle">Track your purchases and discover new items</p>
      </div>
      <div class="header-actions">
        <button @click="showWishlist = true" class="action-btn primary">
          View Wishlist ({{ wishlistCount }})
        </button>
        <button @click="browseCatalog" class="action-btn secondary">
          Browse Catalog
        </button>
      </div>
    </div>

    <!-- Quick Stats -->
    <div class="stats-section">
      <div class="stats-grid">
        <div class="stat-card purchases">
          <div class="stat-icon">🛒</div>
          <div class="stat-content">
            <div class="stat-value">{{ totalPurchases }}</div>
            <div class="stat-label">Total Purchases</div>
            <div class="stat-trend">{{ purchasesThisMonth }} this month</div>
          </div>
        </div>
        
        <div class="stat-card spent">
          <div class="stat-icon">💰</div>
          <div class="stat-content">
            <div class="stat-value">${{ totalSpent.toLocaleString() }}</div>
            <div class="stat-label">Total Spent</div>
            <div class="stat-trend">{{ ((monthlySpending / totalSpent) * 100).toFixed(1) }}% this month</div>
          </div>
        </div>
        
        <div class="stat-card saved">
          <div class="stat-icon">💡</div>
          <div class="stat-content">
            <div class="stat-value">${{ totalSaved.toLocaleString() }}</div>
            <div class="stat-label">Total Saved</div>
            <div class="stat-trend">From smart shopping</div>
          </div>
        </div>
        
        <div class="stat-card rating">
          <div class="stat-icon">⭐</div>
          <div class="stat-content">
            <div class="stat-value">{{ buyerRating.toFixed(1) }}</div>
            <div class="stat-label">Buyer Rating</div>
            <div class="stat-trend">Based on {{ reviewsGiven }} reviews</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="activity-section">
      <h3>Recent Activity</h3>
      <div class="activity-tabs">
        <button
          v-for="tab in activityTabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          :class="['tab-btn', { active: activeTab === tab.id }]"
        >
          {{ tab.label }}
        </button>
      </div>
      
      <!-- Purchases Tab -->
      <div v-if="activeTab === 'purchases'" class="tab-content">
        <div class="purchases-list">
          <div
            v-for="purchase in recentPurchases"
            :key="purchase.id"
            class="purchase-item"
          >
            <div class="purchase-info">
              <div class="item-details">
                <h4>{{ getItemName(purchase.itemId) }}</h4>
                <p>{{ getSellerName(purchase.sellerId) }}</p>
              </div>
              <div class="purchase-meta">
                <span class="purchase-amount">${{ purchase.amount.toLocaleString() }}</span>
                <span class="purchase-date">{{ formatDate(purchase.timestamp) }}</span>
              </div>
            </div>
            <div class="purchase-status">
              <span class="status-badge" :class="purchase.status">
                {{ getStatusLabel(purchase.status) }}
              </span>
              <div class="purchase-actions">
                <button @click="viewPurchaseDetails(purchase)" class="action-link">
                  View Details
                </button>
                <button
                  v-if="canReview(purchase)"
                  @click="leaveReview(purchase)"
                  class="action-link"
                >
                  Leave Review
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Watchlist Tab -->
      <div v-if="activeTab === 'watchlist'" class="tab-content">
        <div class="watchlist-grid">
          <div
            v-for="item in watchlistItems"
            :key="item.id"
            class="watchlist-item"
          >
            <div class="item-header">
              <h4>{{ item.name }}</h4>
              <button @click="removeFromWatchlist(item.id)" class="remove-btn">×</button>
            </div>
            <div class="item-price">
              <span class="current-price">${{ item.price.toLocaleString() }}</span>
              <span v-if="item.originalPrice" class="original-price">
                ${{ item.originalPrice.toLocaleString() }}
              </span>
            </div>
            <div class="price-change" :class="getPriceChangeClass(item)">
              {{ getPriceChangeText(item) }}
            </div>
            <div class="item-actions">
              <button @click="viewItem(item)" class="item-btn primary">View Item</button>
              <button @click="buyNow(item)" class="item-btn secondary">Buy Now</button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Reviews Tab -->
      <div v-if="activeTab === 'reviews'" class="tab-content">
        <div class="reviews-list">
          <div
            v-for="review in myReviews"
            :key="review.id"
            class="review-item"
          >
            <div class="review-header">
              <div class="review-item-name">{{ review.itemName }}</div>
              <div class="review-rating">
                <span v-for="i in 5" :key="i" class="star" :class="{ filled: i <= review.rating }">
                  ⭐
                </span>
              </div>
            </div>
            <p class="review-text">{{ review.text }}</p>
            <div class="review-meta">
              <span class="review-date">{{ formatDate(review.date) }}</span>
              <span class="seller-name">Seller: {{ review.sellerName }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Recommendations -->
    <div class="recommendations-section">
      <h3>Recommended for You</h3>
      <div class="recommendations-grid">
        <div
          v-for="item in recommendations"
          :key="item.id"
          class="recommendation-item"
        >
          <div class="recommendation-badge">{{ item.matchPercentage }}% match</div>
          <div class="item-info">
            <h4>{{ item.name }}</h4>
            <p class="item-category">{{ item.category }}</p>
          </div>
          <div class="item-price">${{ item.price.toLocaleString() }}</div>
          <div class="item-dimensions">
            <div
              v-for="(value, key) in getTopDimensions(item)"
              :key="key"
              class="dimension-tag"
            >
              {{ key }}: {{ value }}
            </div>
          </div>
          <div class="recommendation-actions">
            <button @click="viewItem(item)" class="rec-btn view">View</button>
            <button @click="addToWatchlist(item)" class="rec-btn watch">Watch</button>
            <button @click="buyNow(item)" class="rec-btn buy">Buy</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Spending Analysis -->
    <div class="spending-section">
      <h3>Spending Analysis</h3>
      <div class="spending-content">
        <div class="spending-chart">
          <SpendingChart :data="spendingData" :period="spendingPeriod" />
        </div>
        <div class="spending-insights">
          <div class="insight-card">
            <h4>Top Category</h4>
            <p>{{ topSpendingCategory.name }}: ${{ topSpendingCategory.amount.toLocaleString() }}</p>
          </div>
          <div class="insight-card">
            <h4>Average Purchase</h4>
            <p>${{ averagePurchaseAmount.toLocaleString() }}</p>
          </div>
          <div class="insight-card">
            <h4>Monthly Budget</h4>
            <p>${{ monthlyBudget.toLocaleString() }} ({{ budgetUsedPercentage }}% used)</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Price Alerts -->
    <div class="alerts-section">
      <h3>Price Alerts</h3>
      <div class="alerts-list">
        <div
          v-for="alert in priceAlerts"
          :key="alert.id"
          class="alert-item"
        >
          <div class="alert-info">
            <div class="alert-item-name">{{ alert.itemName }}</div>
            <div class="alert-condition">
              Alert when price drops below ${{ alert.targetPrice.toLocaleString() }}
            </div>
          </div>
          <div class="alert-status">
            <div class="current-price">Current: ${{ alert.currentPrice.toLocaleString() }}</div>
            <div class="price-diff" :class="alert.currentPrice <= alert.targetPrice ? 'reached' : 'pending'">
              {{ alert.currentPrice <= alert.targetPrice ? 'Target Reached!' : 'Monitoring...' }}
            </div>
          </div>
          <div class="alert-actions">
            <button @click="editAlert(alert)" class="alert-btn edit">Edit</button>
            <button @click="removeAlert(alert.id)" class="alert-btn remove">Remove</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Wishlist Modal -->
    <div v-if="showWishlist" class="modal-overlay" @click="closeWishlist">
      <div class="wishlist-modal" @click.stop>
        <div class="modal-header">
          <h3>My Wishlist</h3>
          <button @click="closeWishlist" class="close-btn">×</button>
        </div>
        <div class="modal-content">
          <WishlistManager
            :items="wishlistItems"
            @item-removed="onWishlistItemRemoved"
            @item-purchased="onWishlistItemPurchased"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { MarketplaceItem, Transaction } from '../../types';
import SpendingChart from './SpendingChart.vue';
import WishlistManager from './WishlistManager.vue';

interface Review {
  id: string;
  itemName: string;
  rating: number;
  text: string;
  date: Date;
  sellerName: string;
}

interface PriceAlert {
  id: string;
  itemName: string;
  targetPrice: number;
  currentPrice: number;
}

interface Recommendation {
  id: string;
  name: string;
  category: string;
  price: number;
  dimensions: Record<string, any>;
  matchPercentage: number;
}

interface Props {
  buyerId: string;
  purchases?: Transaction[];
  wishlistItems?: MarketplaceItem[];
}

const props = withDefaults(defineProps<Props>(), {
  purchases: () => [],
  wishlistItems: () => []
});

const emit = defineEmits<{
  itemPurchased: [item: MarketplaceItem];
  reviewSubmitted: [review: Review];
  wishlistUpdated: [items: MarketplaceItem[]];
}>();

// Reactive state
const showWishlist = ref(false);
const activeTab = ref('purchases');
const spendingPeriod = ref('30d');

// Mock data
const mockData = {
  totalSaved: 2840,
  buyerRating: 4.6,
  reviewsGiven: 23,
  monthlySpending: 1250,
  monthlyBudget: 2000,
  averagePurchaseAmount: 180
};

const activityTabs = [
  { id: 'purchases', label: 'Recent Purchases' },
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'reviews', label: 'My Reviews' }
];

// Computed properties
const totalPurchases = computed(() => props.purchases.length);

const purchasesThisMonth = computed(() => {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return props.purchases.filter(p => new Date(p.timestamp) >= thisMonth).length;
});

const totalSpent = computed(() =>
  props.purchases
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0)
);

const monthlySpending = computed(() => mockData.monthlySpending);
const totalSaved = computed(() => mockData.totalSaved);
const buyerRating = computed(() => mockData.buyerRating);
const reviewsGiven = computed(() => mockData.reviewsGiven);
const averagePurchaseAmount = computed(() => mockData.averagePurchaseAmount);
const monthlyBudget = computed(() => mockData.monthlyBudget);
const wishlistCount = computed(() => props.wishlistItems.length);

const budgetUsedPercentage = computed(() =>
  Math.round((monthlySpending.value / monthlyBudget.value) * 100)
);

const recentPurchases = computed(() =>
  props.purchases
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5)
);

const watchlistItems = computed(() => {
  // Add mock price change data
  return props.wishlistItems.map(item => ({
    ...item,
    originalPrice: item.price + Math.floor(Math.random() * 100) + 50,
    priceChange: Math.floor(Math.random() * 20) - 10
  }));
});

const topSpendingCategory = computed(() => ({
  name: 'Electronics',
  amount: 1850
}));

const spendingData = computed(() => ({
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  datasets: [{
    label: 'Spending',
    data: [320, 450, 380, 520, 460, 580],
    backgroundColor: 'rgba(0, 123, 255, 0.1)',
    borderColor: '#007bff'
  }]
}));

// Mock data arrays
const myReviews = ref<Review[]>([
  {
    id: 'review1',
    itemName: 'Wireless Headphones Pro',
    rating: 5,
    text: 'Excellent sound quality and comfortable fit. Highly recommended!',
    date: new Date('2024-01-15'),
    sellerName: 'TechStore'
  },
  {
    id: 'review2',
    itemName: 'Smart Watch Series X',
    rating: 4,
    text: 'Great features but battery life could be better.',
    date: new Date('2024-01-10'),
    sellerName: 'GadgetHub'
  }
]);

const recommendations = ref<Recommendation[]>([
  {
    id: 'rec1',
    name: 'Advanced Fitness Tracker',
    category: 'Health & Fitness',
    price: 199,
    dimensions: { battery_life: '7 days', water_resistance: 'IP68', screen_size: '1.4 inch' },
    matchPercentage: 95
  },
  {
    id: 'rec2',
    name: 'Noise-Canceling Earbuds',
    category: 'Electronics',
    price: 149,
    dimensions: { noise_reduction: '35dB', battery_life: '8 hours', connectivity: 'Bluetooth 5.2' },
    matchPercentage: 88
  }
]);

const priceAlerts = ref<PriceAlert[]>([
  {
    id: 'alert1',
    itemName: 'Gaming Laptop Ultra',
    targetPrice: 1200,
    currentPrice: 1350
  },
  {
    id: 'alert2',
    itemName: 'Professional Camera Kit',
    targetPrice: 800,
    currentPrice: 750
  }
]);

// Methods
const getItemName = (itemId: string) => {
  // Mock implementation
  return `Item ${itemId.substring(0, 8)}`;
};

const getSellerName = (sellerId: string) => {
  return `Seller ${sellerId.substring(0, 6)}`;
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: 'Processing',
    completed: 'Delivered',
    failed: 'Failed',
    refunded: 'Refunded'
  };
  return labels[status] || status;
};

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(date));
};

const canReview = (purchase: Transaction) => {
  return purchase.status === 'completed';
};

const getPriceChangeClass = (item: any) => {
  if (!item.priceChange) return '';
  return item.priceChange > 0 ? 'increase' : 'decrease';
};

const getPriceChangeText = (item: any) => {
  if (!item.priceChange) return 'No change';
  const prefix = item.priceChange > 0 ? '+' : '';
  return `${prefix}${item.priceChange}% from last week`;
};

const getTopDimensions = (item: MarketplaceItem | Recommendation) => {
  const dimensions = item.dimensions || {};
  const entries = Object.entries(dimensions);
  return Object.fromEntries(entries.slice(0, 3));
};

// Action handlers
const browseCatalog = () => {
  console.log('Browsing catalog...');
};

const viewPurchaseDetails = (purchase: Transaction) => {
  console.log('Viewing purchase details:', purchase.id);
};

const leaveReview = (purchase: Transaction) => {
  console.log('Leaving review for purchase:', purchase.id);
};

const removeFromWatchlist = (itemId: string) => {
  console.log('Removing from watchlist:', itemId);
};

const viewItem = (item: MarketplaceItem | Recommendation) => {
  console.log('Viewing item:', item.name);
};

const buyNow = (item: MarketplaceItem | Recommendation) => {
  console.log('Buying item:', item.name);
  // emit('itemPurchased', item);
};

const addToWatchlist = (item: Recommendation) => {
  console.log('Adding to watchlist:', item.name);
};

const editAlert = (alert: PriceAlert) => {
  console.log('Editing alert:', alert.id);
};

const removeAlert = (alertId: string) => {
  const index = priceAlerts.value.findIndex(a => a.id === alertId);
  if (index > -1) {
    priceAlerts.value.splice(index, 1);
  }
};

const closeWishlist = () => {
  showWishlist.value = false;
};

const onWishlistItemRemoved = (itemId: string) => {
  console.log('Wishlist item removed:', itemId);
};

const onWishlistItemPurchased = (item: MarketplaceItem) => {
  emit('itemPurchased', item);
};

// Initialize component
onMounted(() => {
  console.log('Buyer dashboard initialized for:', props.buyerId);
});
</script>

<style scoped>
.buyer-dashboard {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.header-info h2 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 2rem;
  font-weight: 600;
}

.header-subtitle {
  margin: 0;
  color: #6c757d;
  font-size: 1.125rem;
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.action-btn {
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.action-btn.primary {
  background: #007bff;
  color: white;
  border: none;
}

.action-btn.primary:hover {
  background: #0056b3;
}

.action-btn.secondary {
  background: white;
  color: #6c757d;
  border: 1px solid #dee2e6;
}

.action-btn.secondary:hover {
  background: #f8f9fa;
}

.stats-section {
  margin-bottom: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.stat-card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.stat-card.purchases {
  border-left: 4px solid #007bff;
}

.stat-card.spent {
  border-left: 4px solid #28a745;
}

.stat-card.saved {
  border-left: 4px solid #ffc107;
}

.stat-card.rating {
  border-left: 4px solid #fd7e14;
}

.stat-icon {
  font-size: 2.5rem;
  opacity: 0.8;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: #333;
  margin-bottom: 0.25rem;
}

.stat-label {
  color: #6c757d;
  font-size: 0.875rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.25rem;
}

.stat-trend {
  color: #6c757d;
  font-size: 0.875rem;
}

.activity-section,
.recommendations-section,
.spending-section,
.alerts-section {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  padding: 2rem;
  margin-bottom: 2rem;
}

.activity-section h3,
.recommendations-section h3,
.spending-section h3,
.alerts-section h3 {
  margin: 0 0 1.5rem 0;
  color: #333;
  font-size: 1.25rem;
}

.activity-tabs {
  display: flex;
  border-bottom: 1px solid #dee2e6;
  margin-bottom: 1.5rem;
}

.tab-btn {
  padding: 1rem 1.5rem;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  color: #6c757d;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #333;
}

.tab-btn.active {
  color: #007bff;
  border-bottom-color: #007bff;
}

.purchases-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.purchase-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.purchase-info {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  flex: 1;
}

.item-details h4 {
  margin: 0 0 0.25rem 0;
  color: #333;
  font-size: 1rem;
}

.item-details p {
  margin: 0;
  color: #6c757d;
  font-size: 0.875rem;
}

.purchase-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}

.purchase-amount {
  font-weight: bold;
  color: #28a745;
  font-size: 1.125rem;
}

.purchase-date {
  font-size: 0.875rem;
  color: #6c757d;
}

.purchase-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.75rem;
}

.status-badge {
  padding: 0.375rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: capitalize;
}

.status-badge.pending {
  background: #fff3cd;
  color: #856404;
}

.status-badge.completed {
  background: #d4edda;
  color: #155724;
}

.status-badge.failed {
  background: #f8d7da;
  color: #721c24;
}

.purchase-actions {
  display: flex;
  gap: 0.5rem;
}

.action-link {
  background: none;
  border: none;
  color: #007bff;
  cursor: pointer;
  font-size: 0.875rem;
  text-decoration: underline;
}

.action-link:hover {
  color: #0056b3;
}

.watchlist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.watchlist-item {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.item-header h4 {
  margin: 0;
  color: #333;
  font-size: 1rem;
  flex: 1;
}

.remove-btn {
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  font-size: 1rem;
}

.item-price {
  margin-bottom: 0.5rem;
}

.current-price {
  font-weight: bold;
  color: #28a745;
  font-size: 1.125rem;
}

.original-price {
  margin-left: 0.5rem;
  text-decoration: line-through;
  color: #6c757d;
  font-size: 0.875rem;
}

.price-change {
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.price-change.increase {
  color: #dc3545;
}

.price-change.decrease {
  color: #28a745;
}

.item-actions {
  display: flex;
  gap: 0.5rem;
}

.item-btn {
  flex: 1;
  padding: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.item-btn.primary {
  background: #007bff;
  color: white;
  border: none;
}

.item-btn.primary:hover {
  background: #0056b3;
}

.item-btn.secondary {
  background: white;
  color: #007bff;
  border: 1px solid #007bff;
}

.item-btn.secondary:hover {
  background: #007bff;
  color: white;
}

.reviews-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.review-item {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
}

.review-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.review-item-name {
  font-weight: 600;
  color: #333;
}

.review-rating .star {
  font-size: 1rem;
  opacity: 0.3;
}

.review-rating .star.filled {
  opacity: 1;
}

.review-text {
  color: #495057;
  line-height: 1.6;
  margin-bottom: 1rem;
}

.review-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  color: #6c757d;
}

.recommendations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.recommendation-item {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #dee2e6;
  position: relative;
}

.recommendation-badge {
  position: absolute;
  top: -8px;
  right: 1rem;
  background: #007bff;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.item-info h4 {
  margin: 0 0 0.25rem 0;
  color: #333;
  font-size: 1rem;
}

.item-category {
  color: #6c757d;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.item-price {
  font-weight: bold;
  color: #28a745;
  font-size: 1.125rem;
  margin-bottom: 1rem;
}

.item-dimensions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.dimension-tag {
  background: white;
  border: 1px solid #dee2e6;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  color: #495057;
}

.recommendation-actions {
  display: flex;
  gap: 0.5rem;
}

.rec-btn {
  flex: 1;
  padding: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.2s;
}

.rec-btn.view {
  background: white;
  color: #007bff;
  border: 1px solid #007bff;
}

.rec-btn.view:hover {
  background: #007bff;
  color: white;
}

.rec-btn.watch {
  background: white;
  color: #ffc107;
  border: 1px solid #ffc107;
}

.rec-btn.watch:hover {
  background: #ffc107;
  color: #333;
}

.rec-btn.buy {
  background: #28a745;
  color: white;
  border: none;
}

.rec-btn.buy:hover {
  background: #1e7e34;
}

.spending-content {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 2rem;
  align-items: start;
}

.spending-chart {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6c757d;
}

.spending-insights {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.insight-card {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
}

.insight-card h4 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 1rem;
}

.insight-card p {
  margin: 0;
  color: #495057;
  font-size: 0.875rem;
}

.alerts-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.alert-item {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.alert-info {
  flex: 1;
}

.alert-item-name {
  font-weight: 600;
  color: #333;
  margin-bottom: 0.25rem;
}

.alert-condition {
  color: #6c757d;
  font-size: 0.875rem;
}

.alert-status {
  text-align: center;
}

.current-price {
  font-weight: bold;
  color: #333;
  margin-bottom: 0.25rem;
}

.price-diff.reached {
  color: #28a745;
  font-weight: 600;
}

.price-diff.pending {
  color: #6c757d;
}

.alert-actions {
  display: flex;
  gap: 0.5rem;
}

.alert-btn {
  padding: 0.375rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.alert-btn.edit {
  background: white;
  color: #007bff;
  border: 1px solid #007bff;
}

.alert-btn.edit:hover {
  background: #007bff;
  color: white;
}

.alert-btn.remove {
  background: white;
  color: #dc3545;
  border: 1px solid #dc3545;
}

.alert-btn.remove:hover {
  background: #dc3545;
  color: white;
}

.modal-overlay {
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

.wishlist-modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 800px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #e9ecef;
}

.modal-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.25rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6c757d;
  padding: 0.25rem;
}

.close-btn:hover {
  color: #333;
}

.modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
}

@media (max-width: 1200px) {
  .spending-content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .buyer-dashboard {
    padding: 1rem;
  }
  
  .dashboard-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .header-actions {
    justify-content: stretch;
  }
  
  .action-btn {
    flex: 1;
    text-align: center;
  }
  
  .stats-grid,
  .watchlist-grid,
  .recommendations-grid {
    grid-template-columns: 1fr;
  }
  
  .purchase-item {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .purchase-info {
    flex-direction: column;
    gap: 1rem;
  }
  
  .purchase-meta {
    align-items: flex-start;
  }
  
  .purchase-status {
    align-items: flex-start;
  }
  
  .alert-item {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .alert-status {
    text-align: left;
  }
}
</style>