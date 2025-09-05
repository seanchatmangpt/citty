<template>
  <div class="realtime-updates">
    <!-- Connection Status -->
    <div class="connection-status" :class="connectionStatus">
      <div class="status-indicator">
        <div class="status-dot"></div>
        <span class="status-text">{{ getStatusText() }}</span>
      </div>
      <div class="connection-info">
        <span class="last-update">Last update: {{ formatLastUpdate() }}</span>
        <button @click="reconnect" class="reconnect-btn" v-if="connectionStatus !== 'connected'">
          Reconnect
        </button>
      </div>
    </div>

    <!-- Update Feed -->
    <div class="update-feed">
      <div class="feed-header">
        <h4>Live Updates</h4>
        <div class="feed-controls">
          <button
            v-for="filter in updateFilters"
            :key="filter.type"
            @click="toggleFilter(filter.type)"
            :class="['filter-btn', { active: activeFilters.includes(filter.type) }]"
          >
            {{ filter.label }}
          </button>
          <button @click="clearFeed" class="clear-btn">Clear</button>
        </div>
      </div>

      <!-- Updates List -->
      <div class="updates-list" ref="updatesList">
        <div
          v-for="update in filteredUpdates"
          :key="update.id"
          class="update-item"
          :class="[update.type, { new: isNewUpdate(update) }]"
        >
          <div class="update-header">
            <div class="update-icon">{{ getUpdateIcon(update.type) }}</div>
            <div class="update-meta">
              <span class="update-type">{{ getUpdateTypeLabel(update.type) }}</span>
              <span class="update-time">{{ formatUpdateTime(update.timestamp) }}</span>
            </div>
            <button @click="dismissUpdate(update.id)" class="dismiss-btn">×</button>
          </div>
          
          <div class="update-content">
            <div class="update-message">{{ getUpdateMessage(update) }}</div>
            
            <!-- Item Update Details -->
            <div v-if="isItemUpdate(update)" class="item-details">
              <div class="item-info">
                <span class="item-name">{{ update.data.name }}</span>
                <span class="item-price">${{ update.data.price.toLocaleString() }}</span>
              </div>
              <div v-if="update.changes" class="item-changes">
                <div
                  v-for="change in update.changes"
                  :key="change.field"
                  class="change-item"
                >
                  <span class="change-field">{{ formatFieldName(change.field) }}:</span>
                  <span class="change-old">{{ change.oldValue }}</span>
                  <span class="change-arrow">→</span>
                  <span class="change-new">{{ change.newValue }}</span>
                </div>
              </div>
            </div>
            
            <!-- Transaction Update Details -->
            <div v-if="isTransactionUpdate(update)" class="transaction-details">
              <div class="transaction-info">
                <span class="transaction-amount">${{ update.data.amount.toLocaleString() }}</span>
                <span class="transaction-status" :class="update.data.status">
                  {{ update.data.status }}
                </span>
              </div>
              <div class="transaction-parties">
                <span>{{ getBuyerName(update.data.buyerId) }} ↔ {{ getSellerName(update.data.sellerId) }}</span>
              </div>
            </div>
          </div>
          
          <!-- Update Actions -->
          <div class="update-actions" v-if="getUpdateActions(update).length > 0">
            <button
              v-for="action in getUpdateActions(update)"
              :key="action.id"
              @click="executeUpdateAction(update, action)"
              :class="['action-btn', action.type]"
            >
              {{ action.label }}
            </button>
          </div>
        </div>
        
        <!-- Loading More -->
        <div v-if="isLoadingMore" class="loading-more">
          <div class="spinner"></div>
          <span>Loading more updates...</span>
        </div>
        
        <!-- No Updates -->
        <div v-if="filteredUpdates.length === 0" class="no-updates">
          <div class="no-updates-icon">📡</div>
          <p>No updates available</p>
          <p class="no-updates-subtitle">New activities will appear here in real-time</p>
        </div>
      </div>
    </div>

    <!-- Update Statistics -->
    <div class="update-stats">
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-value">{{ totalUpdates }}</span>
          <span class="stat-label">Total Updates</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ updatesPerMinute }}</span>
          <span class="stat-label">Per Minute</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ activeConnections }}</span>
          <span class="stat-label">Active Users</span>
        </div>
      </div>
    </div>

    <!-- Sound Toggle -->
    <div class="sound-settings">
      <label class="sound-toggle">
        <input
          type="checkbox"
          v-model="soundEnabled"
          @change="onSoundToggle"
        />
        <span>Play sounds for updates</span>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import type { RealTimeUpdate, MarketplaceItem, Transaction } from '../../types';

interface UpdateChange {
  field: string;
  oldValue: any;
  newValue: any;
}

interface UpdateAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger';
}

