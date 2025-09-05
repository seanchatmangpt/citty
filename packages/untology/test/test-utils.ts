import { clearOntologyContext, setOntologyContext, createFreshContext } from '../src'

/**
 * Test isolation utility - ensures each test has a clean context
 */
export function withCleanContext<T>(fn: () => T | Promise<T>): T | Promise<T> {
  // Clear any existing context
  clearOntologyContext()
  
  try {
    return fn()
  } finally {
    // Always clean up after test
    clearOntologyContext()
  }
}

/**
 * Setup a fresh context before each test
 */
export function setupFreshContext() {
  clearOntologyContext()
  const context = createFreshContext()
  setOntologyContext(context)
}

/**
 * Clean up context after each test
 */
export function teardownContext() {
  clearOntologyContext()
}

/**
 * Wrapper for describe blocks that automatically handles context cleanup
 */
export function describeWithContext(name: string, fn: () => void) {
  describe(name, () => {
    beforeEach(() => {
      setupFreshContext()
    })
    
    afterEach(() => {
      teardownContext()
    })
    
    fn()
  })
}