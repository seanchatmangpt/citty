interface AuthUser {
  id: string
  email: string
  name: string
  role: 'buyer' | 'seller' | 'admin'
  verified: boolean
  createdAt: Date
  preferences: {
    theme: string
    notifications: boolean
    language: string
  }
  stats?: Record<string, any>
  lastActive?: Date
}

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null
}

interface LoginCredentials {
  email: string
  password: string
  rememberMe?: boolean
}

export function useAuth() {
  // Global auth state
  const authState = useState<AuthState>('auth.state', () => ({
    user: null,
    isAuthenticated: false,
    loading: false,
    error: null
  }))

  const isAuthenticated = computed(() => authState.value.isAuthenticated)
  const user = computed(() => authState.value.user)
  const loading = computed(() => authState.value.loading)
  const error = computed(() => authState.value.error)

  // Role-based computed properties
  const isBuyer = computed(() => authState.value.user?.role === 'buyer')
  const isSeller = computed(() => authState.value.user?.role === 'seller')
  const isAdmin = computed(() => authState.value.user?.role === 'admin')

  // Set loading state
  const setLoading = (value: boolean) => {
    authState.value.loading = value
  }

  // Set error
  const setError = (error: string | null) => {
    authState.value.error = error
  }

  // Clear error
  const clearError = () => {
    authState.value.error = null
  }

  // Login
  const login = async (credentials: LoginCredentials) => {
    setLoading(true)
    clearError()

    try {
      const response = await $fetch('/api/auth/login', {
        method: 'POST',
        body: credentials
      })

      if (response.success && response.user) {
        authState.value.user = response.user
        authState.value.isAuthenticated = true

        // Store token in localStorage if provided (for client-side requests)
        if (process.client && response.token) {
          localStorage.setItem('auth-token', response.token)
          localStorage.setItem('auth-expires', response.expiresAt)
        }

        // Navigate to dashboard or redirect to intended page
        const router = useRouter()
        const route = useRoute()
        const redirectTo = (route.query.redirect as string) || '/marketplace'
        
        await router.push(redirectTo)
        
        return response
      }

      throw new Error('Login failed')

    } catch (err: any) {
      const errorMessage = err.data?.message || err.message || 'Login failed'
      setError(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Logout
  const logout = async () => {
    setLoading(true)
    clearError()

    try {
      await $fetch('/api/auth/logout', {
        method: 'POST'
      })

      // Clear client-side storage
      if (process.client) {
        localStorage.removeItem('auth-token')
        localStorage.removeItem('auth-expires')
      }

      // Reset state
      authState.value.user = null
      authState.value.isAuthenticated = false

      // Navigate to home
      const router = useRouter()
      await router.push('/')

    } catch (err: any) {
      console.error('Logout error:', err)
      // Even if logout API fails, clear local state
      authState.value.user = null
      authState.value.isAuthenticated = false
      
      if (process.client) {
        localStorage.removeItem('auth-token')
        localStorage.removeItem('auth-expires')
      }
    } finally {
      setLoading(false)
    }
  }

  // Get current user info
  const getCurrentUser = async () => {
    setLoading(true)
    clearError()

    try {
      const response = await $fetch('/api/auth/me')
      
      if (response.success && response.user) {
        authState.value.user = response.user
        authState.value.isAuthenticated = true
        return response.user
      }

      throw new Error('Failed to get user info')

    } catch (err: any) {
      // If token is invalid, clear auth state
      if (err.statusCode === 401) {
        authState.value.user = null
        authState.value.isAuthenticated = false
        
        if (process.client) {
          localStorage.removeItem('auth-token')
          localStorage.removeItem('auth-expires')
        }
      } else {
        setError('Failed to load user information')
      }
      
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Initialize auth state (check if user is already logged in)
  const initAuth = async () => {
    if (process.client) {
      const token = localStorage.getItem('auth-token')
      const expiresAt = localStorage.getItem('auth-expires')

      // Check if token exists and hasn't expired
      if (token && expiresAt && new Date(expiresAt) > new Date()) {
        try {
          await getCurrentUser()
        } catch (err) {
          // Token might be invalid, clear it
          localStorage.removeItem('auth-token')
          localStorage.removeItem('auth-expires')
        }
      } else if (token) {
        // Token expired, clear it
        localStorage.removeItem('auth-token')
        localStorage.removeItem('auth-expires')
      }
    } else {
      // Server-side: try to get user from cookie
      try {
        await getCurrentUser()
      } catch (err) {
        // No valid session
      }
    }
  }

  // Refresh user data
  const refreshUser = async () => {
    if (authState.value.isAuthenticated) {
      try {
        await getCurrentUser()
      } catch (err) {
        console.error('Failed to refresh user data:', err)
      }
    }
  }

  // Update user preferences
  const updatePreferences = async (preferences: Partial<AuthUser['preferences']>) => {
    if (!authState.value.user) return

    try {
      setLoading(true)
      
      // In a real app, this would call an API endpoint
      // await $fetch('/api/auth/preferences', { method: 'PUT', body: preferences })
      
      // For now, just update local state
      authState.value.user.preferences = {
        ...authState.value.user.preferences,
        ...preferences
      }

    } catch (err: any) {
      setError('Failed to update preferences')
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Require authentication (for protected routes)
  const requireAuth = async (redirectTo = '/auth/login') => {
    if (!authState.value.isAuthenticated) {
      const router = useRouter()
      const route = useRoute()
      
      await router.push({
        path: redirectTo,
        query: { redirect: route.fullPath }
      })
      
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentication required'
      })
    }
  }

  // Require specific role
  const requireRole = (role: AuthUser['role'] | AuthUser['role'][]) => {
    if (!authState.value.user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentication required'
      })
    }

    const allowedRoles = Array.isArray(role) ? role : [role]
    if (!allowedRoles.includes(authState.value.user.role)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Insufficient permissions'
      })
    }
  }

  return {
    // State
    user: readonly(user),
    isAuthenticated: readonly(isAuthenticated),
    loading: readonly(loading),
    error: readonly(error),

    // Role checks
    isBuyer: readonly(isBuyer),
    isSeller: readonly(isSeller),
    isAdmin: readonly(isAdmin),

    // Methods
    login,
    logout,
    getCurrentUser,
    initAuth,
    refreshUser,
    updatePreferences,
    requireAuth,
    requireRole,
    clearError
  }
}