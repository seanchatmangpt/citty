/**
 * Test setup for Unjucks package
 * Ensures proper context isolation and AsyncLocalStorage availability
 */

import { beforeEach, afterEach } from 'vitest'
import { clearTemplateContext } from '../src/context'

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

// Clear context between tests to prevent interference
beforeEach(() => {
  try {
    clearTemplateContext()
  } catch (error) {
    // Context might not exist, which is fine
  }
})

afterEach(() => {
  try {
    clearTemplateContext()
  } catch (error) {
    // Context might not exist, which is fine
  }
})