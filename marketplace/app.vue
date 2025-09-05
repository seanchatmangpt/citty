<template>
  <div id="__nuxt">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <NuxtLoadingIndicator />
  </div>
</template>

<script setup>
// Global error handling
useHead({
  titleTemplate: '%s - Citty Pro Marketplace',
  meta: [
    { name: 'description', content: 'Discover and share Citty Pro CLI tools, templates, and workflows' }
  ]
})

// Global error handler
onErrorCaptured((error) => {
  console.error('Global error captured:', error)
  return false
})
</script>