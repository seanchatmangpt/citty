<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        Browse Marketplace
      </h1>
      <p class="text-gray-600 dark:text-gray-300 text-lg">
        Discover CLI tools, templates, plugins, and workflows created by the community.
      </p>
    </div>

    <!-- Search and Filters -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
      <!-- Search Bar -->
      <div class="mb-6">
        <div class="relative max-w-2xl">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search templates, plugins, workflows..."
            class="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-marketplace-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            @input="debouncedSearch"
          />
          <Icon name="heroicons:magnifying-glass" class="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
          <button
            v-if="searchQuery"
            @click="clearSearch"
            class="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <Icon name="heroicons:x-mark" class="h-5 w-5" />
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap gap-4">
        <!-- Type Filter -->
        <div class="flex-1 min-w-[200px]">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Type
          </label>
          <select
            v-model="selectedType"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-marketplace-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            @change="handleFilterChange"
          >
            <option value="all">All Types</option>
            <option value="template">Templates</option>
            <option value="plugin">Plugins</option>
            <option value="workflow">Workflows</option>
            <option value="theme">Themes</option>
          </select>
        </div>

        <!-- Category Filter -->
        <div class="flex-1 min-w-[200px]">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Category
          </label>
          <select
            v-model="selectedCategory"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-marketplace-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            @change="handleFilterChange"
          >
            <option value="">All Categories</option>
            <option v-for="category in availableCategories" :key="category" :value="category">
              {{ formatCategoryName(category) }}
            </option>
          </select>
        </div>

        <!-- Sort Filter -->
        <div class="flex-1 min-w-[200px]">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Sort By
          </label>
          <select
            v-model="selectedSort"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-marketplace-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            @change="handleSortChange"
          >
            <option value="downloads:desc">Most Downloaded</option>
            <option value="rating:desc">Highest Rated</option>
            <option value="updated:desc">Recently Updated</option>
            <option value="created:desc">Newest</option>
            <option value="name:asc">Name A-Z</option>
            <option value="name:desc">Name Z-A</option>
          </select>
        </div>

        <!-- Verified Filter -->
        <div class="flex items-end">
          <label class="flex items-center">
            <input
              v-model="verifiedOnly"
              type="checkbox"
              class="rounded border-gray-300 dark:border-gray-600 text-marketplace-600 focus:ring-marketplace-500 dark:bg-gray-700"
              @change="handleFilterChange"
            />
            <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Verified only</span>
          </label>
        </div>
      </div>

      <!-- Active Filters -->
      <div v-if="hasActiveFilters" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-sm text-gray-600 dark:text-gray-400">Active filters:</span>
          
          <span v-if="searchQuery" class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-marketplace-100 text-marketplace-800 dark:bg-marketplace-900 dark:text-marketplace-200">
            Search: "{{ searchQuery }}"
            <button @click="clearSearch" class="ml-1 text-marketplace-600 hover:text-marketplace-800">
              <Icon name="heroicons:x-mark" class="h-3 w-3" />
            </button>
          </span>
          
          <span v-if="selectedType !== 'all'" class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-marketplace-100 text-marketplace-800 dark:bg-marketplace-900 dark:text-marketplace-200">
            Type: {{ selectedType }}
            <button @click="selectedType = 'all'; handleFilterChange()" class="ml-1 text-marketplace-600 hover:text-marketplace-800">
              <Icon name="heroicons:x-mark" class="h-3 w-3" />
            </button>
          </span>
          
          <span v-if="selectedCategory" class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-marketplace-100 text-marketplace-800 dark:bg-marketplace-900 dark:text-marketplace-200">
            Category: {{ formatCategoryName(selectedCategory) }}
            <button @click="selectedCategory = ''; handleFilterChange()" class="ml-1 text-marketplace-600 hover:text-marketplace-800">
              <Icon name="heroicons:x-mark" class="h-3 w-3" />
            </button>
          </span>
          
          <span v-if="verifiedOnly" class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-marketplace-100 text-marketplace-800 dark:bg-marketplace-900 dark:text-marketplace-200">
            Verified only
            <button @click="verifiedOnly = false; handleFilterChange()" class="ml-1 text-marketplace-600 hover:text-marketplace-800">
              <Icon name="heroicons:x-mark" class="h-3 w-3" />
            </button>
          </span>
          
          <button @click="clearAllFilters" class="text-sm text-marketplace-600 hover:text-marketplace-800 font-medium">
            Clear all
          </button>
        </div>
      </div>
    </div>

    <!-- Results -->
    <div class="mb-6 flex justify-between items-center">
      <p class="text-gray-600 dark:text-gray-300">
        <span v-if="loading">Searching...</span>
        <span v-else>{{ total }} result{{ total !== 1 ? 's' : '' }}</span>
      </p>
      
      <!-- View Toggle -->
      <div class="flex items-center space-x-2">
        <button
          :class="['p-2 rounded-md transition-colors', viewMode === 'grid' ? 'bg-marketplace-100 text-marketplace-600 dark:bg-marketplace-900 dark:text-marketplace-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300']"
          @click="viewMode = 'grid'"
        >
          <Icon name="heroicons:squares-2x2" class="h-5 w-5" />
        </button>
        <button
          :class="['p-2 rounded-md transition-colors', viewMode === 'list' ? 'bg-marketplace-100 text-marketplace-600 dark:bg-marketplace-900 dark:text-marketplace-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300']"
          @click="viewMode = 'list'"
        >
          <Icon name="heroicons:list-bullet" class="h-5 w-5" />
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" :class="viewMode === 'grid' ? 'marketplace-grid' : 'space-y-4'">
      <MarketplaceItemSkeleton v-for="i in 12" :key="i" :list-view="viewMode === 'list'" />
    </div>

    <!-- No Results -->
    <div v-else-if="!items.length" class="text-center py-12">
      <Icon name="heroicons:magnifying-glass" class="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No results found</h3>
      <p class="text-gray-600 dark:text-gray-300 mb-4">
        Try adjusting your search terms or filters to find what you're looking for.
      </p>
      <button @click="clearAllFilters" class="btn-primary">
        Clear All Filters
      </button>
    </div>

    <!-- Results Grid/List -->
    <div v-else>
      <div :class="viewMode === 'grid' ? 'marketplace-grid' : 'space-y-4'">
        <MarketplaceItemCard
          v-for="item in items"
          :key="item.id"
          :item="item"
          :list-view="viewMode === 'list'"
        />
      </div>

      <!-- Load More -->
      <div v-if="hasMore" class="mt-12 text-center">
        <button 
          :disabled="loading"
          @click="loadMore"
          class="btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="loading">Loading...</span>
          <span v-else>Load More</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ItemType } from '~/types/marketplace'

