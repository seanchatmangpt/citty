<template>
  <UCard 
    class="metric-card cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 group"
    :class="getCardClass()"
    @click="handleClick"
  >
    <div class="flex items-center justify-between">
      <div class="flex-1">
        <!-- Metric Header -->
        <div class="flex items-center gap-2 mb-2">
          <UIcon 
            :name="metric.icon" 
            :class="getIconClass()"
            class="w-5 h-5 transition-colors duration-200"
          />
          <p class="text-sm font-medium text-gray-600 dark:text-gray-300">
            {{ metric.label }}
          </p>
        </div>
        
        <!-- Metric Value -->
        <p class="text-2xl font-bold text-gray-900 dark:text-white mb-2 transition-all duration-200">
          {{ formatValue(metric.value, metric.type) }}
        </p>
        
        <!-- Trend Indicator (80/20: Simple but effective) -->
        <div class="flex items-center gap-2">
          <UIcon 
            :name="getTrendIcon(metric.trend)" 
            :class="getTrendColor(metric.trend)"
            class="w-4 h-4 transition-all duration-200"
          />
          <span 
            :class="getTrendColor(metric.trend)" 
            class="text-sm font-medium transition-colors duration-200"
          >
            {{ formatTrend(metric.change, metric.trend) }}
          </span>
        </div>
      </div>
      
      <!-- Status Indicator -->
      <div 
        :class="getStatusClass()" 
        class="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200"
      >
        <UIcon :name="getStatusIcon()" class="w-6 h-6" />
      </div>
    </div>
    
    <!-- Mini Sparkline (CNS Pattern: Visual trend indication) -->
    <div class="mt-4 h-8 overflow-hidden" v-if="showSparkline && metric.sparklineData?.length">
      <MiniSparkline 
        :data="metric.sparklineData" 
        :color="getSparklineColor()"
        class="transition-opacity duration-200 group-hover:opacity-80"
      />
    </div>
    
    <!-- Action Indicator -->
    <div 
      v-if="clickable"
      class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
    >
      <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-400" />
    </div>
  </UCard>
</template>

<script setup lang="ts">
// 80/20 Optimized Metric Card based on CNS patterns
interface MetricData {
  id: string
  label: string
  value: number | string
  type?: 'number' | 'currency' | 'percentage' | 'duration'
  trend?: 'up' | 'down' | 'stable'
  change?: number
  icon: string
  status?: 'success' | 'warning' | 'error' | 'info'
  color?: 'green' | 'blue' | 'orange' | 'red' | 'purple'
  sparklineData?: number[]
}

interface Props {
  metric: MetricData
  clickable?: boolean
  showSparkline?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  clickable: true,
  showSparkline: true,
  size: 'md'
})

const emit = defineEmits<{
  'drill-down': [metric: MetricData]
  'click': [metric: MetricData]
}>()

// 80/20: Focus on essential formatting functions
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

// CNS Pattern: Dynamic styling based on state
const getCardClass = () => {
  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  }
  
  const statusBorder = {
    success: 'border-l-4 border-l-green-500',
    warning: 'border-l-4 border-l-orange-500',
    error: 'border-l-4 border-l-red-500',
    info: 'border-l-4 border-l-blue-500'
  }
  
  return [
    sizeClasses[props.size],
    props.metric.status ? statusBorder[props.metric.status] : '',
    'relative overflow-hidden'
  ].join(' ')
}

const getIconClass = () => {
  const colorClasses = {
    green: 'text-green-600',
    blue: 'text-blue-600', 
    orange: 'text-orange-600',
    red: 'text-red-600',
    purple: 'text-purple-600'
  }
  return props.metric.color ? colorClasses[props.metric.color] : 'text-gray-600'
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

const getStatusClass = () => {
  const statusClasses = {
    success: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300',
    warning: 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300',
    error: 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300',
    info: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
  }
  
  if (props.metric.status) {
    return statusClasses[props.metric.status]
  }
  
  // Fallback to color-based styling
  const colorClasses = {
    green: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300',
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300',
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300',
    red: 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300'
  }
  
  return props.metric.color 
    ? colorClasses[props.metric.color] 
    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
}

const getStatusIcon = () => {
  const statusIcons = {
    success: 'i-heroicons-check-circle',
    warning: 'i-heroicons-exclamation-triangle',
    error: 'i-heroicons-x-circle',
    info: 'i-heroicons-information-circle'
  }
  
  if (props.metric.status) {
    return statusIcons[props.metric.status]
  }
  
  // Fallback to metric-specific icons
  const metricIcons = {
    throughput: 'i-heroicons-arrow-trending-up',
    latency: 'i-heroicons-clock',
    errors: 'i-heroicons-exclamation-triangle',
    availability: 'i-heroicons-check-circle',
    revenue: 'i-heroicons-banknotes',
    users: 'i-heroicons-users'
  }
  
  return metricIcons[props.metric.id as keyof typeof metricIcons] || 'i-heroicons-chart-bar'
}

const getSparklineColor = () => {
  const colors = {
    green: '#10b981',
    blue: '#3b82f6',
    orange: '#f59e0b', 
    red: '#ef4444',
    purple: '#8b5cf6'
  }
  return props.metric.color ? colors[props.metric.color] : '#6b7280'
}

const handleClick = () => {
  if (props.clickable) {
    emit('click', props.metric)
    emit('drill-down', props.metric)
  }
}

// CNS Pattern: Performance monitoring
const trackMetricView = () => {
  // Track metric card interaction for analytics
  // This would integrate with your analytics service
  if (process.client) {
    console.log('Metric viewed:', props.metric.id)
  }
}

onMounted(() => {
  trackMetricView()
})
</script>

<style scoped>
.metric-card {
  /* CNS Pattern: Subtle animations for better UX */
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.metric-card:hover {
  /* Subtle lift effect */
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

/* Dark mode optimizations */
@media (prefers-color-scheme: dark) {
  .metric-card:hover {
    box-shadow: 0 10px 25px -5px rgba(255, 255, 255, 0.1), 0 10px 10px -5px rgba(255, 255, 255, 0.04);
  }
}
</style>