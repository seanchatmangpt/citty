<template>
  <div>
    <!-- Error State -->
    <div v-if="hasError" class="error-boundary">
      <div class="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div class="flex items-center mb-4">
          <div class="flex-shrink-0">
            <Icon 
              name="heroicons:exclamation-triangle" 
              class="h-8 w-8 text-red-500"
            />
          </div>
          <div class="ml-3">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">
              Something went wrong
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ userFriendlyMessage }}
            </p>
          </div>
        </div>

        <!-- Error Details (Development Only) -->
        <details v-if="isDev && errorDetails" class="mb-4">
          <summary class="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
            Technical Details
          </summary>
          <pre class="mt-2 p-3 bg-gray-50 dark:bg-gray-700 rounded text-xs font-mono text-gray-800 dark:text-gray-200 overflow-auto">{{ errorDetails }}</pre>
        </details>

        <!-- Actions -->
        <div class="flex flex-col sm:flex-row gap-3">
          <button
            @click="retry"
            :disabled="retryCount >= maxRetries"
            class="flex-1 px-4 py-2 bg-marketplace-600 text-white rounded-md hover:bg-marketplace-700 focus:outline-none focus:ring-2 focus:ring-marketplace-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ retryCount >= maxRetries ? 'Max Retries Reached' : `Retry${retryCount > 0 ? ` (${retryCount}/${maxRetries})` : ''}` }}
          </button>
          
          <button
            @click="reportError"
            class="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Report Issue
          </button>
        </div>

        <!-- Reset Option -->
        <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          <button
            @click="reset"
            class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Reset to fresh state
          </button>
        </div>
      </div>
    </div>

    <!-- Normal Content -->
    <div v-else>
      <slot :error="currentError" :retry="retry" :hasError="hasError" />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  maxRetries?: number
  resetOnPropsChange?: boolean
  fallback?: string
  onError?: (error: Error, errorInfo: any) => void
}

const props = withDefaults(defineProps<Props>(), {
  maxRetries: 3,
  resetOnPropsChange: true,
  fallback: 'Something went wrong while loading this content.'
})

const emit = defineEmits<{
  error: [error: Error, errorInfo: any]
  retry: [retryCount: number]
  reset: []
}>()

const { handleError } = useErrorHandler()
const isDev = process.dev

const hasError = ref(false)
const currentError = ref<Error | null>(null)
const retryCount = ref(0)
const errorId = ref<string | null>(null)

// User-friendly error message
const userFriendlyMessage = computed(() => {
  if (!currentError.value) return props.fallback
  
  const message = currentError.value.message.toLowerCase()
  
  // Network/API errors
  if (message.includes('fetch') || message.includes('network')) {
    return 'Unable to load data. Please check your internet connection.'
  }
  
  // Permission errors
  if (message.includes('unauthorized') || message.includes('forbidden')) {
    return 'You don\'t have permission to access this content.'
  }
  
  // Not found errors
  if (message.includes('not found') || message.includes('404')) {
    return 'The requested content could not be found.'
  }
  
  // Server errors
  if (message.includes('server error') || message.includes('500')) {
    return 'The server is experiencing issues. Please try again later.'
  }
  
  return props.fallback
})

// Error details for development
const errorDetails = computed(() => {
  if (!currentError.value || !isDev) return null
  
  return {
    message: currentError.value.message,
    stack: currentError.value.stack,
    name: currentError.value.name,
    retryCount: retryCount.value,
    timestamp: new Date().toISOString()
  }
})

// Capture errors from child components
const errorCaptured = (error: Error, instance: any, errorInfo: string) => {
  console.error('Error captured by ErrorBoundary:', error)
  
  hasError.value = true
  currentError.value = error
  
  // Report to error handling service
  errorId.value = handleError(error, {
    component: 'ErrorBoundary',
    action: 'error-captured',
    metadata: { errorInfo, retryCount: retryCount.value }
  }, 'high')
  
  emit('error', error, errorInfo)
  props.onError?.(error, errorInfo)
  
  return false // Prevent error from bubbling up
}

// Retry functionality
const retry = async () => {
  if (retryCount.value >= props.maxRetries) return
  
  retryCount.value++
  emit('retry', retryCount.value)
  
  // Add exponential backoff delay
  const delay = Math.min(1000 * Math.pow(2, retryCount.value - 1), 5000)
  
  await new Promise(resolve => setTimeout(resolve, delay))
  
  hasError.value = false
  currentError.value = null
}

// Reset to initial state
const reset = () => {
  hasError.value = false
  currentError.value = null
  retryCount.value = 0
  errorId.value = null
  
  emit('reset')
}

// Report error to support
const reportError = async () => {
  if (!errorId.value) return
  
  try {
    await $fetch('/api/errors/report', {
      method: 'POST',
      body: {
        errorId: errorId.value,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString()
      }
    })
    
    // Show success feedback
    const { $toast } = useNuxtApp()
    $toast?.add({
      title: 'Error Reported',
      description: 'Thank you for reporting this issue.',
      variant: 'success'
    })
  } catch (reportError) {
    console.error('Failed to report error:', reportError)
    
    const { $toast } = useNuxtApp()
    $toast?.add({
      title: 'Report Failed',
      description: 'Unable to report the error. Please try again.',
      variant: 'destructive'
    })
  }
}

// Reset when props change (if enabled)
const propsHash = computed(() => JSON.stringify(props))
watch(propsHash, () => {
  if (props.resetOnPropsChange && hasError.value) {
    reset()
  }
})

// Global error handler for unhandled promise rejections in this boundary
onMounted(() => {
  window.addEventListener('unhandledrejection', handleUnhandledRejection)
})

onUnmounted(() => {
  window.removeEventListener('unhandledrejection', handleUnhandledRejection)
})

const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
  console.warn('Unhandled promise rejection caught by ErrorBoundary:', event.reason)
  
  if (event.reason instanceof Error) {
    errorCaptured(event.reason, null, 'unhandled-promise-rejection')
  }
}

// Vue error handler integration
onErrorCaptured(errorCaptured)
</script>

<style scoped>
.error-boundary {
  @apply min-h-[200px] flex items-center justify-center p-4;
}
</style>