// CNS-Optimized Nuxt Configuration with 80/20 Patterns
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  
  // TypeScript configuration - 80/20: Enable strict mode for better DX
  typescript: {
    strict: true,
    typeCheck: 'build'
  },

  // 80/20: Hybrid rendering - SSR for core pages, SPA for interactive features
  ssr: true,
  nitro: {
    preset: 'node-server',
    // CNS Pattern: Enable experimental features for real-time capabilities
    experimental: {
      wasm: true,
      websockets: true
    },
    // 80/20: Core plugins only
    plugins: [
      '~/plugins/websocket.server.ts'
    ],
    // Performance optimization from CNS patterns
    routeRules: {
      // Static pages (80% of traffic)
      '/': { prerender: true, headers: { 'cache-control': 's-maxage=31536000' } },
      '/about': { prerender: true },
      // Dynamic pages with smart caching
      '/marketplace': { headers: { 'cache-control': 's-maxage=60' } },
      '/search': { ssr: false }, // SPA for real-time search
      // Real-time features
      '/auctions/**': { ssr: false, headers: { 'cache-control': 'no-cache' } },
      '/dashboard/**': { ssr: false }
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
      title: 'Citty Pro Ecosystem Marketplace - Unified Architecture',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { hid: 'description', name: 'description', content: 'Discover and share Citty Pro CLI tools, templates, and workflows with real-time features' },
        { name: 'author', content: 'Citty Pro Team' },
        { name: 'keywords', content: 'citty, cli, marketplace, templates, plugins, workflows, real-time, auctions' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'manifest', href: '/manifest.json' }
      ]
    }
  },

  // CNS Pattern: 80/20 Runtime Configuration
  runtimeConfig: {
    // Private keys (only available on server-side)
    jwtSecret: process.env.JWT_SECRET || 'citty-marketplace-jwt-secret-2024',
    databaseUrl: process.env.DATABASE_URL || 'sqlite://./marketplace.db',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    
    // Public keys (exposed to client-side)
    public: {
      // Core configuration (80% of usage)
      apiBase: process.env.API_BASE || 'http://localhost:3000/api',
      appVersion: process.env.APP_VERSION || '2.0.0',
      appUrl: process.env.APP_URL || 'http://localhost:3000',
      
      // CNS Real-time configuration
      pipelineWsUrl: process.env.PIPELINE_WS_URL || 'ws://localhost:9000',
      enableWebSocket: process.env.ENABLE_WEBSOCKET !== 'false',
      enableRealTimeFeatures: process.env.ENABLE_REALTIME !== 'false',
      
      // 80/20 Feature flags
      enableCoreFeatures: true,
      enableSearch: true,
      enableAuctions: process.env.ENABLE_AUCTIONS !== 'false',
      
      // Advanced features (20% of usage, opt-in)
      enableAnalytics: process.env.ENABLE_ANALYTICS === 'true',
      enableSocial: process.env.ENABLE_SOCIAL === 'true',
      enableAdvancedMetrics: process.env.ENABLE_ADVANCED_METRICS === 'true',
      
      // Payment configuration
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      
      // Performance settings
      refreshInterval: parseInt(process.env.REFRESH_INTERVAL || '1000'),
      maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
      cacheTimeout: parseInt(process.env.CACHE_TIMEOUT || '300000') // 5 minutes
    }
  },

  // Build configuration
  build: {
    transpile: ['citty-pro', 'socket.io-client']
  },

  // Experimental features
  experimental: {
    payloadExtraction: false,
    renderJsonPayloads: true,
    typedPages: true
  },

  // Auto-imports
  imports: {
    dirs: [
      'composables/**',
      'utils/**',
      'types/**',
      'stores/**'
    ]
  },

  // Server-side middleware
  serverMiddleware: [
    // Global middleware will be applied via server/middleware/ directory
  ],

  // Security headers
  routeRules: {
    '/api/**': {
      cors: true,
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      }
    },
    // Cache static assets
    '/images/**': { headers: { 'Cache-Control': 's-maxage=31536000' } },
    '/css/**': { headers: { 'Cache-Control': 's-maxage=31536000' } },
    '/js/**': { headers: { 'Cache-Control': 's-maxage=31536000' } },
    
    // Prerender static pages
    '/': { prerender: true },
    '/about': { prerender: true },
    '/contact': { prerender: true }
  },

  // Plugin configuration
  plugins: [
    '~/plugins/websocket.client.ts'
  ],

  // Vite configuration for better development experience
  vite: {
    server: {
      hmr: false, // Disable HMR to reduce file watching
      watch: {
        usePolling: false,
        ignored: ['**/node_modules/**', '**/dist/**', '**/tests/**', '**/.git/**', '**/coverage/**']
      }
    },
    optimizeDeps: {
      include: ['socket.io-client']
    },
    define: {
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(true)
    }
  },

  // Development configuration
  dev: process.env.NODE_ENV !== 'production',
  
  // Logging configuration
  logLevel: process.env.NODE_ENV === 'production' ? 'info' : 'verbose'
})