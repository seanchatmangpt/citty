<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-50 space-y-2">
      <transition-group
        name="toast"
        tag="div"
        class="space-y-2"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="[
            'max-w-sm p-4 rounded-lg shadow-lg border',
            'transform transition-all duration-300',
            getToastClasses(toast.type)
          ]"
        >
          <div class="flex items-start">
            <!-- Icon -->
            <div class="flex-shrink-0">
              <Icon 
                :name="getToastIcon(toast.type)" 
                :class="[
                  'h-5 w-5',
                  getIconClasses(toast.type)
                ]" 
              />
            </div>
            
            <!-- Content -->
            <div class="ml-3 flex-1">
              <p v-if="toast.title" class="text-sm font-medium mb-1">
                {{ toast.title }}
              </p>
              <p class="text-sm">
                {{ toast.message }}
              </p>
            </div>
            
            <!-- Close button -->
            <button
              class="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              @click="removeToast(toast.id)"
            >
              <Icon name="heroicons:x-mark" class="h-4 w-4" />
            </button>
          </div>
        </div>
      </transition-group>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title?: string
  message: string
  duration?: number
}

// Toast store (in a real app, this might be in a Pinia store)
const toasts = ref<Toast[]>([])

// Methods
const addToast = (toast: Omit<Toast, 'id'>) => {
  const id = Date.now().toString()
  const newToast: Toast = {
    id,
    duration: 5000,
    ...toast
  }
  
  toasts.value.push(newToast)
  
  // Auto-remove after duration
  if (newToast.duration && newToast.duration > 0) {
    setTimeout(() => {
      removeToast(id)
    }, newToast.duration)
  }
}

const removeToast = (id: string) => {
  const index = toasts.value.findIndex(toast => toast.id === id)
  if (index > -1) {
    toasts.value.splice(index, 1)
  }
}

const getToastClasses = (type: Toast['type']) => {
  const classes = {
    success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200',
    error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200',
    info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200'
  }
  return classes[type]
}

const getToastIcon = (type: Toast['type']) => {
  const icons = {
    success: 'heroicons:check-circle',
    error: 'heroicons:x-circle',
    warning: 'heroicons:exclamation-triangle',
    info: 'heroicons:information-circle'
  }
  return icons[type]
}

const getIconClasses = (type: Toast['type']) => {
  const classes = {
    success: 'text-green-500',
    error: 'text-red-500',
    warning: 'text-yellow-500',
    info: 'text-blue-500'
  }
  return classes[type]
}

// Global toast function
const showToast = (toast: Omit<Toast, 'id'>) => {
  addToast(toast)
}

// Provide toast functions globally
provide('showToast', showToast)

// Export for composable use
defineExpose({
  showToast,
  addToast,
  removeToast
})
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-move {
  transition: transform 0.3s ease;
}
</style>