<template>
  <!-- Modal Overlay -->
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 overflow-y-auto"
      @click="$emit('update:open', false)"
    >
      <div class="flex min-h-full items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="fixed inset-0 bg-black/25 backdrop-blur-sm transition-opacity"></div>
        
        <!-- Modal Content -->
        <div 
          class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl transform transition-all"
          @click.stop
        >
          <!-- Header -->
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                Search Marketplace
              </h3>
              <button
                class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                @click="$emit('update:open', false)"
              >
                <Icon name="heroicons:x-mark" class="h-5 w-5" />
              </button>
            </div>
          </div>

          <!-- Search Input -->
          <div class="p-6">
            <div class="relative">
              <Icon name="heroicons:magnifying-glass" class="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
              <input
                v-model="searchQuery"
                ref="searchInput"
                type="text"
                placeholder="Search for templates, plugins, workflows..."
                class="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-marketplace-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-lg"
                @keydown.enter="handleSearch"
                @keydown.escape="$emit('update:open', false)"
              />
              <div class="absolute right-3 top-3.5 text-sm text-gray-400">
                <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">ESC</kbd>
              </div>
            </div>

            <!-- Recent searches -->
            <div v-if="recentSearches.length && !searchQuery" class="mt-4">
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recent Searches</h4>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="search in recentSearches"
                  :key="search"
                  class="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  @click="selectRecentSearch(search)"
                >
                  {{ search }}
                </button>
              </div>
            </div>

            <!-- Quick filters -->
            <div v-if="!searchQuery" class="mt-6">
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Quick Filters</h4>
              <div class="grid grid-cols-2 gap-3">
                <button
                  v-for="filter in quickFilters"
                  :key="filter.value"
                  class="flex items-center p-3 text-left bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  @click="selectQuickFilter(filter)"
                >
                  <Icon :name="filter.icon" class="h-5 w-5 text-gray-500 dark:text-gray-400 mr-3" />
                  <div>
                    <div class="text-sm font-medium text-gray-900 dark:text-white">{{ filter.label }}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">{{ filter.description }}</div>
                  </div>
                </button>
              </div>
            </div>

            <!-- Search results preview -->
            <div v-if="searchQuery && searchResults.length" class="mt-6">
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Quick Results</h4>
              <div class="space-y-2 max-h-64 overflow-y-auto">
                <NuxtLink
                  v-for="result in searchResults.slice(0, 5)"
                  :key="result.id"
                  :to="`/marketplace/item/${result.id}`"
                  class="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors group"
                  @click="$emit('update:open', false)"
                >
                  <div class="w-8 h-8 rounded bg-gradient-to-br from-marketplace-400 to-primary-500 flex items-center justify-center mr-3">
                    <Icon 
                      :name="getTypeIcon(result.type)" 
                      class="w-4 h-4 text-white" 
                    />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-gray-900 dark:text-white group-hover:text-marketplace-600 dark:group-hover:text-marketplace-400">
                      {{ result.name }}
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {{ result.description }}
                    </div>
                  </div>
                  <div class="text-xs text-gray-400 ml-2">
                    {{ formatType(result.type) }}
                  </div>
                </NuxtLink>
              </div>
              
              <button
                v-if="searchResults.length > 5"
                class="w-full mt-3 py-2 text-sm text-marketplace-600 dark:text-marketplace-400 hover:text-marketplace-700 dark:hover:text-marketplace-300 font-medium"
                @click="viewAllResults"
              >
                View all {{ searchResults.length }} results →
              </button>
            </div>

            <!-- No results -->
            <div v-if="searchQuery && !searchLoading && !searchResults.length" class="mt-6 text-center py-8">
              <Icon name="heroicons:magnifying-glass" class="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p class="text-gray-500 dark:text-gray-400">No results found for "{{ searchQuery }}"</p>
              <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Try different keywords or browse categories</p>
            </div>

            <!-- Loading -->
            <div v-if="searchLoading" class="mt-6 text-center py-8">
              <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-marketplace-600"></div>
              <p class="text-gray-500 dark:text-gray-400 mt-2">Searching...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { MarketplaceItemUnion } from '~/types/marketplace'