interface EnhancedUpdate extends RealTimeUpdate {
  id: string;
  changes?: UpdateChange[];
  dismissed?: boolean;
}

interface Props {
  maxUpdates?: number;
  autoScroll?: boolean;
  enableSound?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  maxUpdates: 100,
  autoScroll: true,
  enableSound: true
});

const emit = defineEmits<{
  updateReceived: [update: RealTimeUpdate];
  actionExecuted: [update: EnhancedUpdate, action: UpdateAction];
}>();

// Reactive state
const updates = ref<EnhancedUpdate[]>([]);
const connectionStatus = ref<'connected' | 'connecting' | 'disconnected'>('connecting');
const lastUpdateTime = ref<Date | null>(null);
const activeFilters = ref<string[]>(['item_added', 'item_sold', 'transaction_created']);
const soundEnabled = ref(props.enableSound);
const isLoadingMore = ref(false);
const newUpdateIds = ref<Set<string>>(new Set());
const updatesList = ref<HTMLElement>();

// WebSocket connection (mock)
let websocketConnection: WebSocket | null = null;
let reconnectTimer: number | null = null;

// Update filters
const updateFilters = [
  { type: 'item_added', label: 'New Items' },
  { type: 'item_updated', label: 'Item Updates' },
  { type: 'item_sold', label: 'Sales' },
  { type: 'transaction_created', label: 'New Transactions' },
  { type: 'transaction_updated', label: 'Transaction Updates' }
];

// Computed properties
const filteredUpdates = computed(() => {
  return updates.value
    .filter(update => !update.dismissed)
    .filter(update => activeFilters.value.length === 0 || activeFilters.value.includes(update.type))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, props.maxUpdates);
});

const totalUpdates = computed(() => updates.value.length);

const updatesPerMinute = computed(() => {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  return updates.value.filter(update => 
    new Date(update.timestamp) > oneMinuteAgo
  ).length;
});

const activeConnections = computed(() => {
  // Mock active connections
  return Math.floor(Math.random() * 50) + 10;
});

// Methods
const connectWebSocket = () => {
  connectionStatus.value = 'connecting';
  
  // Mock WebSocket connection
  setTimeout(() => {
    connectionStatus.value = 'connected';
    lastUpdateTime.value = new Date();
    
    // Start mock update generation
    startMockUpdates();
  }, 1000);
};

const startMockUpdates = () => {
  const generateMockUpdate = () => {
    const updateTypes = ['item_added', 'item_updated', 'item_sold', 'transaction_created', 'transaction_updated'];
    const randomType = updateTypes[Math.floor(Math.random() * updateTypes.length)];
    
    const mockUpdate: EnhancedUpdate = {
      id: `update_${Date.now()}_${Math.random()}`,
      type: randomType as any,
      data: generateMockUpdateData(randomType),
      timestamp: new Date()
    };
    
    if (randomType === 'item_updated') {
      mockUpdate.changes = [
        {
          field: 'price',
          oldValue: '$1,000',
          newValue: '$900'
        }
      ];
    }
    
    receiveUpdate(mockUpdate);
  };
  
  // Generate updates at random intervals
  const scheduleNext = () => {
    const delay = Math.random() * 10000 + 2000; // 2-12 seconds
    setTimeout(() => {
      generateMockUpdate();
      scheduleNext();
    }, delay);
  };
  
  scheduleNext();
};

const generateMockUpdateData = (type: string) => {
  switch (type) {
    case 'item_added':
    case 'item_updated':
    case 'item_sold':
      return {
        id: `item_${Math.random().toString(36).substr(2, 9)}`,
        name: `Product ${Math.floor(Math.random() * 1000)}`,
        price: Math.floor(Math.random() * 5000) + 100,
        category: 'Electronics',
        sellerId: `seller_${Math.random().toString(36).substr(2, 5)}`
      };
    case 'transaction_created':
    case 'transaction_updated':
      return {
        id: `txn_${Math.random().toString(36).substr(2, 9)}`,
        amount: Math.floor(Math.random() * 3000) + 100,
        buyerId: `buyer_${Math.random().toString(36).substr(2, 5)}`,
        sellerId: `seller_${Math.random().toString(36).substr(2, 5)}`,
        status: ['pending', 'completed', 'failed'][Math.floor(Math.random() * 3)]
      };
    default:
      return {};
  }
};

const receiveUpdate = (update: EnhancedUpdate) => {
  updates.value.unshift(update);
  lastUpdateTime.value = new Date();
  newUpdateIds.value.add(update.id);
  
  // Mark as not new after 3 seconds
  setTimeout(() => {
    newUpdateIds.value.delete(update.id);
  }, 3000);
  
  // Play sound if enabled
  if (soundEnabled.value) {
    playNotificationSound(update.type);
  }
  
  // Auto-scroll to top if enabled
  if (props.autoScroll && updatesList.value) {
    nextTick(() => {
      updatesList.value!.scrollTop = 0;
    });
  }
  
  // Emit event
  emit('updateReceived', update);
  
  // Limit total updates
  if (updates.value.length > props.maxUpdates * 2) {
    updates.value = updates.value.slice(0, props.maxUpdates);
  }
};

