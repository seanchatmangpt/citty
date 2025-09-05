<template>
  <div class="performance-dashboard">
    <!-- Dashboard Header -->
    <div class="dashboard-header mb-6">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
        <UIcon name="i-heroicons-chart-bar" class="w-6 h-6" />
        Performance Dashboard
        <UBadge :color="getOverallHealthColor()" variant="solid" size="sm">
          {{ overallHealth }}
        </UBadge>
      </h2>
      <p class="text-gray-600 dark:text-gray-300 mt-1">
        Real-time marketplace performance metrics based on CNS patterns
      </p>
    </div>

    <!-- Core Metrics Grid (80% of value) -->
    <div class="metrics-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <OptimizedMetricCard
        v-for="metric in coreMetrics"
        :key="metric.id"
        :metric="metric"
        :clickable="true"
        :show-sparkline="true"
        @drill-down="handleMetricDrillDown"
        class="core-metric"
      />
    </div>

    <!-- Real-time Activity Feed (CNS Pattern) -->
    <div class="activity-section mb-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon name="i-heroicons-bolt" class="w-5 h-5 text-blue-500" />
          Real-time Activity
        </h3>
        <div class="flex items-center gap-2">
          <UBadge 
            :color="isConnected ? 'green' : 'red'" 
            variant="solid" 
            size="sm"
          >
            {{ isConnected ? 'Connected' : 'Disconnected' }}
          </UBadge>
          <UButton 
            @click="toggleRealTime" 
            :color="realTimeEnabled ? 'red' : 'green'"
            variant="ghost" 
            size="sm"
          >
            {{ realTimeEnabled ? 'Pause' : 'Resume' }}
          </UButton>
        </div>
      </div>

      <div class="activity-feed bg-gray-50 dark:bg-gray-800 rounded-lg p-4 max-h-64 overflow-y-auto">
        <div
          v-for="activity in recentActivities"
          :key="activity.id"
          class="activity-item flex items-center gap-3 py-2 px-3 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
        >
          <UIcon 
            :name="getActivityIcon(activity.type)" 
            :class="getActivityColor(activity.type)"
            class="w-4 h-4 flex-shrink-0" 
          />
          <div class="flex-1 min-w-0">
            <p class="text-sm text-gray-900 dark:text-white font-medium truncate">
              {{ activity.title }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ formatTimeAgo(activity.timestamp) }}
            </p>
          </div>
          <div class="flex-shrink-0">
            <UBadge 
              :color="getActivityBadgeColor(activity.type)" 
              variant="soft" 
              size="xs"
            >
              {{ activity.category }}
            </UBadge>
          </div>
        </div>

        <div v-if="recentActivities.length === 0" class="text-center py-8">
          <UIcon name="i-heroicons-inbox" class="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p class="text-gray-500 dark:text-gray-400 text-sm">No recent activity</p>
        </div>
      </div>
    </div>

    <!-- Advanced Metrics (20% of value, progressive disclosure) -->
    <div v-if="showAdvancedMetrics" class="advanced-section">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon name="i-heroicons-cog-6-tooth" class="w-5 h-5 text-purple-500" />
          Advanced Metrics
        </h3>
        <UButton 
          @click="showAdvancedMetrics = false" 
          color="gray" 
          variant="ghost" 
          size="sm"
        >
          Hide
        </UButton>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <OptimizedMetricCard
          v-for="metric in advancedMetrics"
          :key="metric.id"
          :metric="metric"
          :clickable="true"
          :show-sparkline="false"
          size="sm"
          @drill-down="handleMetricDrillDown"
          class="advanced-metric"
        />
      </div>
    </div>

    <!-- Show Advanced Metrics Button -->
    <div v-else class="text-center">
      <UButton 
        @click="showAdvancedMetrics = true"
        color="gray" 
        variant="outline"
      >
        <UIcon name="i-heroicons-chevron-down" class="w-4 h-4 mr-2" />
        Show Advanced Metrics
      </UButton>
    </div>

    <!-- Performance Chart Modal (Progressive Enhancement) -->
    <UModal v-model="showDetailModal" :ui="{ container: 'z-50' }">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">{{ selectedMetric?.label }} Details</h3>
            <UButton 
              @click="showDetailModal = false" 
              color="gray" 
              variant="ghost" 
              icon="i-heroicons-x-mark"
            />
          </div>
        </template>

        <div v-if="selectedMetric" class="space-y-4">
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-gray-500">Current Value:</span>
              <div class="font-semibold">{{ formatValue(selectedMetric.value, selectedMetric.type) }}</div>
            </div>
            <div>
              <span class="text-gray-500">Trend:</span>
              <div class="flex items-center gap-1">
                <UIcon :name="getTrendIcon(selectedMetric.trend)" :class="getTrendColor(selectedMetric.trend)" class="w-4 h-4" />
                <span :class="getTrendColor(selectedMetric.trend)" class="font-medium">
                  {{ formatTrend(selectedMetric.change, selectedMetric.trend) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Extended Sparkline Chart -->
          <div v-if="selectedMetric.sparklineData?.length" class="h-32">
            <canvas ref="detailChart" class="w-full h-full"></canvas>
          </div>

          <div class="text-xs text-gray-500 space-y-1">
            <p><strong>Metric ID:</strong> {{ selectedMetric.id }}</p>
            <p><strong>Last Updated:</strong> {{ new Date().toLocaleString() }}</p>
            <p v-if="selectedMetric.status"><strong>Status:</strong> {{ selectedMetric.status }}</p>
          </div>
        </div>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
// CNS-Inspired Performance Dashboard with 80/20 Optimization

interface ActivityItem {
  id: string
  type: 'search' | 'purchase' | 'auction' | 'error' | 'system'
  title: string
  category: string
  timestamp: Date
}

// Real-time WebSocket connection
const { 
  isConnected, 
  marketplaceUpdates, 
  notifications,
  connectToPipeline, 
  disconnectPipeline 
} = useOptimizedWebSocket()

// State management
const showAdvancedMetrics = ref(false)
const showDetailModal = ref(false)
const selectedMetric = ref<any>(null)
const realTimeEnabled = ref(true)
const recentActivities = ref<ActivityItem[]>([])

// Core metrics (80% of user value)
const coreMetrics = ref([
  {
    id: 'active_users',
    label: 'Active Users',
    value: 1247,
    type: 'number',
    trend: 'up',
    change: 12.5,
    icon: 'i-heroicons-users',
    status: 'success',
    color: 'green',
    sparklineData: [1100, 1150, 1200, 1180, 1220, 1247]
  },
  {
    id: 'search_latency',
    label: 'Search Latency',
    value: 145,
    type: 'duration',
    trend: 'down',
    change: -8.2,
    icon: 'i-heroicons-clock',
    status: 'success',
    color: 'blue',
    sparklineData: [180, 170, 160, 155, 150, 145]
  },
  {
    id: 'conversion_rate',
    label: 'Conversion Rate',
    value: 3.2,
    type: 'percentage',
    trend: 'up',
    change: 0.5,
    icon: 'i-heroicons-arrow-trending-up',
    status: 'success',
    color: 'green',
    sparklineData: [2.8, 2.9, 3.0, 3.1, 3.1, 3.2]
  },
  {
    id: 'revenue',
    label: 'Revenue Today',
    value: 24580,
    type: 'currency',
    trend: 'up',
    change: 18.7,
    icon: 'i-heroicons-banknotes',
    status: 'success',
    color: 'green',
    sparklineData: [20000, 21000, 22000, 23000, 24000, 24580]
  }
])

// Advanced metrics (20% of user value, shown on demand)
const advancedMetrics = ref([
  {
    id: 'websocket_connections',
    label: 'WebSocket Connections',
    value: 892,
    type: 'number',
    trend: 'stable',
    change: 0,
    icon: 'i-heroicons-signal',
    status: 'info',
    color: 'blue'
  },
  {
    id: 'cache_hit_rate',
    label: 'Cache Hit Rate',
    value: 94.5,
    type: 'percentage',
    trend: 'up',
    change: 2.1,
    icon: 'i-heroicons-server',
    status: 'success',
    color: 'green'
  },
  {
    id: 'error_rate',
    label: 'Error Rate',
    value: 0.3,
    type: 'percentage',
    trend: 'down',
    change: -0.1,
    icon: 'i-heroicons-exclamation-triangle',
    status: 'warning',
    color: 'orange'
  }
])

// Computed properties
const overallHealth = computed(() => {
  // Simple health calculation based on core metrics
  const searchLatency = coreMetrics.value.find(m => m.id === 'search_latency')?.value || 0
  const errorRate = advancedMetrics.value.find(m => m.id === 'error_rate')?.value || 0
  
  if (searchLatency > 300 || errorRate > 1) return 'Poor'
  if (searchLatency > 200 || errorRate > 0.5) return 'Fair'
  return 'Excellent'
})

// Utility functions
const formatValue = (value: number | string, type?: string): string => {
  if (typeof value === 'string') return value
  
  switch (type) {
    case 'currency':
      return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD',
        minimumFractionDigits: value >= 1000 ? 0 : 2
      }).format(value)
    case 'percentage':
      return `${value.toFixed(1)}%`
    case 'duration':
      return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`
    default:
      return value >= 1000 
        ? new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value)
        : value.toString()
  }
}

const formatTrend = (change?: number, trend?: string): string => {
  if (!change && !trend) return ''
  if (change) {
    const sign = change > 0 ? '+' : ''
    return `${sign}${change.toFixed(1)}%`
  }
  return trend === 'stable' ? 'No change' : trend === 'up' ? 'Increasing' : 'Decreasing'
}

const getTrendIcon = (trend?: string) => {
  const icons = {
    up: 'i-heroicons-arrow-trending-up',
    down: 'i-heroicons-arrow-trending-down',
    stable: 'i-heroicons-minus'
  }
  return icons[trend as keyof typeof icons] || 'i-heroicons-minus'
}

const getTrendColor = (trend?: string) => {
  const colors = {
    up: 'text-green-600',
    down: 'text-red-600',
    stable: 'text-gray-500'
  }
  return colors[trend as keyof typeof colors] || 'text-gray-500'
}

const getOverallHealthColor = () => {
  switch (overallHealth.value) {
    case 'Excellent': return 'green'
    case 'Fair': return 'orange'
    case 'Poor': return 'red'
    default: return 'gray'
  }
}

const getActivityIcon = (type: string) => {
  const icons = {
    search: 'i-heroicons-magnifying-glass',
    purchase: 'i-heroicons-shopping-cart',
    auction: 'i-heroicons-currency-dollar',
    error: 'i-heroicons-exclamation-triangle',
    system: 'i-heroicons-cog-6-tooth'
  }
  return icons[type as keyof typeof icons] || 'i-heroicons-information-circle'
}

const getActivityColor = (type: string) => {
  const colors = {
    search: 'text-blue-500',
    purchase: 'text-green-500',
    auction: 'text-yellow-500',
    error: 'text-red-500',
    system: 'text-gray-500'
  }
  return colors[type as keyof typeof colors] || 'text-gray-500'
}

const getActivityBadgeColor = (type: string) => {
  const colors = {
    search: 'blue',
    purchase: 'green',
    auction: 'yellow',
    error: 'red',
    system: 'gray'
  }
  return colors[type as keyof typeof colors] || 'gray'
}

const formatTimeAgo = (timestamp: Date): string => {
  const now = new Date()
  const diff = now.getTime() - timestamp.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return `${seconds}s ago`
}

// Event handlers
const handleMetricDrillDown = (metric: any) => {
  selectedMetric.value = metric
  showDetailModal.value = true
}

const toggleRealTime = () => {
  realTimeEnabled.value = !realTimeEnabled.value
  
  if (realTimeEnabled.value && !isConnected.value) {
    connectToPipeline({
      onMarketplace: handleMarketplaceUpdate,
      onNotification: handleNotification
    })
  } else if (!realTimeEnabled.value && isConnected.value) {
    disconnectPipeline()
  }
}

// Real-time data handlers (CNS Pattern)
const handleMarketplaceUpdate = (update: any) => {
  if (!realTimeEnabled.value) return
  
  const activity: ActivityItem = {
    id: `activity-${Date.now()}`,
    type: update.type === 'new_item' ? 'search' : 
          update.type === 'item_sold' ? 'purchase' : 'auction',
    title: getActivityTitle(update),
    category: update.type.replace('_', ' '),
    timestamp: new Date(update.timestamp)
  }
  
  recentActivities.value.unshift(activity)
  
  // Keep only recent 20 activities
  if (recentActivities.value.length > 20) {
    recentActivities.value = recentActivities.value.slice(0, 20)
  }
  
  // Update relevant metrics
  updateMetricsFromActivity(activity)
}

const handleNotification = (notification: any) => {
  if (!realTimeEnabled.value) return
  
  const activity: ActivityItem = {
    id: `notif-${Date.now()}`,
    type: notification.type === 'error' ? 'error' : 'system',
    title: notification.message,
    category: notification.type,
    timestamp: new Date(notification.timestamp)
  }
  
  recentActivities.value.unshift(activity)
  
  if (recentActivities.value.length > 20) {
    recentActivities.value = recentActivities.value.slice(0, 20)
  }
}

const getActivityTitle = (update: any): string => {
  switch (update.type) {
    case 'new_item': return `New item: ${update.data?.title || 'Unknown item'}`
    case 'item_sold': return `Item sold: ${update.data?.title || 'Unknown item'}`
    case 'price_change': return `Price updated: ${update.data?.title || 'Unknown item'}`
    default: return 'Marketplace activity'
  }
}

const updateMetricsFromActivity = (activity: ActivityItem) => {
  // Simple metric updates based on activity
  if (activity.type === 'purchase') {
    const revenueMetric = coreMetrics.value.find(m => m.id === 'revenue')
    if (revenueMetric) {
      revenueMetric.value += 50 // Simulate revenue increase
      revenueMetric.sparklineData?.push(revenueMetric.value)
      if (revenueMetric.sparklineData && revenueMetric.sparklineData.length > 6) {
        revenueMetric.sparklineData.shift()
      }
    }
  }
}

// Lifecycle
onMounted(() => {
  // Connect to real-time updates
  if (realTimeEnabled.value) {
    connectToPipeline({
      onMarketplace: handleMarketplaceUpdate,
      onNotification: handleNotification
    })
  }
  
  // Simulate some initial activities for demo
  setTimeout(() => {
    recentActivities.value = [
      {
        id: 'activity-1',
        type: 'search',
        title: 'User searched for "vue components"',
        category: 'search',
        timestamp: new Date(Date.now() - 30000)
      },
      {
        id: 'activity-2', 
        type: 'purchase',
        title: 'Purchase completed: CLI Template Pack',
        category: 'purchase',
        timestamp: new Date(Date.now() - 60000)
      }
    ]
  }, 1000)
})

onBeforeUnmount(() => {
  if (isConnected.value) {
    disconnectPipeline()
  }
})
</script>

<style scoped>
.performance-dashboard {
  @apply p-6 min-h-screen bg-gray-50 dark:bg-gray-900;
}

.metrics-grid .core-metric {
  @apply transform transition-all duration-200;
}

.metrics-grid .core-metric:hover {
  @apply -translate-y-1;
}

.activity-feed {
  max-height: 16rem;
}

.activity-item {
  @apply border-l-2 border-transparent;
}

.activity-item:hover {
  @apply border-l-blue-500;
}

.advanced-metric {
  @apply opacity-90 hover:opacity-100 transition-opacity duration-200;
}

/* Scrollbar styling */
.activity-feed::-webkit-scrollbar {
  width: 4px;
}

.activity-feed::-webkit-scrollbar-track {
  @apply bg-gray-200 dark:bg-gray-700;
}

.activity-feed::-webkit-scrollbar-thumb {
  @apply bg-gray-400 dark:bg-gray-500 rounded;
}

.activity-feed::-webkit-scrollbar-thumb:hover {
  @apply bg-gray-500 dark:bg-gray-400;
}
</style>