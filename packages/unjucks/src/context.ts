/**
 * Context Management for Unjucks
 * Uses unctx for scoped template context
 */

import { createContext, type Context } from 'unctx'
import { defu } from 'defu'
import type { TemplateContext, ContextMetadata, ContextError as ContextErrorType } from './types'

// Create the context
const templateContext = createContext<TemplateContext>('unjucks:context')

/**
 * Create a new template context
 */
export function createTemplateContext(initial?: Partial<TemplateContext>): TemplateContext {
  const context: TemplateContext = defu(initial || {}, {
    _meta: {
      version: '1.0.0',
      created: new Date(),
      updated: new Date()
    } as ContextMetadata
  })

  templateContext.set(context)
  return context
}

/**
 * Get the current template context
 */
export function useTemplateContext(): TemplateContext {
  const ctx = templateContext.use()
  if (!ctx) {
    throw new Error('No template context available. Call createTemplateContext() first.')
  }
  return ctx
}

/**
 * Try to get the current template context (returns undefined if not set)
 */
export function tryUseTemplateContext(): TemplateContext | undefined {
  return templateContext.tryUse()
}

/**
 * Check if a template context exists
 */
export function hasTemplateContext(): boolean {
  return templateContext.tryUse() !== undefined
}

/**
 * Update the current template context
 */
export function updateTemplateContext(updates: Partial<TemplateContext>): TemplateContext {
  const current = useTemplateContext()
  
  // Deep merge the updates
  const updated = defu(updates, current)
  
  // Update metadata
  if (updated._meta) {
    updated._meta.updated = new Date()
  }
  
  templateContext.set(updated)
  return updated
}

/**
 * Clear the current template context
 */
export function clearTemplateContext(): void {
  templateContext.unset()
}

/**
 * Run a function with a specific context
 */
export function withTemplateContext<T>(
  context: TemplateContext,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return templateContext.call(context, fn)
}

/**
 * Get a value from the context using dot notation
 */
export function getContextValue(path: string, defaultValue?: any): any {
  const context = useTemplateContext()
  
  const keys = path.split('.')
  let value: any = context
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key]
    } else {
      return defaultValue
    }
  }
  
  return value
}

/**
 * Set a value in the context using dot notation
 */
export function setContextValue(path: string, value: any): void {
  const context = useTemplateContext()
  
  const keys = path.split('.')
  const lastKey = keys.pop()!
  
  let target: any = context
  for (const key of keys) {
    if (!(key in target) || typeof target[key] !== 'object') {
      target[key] = {}
    }
    target = target[key]
  }
  
  target[lastKey] = value
  
  // Update metadata
  if (context._meta) {
    context._meta.updated = new Date()
  }
}

/**
 * Delete a value from the context using dot notation
 */
export function deleteContextValue(path: string): boolean {
  const context = useTemplateContext()
  
  const keys = path.split('.')
  const lastKey = keys.pop()!
  
  let target: any = context
  for (const key of keys) {
    if (!(key in target) || typeof target[key] !== 'object') {
      return false
    }
    target = target[key]
  }
  
  if (lastKey in target) {
    delete target[lastKey]
    
    // Update metadata
    if (context._meta) {
      context._meta.updated = new Date()
    }
    
    return true
  }
  
  return false
}

/**
 * Check if a value exists in the context
 */
export function hasContextValue(path: string): boolean {
  const context = tryUseTemplateContext()
  if (!context) return false
  
  const keys = path.split('.')
  let target: any = context
  
  for (const key of keys) {
    if (!(key in target) || target[key] === undefined) {
      return false
    }
    target = target[key]
  }
  
  return true
}

/**
 * Merge multiple contexts
 */
export function mergeContexts(...contexts: Partial<TemplateContext>[]): TemplateContext {
  return defu({}, ...contexts, {
    _meta: {
      version: '1.0.0',
      created: new Date(),
      updated: new Date()
    }
  }) as TemplateContext
}

/**
 * Clone the current context
 */
export function cloneContext(): TemplateContext {
  const current = useTemplateContext()
  return JSON.parse(JSON.stringify(current))
}

/**
 * Export the current context as JSON
 */
export function exportContext(): string {
  const context = useTemplateContext()
  return JSON.stringify(context, null, 2)
}

/**
 * Import context from JSON
 */
export function importContext(json: string): TemplateContext {
  try {
    const parsed = JSON.parse(json)
    return createTemplateContext(parsed)
  } catch (error) {
    throw new Error(`Failed to import context: ${error instanceof Error ? error.message : 'Invalid JSON'}`)
  }
}

/**
 * Get context metadata
 */
export function getContextMetadata(): ContextMetadata | undefined {
  const context = tryUseTemplateContext()
  return context?._meta
}

/**
 * Context-aware interpolation
 */
export function interpolate(template: string, context?: Partial<TemplateContext>): string {
  const ctx = context || useTemplateContext()
  
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const trimmedPath = path.trim()
    const value = getValueByPath(ctx, trimmedPath)
    return value !== undefined ? String(value) : match
  })
}

// Helper function to get value by path
function getValueByPath(obj: any, path: string): any {
  const keys = path.split('.')
  let value = obj
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key]
    } else {
      return undefined
    }
  }
  
  return value
}