// packages/citty-pro/src/context.ts
import { createContext } from 'unctx';
import type { RunCtx } from '../types/citty-pro';

// Create context for Citty Pro
export interface CittyProContext extends RunCtx {
  // Additional context properties
  session?: {
    id: string;
    startTime: Date;
    user?: string;
  };
  
  // Shared state across commands
  state?: Map<string, unknown>;
  
  // Plugin registry
  plugins?: Set<string>;
}

// Create the context using unctx
export const cittyContext = createContext<CittyProContext>({
  name: 'citty-pro',
  asyncContext: true,
  AsyncLocalStorage: globalThis.AsyncLocalStorage
});

// Helper to run with context
export async function withContext<T>(
  ctx: CittyProContext,
  fn: () => Promise<T> | T
): Promise<T> {
  return cittyContext.call(ctx, fn);
}

// Helper to get current context
export function useContext(): CittyProContext | undefined {
  return cittyContext.tryUse();
}

// Helper to require context (throws if not available)
export function requireContext(): CittyProContext {
  const ctx = cittyContext.tryUse();
  if (!ctx) {
    throw new Error('Citty Pro context not available. Ensure you are running within a context.');
  }
  return ctx;
}

// Initialize default context
export function createDefaultContext(): CittyProContext {
  return {
    cwd: process.cwd(),
    env: process.env as Record<string, string | undefined>,
    now: () => new Date(),
    state: new Map(),
    plugins: new Set(),
    session: {
      id: Math.random().toString(36).substring(2, 15),
      startTime: new Date()
    },
    memo: {}
  };
}