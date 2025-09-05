export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: [
    '@nuxt/content',
    '@nuxtjs/tailwindcss'
  ],
  css: ['~/assets/css/main.css'],
  content: {
    highlight: {
      theme: 'github-dark',
      preload: ['ts', 'js', 'css', 'json', 'bash', 'vue']
    }
  },
  nitro: {
    plugins: ['~/server/plugins/unjucks.ts']
  }
})