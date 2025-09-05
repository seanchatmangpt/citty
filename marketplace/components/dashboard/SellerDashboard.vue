<template>
  <div class="seller-dashboard">
    <!-- Dashboard Header -->
    <div class="dashboard-header">
      <div class="header-info">
        <h2>Seller Dashboard</h2>
        <p class="header-subtitle">Manage your marketplace presence and track performance</p>
      </div>
      <div class="header-actions">
        <button @click="showAddItemModal = true" class="action-btn primary">
          Add New Item
        </button>
        <button @click="exportData" class="action-btn secondary">
          Export Data
        </button>
      </div>
    </div>

    <!-- Key Metrics -->
    <div class="metrics-section">
      <div class="metrics-grid">
        <div class="metric-card revenue">
          <div class="metric-header">
            <h3>Total Revenue</h3>
            <span class="metric-trend positive">+12.5%</span>
          </div>
          <div class="metric-value">${{ totalRevenue.toLocaleString() }}</div>
          <div class="metric-subtitle">This month</div>
        </div>
        
        <div class="metric-card items">
          <div class="metric-header">
            <h3>Active Items</h3>
            <span class="metric-trend neutral">0%</span>
          </div>
          <div class="metric-value">{{ activeItems }}</div>
          <div class="metric-subtitle">{{ totalItems }} total items</div>
        </div>
        
        <div class="metric-card sales">
          <div class="metric-header">
            <h3>Total Sales</h3>
            <span class="metric-trend positive">+8.3%</span>
          </div>
          <div class="metric-value">{{ totalSales }}</div>
          <div class="metric-subtitle">{{ salesThisWeek }} this week</div>
        </div>
        
        <div class="metric-card rating">
          <div class="metric-header">
            <h3>Average Rating</h3>
            <span class="metric-trend positive">+0.2</span>
          </div>
          <div class="metric-value">{{ averageRating.toFixed(1) }}⭐</div>
          <div class="metric-subtitle">{{ totalReviews }} reviews</div>
        </div>
      </div>
    </div>

    <!-- Charts Section -->
    <div class="charts-section">
      <div class="charts-grid">
        <!-- Revenue Chart -->
        <div class="chart-card">
          <div class="chart-header">
            <h3>Revenue Trends</h3>
            <select v-model="revenueChartPeriod" @change="updateRevenueChart">
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>
          <div class="chart-container">
            <RevenueChart
              :data="revenueChartData"
              :period="revenueChartPeriod"
            />
          </div>
        </div>
        
        <!-- Items Performance -->
        <div class="chart-card">
          <div class="chart-header">
            <h3>Item Performance</h3>
            <button @click="togglePerformanceView" class="toggle-btn">
              {{ performanceView === 'views' ? 'Views' : 'Sales' }}
            </button>
          </div>
          <div class="chart-container">
            <ItemPerformanceChart
              :data="itemPerformanceData"
              :view="performanceView"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Items Management -->
    <div class="items-section">
      <div class="section-header">
        <h3>Your Items</h3>
        <div class="section-controls">
          <input
            v-model="itemsSearchQuery"
            type="text"
            placeholder="Search items..."
            class="search-input"
          />
          <select v-model="itemsStatusFilter" class="status-filter">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="sold">Sold</option>
            <option value="pending">Pending</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>
      
      <div class="items-table">
        <div class="table-header">
          <div class="header-cell name">Item Name</div>
          <div class="header-cell price">Price</div>
          <div class="header-cell views">Views</div>
          <div class="header-cell status">Status</div>
          <div class="header-cell actions">Actions</div>
        </div>
        
        <div
          v-for="item in filteredItems"
          :key="item.id"
          class="table-row"
        >
          <div class="table-cell name">
            <div class="item-info">
              <span class="item-name">{{ item.name }}</span>
              <span class="item-category">{{ item.category }}</span>
            </div>
          </div>
          <div class="table-cell price">${{ item.price.toLocaleString() }}</div>
          <div class="table-cell views">{{ getItemViews(item.id) }}</div>
          <div class="table-cell status">
            <span class="status-badge" :class="item.status">{{ item.status }}</span>
          </div>
          <div class="table-cell actions">
            <button @click="editItem(item)" class="table-action edit">Edit</button>
            <button @click="viewAnalytics(item)" class="table-action analytics">Analytics</button>
            <button @click="duplicateItem(item)" class="table-action duplicate">Duplicate</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Transactions -->
    <div class="transactions-section">
      <div class="section-header">
        <h3>Recent Transactions</h3>
        <button @click="viewAllTransactions" class="view-all-btn">View All</button>
      </div>
      
      <div class="transactions-list">
        <div
          v-for="transaction in recentTransactions"
          :key="transaction.id"
          class="transaction-item"
        >
          <div class="transaction-info">
            <div class="transaction-item-name">{{ getItemName(transaction.itemId) }}</div>
            <div class="transaction-buyer">{{ getBuyerName(transaction.buyerId) }}</div>
          </div>
          <div class="transaction-amount">${{ transaction.amount.toLocaleString() }}</div>
          <div class="transaction-status" :class="transaction.status">
            {{ getTransactionStatusLabel(transaction.status) }}
          </div>
          <div class="transaction-date">{{ formatDate(transaction.timestamp) }}</div>
        </div>
      </div>
    </div>

    <!-- Performance Insights -->
    <div class="insights-section">
      <h3>Performance Insights</h3>
      <div class="insights-grid">
        <div class="insight-card">
          <div class="insight-icon">📈</div>
          <div class="insight-content">
            <h4>Top Performing Category</h4>
            <p>{{ topCategory.name }} items are selling {{ topCategory.rate }}% faster than average</p>
            <div class="insight-action">
              <button @click="exploreCategory(topCategory.name)">Explore</button>
            </div>
          </div>
        </div>
        
        <div class="insight-card">
          <div class="insight-icon">💡</div>
          <div class="insight-content">
            <h4>Pricing Optimization</h4>
            <p>{{ pricingInsight.count }} items could benefit from price adjustments</p>
            <div class="insight-action">
              <button @click="showPricingRecommendations">View Recommendations</button>
            </div>
          </div>
        </div>
        
        <div class="insight-card">
          <div class="insight-icon">🎯</div>
          <div class="insight-content">
            <h4>Market Trends</h4>
            <p>{{ trendInsight.trend }} demand for {{ trendInsight.dimension }} items</p>
            <div class="insight-action">
              <button @click="viewTrendDetails">Learn More</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Item Modal -->
    <div v-if="showAddItemModal" class="modal-overlay" @click="closeAddItemModal">
      <div class="add-item-modal" @click.stop>
        <div class="modal-header">
          <h3>Add New Item</h3>
          <button @click="closeAddItemModal" class="close-btn">×</button>
        </div>
        
        <div class="modal-content">
          <AddItemForm
            @item-added="onItemAdded"
            @cancel="closeAddItemModal"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { MarketplaceItem, Transaction } from '../../types';
