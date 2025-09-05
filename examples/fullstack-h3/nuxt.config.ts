export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: [
    '@nuxt/content',
    '@nuxtjs/tailwindcss'
  ],
  css: ['~/assets/css/main.css'],
  
  // Server-side rendering configuration
  ssr: true,
  
  // Nitro configuration for H3 + UnJucks integration
  nitro: {
    experimental: {
      wasm: true
    },
    plugins: [
      '~/server/plugins/unjucks-fullstack.ts'
    ],
    storage: {
      templates: {
        driver: 'fs',
        base: './server/templates'
      },
      data: {
        driver: 'fs',
        base: './server/data'
      }
    }
  },

  // Runtime configuration
  runtimeConfig: {
    // Private keys (only available on server-side)
    databaseUrl: process.env.DATABASE_URL || './data/app.db',
    jwtSecret: process.env.JWT_SECRET || 'dev-secret',
    
    // Public keys (exposed to client-side)
    public: {
      apiBase: process.env.API_BASE_URL || 'http://localhost:3000/api',
      appName: 'Full-Stack H3 + UnJucks Demo'
    }
  },

  // Content configuration for blog/docs
  content: {
    highlight: {
      theme: {
        default: 'github-light',
        dark: 'github-dark'
      },
      preload: ['ts', 'js', 'css', 'json', 'bash', 'vue', 'sql']
    }
  },

  // Build optimization
  vite: {
    optimizeDeps: {
      include: ['better-sqlite3', 'drizzle-orm']
    }
  }
})