const getStatusText = () => {
  switch (connectionStatus.value) {
    case 'connected': return 'Connected';
    case 'connecting': return 'Connecting...';
    case 'disconnected': return 'Disconnected';
    default: return 'Unknown';
  }
};

const formatLastUpdate = () => {
  if (!lastUpdateTime.value) return 'Never';
  
  const now = new Date();
  const diff = now.getTime() - lastUpdateTime.value.getTime();
  const seconds = Math.floor(diff / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
};

const formatUpdateTime = (timestamp: Date) => {
  const now = new Date();
  const diff = now.getTime() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp));
};

const getUpdateIcon = (type: string) => {
  const icons: Record<string, string> = {
    item_added: '🆕',
    item_updated: '📝',
    item_sold: '💰',
    transaction_created: '🔄',
    transaction_updated: '📊'
  };
  return icons[type] || '📡';
};

const getUpdateTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    item_added: 'New Item',
    item_updated: 'Item Updated',
    item_sold: 'Item Sold',
    transaction_created: 'New Transaction',
    transaction_updated: 'Transaction Updated'
  };
  return labels[type] || type;
};

const getUpdateMessage = (update: EnhancedUpdate) => {
  switch (update.type) {
    case 'item_added':
      return `New item "${update.data.name}" added to marketplace`;
    case 'item_updated':
      return `Item "${update.data.name}" has been updated`;
    case 'item_sold':
      return `Item "${update.data.name}" has been sold`;
    case 'transaction_created':
      return `New transaction created for $${update.data.amount?.toLocaleString()}`;
    case 'transaction_updated':
      return `Transaction updated - Status: ${update.data.status}`;
    default:
      return 'Marketplace activity detected';
  }
};

const isItemUpdate = (update: EnhancedUpdate) => {
  return ['item_added', 'item_updated', 'item_sold'].includes(update.type);
};

const isTransactionUpdate = (update: EnhancedUpdate) => {
  return ['transaction_created', 'transaction_updated'].includes(update.type);
};

const isNewUpdate = (update: EnhancedUpdate) => {
  return newUpdateIds.value.has(update.id);
};

const formatFieldName = (field: string) => {
  return field.charAt(0).toUpperCase() + field.slice(1);
};

const getBuyerName = (buyerId: string) => {
  return `Buyer ${buyerId.substring(0, 6)}`;
};

const getSellerName = (sellerId: string) => {
  return `Seller ${sellerId.substring(0, 6)}`;
};

const getUpdateActions = (update: EnhancedUpdate): UpdateAction[] => {
  const actions: UpdateAction[] = [];
  
  if (isItemUpdate(update)) {
    actions.push({ id: 'view_item', label: 'View Item', type: 'primary' });
  }
  
  if (isTransactionUpdate(update)) {
    actions.push({ id: 'view_transaction', label: 'View Transaction', type: 'primary' });
  }
  
  actions.push({ id: 'dismiss', label: 'Dismiss', type: 'secondary' });
  
  return actions;
};

const executeUpdateAction = (update: EnhancedUpdate, action: UpdateAction) => {
  if (action.id === 'dismiss') {
    dismissUpdate(update.id);
    return;
  }
  
  emit('actionExecuted', update, action);
};

const toggleFilter = (filterType: string) => {
  const index = activeFilters.value.indexOf(filterType);
  if (index > -1) {
    activeFilters.value.splice(index, 1);
  } else {
    activeFilters.value.push(filterType);
  }
};

const clearFeed = () => {
  updates.value = [];
  newUpdateIds.value.clear();
};

const dismissUpdate = (updateId: string) => {
  const update = updates.value.find(u => u.id === updateId);
  if (update) {
    update.dismissed = true;
  }
};

const reconnect = () => {
  connectionStatus.value = 'connecting';
  connectWebSocket();
};

const onSoundToggle = () => {
  // Save preference
  localStorage.setItem('marketplace_sound_enabled', soundEnabled.value.toString());
};

const playNotificationSound = (updateType: string) => {
  // Mock sound playing
  console.log(`Playing notification sound for: ${updateType}`);
  
  // In a real implementation, you would play actual sounds:
  // const audio = new Audio('/sounds/notification.mp3');
  // audio.play().catch(console.error);
};

// Lifecycle
onMounted(() => {
  // Load sound preference
  const savedSoundPref = localStorage.getItem('marketplace_sound_enabled');
  if (savedSoundPref !== null) {
    soundEnabled.value = savedSoundPref === 'true';
  }
  
  connectWebSocket();
});