import RevenueChart from './RevenueChart.vue';
import ItemPerformanceChart from './ItemPerformanceChart.vue';
import AddItemForm from './AddItemForm.vue';

interface Props {
  sellerId: string;
  items?: MarketplaceItem[];
  transactions?: Transaction[];
}

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  transactions: () => []
});

const emit = defineEmits<{
  itemAdded: [item: MarketplaceItem];
  itemUpdated: [item: MarketplaceItem];
  exportRequested: [data: any];
}>();

// Reactive state
const showAddItemModal = ref(false);
const itemsSearchQuery = ref('');
const itemsStatusFilter = ref('');
const revenueChartPeriod = ref('30d');
const performanceView = ref<'views' | 'sales'>('views');
const itemViews = ref<Record<string, number>>({});

// Mock data
const mockMetrics = {
  totalRevenue: 45280,
  totalSales: 156,
  salesThisWeek: 12,
  averageRating: 4.7,
  totalReviews: 89
};

// Computed properties
const activeItems = computed(() => 
  props.items.filter(item => item.status === 'active').length
);

const totalItems = computed(() => props.items.length);

const totalRevenue = computed(() => mockMetrics.totalRevenue);
const totalSales = computed(() => mockMetrics.totalSales);
const salesThisWeek = computed(() => mockMetrics.salesThisWeek);
const averageRating = computed(() => mockMetrics.averageRating);
const totalReviews = computed(() => mockMetrics.totalReviews);

const filteredItems = computed(() => {
  let items = [...props.items];
  
  // Filter by search query
  if (itemsSearchQuery.value) {
    const query = itemsSearchQuery.value.toLowerCase();
    items = items.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
    );
  }
  
  // Filter by status
  if (itemsStatusFilter.value) {
    items = items.filter(item => item.status === itemsStatusFilter.value);
  }
  
  return items.sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
});

const recentTransactions = computed(() => {
  return props.transactions
    .filter(t => t.sellerId === props.sellerId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);
});

