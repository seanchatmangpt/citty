/**
 * Global test setup for main test suite
 * Ensures proper context isolation and AsyncLocalStorage availability
 */

import { beforeEach, afterEach } from 'vitest'

// Ensure AsyncLocalStorage is available for tests
if (typeof (globalThis as any).AsyncLocalStorage === 'undefined') {
  try {
    const { AsyncLocalStorage } = require('async_hooks')
    ;(globalThis as any).AsyncLocalStorage = AsyncLocalStorage
  } catch {
    // Fallback implementation for environments without async_hooks
    ;(globalThis as any).AsyncLocalStorage = class MockAsyncLocalStorage {
      private store = new Map()
      
      run(store: any, callback: () => any) {
        const key = Symbol()
        this.store.set(key, store)
        try {
          return callback()
        } finally {
          this.store.delete(key)
        }
      }
      
      getStore() {
        const keys = Array.from(this.store.keys())
        return keys.length > 0 ? this.store.get(keys[keys.length - 1]) : undefined
      }
    }
  }
}

// Clear any global contexts between tests to prevent interference
beforeEach(() => {
  // Clear unjucks context if available
  try {
    const { clearTemplateContext } = require('../packages/unjucks/src/context')
    clearTemplateContext()
  } catch {
    // Package might not be available in all test environments
  }
  
  // Clear untology context if available
  try {
    const { clearOntologyContext } = require('../packages/untology/src/context')
    clearOntologyContext()
  } catch {
    // Package might not be available in all test environments
  }
})

afterEach(() => {
  // Clear unjucks context if available
  try {
    const { clearTemplateContext } = require('../packages/unjucks/src/context')
    clearTemplateContext()
  } catch {
    // Package might not be available in all test environments
  }
  
  // Clear untology context if available
  try {
    const { clearOntologyContext } = require('../packages/untology/src/context')
    clearOntologyContext()
  } catch {
    // Package might not be available in all test environments
  }
})