// Meta
useHead({
  title: 'Browse Marketplace',
  meta: [
    { name: 'description', content: 'Browse and discover CLI tools, templates, plugins, and workflows in the Citty Pro marketplace.' }
  ]
})

// Composables
const route = useRoute()
const router = useRouter()
const { items, loading, total, hasMore, search, loadMore, setSearchQuery, setType, setSort, clearFilters } = useMarketplace()

// Reactive state
const searchQuery = ref('')
const selectedType = ref<ItemType | 'all'>('all')
const selectedCategory = ref('')
const selectedSort = ref('downloads:desc')
const verifiedOnly = ref(false)
const viewMode = ref<'grid' | 'list'>('grid')

// Available categories based on type
const availableCategories = computed(() => {
  const categoryMap = {
    template: ['cli', 'api', 'web', 'mobile', 'desktop', 'library', 'other'],
    plugin: ['authentication', 'validation', 'logging', 'testing', 'deployment', 'other'],
    workflow: ['ci-cd', 'testing', 'deployment', 'development', 'automation', 'other'],
    theme: [],
  }
  
  return selectedType.value === 'all' 
    ? Object.values(categoryMap).flat()
    : categoryMap[selectedType.value] || []
})

// Check if there are active filters
const hasActiveFilters = computed(() => {
  return searchQuery.value || selectedType.value !== 'all' || selectedCategory.value || verifiedOnly.value
})

// Debounced search
let searchTimeout: NodeJS.Timeout
const debouncedSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    setSearchQuery(searchQuery.value)
    updateURL()
  }, 300)
}

// Handle filter changes
const handleFilterChange = () => {
  const filters = {
    query: searchQuery.value,
    type: selectedType.value,
    category: selectedCategory.value || undefined,
    verified: verifiedOnly.value || undefined,
  }
  
  search(filters)
  updateURL()
}

// Handle sort change
const handleSortChange = () => {
  const [sortBy, sortOrder] = selectedSort.value.split(':')
  setSort(sortBy as any, sortOrder as any)
  updateURL()
}

// Clear search
const clearSearch = () => {
  searchQuery.value = ''
  setSearchQuery('')
  updateURL()
}

// Clear all filters
const clearAllFilters = () => {
  searchQuery.value = ''
  selectedType.value = 'all'
  selectedCategory.value = ''
  verifiedOnly.value = false
  selectedSort.value = 'downloads:desc'
  clearFilters()
  updateURL()
}

// Update URL with current filters
const updateURL = () => {
  const query: Record<string, any> = {}
  
  if (searchQuery.value) query.q = searchQuery.value
  if (selectedType.value !== 'all') query.type = selectedType.value
  if (selectedCategory.value) query.category = selectedCategory.value
  if (verifiedOnly.value) query.verified = 'true'
  if (selectedSort.value !== 'downloads:desc') query.sort = selectedSort.value
  
  router.replace({ query })
}

// Format category name
const formatCategoryName = (category: string) => {
  return category.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
}

// Initialize from URL params
onMounted(() => {
  // Set initial values from URL
  if (route.query.q) searchQuery.value = route.query.q as string
  if (route.query.type) selectedType.value = route.query.type as ItemType | 'all'
  if (route.query.category) selectedCategory.value = route.query.category as string
  if (route.query.verified) verifiedOnly.value = route.query.verified === 'true'
  if (route.query.sort) selectedSort.value = route.query.sort as string
  
  // Perform initial search
  handleFilterChange()
  if (selectedSort.value !== 'downloads:desc') {
    handleSortChange()
  }
})

// Watch for category changes when type changes
watch(selectedType, (newType, oldType) => {
  if (newType !== oldType && selectedCategory.value) {
    // Clear category if it's not available for the new type
    if (!availableCategories.value.includes(selectedCategory.value)) {
      selectedCategory.value = ''
    }
  }
})
</script>