<template>
  <component 
    :is="iconComponent" 
    v-bind="$attrs"
  />
</template>

<script setup lang="ts">
interface Props {
  name: string
}

const props = defineProps<Props>()

// Simple icon component - in production, you might use @nuxt/icon or similar
const iconComponent = computed(() => {
  // This is a simplified implementation
  // In a real app, you'd likely use a more sophisticated icon system
  const iconMap: Record<string, string> = {
    // Heroicons outline
    'heroicons:magnifying-glass': '🔍',
    'heroicons:heart': '♡',
    'heroicons:heart-solid': '♥',
    'heroicons:star': '⭐',
    'heroicons:arrow-down-tray': '⬇',
    'heroicons:plus': '+',
    'heroicons:check-badge': '✓',
    'heroicons:document-duplicate': '📄',
    'heroicons:puzzle-piece': '🧩',
    'heroicons:cog-6-tooth': '⚙',
    'heroicons:paint-brush': '🎨',
    'heroicons:cube': '⬜',
    'heroicons:bars-3': '☰',
    'heroicons:x-mark': '✕',
    'heroicons:tag': '🏷',
    'heroicons:clock': '⏰',
    'heroicons:squares-2x2': '⊞',
    'heroicons:list-bullet': '≡',
    'heroicons:sun': '☀',
    'heroicons:moon': '🌙',
    'heroicons:check-circle': '✅',
    'heroicons:x-circle': '❌',
    'heroicons:exclamation-triangle': '⚠',
    'heroicons:information-circle': 'ℹ',
  }
  
  const emoji = iconMap[props.name] || '•'
  
  return {
    template: `<span style="display: inline-block; font-style: normal;">${emoji}</span>`
  }
})
</script>