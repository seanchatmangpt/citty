/**
 * Global Error Handling Composable
 * Provides centralized error handling with user-friendly messages and logging
 */

export interface ErrorContext {
  component?: string
  action?: string
  metadata?: Record<string, any>
}

export interface AppError {
  id: string
  message: string
  originalError?: Error
  context?: ErrorContext
  timestamp: Date
  severity: 'low' | 'medium' | 'high' | 'critical'
  resolved?: boolean
}

export const useErrorHandler = () => {
  const errors = ref<AppError[]>([])
  const toast = useToast()
  
  // Generate unique error ID
  const generateErrorId = () => {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Handle error with context
  const handleError = (
    error: Error | string, 
    context?: ErrorContext,
    severity: AppError['severity'] = 'medium'
  ) => {
    const appError: AppError = {
      id: generateErrorId(),
      message: typeof error === 'string' ? error : error.message,
      originalError: typeof error === 'string' ? undefined : error,
      context,
      timestamp: new Date(),
      severity,
      resolved: false
    }

    // Add to error log
    errors.value.unshift(appError)
    
    // Keep only last 50 errors
    if (errors.value.length > 50) {
      errors.value = errors.value.slice(0, 50)
    }

    // Log to console in development
    if (process.dev) {
      console.error('Application Error:', {
        ...appError,
        stack: appError.originalError?.stack
      })
    }

    // Show user-friendly toast notification
    showUserNotification(appError)

    // Send to logging service in production
    if (process.env.NODE_ENV === 'production') {
      sendToLoggingService(appError)
    }

    return appError.id
  }

  // Show user-friendly notification
  const showUserNotification = (error: AppError) => {
    const userMessage = getUserFriendlyMessage(error)
    
    const toastConfig = {
      title: getSeverityTitle(error.severity),
      description: userMessage,
      variant: getSeverityVariant(error.severity),
      actions: error.severity === 'high' || error.severity === 'critical' 
        ? [{
            label: 'Report Issue',
            click: () => reportError(error.id)
          }] 
        : undefined
    }

    toast.add(toastConfig)
  }

  // Convert technical errors to user-friendly messages
  const getUserFriendlyMessage = (error: AppError): string => {
    const message = error.message.toLowerCase()
    
    // Network errors
    if (message.includes('network') || message.includes('fetch')) {
      return 'Unable to connect to the server. Please check your internet connection and try again.'
    }
    
    // Authentication errors
    if (message.includes('unauthorized') || message.includes('authentication')) {
      return 'Your session has expired. Please log in again.'
    }
    
    // Validation errors
    if (message.includes('validation') || message.includes('invalid')) {
      return 'Please check your input and try again.'
    }
    
    // Rate limiting
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return 'Too many requests. Please wait a moment and try again.'
    }
    
    // File upload errors
    if (message.includes('file') && (message.includes('size') || message.includes('type'))) {
      return 'The file you selected is not supported or is too large.'
    }
    
    // Default fallback
    return error.severity === 'critical' 
      ? 'A critical error occurred. Our team has been notified.'
      : 'Something went wrong. Please try again or contact support if the problem persists.'
  }

  // Get severity-based UI configuration
  const getSeverityTitle = (severity: AppError['severity']): string => {
    switch (severity) {
      case 'low': return 'Notice'
      case 'medium': return 'Warning'
      case 'high': return 'Error'
      case 'critical': return 'Critical Error'
    }
  }

  const getSeverityVariant = (severity: AppError['severity']): string => {
    switch (severity) {
      case 'low': return 'subtle'
      case 'medium': return 'warning'
      case 'high': return 'destructive'
      case 'critical': return 'destructive'
    }
  }

  // Mark error as resolved
  const resolveError = (errorId: string) => {
    const error = errors.value.find(e => e.id === errorId)
    if (error) {
      error.resolved = true
    }
  }

  // Clear old resolved errors
  const clearResolvedErrors = () => {
    errors.value = errors.value.filter(error => !error.resolved)
  }

  // Report error to support system
  const reportError = async (errorId: string) => {
    try {
      const error = errors.value.find(e => e.id === errorId)
      if (!error) return

      await $fetch('/api/errors/report', {
        method: 'POST',
        body: {
          errorId,
          error: {
            ...error,
            userAgent: navigator.userAgent,
            url: window.location.href,
            timestamp: error.timestamp.toISOString()
          }
        }
      })

      toast.add({
        title: 'Error Reported',
        description: 'Thank you for reporting this issue. We\'ll investigate it.',
        variant: 'success'
      })
    } catch (reportError) {
      console.error('Failed to report error:', reportError)
      toast.add({
        title: 'Report Failed',
        description: 'Unable to report the error. Please try again later.',
        variant: 'destructive'
      })
    }
  }

  // Send to external logging service
  const sendToLoggingService = async (error: AppError) => {
    try {
      // In production, replace with actual logging service
      // e.g., Sentry, LogRocket, DataDog, etc.
      console.log('Would send to logging service:', error)
    } catch (loggingError) {
      console.error('Failed to send error to logging service:', loggingError)
    }
  }

  // Get error statistics
  const getErrorStats = computed(() => {
    const total = errors.value.length
    const bySeverity = errors.value.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const resolved = errors.value.filter(e => e.resolved).length
    const unresolved = total - resolved

    return {
      total,
      resolved,
      unresolved,
      bySeverity
    }
  })

  // Utility function for async operations with error handling
  const withErrorHandling = async <T>(
    operation: () => Promise<T>,
    context?: ErrorContext,
    severity: AppError['severity'] = 'medium'
  ): Promise<T | null> => {
    try {
      return await operation()
    } catch (error) {
      handleError(error as Error, context, severity)
      return null
    }
  }

  return {
    errors: readonly(errors),
    handleError,
    resolveError,
    clearResolvedErrors,
    reportError,
    getErrorStats,
    withErrorHandling
  }
}