interface Props {
  open: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

// Composables
const router = useRouter()

// Reactive state
const searchQuery = ref('')
const searchResults = ref<MarketplaceItemUnion[]>([])
const searchLoading = ref(false)
const searchInput = ref<HTMLInputElement>()

// Recent searches from localStorage
const recentSearches = ref<string[]>([])

// Load recent searches from localStorage
onMounted(() => {
  if (process.client) {
    const stored = localStorage.getItem('recent-searches')
    if (stored) {
      try {
        recentSearches.value = JSON.parse(stored).slice(0, 5) // Keep only last 5
      } catch (e) {
        console.warn('Failed to parse stored searches:', e)
        recentSearches.value = []
      }
    }
  }
})

// Quick filter options
const quickFilters = [
  {
    label: 'Templates',
    description: 'Ready-to-use project templates',
    value: 'templates',
    icon: 'heroicons:document-duplicate'
  },
  {
    label: 'Plugins',
    description: 'Extend CLI functionality',
    value: 'plugins',
    icon: 'heroicons:puzzle-piece'
  },
  {
    label: 'Workflows',
    description: 'Automated development workflows',
    value: 'workflows',
    icon: 'heroicons:cog-6-tooth'
  },
  {
    label: 'Featured',
    description: 'Hand-picked by the community',
    value: 'featured',
    icon: 'heroicons:star'
  }
]

// Watch for search query changes
let searchTimeout: NodeJS.Timeout
watch(searchQuery, (newQuery) => {
  if (!newQuery.trim()) {
    searchResults.value = []
    return
  }
  
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(async () => {
    await performSearch(newQuery)
  }, 300)
})

// Focus input when modal opens
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    nextTick(() => {
      searchInput.value?.focus()
    })
  } else {
    // Clear search when modal closes
    searchQuery.value = ''
    searchResults.value = []
  }
})

// Methods
const performSearch = async (query: string) => {
  if (!query.trim()) return
  
  searchLoading.value = true
  try {
    // Real API call to dimensional search endpoint
    const response = await $fetch('/api/marketplace/search', {
      query: { 
        q: query.trim(), 
        limit: 10,
        sortBy: 'downloads',
        sortOrder: 'desc'
      }
    })
    
    searchResults.value = response.items || []
    
    // Track search activity if WebSocket is available
    const { trackSearchQuery } = useWebSocket({ autoConnect: false })
    trackSearchQuery(query, { modal: true, resultsCount: searchResults.value.length })
    
  } catch (error: any) {
    console.error('Search error:', error)
    searchResults.value = []
    
    // Show user-friendly error message
    if (error.statusCode === 400) {
      // Handle validation errors gracefully
      console.warn('Invalid search parameters:', error.data)
    } else if (error.statusCode >= 500) {
      // Server error - could show a toast notification
      console.error('Server error during search:', error.message)
    }
  } finally {
    searchLoading.value = false
  }
}

const handleSearch = () => {
  if (!searchQuery.value.trim()) return
  
  const query = searchQuery.value.trim()
  
  // Add to recent searches and persist to localStorage
  if (!recentSearches.value.includes(query)) {
    recentSearches.value.unshift(query)
    recentSearches.value = recentSearches.value.slice(0, 5)
    
    // Save to localStorage
    if (process.client) {
      try {
        localStorage.setItem('recent-searches', JSON.stringify(recentSearches.value))
      } catch (e) {
        console.warn('Failed to save recent searches:', e)
      }
    }
  }
  
  // Navigate to search results with proper query encoding
  const searchParams = new URLSearchParams({ q: query })
  router.push(`/marketplace?${searchParams.toString()}`)
  emit('update:open', false)
}

const selectRecentSearch = (search: string) => {
  searchQuery.value = search
}

const selectQuickFilter = (filter: typeof quickFilters[0]) => {
  let route = '/marketplace'
  
  if (filter.value === 'featured') {
    route += '?featured=true'
  } else {
    route += `?type=${filter.value.slice(0, -1)}` // Remove 's' from plural
  }
  
  router.push(route)
  emit('update:open', false)
}

const viewAllResults = () => {
  handleSearch()
}

const getTypeIcon = (type: string) => {
  const icons = {
    template: 'heroicons:document-duplicate',
    plugin: 'heroicons:puzzle-piece',
    workflow: 'heroicons:cog-6-tooth',
    theme: 'heroicons:paint-brush'
  }
  return icons[type as keyof typeof icons] || 'heroicons:cube'
}

const formatType = (type: string) => {
  return type.charAt(0).toUpperCase() + type.slice(1)
}
</script>