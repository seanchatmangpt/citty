<template>
  <div>
    <ContentDoc v-slot="{ doc }">
      <div v-html="renderedPost" />
    </ContentDoc>
  </div>
</template>

<script setup lang="ts">
import { createSemanticContext } from '@unjs/unjucks/context'

const route = useRoute()
const { data: doc } = await useAsyncData(`blog-${route.params.slug}`, () =>
  queryContent('/blog').where({ _path: route.path }).findOne()
)

// Render blog post with semantic template
const { data: renderedPost } = await useLazyAsyncData('rendered-post', async () => {
  if (!doc.value) return ''
  
  const semanticContext = createSemanticContext({
    type: 'blog',
    data: {
      title: doc.value.title,
      content: doc.value.body?.children?.[0]?.value || '',
      author: {
        name: doc.value.author || 'Anonymous',
        email: doc.value.authorEmail,
        bio: doc.value.authorBio,
        avatar: doc.value.authorAvatar,
        social: doc.value.authorSocial
      },
      publishedAt: new Date(doc.value.date || doc.value.createdAt),
      tags: doc.value.tags || [],
      category: doc.value.category,
      featured: doc.value.featured || false,
      readTime: doc.value.readTime || Math.ceil((doc.value.body?.children?.[0]?.value?.length || 0) / 200)
    },
    metadata: {
      path: route.path,
      slug: route.params.slug
    }
  })

  // Use Nitro's unjucks instance
  const { $unjucks } = useNuxtApp()
  return await $unjucks.render('blog-post.njk', semanticContext)
})

// SEO Meta
useHead({
  title: doc.value?.title,
  meta: [
    { name: 'description', content: doc.value?.description },
    { property: 'og:title', content: doc.value?.title },
    { property: 'og:description', content: doc.value?.description },
    { property: 'og:type', content: 'article' },
    { property: 'article:published_time', content: doc.value?.date },
    { property: 'article:author', content: doc.value?.author }
  ]
})
</script>