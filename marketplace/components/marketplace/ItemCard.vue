<template>
  <article 
    :class="[
      'card hover:shadow-md transition-all duration-200 group',
      listView ? 'flex flex-row items-center' : 'flex flex-col h-full'
    ]"
  >
    <!-- Header -->
    <header :class="listView ? 'flex-1 flex items-center space-x-4 p-4' : 'card-header'">
      <!-- Icon/Logo -->
      <div :class="listView ? 'flex-shrink-0' : 'mb-3'">
        <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-marketplace-400 to-primary-500 flex items-center justify-center">
          <Icon 
            :name="getTypeIcon(item.type)" 
            class="w-6 h-6 text-white" 
          />
        </div>
      </div>

      <!-- Content -->
      <div :class="listView ? 'flex-1 min-w-0' : ''">
        <!-- Title and verification -->
        <div class="flex items-start justify-between gap-2 mb-2">
          <h3 :class="listView ? 'text-lg' : 'text-xl'">
            <NuxtLink 
              :to="`/marketplace/item/${item.id}`" 
              class="font-semibold text-gray-900 dark:text-white hover:text-marketplace-600 dark:hover:text-marketplace-400 transition-colors line-clamp-1"
            >
              {{ item.name }}
            </NuxtLink>
          </h3>
          
          <!-- Verification badge -->
          <div v-if="item.verified" class="flex-shrink-0">
            <Icon 
              name="heroicons:check-badge" 
              class="w-5 h-5 text-marketplace-500" 
              title="Verified"
            />
          </div>
          
          <!-- Featured badge -->
          <div v-if="featured" class="flex-shrink-0">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              <Icon name="heroicons:star" class="w-3 h-3 mr-1" />
              Featured
            </span>
          </div>
        </div>

        <!-- Type and category -->
        <div class="flex items-center gap-2 mb-2">
          <span class="marketplace-tag">
            {{ formatType(item.type) }}
          </span>
          <span v-if="'category' in item" class="marketplace-tag">
            {{ formatCategory(item.category) }}
          </span>
        </div>

        <!-- Author -->
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
          by {{ item.author.name }}
        </p>
      </div>
    </header>

    <!-- Description -->
    <div :class="listView ? 'flex-1 px-4' : 'card-body flex-1'">
      <p :class="[
        'text-gray-600 dark:text-gray-300 text-sm leading-relaxed',
        listView ? 'line-clamp-2' : 'line-clamp-3'
      ]">
        {{ item.description }}
      </p>

      <!-- Keywords (only show in card view) -->
      <div v-if="!listView && item.keywords.length" class="mt-3">
        <div class="flex flex-wrap gap-1">
          <span 
            v-for="keyword in item.keywords.slice(0, 4)" 
            :key="keyword"
            class="inline-block px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
          >
            {{ keyword }}
          </span>
          <span 
            v-if="item.keywords.length > 4"
            class="inline-block px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
          >
            +{{ item.keywords.length - 4 }}
          </span>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <footer :class="listView ? 'flex items-center space-x-6 px-4 py-4' : 'card-footer'">
      <!-- Stats -->
      <div :class="listView ? 'flex items-center space-x-4 text-sm' : 'flex justify-between items-center text-sm'">
        <!-- Downloads -->
        <div class="flex items-center text-gray-500 dark:text-gray-400">
          <Icon name="heroicons:arrow-down-tray" class="w-4 h-4 mr-1" />
          {{ formatNumber(item.downloads) }}
        </div>
        
        <!-- Rating -->
        <div class="flex items-center text-gray-500 dark:text-gray-400">
          <Icon name="heroicons:star" class="w-4 h-4 mr-1 text-yellow-400" />
          {{ item.rating.toFixed(1) }}
        </div>
        
        <!-- Version -->
        <div class="flex items-center text-gray-500 dark:text-gray-400">
          <Icon name="heroicons:tag" class="w-4 h-4 mr-1" />
          v{{ item.version }}
        </div>

        <!-- Updated date (only in card view) -->
        <div v-if="!listView" class="flex items-center text-gray-500 dark:text-gray-400">
          <Icon name="heroicons:clock" class="w-4 h-4 mr-1" />
          {{ formatDate(item.updatedAt) }}
        </div>
      </div>

      <!-- Actions -->
      <div :class="listView ? 'flex items-center space-x-2' : 'flex justify-between items-center mt-3'">
        <!-- View button -->
        <NuxtLink 
          :to="`/marketplace/item/${item.id}`" 
          class="btn-outline btn-sm"
        >
          View Details
        </NuxtLink>

        <!-- Action buttons -->
        <div class="flex items-center space-x-2">
          <!-- Favorite button -->
          <button 
            :class="[
              'p-2 rounded-md transition-colors',
              isFavorited ? 'text-red-500 hover:text-red-600' : 'text-gray-400 hover:text-red-500'
            ]"
            @click="toggleFavorite"
            :title="isFavorited ? 'Remove from favorites' : 'Add to favorites'"
          >
            <Icon 
              :name="isFavorited ? 'heroicons:heart-solid' : 'heroicons:heart'" 
              class="w-5 h-5" 
            />
          </button>

          <!-- Quick install/download button -->
          <button 
            class="p-2 rounded-md text-gray-400 hover:text-marketplace-500 transition-colors"
            @click="quickInstall"
            :title="item.type === 'template' ? 'Quick install' : 'Download'"
          >
            <Icon 
              :name="item.type === 'template' ? 'heroicons:plus' : 'heroicons:arrow-down-tray'" 
              class="w-5 h-5" 
            />
          </button>
        </div>
      </div>
    </footer>
  </article>
</template>

<script setup lang="ts">
import type { MarketplaceItemUnion } from '~/types/marketplace'

interface Props {
  item: MarketplaceItemUnion
  featured?: boolean
  listView?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  featured: false,
  listView: false
})

// Composables
const { toggleFavorite: toggleFav } = useMarketplaceInteractions()
const { installItem, downloadItem } = useMarketplaceDownloads()

// Reactive state
const isFavorited = ref(false) // In real app, this would come from user's favorites

// Methods
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

const formatCategory = (category: string) => {
  return category.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
}

const formatNumber = (num: number) => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toString()
}

const formatDate = (date: Date) => {
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays < 7) {
    return `${diffDays}d ago`
  } else if (diffDays < 30) {
    return `${Math.ceil(diffDays / 7)}w ago`
  } else if (diffDays < 365) {
    return `${Math.ceil(diffDays / 30)}mo ago`
  } else {
    return `${Math.ceil(diffDays / 365)}y ago`
  }
}

const toggleFavorite = async () => {
  try {
    await toggleFav(props.item.id)
    isFavorited.value = !isFavorited.value
  } catch (error) {
    console.error('Failed to toggle favorite:', error)
    // Show toast notification
  }
}

const quickInstall = async () => {
  try {
    if (props.item.type === 'template') {
      await installItem(props.item.id)
      // Show success notification
    } else {
      await downloadItem(props.item.id)
      // Show download started notification
    }
  } catch (error) {
    console.error('Failed to install/download item:', error)
    // Show error notification
  }
}
</script>