const revenueChartData = computed(() => {
  // Mock revenue data
  return {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [{
      label: 'Revenue',
      data: [3200, 4100, 3800, 5200, 4600, 5800],
      borderColor: '#007bff',
      backgroundColor: 'rgba(0, 123, 255, 0.1)',
      tension: 0.4
    }]
  };
});

const itemPerformanceData = computed(() => {
  return props.items.map(item => ({
    name: item.name,
    views: getItemViews(item.id),
    sales: getItemSales(item.id),
    revenue: getItemRevenue(item.id)
  }));
});

const topCategory = computed(() => ({
  name: 'Electronics',
  rate: 25
}));

const pricingInsight = computed(() => ({
  count: Math.floor(props.items.length * 0.3)
}));

const trendInsight = computed(() => ({
  trend: 'Increasing',
  dimension: 'eco-friendly'
}));

// Methods
const getItemViews = (itemId: string) => {
  return itemViews.value[itemId] || Math.floor(Math.random() * 500) + 50;
};

const getItemSales = (itemId: string) => {
  return props.transactions.filter(t => t.itemId === itemId).length;
};

const getItemRevenue = (itemId: string) => {
  return props.transactions
    .filter(t => t.itemId === itemId && t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);
};

const getItemName = (itemId: string) => {
  const item = props.items.find(i => i.id === itemId);
  return item?.name || 'Unknown Item';
};

const getBuyerName = (buyerId: string) => {
  return `Buyer ${buyerId.substring(0, 6)}`;
};

const getTransactionStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: 'Pending',
    completed: 'Completed',
    failed: 'Failed',
    refunded: 'Refunded'
  };
  return labels[status] || status;
};

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date));
};

const updateRevenueChart = () => {
  // Update chart data based on selected period
  console.log('Updating revenue chart for period:', revenueChartPeriod.value);
};

const togglePerformanceView = () => {
  performanceView.value = performanceView.value === 'views' ? 'sales' : 'views';
};

const editItem = (item: MarketplaceItem) => {
  console.log('Editing item:', item.name);
  // Open edit modal or navigate to edit page
};

const viewAnalytics = (item: MarketplaceItem) => {
  console.log('Viewing analytics for item:', item.name);
  // Navigate to detailed analytics
};

const duplicateItem = (item: MarketplaceItem) => {
  console.log('Duplicating item:', item.name);
  // Create a copy of the item
};

const viewAllTransactions = () => {
  console.log('Viewing all transactions');
  // Navigate to transactions page
};

const exploreCategory = (categoryName: string) => {
  console.log('Exploring category:', categoryName);
  // Navigate to category insights
};

const showPricingRecommendations = () => {
  console.log('Showing pricing recommendations');
  // Open pricing recommendations modal
};

const viewTrendDetails = () => {
  console.log('Viewing trend details');
  // Navigate to trend analysis
};

const exportData = () => {
  const data = {
    items: props.items,
    transactions: props.transactions.filter(t => t.sellerId === props.sellerId),
    metrics: {
      totalRevenue: totalRevenue.value,
      totalSales: totalSales.value,
      averageRating: averageRating.value
    }
  };
  emit('exportRequested', data);
};

const closeAddItemModal = () => {
  showAddItemModal.value = false;
};

const onItemAdded = (item: MarketplaceItem) => {
  emit('itemAdded', item);
  closeAddItemModal();
};

// Initialize mock view data
onMounted(() => {
  props.items.forEach(item => {
    itemViews.value[item.id] = Math.floor(Math.random() * 500) + 50;
  });
});
</script>

