/**
 * Loading States Management Composable
 * Provides centralized loading state management with smart batching and UI feedback
 */

export interface LoadingOperation {
  id: string
  label: string
  progress?: number
  startTime: Date
  estimatedDuration?: number
  canCancel?: boolean
  onCancel?: () => void
}

export const useLoadingStates = () => {
  const operations = ref<Map<string, LoadingOperation>>(new Map())
  
  // Generate unique operation ID
  const generateOperationId = () => {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Start a loading operation
  const startLoading = (
    label: string,
    options: {
      id?: string
      estimatedDuration?: number
      canCancel?: boolean
      onCancel?: () => void
    } = {}
  ): string => {
    const id = options.id || generateOperationId()
    
    const operation: LoadingOperation = {
      id,
      label,
      startTime: new Date(),
      estimatedDuration: options.estimatedDuration,
      canCancel: options.canCancel,
      onCancel: options.onCancel,
      progress: 0
    }

    operations.value.set(id, operation)
    return id
  }

  // Update loading progress
  const updateProgress = (id: string, progress: number, label?: string) => {
    const operation = operations.value.get(id)
    if (operation) {
      operation.progress = Math.max(0, Math.min(100, progress))
      if (label) {
        operation.label = label
      }
      operations.value.set(id, operation)
    }
  }

  // Finish a loading operation
  const finishLoading = (id: string) => {
    operations.value.delete(id)
  }

  // Cancel a loading operation
  const cancelLoading = (id: string) => {
    const operation = operations.value.get(id)
    if (operation?.canCancel && operation.onCancel) {
      operation.onCancel()
    }
    operations.value.delete(id)
  }

  // Check if any operation is loading
  const isLoading = computed(() => operations.value.size > 0)

  // Get specific operation loading state
  const isOperationLoading = (id: string) => {
    return computed(() => operations.value.has(id))
  }

  // Get all active operations
  const activeOperations = computed(() => Array.from(operations.value.values()))

  // Get primary loading operation (longest running or highest progress)
  const primaryOperation = computed((): LoadingOperation | null => {
    if (operations.value.size === 0) return null
    
    const ops = Array.from(operations.value.values())
    
    // Prioritize operations with progress information
    const withProgress = ops.filter(op => op.progress !== undefined && op.progress > 0)
    if (withProgress.length > 0) {
      return withProgress.reduce((a, b) => (a.progress || 0) > (b.progress || 0) ? a : b)
    }
    
    // Otherwise, return the longest running operation
    return ops.reduce((a, b) => a.startTime < b.startTime ? a : b)
  })

  // Loading statistics
  const loadingStats = computed(() => {
    const ops = Array.from(operations.value.values())
    const totalOperations = ops.length
    const averageProgress = ops.reduce((sum, op) => sum + (op.progress || 0), 0) / totalOperations || 0
    const longestRunning = ops.reduce((longest, op) => {
      const duration = Date.now() - op.startTime.getTime()
      return duration > longest ? duration : longest
    }, 0)

    return {
      totalOperations,
      averageProgress,
      longestRunningDuration: longestRunning,
      canCancelAny: ops.some(op => op.canCancel)
    }
  })

  // Utility functions for common loading patterns
  const withLoading = async <T>(
    operation: () => Promise<T>,
    label: string,
    options: {
      onProgress?: (progress: number) => void
      onCancel?: () => void
      estimatedDuration?: number
    } = {}
  ): Promise<T> => {
    const id = startLoading(label, {
      estimatedDuration: options.estimatedDuration,
      canCancel: !!options.onCancel,
      onCancel: options.onCancel
    })

    try {
      // Set up progress tracking if provided
      if (options.onProgress) {
        const progressInterval = setInterval(() => {
          const op = operations.value.get(id)
          if (op && options.onProgress) {
            options.onProgress(op.progress || 0)
          }
        }, 100)
        
        try {
          const result = await operation()
          clearInterval(progressInterval)
          return result
        } catch (error) {
          clearInterval(progressInterval)
          throw error
        }
      } else {
        return await operation()
      }
    } finally {
      finishLoading(id)
    }
  }

  // Smart loading for multiple concurrent operations
  const batchLoading = async <T>(
    operations: Array<{
      operation: () => Promise<T>
      label: string
      weight?: number
    }>,
    overallLabel: string = 'Processing...'
  ): Promise<T[]> => {
    const batchId = startLoading(overallLabel)
    const totalWeight = operations.reduce((sum, op) => sum + (op.weight || 1), 0)
    let completedWeight = 0

    try {
      const results = await Promise.all(
        operations.map(async ({ operation, label, weight = 1 }) => {
          const opId = startLoading(label)
          try {
            const result = await operation()
            completedWeight += weight
            updateProgress(batchId, (completedWeight / totalWeight) * 100, overallLabel)
            return result
          } finally {
            finishLoading(opId)
          }
        })
      )
      
      return results
    } finally {
      finishLoading(batchId)
    }
  }

  // Auto-cleanup long-running operations
  const cleanupStaleOperations = (maxDurationMs: number = 300000) => { // 5 minutes
    const now = Date.now()
    const staleIds: string[] = []
    
    operations.value.forEach((operation, id) => {
      if (now - operation.startTime.getTime() > maxDurationMs) {
        staleIds.push(id)
      }
    })
    
    staleIds.forEach(id => {
      console.warn(`Cleaning up stale loading operation: ${id}`)
      operations.value.delete(id)
    })
    
    return staleIds.length
  }

  // Set up auto-cleanup
  if (process.client) {
    const cleanupInterval = setInterval(() => {
      cleanupStaleOperations()
    }, 60000) // Check every minute

    onUnmounted(() => {
      clearInterval(cleanupInterval)
    })
  }

  return {
    // State
    isLoading,
    activeOperations,
    primaryOperation,
    loadingStats,
    
    // Methods
    startLoading,
    updateProgress,
    finishLoading,
    cancelLoading,
    isOperationLoading,
    
    // Utilities
    withLoading,
    batchLoading,
    cleanupStaleOperations
  }
}