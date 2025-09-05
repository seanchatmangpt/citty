<template>
  <div>
    <!-- Hero Section -->
    <section class="marketplace-hero py-20">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 class="text-4xl md:text-6xl font-bold mb-6 text-balance">
          Discover Amazing CLI Tools
        </h1>
        <p class="text-xl md:text-2xl text-marketplace-100 mb-8 max-w-3xl mx-auto text-balance">
          Browse, download, and share templates, plugins, and workflows for the Citty Pro ecosystem.
        </p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <NuxtLink to="/marketplace" class="btn bg-white text-marketplace-600 hover:bg-gray-100 text-lg px-8 py-4">
            Explore Marketplace
          </NuxtLink>
          <NuxtLink to="/publish" class="btn border border-white text-white hover:bg-white/10 text-lg px-8 py-4">
            Publish Your Tool
          </NuxtLink>
        </div>
        
        <!-- Search Bar -->
        <div class="mt-12 max-w-2xl mx-auto">
          <div class="relative">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search for templates, plugins, workflows..."
              class="w-full px-6 py-4 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20 text-lg"
              @keypress.enter="handleSearch"
            />
            <button 
              class="absolute right-2 top-2 p-2 text-gray-500 hover:text-gray-700 transition-colors"
              @click="handleSearch"
            >
              <Icon name="heroicons:magnifying-glass" class="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Stats Section -->
    <section class="py-12 bg-white dark:bg-gray-800">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div class="text-3xl font-bold text-marketplace-600 dark:text-marketplace-400">1,200+</div>
            <div class="text-gray-600 dark:text-gray-300 mt-2">Templates</div>
          </div>
          <div>
            <div class="text-3xl font-bold text-marketplace-600 dark:text-marketplace-400">850+</div>
            <div class="text-gray-600 dark:text-gray-300 mt-2">Plugins</div>
          </div>
          <div>
            <div class="text-3xl font-bold text-marketplace-600 dark:text-marketplace-400">450+</div>
            <div class="text-gray-600 dark:text-gray-300 mt-2">Workflows</div>
          </div>
          <div>
            <div class="text-3xl font-bold text-marketplace-600 dark:text-marketplace-400">2.5M+</div>
            <div class="text-gray-600 dark:text-gray-300 mt-2">Downloads</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Featured Section -->
    <section class="py-16 bg-gray-50 dark:bg-gray-900">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-12">
          <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Featured This Week
          </h2>
          <p class="text-gray-600 dark:text-gray-300 text-lg max-w-2xl mx-auto">
            Hand-picked tools that are making waves in the community
          </p>
        </div>

        <div v-if="featuredLoading" class="marketplace-grid">
          <MarketplaceItemSkeleton v-for="i in 6" :key="i" />
        </div>
        
        <div v-else-if="featured.length" class="marketplace-grid">
          <MarketplaceItemCard
            v-for="item in featured"
            :key="item.id"
            :item="item"
            :featured="true"
          />
        </div>

        <div class="text-center mt-8">
          <NuxtLink to="/marketplace?featured=true" class="btn-outline">
            View All Featured
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Categories Section -->
    <section class="py-16 bg-white dark:bg-gray-800">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-12">
          <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Browse by Category
          </h2>
          <p class="text-gray-600 dark:text-gray-300 text-lg">
            Find exactly what you need for your next project
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <CategoryCard
            v-for="category in categories"
            :key="category.slug"
            :category="category"
          />
        </div>
      </div>
    </section>

    <!-- Popular Section -->
    <section class="py-16 bg-gray-50 dark:bg-gray-900">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-12">
          <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Most Popular
          </h2>
          <p class="text-gray-600 dark:text-gray-300 text-lg">
            Top downloaded tools this month
          </p>
        </div>

        <div v-if="popularLoading" class="marketplace-grid">
          <MarketplaceItemSkeleton v-for="i in 9" :key="i" />
        </div>
        
        <div v-else-if="popular.length" class="marketplace-grid">
          <MarketplaceItemCard
            v-for="item in popular"
            :key="item.id"
            :item="item"
          />
        </div>

        <div class="text-center mt-8">
          <NuxtLink to="/marketplace?sort=downloads" class="btn-outline">
            View All Popular
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="py-16 bg-marketplace-600 dark:bg-marketplace-700">
      <div class="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
        <h2 class="text-3xl font-bold text-white mb-4">
          Ready to Share Your Creation?
        </h2>
        <p class="text-marketplace-100 text-lg mb-8 max-w-2xl mx-auto">
          Join thousands of developers sharing their CLI tools, templates, and workflows with the community.
        </p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <NuxtLink to="/publish" class="btn bg-white text-marketplace-600 hover:bg-gray-100 text-lg px-8 py-4">
            Publish Now
          </NuxtLink>
          <NuxtLink to="/docs/publishing" class="btn border border-white text-white hover:bg-white/10 text-lg px-8 py-4">
            Learn More
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import type { MarketplaceItemUnion } from '~/types/marketplace'

// Meta tags
useHead({
  title: 'Home',
  meta: [
    { name: 'description', content: 'Discover and share Citty Pro CLI tools, templates, and workflows. Browse thousands of community-created tools.' },
    { property: 'og:title', content: 'Citty Pro Marketplace - CLI Tools & Templates' },
    { property: 'og:description', content: 'Discover and share CLI tools, templates, and workflows for developers.' }
  ]
})

// Composables
const { getFeatured, getPopular } = useMarketplace()

// Reactive data
const searchQuery = ref('')
const featured = ref<MarketplaceItemUnion[]>([])
const popular = ref<MarketplaceItemUnion[]>([])
const featuredLoading = ref(true)
const popularLoading = ref(true)

// Categories data
const categories = [
  {
    name: 'Templates',
    slug: 'templates',
    description: 'Ready-to-use project templates',
    icon: 'heroicons:document-duplicate',
    count: 1200,
    color: 'bg-blue-500'
  },
  {
    name: 'Plugins',
    slug: 'plugins',
    description: 'Extend CLI functionality',
    icon: 'heroicons:puzzle-piece',
    count: 850,
    color: 'bg-green-500'
  },
  {
    name: 'Workflows',
    slug: 'workflows',
    description: 'Automated development workflows',
    icon: 'heroicons:cog-6-tooth',
    count: 450,
    color: 'bg-purple-500'
  },
  {
    name: 'Themes',
    slug: 'themes',
    description: 'Customize your CLI appearance',
    icon: 'heroicons:paint-brush',
    count: 120,
    color: 'bg-pink-500'
  }
]

// Methods
const handleSearch = () => {
  if (searchQuery.value.trim()) {
    navigateTo(`/marketplace?q=${encodeURIComponent(searchQuery.value.trim())}`)
  }
}

// Load data
onMounted(async () => {
  try {
    const [featuredData, popularData] = await Promise.all([
      getFeatured().finally(() => { featuredLoading.value = false }),
      getPopular('all', 9).finally(() => { popularLoading.value = false })
    ])
    
    featured.value = featuredData
    popular.value = popularData
  } catch (error) {
    console.error('Error loading homepage data:', error)
  }
})
</script>