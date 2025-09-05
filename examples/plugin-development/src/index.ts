// Main exports for plugin development system
export { 
  createPluginManager, 
  loadBuiltinPlugins, 
  definePlugin, 
  createPlugin,
  PluginBuilder
} from './plugin-system'

export type { 
  PluginManager, 
  PluginDefinition 
} from './plugin-system'

// Plugin exports
export { default as markdownPlugin } from './plugins/markdown'
export { default as i18nPlugin } from './plugins/i18n'  
export { default as cachePlugin } from './plugins/cache'

// Re-export UnJucks types for plugin development
export type { 
  UnJucksInstance, 
  Plugin, 
  PluginContext, 
  TemplateContext 
} from '@unjs/unjucks'