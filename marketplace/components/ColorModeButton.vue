<template>
  <button
    class="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
    @click="toggleColorMode"
    :title="`Switch to ${colorMode === 'dark' ? 'light' : 'dark'} mode`"
  >
    <Icon 
      :name="colorMode === 'dark' ? 'heroicons:sun' : 'heroicons:moon'" 
      class="h-5 w-5" 
    />
  </button>
</template>

<script setup lang="ts">
const colorMode = useColorMode()

const toggleColorMode = () => {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}
</script>