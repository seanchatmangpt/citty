import { createContext } from 'unctx'
import type { Store } from 'n3'
import { Store as N3Store } from 'n3'

export interface OntologyContext {
  store: Store
  prefixes: Record<string, string>
  defaultFormat: 'turtle' | 'ntriples' | 'nquads' | 'trig'
}

// Type declaration for globalThis AsyncLocalStorage
declare global {
  var AsyncLocalStorage: any
}

// Ensure AsyncLocalStorage is available
if (typeof (globalThis as any).AsyncLocalStorage === 'undefined') {
  try {
    const { AsyncLocalStorage } = require('async_hooks')
    ;(globalThis as any).AsyncLocalStorage = AsyncLocalStorage
  } catch {
    // Fallback for environments without async_hooks
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

export const ontologyContext = createContext<OntologyContext>()

// Global store for fallback when context is not available
let globalStore: Store | null = null
let globalPrefixes: Record<string, string> = {}
let globalFormat: 'turtle' | 'ntriples' | 'nquads' | 'trig' = 'turtle'

export function useOntology() {
  const ctx = ontologyContext.tryUse()
  if (ctx) {
    return ctx
  }
  
  // Fallback to global store if no context available
  if (!globalStore) {
    throw new Error('No ontology context available. Did you call loadGraph() first?')
  }
  
  return {
    store: globalStore,
    prefixes: globalPrefixes,
    defaultFormat: globalFormat
  }
}

export function hasOntology(): boolean {
  return ontologyContext.tryUse() !== undefined || globalStore !== null
}

export function withOntology<T>(context: Partial<OntologyContext>, fn: () => T): T {
  const fullContext = {
    store: context.store || new N3Store(),
    prefixes: context.prefixes || {},
    defaultFormat: context.defaultFormat || 'turtle' as const
  }
  return ontologyContext.call(fullContext, fn)
}

/**
 * Set the ontology context safely, handling existing contexts
 */
export function setOntologyContext(context: OntologyContext): void {
  try {
    // Try to unset any existing context first
    const existing = ontologyContext.tryUse()
    if (existing) {
      ontologyContext.unset()
    }
  } catch {
    // Ignore errors when unsetting
  }
  
  try {
    ontologyContext.set(context)
  } catch (error: any) {
    if (error.message?.includes('Context conflict')) {
      // If context conflict, use global store as fallback
      globalStore = context.store
      globalPrefixes = context.prefixes
      globalFormat = context.defaultFormat
    } else {
      throw error
    }
  }
}

/**
 * Clear the ontology context safely
 */
export function clearOntologyContext(): void {
  try {
    const existing = ontologyContext.tryUse()
    if (existing) {
      ontologyContext.unset()
    }
  } catch {
    // Ignore errors when unsetting
  }
  
  // Also clear global fallback
  globalStore = null
  globalPrefixes = {}
  globalFormat = 'turtle'
}

/**
 * Create a fresh context for testing isolation
 */
export function createFreshContext(): OntologyContext {
  return {
    store: new N3Store(),
    prefixes: {
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      owl: 'http://www.w3.org/2002/07/owl#',
      xsd: 'http://www.w3.org/2001/XMLSchema#'
    },
    defaultFormat: 'turtle'
  }
}