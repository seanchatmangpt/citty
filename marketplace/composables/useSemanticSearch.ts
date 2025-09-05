/**
 * Semantic Search Composable - CNS Pattern Integration
 * Implements 80/20 optimization: Fast core search + advanced semantic processing
 */

export interface SearchResult {
  id: string
  title: string
  description: string
  category: string
  tags: string[]
  price: number
  author: string
  rating: number
  relevanceScore: number
  semanticScore?: number
  createdAt: Date
  updatedAt: Date
}

export interface SearchFilters {
  category?: string
  priceMin?: number
  priceMax?: number
  rating?: number
  tags?: string[]
  author?: string
  dateRange?: {
    from: Date
    to: Date
  }
}

export interface SearchOptions {
  enableSemantic?: boolean
  enableRealTime?: boolean
  maxResults?: number
  sortBy?: 'relevance' | 'price' | 'rating' | 'date'
  sortOrder?: 'asc' | 'desc'
}

interface SearchState {
  query: string
  results: SearchResult[]
  filteredResults: SearchResult[]
  filters: SearchFilters
  loading: boolean
  error: string | null
  totalResults: number
  searchTime: number
  hasMore: boolean
  page: number
}

export function useSemanticSearch() {
  const config = useRuntimeConfig()
  
  // State management
  const state = ref<SearchState>({
    query: '',
    results: [],
    filteredResults: [],
    filters: {},
    loading: false,
    error: null,
    totalResults: 0,
    searchTime: 0,
    hasMore: false,
    page: 1
  })

  // Search history for better UX (CNS pattern)
  const searchHistory = ref<string[]>([])
  const recentSearches = ref<SearchResult[]>([])
  
  // Real-time search updates (80/20: optional advanced feature)
  const { isConnected, sendCommand, on, off } = useOptimizedWebSocket()
  
  // Core search function (80% of usage)
  const search = async (
    query: string, 
    filters: SearchFilters = {}, 
    options: SearchOptions = {}
  ): Promise<SearchResult[]> => {
    
    if (!query.trim() && Object.keys(filters).length === 0) {
      state.value.results = []
      state.value.filteredResults = []
      return []
    }

    state.value.loading = true
    state.value.error = null
    state.value.query = query
    state.value.filters = filters
    
    const startTime = performance.now()
    
    try {
      // 80/20: Basic search first, semantic enhancement optional
      const searchParams = new URLSearchParams({
        q: query,
        page: state.value.page.toString(),
        limit: (options.maxResults || 20).toString(),
        sortBy: options.sortBy || 'relevance',
        sortOrder: options.sortOrder || 'desc',
        ...Object.fromEntries(
          Object.entries(filters).map(([key, value]) => [
            key, 
            Array.isArray(value) ? value.join(',') : value?.toString() || ''
          ])
        )
      })

      // Real-time search updates if enabled and connected
      if (options.enableRealTime && isConnected.value) {
        sendCommand('search_subscribe', { query, filters })
      }

      const response = await $fetch<{
        results: SearchResult[]
        totalResults: number
        hasMore: boolean
        semanticEnhanced?: boolean
      }>(`${config.public.apiBase}/search?${searchParams}`)

      // Enhanced semantic processing if enabled (20% feature)
      let results = response.results
      if (options.enableSemantic && config.public.enableAdvancedMetrics) {
        results = await enhanceWithSemantics(results, query)
      }

      state.value.results = results
      state.value.filteredResults = results
      state.value.totalResults = response.totalResults
      state.value.hasMore = response.hasMore
      state.value.searchTime = performance.now() - startTime

      // Track search for analytics and history
      trackSearch(query, filters, results.length)
      updateSearchHistory(query)

      return results

    } catch (error) {
      console.error('Search error:', error)
      state.value.error = error instanceof Error ? error.message : 'Search failed'
      return []
    } finally {
      state.value.loading = false
    }
  }

  // CNS Pattern: Semantic enhancement for advanced users
  const enhanceWithSemantics = async (
    results: SearchResult[],
    query: string
  ): Promise<SearchResult[]> => {
    try {
      const enhancedResponse = await $fetch<{
        enhanced: SearchResult[]
      }>(`${config.public.apiBase}/search/semantic`, {
        method: 'POST',
        body: {
          query,
          results: results.slice(0, 10) // Limit semantic processing for performance
        }
      })

      return enhancedResponse.enhanced.map(result => ({
        ...result,
        semanticScore: result.semanticScore || result.relevanceScore
      }))
    } catch (error) {
      console.warn('Semantic enhancement failed, using basic results:', error)
      return results
    }
  }

  // Instant search with debouncing (80/20: core UX feature)
  const instantSearch = useDebounceFn(async (
    query: string, 
    filters: SearchFilters = {}
  ) => {
    if (query.length < 2) {
      state.value.results = []
      state.value.filteredResults = []
      return
    }

    await search(query, filters, { 
      enableRealTime: true,
      maxResults: 10 // Fewer results for instant search
    })
  }, 300)

  // Advanced filtering (CNS pattern: progressive enhancement)
  const applyFilters = (filters: SearchFilters) => {
    let filtered = [...state.value.results]

    if (filters.category) {
      filtered = filtered.filter(item => 
        item.category.toLowerCase() === filters.category?.toLowerCase()
      )
    }

    if (filters.priceMin !== undefined) {
      filtered = filtered.filter(item => item.price >= filters.priceMin!)
    }

    if (filters.priceMax !== undefined) {
      filtered = filtered.filter(item => item.price <= filters.priceMax!)
    }

    if (filters.rating) {
      filtered = filtered.filter(item => item.rating >= filters.rating!)
    }

    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(item =>
        filters.tags!.some(tag => 
          item.tags.some(itemTag => 
            itemTag.toLowerCase().includes(tag.toLowerCase())
          )
        )
      )
    }

    if (filters.author) {
      filtered = filtered.filter(item =>
        item.author.toLowerCase().includes(filters.author!.toLowerCase())
      )
    }

    if (filters.dateRange) {
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.createdAt)
        return itemDate >= filters.dateRange!.from && 
               itemDate <= filters.dateRange!.to
      })
    }

    state.value.filteredResults = filtered
    state.value.filters = filters
  }

  // Load more results for pagination
  const loadMore = async () => {
    if (!state.value.hasMore || state.value.loading) return

    state.value.page += 1
    const moreResults = await search(state.value.query, state.value.filters, {
      enableRealTime: false // Disable real-time for pagination
    })

    state.value.results = [...state.value.results, ...moreResults]
    state.value.filteredResults = [...state.value.filteredResults, ...moreResults]
  }

  // Search suggestions (CNS pattern: predictive UX)
  const getSuggestions = async (partialQuery: string): Promise<string[]> => {
    if (partialQuery.length < 2) return []

    try {
      const response = await $fetch<{ suggestions: string[] }>(
        `${config.public.apiBase}/search/suggestions`,
        {
          params: { q: partialQuery, limit: 5 }
        }
      )
      return response.suggestions
    } catch (error) {
      console.warn('Failed to get suggestions:', error)
      return []
    }
  }

  // Clear search and reset state
  const clearSearch = () => {
    state.value.query = ''
    state.value.results = []
    state.value.filteredResults = []
    state.value.filters = {}
    state.value.error = null
    state.value.totalResults = 0
    state.value.page = 1
    state.value.hasMore = false

    if (isConnected.value) {
      sendCommand('search_unsubscribe')
    }
  }

  // Track search for analytics
  const trackSearch = (query: string, filters: SearchFilters, resultCount: number) => {
    if (process.client) {
      // Track search analytics
      const searchEvent = {
        query: query.toLowerCase(),
        filters,
        resultCount,
        timestamp: new Date(),
        searchTime: state.value.searchTime
      }
      
      // Send to analytics service
      console.log('Search tracked:', searchEvent)
    }
  }

  // Update search history
  const updateSearchHistory = (query: string) => {
    if (!query.trim()) return

    const cleanQuery = query.trim().toLowerCase()
    
    // Remove if already exists, then add to front
    searchHistory.value = searchHistory.value.filter(q => q !== cleanQuery)
    searchHistory.value.unshift(cleanQuery)
    
    // Keep only recent 10 searches
    if (searchHistory.value.length > 10) {
      searchHistory.value = searchHistory.value.slice(0, 10)
    }

    // Persist to localStorage
    if (process.client) {
      try {
        localStorage.setItem('marketplace_search_history', 
          JSON.stringify(searchHistory.value)
        )
      } catch (error) {
        console.warn('Failed to save search history:', error)
      }
    }
  }

  // Load search history from localStorage
  const loadSearchHistory = () => {
    if (process.client) {
      try {
        const stored = localStorage.getItem('marketplace_search_history')
        if (stored) {
          searchHistory.value = JSON.parse(stored)
        }
      } catch (error) {
        console.warn('Failed to load search history:', error)
      }
    }
  }

  // Real-time search updates handler
  const handleRealTimeUpdate = (update: {
    type: 'new_result' | 'updated_result' | 'removed_result'
    data: SearchResult
  }) => {
    switch (update.type) {
      case 'new_result':
        if (matchesCurrentFilters(update.data)) {
          state.value.results.unshift(update.data)
          state.value.filteredResults.unshift(update.data)
          state.value.totalResults += 1
        }
        break
      case 'updated_result':
        updateResultInState(update.data)
        break
      case 'removed_result':
        removeResultFromState(update.data.id)
        break
    }
  }

  const matchesCurrentFilters = (result: SearchResult): boolean => {
    // Simple filter matching - can be enhanced
    const filters = state.value.filters
    
    if (filters.category && result.category !== filters.category) return false
    if (filters.priceMin && result.price < filters.priceMin) return false
    if (filters.priceMax && result.price > filters.priceMax) return false
    if (filters.rating && result.rating < filters.rating) return false
    
    return true
  }

  const updateResultInState = (updatedResult: SearchResult) => {
    const updateInArray = (array: SearchResult[]) => {
      const index = array.findIndex(r => r.id === updatedResult.id)
      if (index !== -1) {
        array[index] = updatedResult
      }
    }
    
    updateInArray(state.value.results)
    updateInArray(state.value.filteredResults)
  }

  const removeResultFromState = (resultId: string) => {
    state.value.results = state.value.results.filter(r => r.id !== resultId)
    state.value.filteredResults = state.value.filteredResults.filter(r => r.id !== resultId)
    state.value.totalResults = Math.max(0, state.value.totalResults - 1)
  }

  // Setup real-time updates
  onMounted(() => {
    loadSearchHistory()
    
    if (isConnected.value) {
      on('search_update', handleRealTimeUpdate)
    }
  })

  onBeforeUnmount(() => {
    if (isConnected.value) {
      off('search_update', handleRealTimeUpdate)
      sendCommand('search_unsubscribe')
    }
  })

  return {
    // State (readonly for external use)
    state: readonly(state),
    searchHistory: readonly(searchHistory),
    recentSearches: readonly(recentSearches),
    
    // Core methods (80% of usage)
    search,
    instantSearch,
    clearSearch,
    getSuggestions,
    
    // Advanced methods (20% of usage)
    applyFilters,
    loadMore,
    
    // Computed properties
    isSearching: computed(() => state.value.loading),
    hasResults: computed(() => state.value.filteredResults.length > 0),
    hasError: computed(() => !!state.value.error),
    resultCount: computed(() => state.value.filteredResults.length),
    
    // Search metrics
    searchMetrics: computed(() => ({
      totalResults: state.value.totalResults,
      searchTime: state.value.searchTime,
      currentPage: state.value.page,
      hasMore: state.value.hasMore
    }))
  }
}