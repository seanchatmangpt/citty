// packages/citty-pro/src/hooks.ts
import { createHooks } from 'hookable';
import type { HookPayload, Hooks } from '../types/citty-pro';

// Create the global hooks instance
export const hooks = createHooks<HookPayload>();

// Export typed hooks interface
export const typedHooks: Hooks = {
  hook: (name, fn) => {
    return hooks.hook(name as any, fn as any);
  },
  callHook: (name, payload) => {
    return hooks.callHook(name as any, payload);
  }
};

export function registerCoreHooks() {
  // Register lifecycle tracking
  hooks.beforeEach((event) => {
    if (process.env.CITTY_DEBUG) {
      console.log(`[HOOK] Before: ${event.name}`);
    }
  });
  
  hooks.afterEach((event) => {
    if (process.env.CITTY_DEBUG) {
      console.log(`[HOOK] After: ${event.name}`);
    }
  });
  
  // Core error handling
  hooks.hook('cli:boot', async ({ argv }) => {
    if (argv.includes('--debug')) {
      process.env.CITTY_DEBUG = 'true';
    }
  });
}