<style scoped>
.seller-dashboard {
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

.metrics-section {
  margin-bottom: 2rem;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.metric-card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border-left: 4px solid #e9ecef;
}

.metric-card.revenue {
  border-left-color: #28a745;
}

.metric-card.items {
  border-left-color: #007bff;
}

.metric-card.sales {
  border-left-color: #fd7e14;
}

.metric-card.rating {
  border-left-color: #ffc107;
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.metric-header h3 {
  margin: 0;
  color: #6c757d;
  font-size: 0.875rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.metric-trend {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.metric-trend.positive {
  background: #d4edda;
  color: #155724;
}

.metric-trend.negative {
  background: #f8d7da;
  color: #721c24;
}

.metric-trend.neutral {
  background: #e2e3e5;
  color: #383d41;
}

.metric-value {
  font-size: 2.5rem;
  font-weight: bold;
  color: #333;
  margin-bottom: 0.5rem;
}

.metric-subtitle {
  color: #6c757d;
  font-size: 0.875rem;
}

.charts-section {
  margin-bottom: 2rem;
}

.charts-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 2rem;
}

.chart-card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.chart-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.25rem;
}

.chart-header select,
.toggle-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background: white;
  font-size: 0.875rem;
  cursor: pointer;
}

.chart-container {
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  border-radius: 8px;
  color: #6c757d;
}

.items-section,
.transactions-section {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  padding: 2rem;
  margin-bottom: 2rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.section-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.25rem;
}

.section-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.search-input,
.status-filter {
  padding: 0.5rem 1rem;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-size: 0.875rem;
}

.search-input {
  min-width: 250px;
}

.view-all-btn {
  padding: 0.5rem 1rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.view-all-btn:hover {
  background: #0056b3;
}

.items-table {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  overflow: hidden;
}

.table-header {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
}

.header-cell {
  padding: 1rem;
  font-weight: 600;
  color: #333;
  border-right: 1px solid #dee2e6;
}

.header-cell:last-child {
  border-right: none;
}

.table-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
  border-bottom: 1px solid #e9ecef;
}

.table-row:hover {
  background: #f8f9fa;
}

.table-cell {
  padding: 1rem;
  border-right: 1px solid #e9ecef;
  display: flex;
  align-items: center;
}

.table-cell:last-child {
  border-right: none;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.item-name {
  font-weight: 600;
  color: #333;
}

.item-category {
  font-size: 0.875rem;
  color: #6c757d;
}

.status-badge {
  padding: 0.375rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: capitalize;
}

.status-badge.active {
  background: #d1ecf1;
  color: #0c5460;
}

.status-badge.sold {
  background: #d4edda;
  color: #155724;
}

.status-badge.pending {
  background: #fff3cd;
  color: #856404;
}

.status-badge.draft {
  background: #f8d7da;
  color: #721c24;
}

.table-action {
  padding: 0.375rem 0.75rem;
  border: 1px solid;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  margin-right: 0.5rem;
  transition: all 0.2s;
}

.table-action.edit {
  border-color: #007bff;
  color: #007bff;
  background: white;
}

.table-action.edit:hover {
  background: #007bff;
  color: white;
}

.table-action.analytics {
  border-color: #28a745;
  color: #28a745;
  background: white;
}

.table-action.analytics:hover {
  background: #28a745;
  color: white;
}

.table-action.duplicate {
  border-color: #6c757d;
  color: #6c757d;
  background: white;
}

.table-action.duplicate:hover {
  background: #6c757d;
  color: white;
}

.transactions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.transaction-item {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
  align-items: center;
}

.transaction-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.transaction-item-name {
  font-weight: 600;
  color: #333;
}

.transaction-buyer {
  font-size: 0.875rem;
  color: #6c757d;
}

.transaction-amount {
  font-weight: bold;
  color: #28a745;
  font-size: 1.125rem;
}

.transaction-status {
  padding: 0.375rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  text-align: center;
  text-transform: capitalize;
}

.transaction-status.pending {
  background: #fff3cd;
  color: #856404;
}

.transaction-status.completed {
  background: #d4edda;
  color: #155724;
}

.transaction-status.failed {
  background: #f8d7da;
  color: #721c24;
}

.transaction-date {
  font-size: 0.875rem;
  color: #6c757d;
  text-align: center;
}

.insights-section {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  padding: 2rem;
}

.insights-section h3 {
  margin: 0 0 1.5rem 0;
  color: #333;
  font-size: 1.25rem;
}

.insights-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.insight-card {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  display: flex;
  gap: 1rem;
}

.insight-icon {
  font-size: 2rem;
  line-height: 1;
}

.insight-content {
  flex: 1;
}

.insight-content h4 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 1rem;
}

.insight-content p {
  margin: 0 0 1rem 0;
  color: #6c757d;
  font-size: 0.875rem;
  line-height: 1.5;
}

.insight-action button {
  padding: 0.5rem 1rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.insight-action button:hover {
  background: #0056b3;
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

.add-item-modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 600px;
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
  .charts-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .seller-dashboard {
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
  
  .metrics-grid {
    grid-template-columns: 1fr;
  }
  
  .section-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .section-controls {
    flex-direction: column;
  }
  
  .search-input {
    min-width: auto;
  }
  
  .table-header,
  .table-row {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  
  .header-cell,
  .table-cell {
    border-right: none;
    border-bottom: 1px solid #e9ecef;
  }
  
  .transaction-item {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  
  .insights-grid {
    grid-template-columns: 1fr;
  }
}
</style>