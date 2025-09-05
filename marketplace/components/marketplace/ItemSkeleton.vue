<template>
  <div 
    :class="[
      'card animate-pulse',
      listView ? 'flex flex-row items-center' : 'flex flex-col h-full'
    ]"
  >
    <!-- Header -->
    <div :class="listView ? 'flex-1 flex items-center space-x-4 p-4' : 'card-header'">
      <!-- Icon placeholder -->
      <div :class="listView ? 'flex-shrink-0' : 'mb-3'">
        <div class="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700"></div>
      </div>

      <!-- Content placeholders -->
      <div :class="listView ? 'flex-1 min-w-0' : ''">
        <!-- Title -->
        <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-2" :style="{ width: Math.random() * 60 + 40 + '%' }"></div>
        
        <!-- Tags -->
        <div class="flex items-center gap-2 mb-2">
          <div class="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          <div class="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
        </div>

        <!-- Author -->
        <div class="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
      </div>
    </div>

    <!-- Description -->
    <div :class="listView ? 'flex-1 px-4' : 'card-body flex-1'">
      <div class="space-y-2">
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded" :style="{ width: '85%' }"></div>
        <div v-if="!listView" class="h-4 bg-gray-200 dark:bg-gray-700 rounded" :style="{ width: '70%' }"></div>
      </div>

      <!-- Keywords (card view only) -->
      <div v-if="!listView" class="mt-3 flex gap-1">
        <div class="h-6 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div class="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div class="h-6 w-14 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    </div>

    <!-- Footer -->
    <div :class="listView ? 'flex items-center justify-between px-4 py-4' : 'card-footer'">
      <!-- Stats -->
      <div :class="listView ? 'flex items-center space-x-4' : 'flex justify-between items-center'">
        <div class="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div class="h-4 w-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div class="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div v-if="!listView" class="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>

      <!-- Actions -->
      <div :class="listView ? 'flex items-center space-x-2' : 'flex justify-between items-center mt-3'">
        <div class="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div class="flex space-x-2">
          <div class="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div class="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  listView?: boolean
}

withDefaults(defineProps<Props>(), {
  listView: false
})
</script>