onUnmounted(() => {
  if (websocketConnection) {
    websocketConnection.close();
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
});
</script>

<style scoped>
.realtime-updates {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 800px;
  margin: 0 auto;
}

.connection-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-radius: 8px;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.connection-status.connected {
  border-left: 4px solid #28a745;
}

.connection-status.connecting {
  border-left: 4px solid #ffc107;
}

.connection-status.disconnected {
  border-left: 4px solid #dc3545;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6c757d;
}

.connected .status-dot {
  background: #28a745;
  animation: pulse 2s infinite;
}

.connecting .status-dot {
  background: #ffc107;
  animation: pulse 1s infinite;
}

.disconnected .status-dot {
  background: #dc3545;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

.status-text {
  font-weight: 500;
  color: #333;
}

.connection-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.last-update {
  font-size: 0.875rem;
  color: #6c757d;
}

.reconnect-btn {
  padding: 0.375rem 0.75rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.reconnect-btn:hover {
  background: #0056b3;
}

.update-feed {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
}

.feed-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
}

.feed-header h4 {
  margin: 0;
  color: #333;
  font-size: 1.125rem;
}

.feed-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.filter-btn {
  padding: 0.375rem 0.75rem;
  border: 1px solid #dee2e6;
  background: white;
  color: #6c757d;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.filter-btn:hover {
  background: #f8f9fa;
}

.filter-btn.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.clear-btn {
  padding: 0.375rem 0.75rem;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
}

.clear-btn:hover {
  background: #c82333;
}

.updates-list {
  max-height: 500px;
  overflow-y: auto;
}

.update-item {
  border-bottom: 1px solid #e9ecef;
  padding: 1rem 1.5rem;
  transition: all 0.2s;
}

.update-item:last-child {
  border-bottom: none;
}

.update-item:hover {
  background: #f8f9fa;
}

.update-item.new {
  background: #e3f2fd;
  border-left: 3px solid #007bff;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(-20px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.update-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.update-icon {
  font-size: 1.25rem;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  border-radius: 50%;
}

.update-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.update-type {
  font-weight: 600;
  color: #333;
  font-size: 0.875rem;
}

.update-time {
  font-size: 0.75rem;
  color: #6c757d;
}

.dismiss-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: #f8f9fa;
  color: #6c757d;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
}

.dismiss-btn:hover {
  background: #e9ecef;
  color: #333;
}

.update-content {
  margin-bottom: 0.75rem;
}

.update-message {
  color: #495057;
  margin-bottom: 0.75rem;
  line-height: 1.5;
}

.item-details,
.transaction-details {
  background: #f8f9fa;
  border-radius: 6px;
  padding: 0.75rem;
  margin-top: 0.5rem;
}

.item-info,
.transaction-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.item-name {
  font-weight: 500;
  color: #333;
}

.item-price,
.transaction-amount {
  font-weight: bold;
  color: #28a745;
}

.transaction-status {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
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

.transaction-parties {
  font-size: 0.875rem;
  color: #6c757d;
}

.item-changes {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.change-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.change-field {
  font-weight: 500;
  color: #495057;
}

.change-old {
  color: #dc3545;
  text-decoration: line-through;
}

.change-arrow {
  color: #6c757d;
}

.change-new {
  color: #28a745;
  font-weight: 500;
}

.update-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  padding: 0.375rem 0.75rem;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.action-btn.primary {
  border: 1px solid #007bff;
  background: #007bff;
  color: white;
}

.action-btn.primary:hover {
  background: #0056b3;
}

.action-btn.secondary {
  border: 1px solid #6c757d;
  background: white;
  color: #6c757d;
}

.action-btn.secondary:hover {
  background: #6c757d;
  color: white;
}

.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem;
  color: #6c757d;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #e9ecef;
  border-top: 2px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.no-updates {
  text-align: center;
  padding: 3rem 1rem;
  color: #6c757d;
}

.no-updates-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.no-updates p {
  margin: 0;
}

.no-updates-subtitle {
  font-size: 0.875rem;
  opacity: 0.8;
}

.update-stats {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  padding: 1.5rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 2rem;
  font-weight: bold;
  color: #007bff;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.875rem;
  color: #6c757d;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sound-settings {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  padding: 1rem 1.5rem;
}

.sound-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: #495057;
}

.sound-toggle input[type="checkbox"] {
  margin-right: 0.5rem;
}

@media (max-width: 768px) {
  .connection-status {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .connection-info {
    justify-content: space-between;
  }
  
  .feed-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .feed-controls {
    flex-wrap: wrap;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .update-header {
    flex-wrap: wrap;
  }
  
  .item-info,
  .transaction-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
}
</style>