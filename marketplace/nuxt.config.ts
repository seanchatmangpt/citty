// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  
  // TypeScript configuration
  typescript: {
    strict: false,
    typeCheck: false
  },

  // SSR configuration
  ssr: true,
  nitro: {
    preset: 'node-server',
    experimental: {
      wasm: true
    }
  },

  // CSS configuration
  css: ['~/assets/css/main.css'],

  // Modules
  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@nuxtjs/color-mode'
  ],

  // Tailwind CSS
  tailwindcss: {
    cssPath: '~/assets/css/main.css',
    configPath: 'tailwind.config.js',
    exposeConfig: false,
    viewer: true,
  },

  // Color mode
  colorMode: {
    classSuffix: '',
    preference: 'system',
    fallback: 'light'
  },

  // App configuration
  app: {
    head: {
      title: 'Citty Pro Ecosystem Marketplace',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { hid: 'description', name: 'description', content: 'Discover and share Citty Pro CLI tools, templates, and workflows' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
      ]
    }
  },

  // Runtime config
  runtimeConfig: {
    // Private keys (only available on server-side)
    jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret',
    
    // Public keys (exposed to client-side)
    public: {
      apiBase: process.env.API_BASE || 'http://localhost:3000/api',
      appVersion: process.env.APP_VERSION || '1.0.0'
    }
  },

  // Build configuration
  build: {
    transpile: ['citty-pro']
  },

  // Experimental features
  experimental: {
    payloadExtraction: false,
    renderJsonPayloads: true
  },

  // Auto-imports
  imports: {
    dirs: [
      'composables/**',
      'utils/**',
      'types/**'
    ]
  }
})