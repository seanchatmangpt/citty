<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Navigation -->
    <nav class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center">
            <!-- Logo -->
            <NuxtLink to="/" class="flex-shrink-0 flex items-center">
              <div class="h-8 w-8 bg-gradient-to-r from-marketplace-500 to-primary-600 rounded-lg flex items-center justify-center">
                <span class="text-white font-bold text-sm">C</span>
              </div>
              <span class="ml-3 text-xl font-semibold text-gray-900 dark:text-white">
                Citty Pro Marketplace
              </span>
            </NuxtLink>
          </div>

          <!-- Desktop Navigation -->
          <div class="hidden md:flex items-center space-x-8">
            <NuxtLink 
              to="/" 
              class="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white px-3 py-2 text-sm font-medium transition-colors"
              active-class="text-marketplace-600 dark:text-marketplace-400"
            >
              Home
            </NuxtLink>
            <NuxtLink 
              to="/marketplace" 
              class="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white px-3 py-2 text-sm font-medium transition-colors"
              active-class="text-marketplace-600 dark:text-marketplace-400"
            >
              Browse
            </NuxtLink>
            <NuxtLink 
              to="/marketplace/templates" 
              class="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white px-3 py-2 text-sm font-medium transition-colors"
              active-class="text-marketplace-600 dark:text-marketplace-400"
            >
              Templates
            </NuxtLink>
            <NuxtLink 
              to="/marketplace/plugins" 
              class="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white px-3 py-2 text-sm font-medium transition-colors"
              active-class="text-marketplace-600 dark:text-marketplace-400"
            >
              Plugins
            </NuxtLink>
            <NuxtLink 
              to="/marketplace/workflows" 
              class="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white px-3 py-2 text-sm font-medium transition-colors"
              active-class="text-marketplace-600 dark:text-marketplace-400"
            >
              Workflows
            </NuxtLink>
          </div>

          <!-- Right side actions -->
          <div class="flex items-center space-x-4">
            <!-- Search button -->
            <button 
              class="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
              @click="openSearch"
            >
              <Icon name="heroicons:magnifying-glass" class="h-5 w-5" />
            </button>

            <!-- Dark mode toggle -->
            <ClientOnly>
              <ColorModeButton />
            </ClientOnly>

            <!-- User menu or login -->
            <div class="flex items-center space-x-2">
              <button class="btn-outline text-sm">
                Sign In
              </button>
              <button class="btn-primary text-sm">
                Publish
              </button>
            </div>

            <!-- Mobile menu button -->
            <button 
              class="md:hidden p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              @click="mobileMenuOpen = !mobileMenuOpen"
            >
              <Icon name="heroicons:bars-3" class="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>

      <!-- Mobile menu -->
      <div v-show="mobileMenuOpen" class="md:hidden border-t border-gray-200 dark:border-gray-700">
        <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          <NuxtLink 
            to="/" 
            class="block px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
            @click="mobileMenuOpen = false"
          >
            Home
          </NuxtLink>
          <NuxtLink 
            to="/marketplace" 
            class="block px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
            @click="mobileMenuOpen = false"
          >
            Browse
          </NuxtLink>
          <NuxtLink 
            to="/marketplace/templates" 
            class="block px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
            @click="mobileMenuOpen = false"
          >
            Templates
          </NuxtLink>
          <NuxtLink 
            to="/marketplace/plugins" 
            class="block px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
            @click="mobileMenuOpen = false"
          >
            Plugins
          </NuxtLink>
          <NuxtLink 
            to="/marketplace/workflows" 
            class="block px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
            @click="mobileMenuOpen = false"
          >
            Workflows
          </NuxtLink>
        </div>
      </div>
    </nav>

    <!-- Main content -->
    <main class="flex-1">
      <slot />
    </main>

    <!-- Footer -->
    <footer class="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
          <!-- Brand -->
          <div class="col-span-1 md:col-span-2">
            <div class="flex items-center mb-4">
              <div class="h-8 w-8 bg-gradient-to-r from-marketplace-500 to-primary-600 rounded-lg flex items-center justify-center">
                <span class="text-white font-bold text-sm">C</span>
              </div>
              <span class="ml-3 text-lg font-semibold text-gray-900 dark:text-white">
                Citty Pro Marketplace
              </span>
            </div>
            <p class="text-gray-600 dark:text-gray-300 text-sm max-w-md">
              Discover, share, and collaborate on CLI tools, templates, and workflows. 
              Built for developers, by developers.
            </p>
          </div>

          <!-- Links -->
          <div>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
              Marketplace
            </h3>
            <ul class="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li><NuxtLink to="/marketplace/templates" class="hover:text-marketplace-600 transition-colors">Templates</NuxtLink></li>
              <li><NuxtLink to="/marketplace/plugins" class="hover:text-marketplace-600 transition-colors">Plugins</NuxtLink></li>
              <li><NuxtLink to="/marketplace/workflows" class="hover:text-marketplace-600 transition-colors">Workflows</NuxtLink></li>
              <li><NuxtLink to="/marketplace/themes" class="hover:text-marketplace-600 transition-colors">Themes</NuxtLink></li>
            </ul>
          </div>

          <div>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
              Resources
            </h3>
            <ul class="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li><NuxtLink to="/docs" class="hover:text-marketplace-600 transition-colors">Documentation</NuxtLink></li>
              <li><NuxtLink to="/guides" class="hover:text-marketplace-600 transition-colors">Guides</NuxtLink></li>
              <li><NuxtLink to="/api" class="hover:text-marketplace-600 transition-colors">API Reference</NuxtLink></li>
              <li><a href="https://github.com/citty-pro" target="_blank" class="hover:text-marketplace-600 transition-colors">GitHub</a></li>
            </ul>
          </div>
        </div>

        <div class="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <div class="flex flex-col md:flex-row justify-between items-center">
            <p class="text-sm text-gray-600 dark:text-gray-300">
              &copy; 2024 Citty Pro Marketplace. All rights reserved.
            </p>
            <div class="mt-4 md:mt-0 flex space-x-6">
              <NuxtLink to="/privacy" class="text-sm text-gray-600 dark:text-gray-300 hover:text-marketplace-600 transition-colors">
                Privacy Policy
              </NuxtLink>
              <NuxtLink to="/terms" class="text-sm text-gray-600 dark:text-gray-300 hover:text-marketplace-600 transition-colors">
                Terms of Service
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </footer>

    <!-- Search Modal -->
    <MarketplaceSearchModal v-model:open="searchModalOpen" />

    <!-- Toast Notifications -->
    <MarketplaceToastContainer />
  </div>
</template>

<script setup>
// Mobile menu state
const mobileMenuOpen = ref(false)

// Search modal state
const searchModalOpen = ref(false)

// Open search modal
const openSearch = () => {
  searchModalOpen.value = true
}

// Close mobile menu when route changes
const route = useRoute()
watch(() => route.path, () => {
  mobileMenuOpen.value = false
})

// Keyboard shortcut for search
onMounted(() => {
  const handleKeydown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      openSearch()
    }
  }
  
  document.addEventListener('keydown', handleKeydown)
  
  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
  })
})
</script>