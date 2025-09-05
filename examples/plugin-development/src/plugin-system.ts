import type { UnJucksInstance, Plugin, PluginContext, TemplateContext } from '@unjs/unjucks'
import { createHooks } from 'hookable'
import { defu } from 'defu'
import consola from 'consola'

export interface PluginManager {
  plugins: Map<string, Plugin>
  hooks: ReturnType<typeof createHooks>
  register(plugin: Plugin): Promise<void>
  unregister(name: string): Promise<void>
  getPlugin(name: string): Plugin | undefined
  listPlugins(): string[]
  createContext(unjucks: UnJucksInstance): PluginContext
}

export interface PluginDefinition {
  name: string
  version: string
  description?: string
  author?: string
  dependencies?: string[]
  
  // Plugin lifecycle hooks
  setup?(context: PluginContext): Promise<void> | void
  beforeRender?(template: string, data: any, context: TemplateContext): Promise<void> | void  
  afterRender?(result: string, template: string, data: any, context: TemplateContext): Promise<string> | string
  onError?(error: Error, context: TemplateContext): Promise<void> | void
  
  // Custom filters and functions
  filters?: Record<string, Function>
  functions?: Record<string, Function>
  
  // Configuration
  config?: Record<string, any>
}

export function createPluginManager(): PluginManager {
  const plugins = new Map<string, Plugin>()
  const hooks = createHooks()

  return {
    plugins,
    hooks,

    async register(plugin: Plugin) {
      // Validate plugin
      if (!plugin.name) {
        throw new Error('Plugin must have a name')
      }

      if (plugins.has(plugin.name)) {
        consola.warn(`Plugin ${plugin.name} is already registered, skipping`)
        return
      }

      // Check dependencies
      if (plugin.dependencies) {
        for (const dep of plugin.dependencies) {
          if (!plugins.has(dep)) {
            throw new Error(`Plugin ${plugin.name} depends on ${dep} which is not registered`)
          }
        }
      }

      // Register plugin
      plugins.set(plugin.name, plugin)
      
      // Register hooks
      if (plugin.setup) {
        hooks.hook('plugin:setup', plugin.setup)
      }
      if (plugin.beforeRender) {
        hooks.hook('render:before', plugin.beforeRender)
      }
      if (plugin.afterRender) {
        hooks.hook('render:after', plugin.afterRender)
      }
      if (plugin.onError) {
        hooks.hook('render:error', plugin.onError)
      }

      consola.success(`Plugin ${plugin.name} v${plugin.version} registered`)
    },

    async unregister(name: string) {
      const plugin = plugins.get(name)
      if (!plugin) {
        consola.warn(`Plugin ${name} is not registered`)
        return
      }

      // Check if other plugins depend on this one
      for (const [pluginName, p] of plugins.entries()) {
        if (p.dependencies?.includes(name)) {
          throw new Error(`Cannot unregister ${name}: ${pluginName} depends on it`)
        }
      }

      plugins.delete(name)
      consola.info(`Plugin ${name} unregistered`)
    },

    getPlugin(name: string) {
      return plugins.get(name)
    },

    listPlugins() {
      return Array.from(plugins.keys())
    },

    createContext(unjucks: UnJucksInstance): PluginContext {
      return {
        unjucks,
        plugins: this,
        hooks,
        config: {},
        
        // Helper methods
        async callHook(name: string, ...args: any[]) {
          return hooks.callHook(name, ...args)
        },

        getConfig(pluginName: string, key?: string) {
          const plugin = plugins.get(pluginName)
          if (!plugin?.config) return undefined
          return key ? plugin.config[key] : plugin.config
        },

        setConfig(pluginName: string, key: string, value: any) {
          const plugin = plugins.get(pluginName)
          if (!plugin) return
          plugin.config = plugin.config || {}
          plugin.config[key] = value
        }
      }
    }
  }
}

// Plugin utilities
export function definePlugin(definition: PluginDefinition): Plugin {
  return {
    ...definition,
    config: definition.config || {}
  }
}

// Built-in plugin loader
export async function loadBuiltinPlugins(manager: PluginManager) {
  const builtinPlugins = [
    () => import('./plugins/markdown'),
    () => import('./plugins/i18n'),
    () => import('./plugins/cache'),
    () => import('./plugins/validation')
  ]

  for (const loader of builtinPlugins) {
    try {
      const module = await loader()
      await manager.register(module.default)
    } catch (error) {
      consola.error(`Failed to load builtin plugin:`, error)
    }
  }
}

// Plugin development helpers
export class PluginBuilder {
  private definition: Partial<PluginDefinition> = {}

  name(name: string) {
    this.definition.name = name
    return this
  }

  version(version: string) {
    this.definition.version = version
    return this
  }

  description(description: string) {
    this.definition.description = description
    return this
  }

  author(author: string) {
    this.definition.author = author
    return this
  }

  dependsOn(...dependencies: string[]) {
    this.definition.dependencies = [...(this.definition.dependencies || []), ...dependencies]
    return this
  }

  setup(handler: NonNullable<PluginDefinition['setup']>) {
    this.definition.setup = handler
    return this
  }

  beforeRender(handler: NonNullable<PluginDefinition['beforeRender']>) {
    this.definition.beforeRender = handler
    return this
  }

  afterRender(handler: NonNullable<PluginDefinition['afterRender']>) {
    this.definition.afterRender = handler
    return this
  }

  onError(handler: NonNullable<PluginDefinition['onError']>) {
    this.definition.onError = handler
    return this
  }

  filter(name: string, fn: Function) {
    this.definition.filters = this.definition.filters || {}
    this.definition.filters[name] = fn
    return this
  }

  function(name: string, fn: Function) {
    this.definition.functions = this.definition.functions || {}
    this.definition.functions[name] = fn
    return this
  }

  config(config: Record<string, any>) {
    this.definition.config = defu(config, this.definition.config)
    return this
  }

  build(): Plugin {
    if (!this.definition.name || !this.definition.version) {
      throw new Error('Plugin must have name and version')
    }
    return definePlugin(this.definition as PluginDefinition)
  }
}

export function createPlugin() {
  return new PluginBuilder()
}