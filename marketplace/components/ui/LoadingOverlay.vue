<template>
  <Teleport to="body">
    <div 
      v-if="isVisible" 
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      @click="handleOverlayClick"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
        <!-- Header -->
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ operation?.label || 'Loading...' }}
          </h3>
          <button
            v-if="operation?.canCancel"
            @click="handleCancel"
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <Icon name="heroicons:x-mark" class="h-5 w-5" />
          </button>
        </div>

        <!-- Progress Bar -->
        <div v-if="showProgress" class="mb-4">
          <div class="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
            <span>Progress</span>
            <span>{{ Math.round(operation?.progress || 0) }}%</span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              class="bg-marketplace-600 h-2 rounded-full transition-all duration-300 ease-out"
              :style="{ width: `${operation?.progress || 0}%` }"
            />
          </div>
        </div>

        <!-- Spinner -->
        <div v-else class="flex justify-center mb-4">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-marketplace-600" />
        </div>

        <!-- Estimated Time -->
        <div v-if="estimatedTimeRemaining" class="text-sm text-gray-500 dark:text-gray-400 text-center mb-3">
          Estimated time remaining: {{ estimatedTimeRemaining }}
        </div>

        <!-- Cancel Button -->
        <div v-if="operation?.canCancel" class="flex justify-center">
          <button
            @click="handleCancel"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
interface Props {
  visible?: boolean
  operation?: {
    id: string
    label: string
    progress?: number
    startTime: Date
    estimatedDuration?: number
    canCancel?: boolean
    onCancel?: () => void
  }
  preventClose?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  preventClose: false
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  cancel: [operationId: string]
}>()

const { primaryOperation } = useLoadingStates()

// Use provided operation or primary loading operation
const operation = computed(() => props.operation || primaryOperation.value)

// Show the overlay if explicitly visible or if there's an active operation
const isVisible = computed(() => props.visible || !!operation.value)

// Show progress bar if progress is available
const showProgress = computed(() => 
  operation.value?.progress !== undefined && operation.value.progress > 0
)

// Calculate estimated time remaining
const estimatedTimeRemaining = computed(() => {
  if (!operation.value?.estimatedDuration || !operation.value.progress) return null
  
  const elapsed = Date.now() - operation.value.startTime.getTime()
  const progress = operation.value.progress / 100
  
  if (progress <= 0) return null
  
  const totalEstimated = operation.value.estimatedDuration
  const remaining = Math.max(0, totalEstimated - elapsed)
  
  if (remaining < 1000) return 'Less than 1 second'
  if (remaining < 60000) return `${Math.round(remaining / 1000)} seconds`
  if (remaining < 3600000) return `${Math.round(remaining / 60000)} minutes`
  
  return `${Math.round(remaining / 3600000)} hours`
})

const handleOverlayClick = (event: MouseEvent) => {
  if (props.preventClose) return
  if (event.target === event.currentTarget) {
    emit('update:visible', false)
  }
}

const handleCancel = () => {
  if (operation.value?.onCancel) {
    operation.value.onCancel()
  }
  if (operation.value?.id) {
    emit('cancel', operation.value.id)
  }
  emit('update:visible', false)
}

// Auto-hide when operation completes
watch(operation, (newOp, oldOp) => {
  if (oldOp && !newOp) {
    emit('update:visible', false)
  }
})
</script>