// packages/citty-pro/src/plugins/index.ts
import type { Plugin, RunCtx, Hooks } from '../../types/citty-pro';

// Plugin registry
const plugins: Map<string, Plugin> = new Map();

// Register a plugin
export function registerPlugin(name: string, plugin: Plugin): void {
  if (plugins.has(name)) {
    console.warn(`Plugin "${name}" is already registered and will be replaced`);
  }
  plugins.set(name, plugin);
}

// Unregister a plugin
export function unregisterPlugin(name: string): boolean {
  return plugins.delete(name);
}

// Apply all registered plugins
export async function applyPlugins(hooks: Hooks, ctx: RunCtx): Promise<void> {
  for (const [name, plugin] of plugins) {
    try {
      await plugin(hooks, ctx);
      if (ctx.plugins) {
        (ctx as any).plugins.add(name);
      }
    } catch (error) {
      console.error(`Failed to apply plugin "${name}":`, error);
    }
  }
}

// Get list of registered plugins
export function getPlugins(): string[] {
  return Array.from(plugins.keys());
}

// Check if a plugin is registered
export function hasPlugin(name: string): boolean {
  return plugins.has(name);
}