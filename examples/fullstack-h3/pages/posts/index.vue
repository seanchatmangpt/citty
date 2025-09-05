<template>
  <div class="max-w-6xl mx-auto px-4 py-8">
    <header class="mb-8">
      <h1 class="text-4xl font-bold text-gray-900 mb-4">Blog Posts</h1>
      <p class="text-gray-600">Powered by H3 + UnJucks semantic templates</p>
    </header>

    <!-- Filters -->
    <div class="mb-8 bg-white rounded-lg shadow p-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Status</label>
          <select v-model="filters.status" class="w-full border rounded-md px-3 py-2">
            <option value="">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Tag</label>
          <select v-model="filters.tag" class="w-full border rounded-md px-3 py-2">
            <option value="">All Tags</option>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="vue">Vue</option>
            <option value="nuxt">Nuxt</option>
            <option value="h3">H3</option>
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Search</label>
          <input 
            v-model="filters.search" 
            type="text" 
            placeholder="Search posts..."
            class="w-full border rounded-md px-3 py-2"
          >
        </div>
      </div>
      
      <div class="mt-4 flex gap-2">
        <button 
          @click="applyFilters" 
          class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Apply Filters
        </button>
        <button 
          @click="clearFilters" 
          class="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
        >
          Clear
        </button>
      </div>
    </div>

    <!-- Posts Grid -->
    <div v-if="pending" class="text-center py-8">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p class="mt-2 text-gray-600">Loading posts...</p>
    </div>

    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-6">
      <h3 class="text-red-800 font-medium">Error loading posts</h3>
      <p class="text-red-600 mt-1">{{ error.message }}</p>
    </div>

    <div v-else class="space-y-8">
      <!-- Posts List -->
      <div class="grid gap-6">
        <article 
          v-for="post in posts" 
          :key="post.id"
          class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
        >
          <div class="md:flex">
            <div class="md:w-48">
              <img 
                :src="post.featuredImage" 
                :alt="post.title"
                class="w-full h-48 md:h-full object-cover"
              >
            </div>
            <div class="p-6 flex-1">
              <div class="flex items-center justify-between mb-2">
                <span :class="{
                  'bg-green-100 text-green-800': post.status === 'published',
                  'bg-yellow-100 text-yellow-800': post.status === 'draft',
                  'bg-gray-100 text-gray-800': post.status === 'archived'
                }" class="px-2 py-1 rounded text-xs font-medium">
                  {{ post.status }}
                </span>
                <span class="text-sm text-gray-500">{{ post.readTime }} min read</span>
              </div>
              
              <h2 class="text-xl font-bold text-gray-900 mb-2">
                <NuxtLink :to="`/posts/${post.slug}`" class="hover:text-blue-600">
                  {{ post.title }}
                </NuxtLink>
              </h2>
              
              <p class="text-gray-600 mb-4">{{ post.excerpt }}</p>
              
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <img 
                    :src="post.author.avatar" 
                    :alt="post.author.firstName"
                    class="w-8 h-8 rounded-full mr-2"
                  >
                  <span class="text-sm text-gray-700">
                    {{ post.author.firstName }} {{ post.author.lastName }}
                  </span>
                </div>
                
                <div class="flex gap-1">
                  <span 
                    v-for="tag in post.tags.slice(0, 3)" 
                    :key="tag"
                    class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>
              
              <div class="mt-4 text-xs text-gray-500">
                Published {{ new Date(post.publishedAt).toLocaleDateString() }} • 
                {{ post.viewCount }} views
              </div>
            </div>
          </div>
        </article>
      </div>

      <!-- Pagination -->
      <div v-if="meta?.pagination" class="flex justify-center items-center gap-2">
        <button 
          @click="changePage(meta.pagination.page - 1)"
          :disabled="meta.pagination.page <= 1"
          class="px-3 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        
        <span class="px-4 py-2">
          Page {{ meta.pagination.page }} of {{ meta.pagination.totalPages }}
          ({{ meta.pagination.total }} total)
        </span>
        
        <button 
          @click="changePage(meta.pagination.page + 1)"
          :disabled="meta.pagination.page >= meta.pagination.totalPages"
          class="px-3 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()

// Reactive filters
const filters = reactive({
  status: route.query.status as string || '',
  tag: route.query.tag as string || '',
  search: route.query.search as string || '',
  page: parseInt(route.query.page as string) || 1,
  limit: 10
})

// Fetch posts with semantic API
const { data: response, pending, error, refresh } = await useFetch('/api/posts', {
  query: computed(() => ({
    page: filters.page,
    limit: filters.limit,
    ...(filters.status && { status: filters.status }),
    ...(filters.tag && { tag: filters.tag }),
    ...(filters.search && { search: filters.search })
  }))
})

// Extract data from semantic response
const posts = computed(() => response.value?.data || [])
const meta = computed(() => response.value?.meta || {})

// Filter actions
const applyFilters = () => {
  filters.page = 1
  refresh()
}

const clearFilters = () => {
  filters.status = ''
  filters.tag = ''
  filters.search = ''
  filters.page = 1
  refresh()
}

const changePage = (newPage: number) => {
  filters.page = newPage
  refresh()
}

// SEO
useHead({
  title: 'Blog Posts',
  meta: [
    { name: 'description', content: 'Browse our latest blog posts powered by H3 and UnJucks' }
  ]
})
</script>