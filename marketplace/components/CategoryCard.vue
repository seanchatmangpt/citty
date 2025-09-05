<template>
  <NuxtLink 
    :to="`/marketplace?type=${category.slug.slice(0, -1)}`" 
    class="group block"
  >
    <div class="card hover:shadow-md transition-all duration-200 h-full">
      <div class="card-body text-center">
        <!-- Icon -->
        <div class="mb-4">
          <div :class="[
            'w-12 h-12 rounded-lg mx-auto flex items-center justify-center text-white transition-transform duration-200 group-hover:scale-110',
            category.color
          ]">
            <Icon :name="category.icon" class="w-6 h-6" />
          </div>
        </div>
        
        <!-- Content -->
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-marketplace-600 dark:group-hover:text-marketplace-400 transition-colors">
          {{ category.name }}
        </h3>
        
        <p class="text-gray-600 dark:text-gray-300 text-sm mb-3">
          {{ category.description }}
        </p>
        
        <!-- Count -->
        <div class="text-sm text-gray-500 dark:text-gray-400">
          {{ formatCount(category.count) }} items
        </div>
      </div>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
interface Category {
  name: string
  slug: string
  description: string
  icon: string
  count: number
  color: string
}

interface Props {
  category: Category
}

defineProps<Props>()

const formatCount = (count: number) => {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`
  }
  return count.toString()
}
</script>