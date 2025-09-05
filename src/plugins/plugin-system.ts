/**
 * Plugin System Architecture
 * Extensible plugin framework for Citty CLI applications
 */

import { defineCommand } from 'citty';
import { readdir, stat, readFile } from 'fs/promises';
import { join, dirname, extname } from 'pathe';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { EventEmitter } from 'events';

export interface Plugin {
  name: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  keywords?: string[];
  
  // Core plugin functionality
  commands?: Record<string, any>;
  hooks?: PluginHooks;
  middleware?: PluginMiddleware[];
  dependencies?: string[];
  
  // Lifecycle methods
  install?(): Promise<void> | void;
  uninstall?(): Promise<void> | void;
  activate?(): Promise<void> | void;
  deactivate?(): Promise<void> | void;
  
  // Configuration
  config?: PluginConfig;
  schema?: any; // JSON schema for plugin configuration
}

export interface PluginConfig {
  enabled: boolean;
  settings: Record<string, any>;
  priority?: number;
}

export interface PluginHooks {
  'before:init'?: (context: PluginContext) => Promise<void> | void;
  'after:init'?: (context: PluginContext) => Promise<void> | void;
  'before:command'?: (command: string, args: any, context: PluginContext) => Promise<void> | void;
  'after:command'?: (command: string, args: any, result: any, context: PluginContext) => Promise<void> | void;
  'on:error'?: (error: Error, context: PluginContext) => Promise<void> | void;
  'before:exit'?: (exitCode: number, context: PluginContext) => Promise<void> | void;
}

export interface PluginMiddleware {
  name: string;
  priority?: number;
  handler: (context: PluginContext, next: () => Promise<void>) => Promise<void>;
}

export interface PluginContext {
  cli: any;
  config: any;
  logger: any;
  utils: PluginUtils;
}

export interface PluginUtils {
  readConfig(key?: string): any;
  writeConfig(key: string, value: any): Promise<void>;
  log(message: string, level?: 'info' | 'warn' | 'error'): void;
  execute(command: string, args?: string[]): Promise<any>;
}

export interface PluginRegistry {
  name: string;
  version: string;
  path: string;
  enabled: boolean;
  config: PluginConfig;
  instance?: Plugin;
}

/**
 * Plugin Manager
 */
export class PluginManager extends EventEmitter {
  private plugins = new Map<string, PluginRegistry>();
  private hooks = new Map<keyof PluginHooks, Array<{ plugin: string; handler: Function; priority: number }>>>();
  private middleware: Array<{ plugin: string; middleware: PluginMiddleware }> = [];
  private context: PluginContext;
  
  constructor(context?: Partial<PluginContext>) {
    super();
    
    this.context = {
      cli: null,
      config: {},
      logger: console,
      utils: this.createPluginUtils(),
      ...context
    };
  }
  
  private createPluginUtils(): PluginUtils {
    return {
      readConfig: (key?: string) => {
        return key ? this.context.config[key] : this.context.config;
      },
      writeConfig: async (key: string, value: any) => {
        this.context.config[key] = value;
        // In real implementation, persist to file
      },
      log: (message: string, level = 'info') => {
        const prefix = `[Plugin] `;
        switch (level) {
          case 'error': console.error(prefix + message); break;
          case 'warn': console.warn(prefix + message); break;
          default: console.log(prefix + message);
        }
      },
      execute: async (command: string, args = []) => {
        // Execute CLI commands programmatically
        const { spawn } = await import('child_process');
        return new Promise((resolve, reject) => {
          const child = spawn(command, args, { stdio: 'pipe' });
          let stdout = '';
          let stderr = '';
          
          child.stdout.on('data', data => stdout += data);
          child.stderr.on('data', data => stderr += data);
          
          child.on('close', code => {
            if (code === 0) {
              resolve({ stdout, stderr });
            } else {
              reject(new Error(`Command failed with code ${code}: ${stderr}`));
            }
          });
        });
      }
    };
  }
  
  /**
   * Discover plugins in directories
   */
  async discover(directories: string[] = ['./plugins', './node_modules']): Promise<string[]> {
    const discovered: string[] = [];
    
    for (const dir of directories) {
      try {
        await this.discoverInDirectory(dir, discovered);
      } catch (error) {
        // Directory doesn't exist or permission error - continue
      }
    }
    
    return discovered;
  }
  
  private async discoverInDirectory(dir: string, discovered: string[]) {
    const entries = await readdir(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stats = await stat(fullPath);
      
      if (stats.isDirectory()) {
        // Check for package.json with citty-plugin keyword
        try {
          const packageJsonPath = join(fullPath, 'package.json');
          const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
          
          if (packageJson.keywords?.includes('citty-plugin')) {
            discovered.push(fullPath);
          }
        } catch {
          // Not a valid plugin directory
        }
      } else if (entry.endsWith('.plugin.js') || entry.endsWith('.plugin.ts')) {
        // Individual plugin file
        discovered.push(fullPath);
      }
    }
  }
  
  /**
   * Load plugin from path or npm package
   */
  async load(pluginPath: string): Promise<void> {
    try {
      let pluginModule: any;
      
      if (pluginPath.startsWith('.') || pluginPath.startsWith('/')) {
        // Local file path
        pluginModule = await import(pluginPath);
      } else {
        // NPM package
        try {
          const require = createRequire(import.meta.url);
          pluginModule = require(pluginPath);
        } catch {
          pluginModule = await import(pluginPath);
        }
      }
      
      const plugin: Plugin = pluginModule.default || pluginModule;
      
      if (!this.validatePlugin(plugin)) {
        throw new Error('Invalid plugin structure');
      }
      
      await this.register(plugin, pluginPath);
      
    } catch (error) {
      this.context.logger.error(`Failed to load plugin '${pluginPath}': ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Register a plugin instance
   */
  async register(plugin: Plugin, path: string): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin '${plugin.name}' is already registered`);
    }
    
    const registry: PluginRegistry = {
      name: plugin.name,
      version: plugin.version,
      path,
      enabled: true,
      config: plugin.config || { enabled: true, settings: {} },
      instance: plugin
    };
    
    // Install plugin
    if (plugin.install) {
      await plugin.install();
    }
    
    // Register hooks
    if (plugin.hooks) {
      for (const [hookName, handler] of Object.entries(plugin.hooks)) {
        this.registerHook(
          hookName as keyof PluginHooks,
          handler,
          plugin.name,
          registry.config.priority || 0
        );
      }
    }
    
    // Register middleware
    if (plugin.middleware) {
      for (const middleware of plugin.middleware) {
        this.middleware.push({ plugin: plugin.name, middleware });
      }
      
      // Sort middleware by priority
      this.middleware.sort((a, b) => (a.middleware.priority || 0) - (b.middleware.priority || 0));
    }
    
    this.plugins.set(plugin.name, registry);
    
    // Activate plugin
    if (plugin.activate) {
      await plugin.activate();
    }
    
    this.emit('plugin:registered', plugin.name);
    this.context.logger.log(`Plugin registered: ${plugin.name}@${plugin.version}`);
  }
  
  /**
   * Unregister a plugin
   */
  async unregister(name: string): Promise<void> {
    const registry = this.plugins.get(name);
    if (!registry) {
      throw new Error(`Plugin '${name}' is not registered`);
    }
    
    const plugin = registry.instance!;
    
    // Deactivate plugin
    if (plugin.deactivate) {
      await plugin.deactivate();
    }
    
    // Uninstall plugin
    if (plugin.uninstall) {
      await plugin.uninstall();
    }
    
    // Remove hooks
    for (const hookName of Object.keys(plugin.hooks || {})) {
      this.unregisterHook(hookName as keyof PluginHooks, name);
    }
    
    // Remove middleware
    this.middleware = this.middleware.filter(m => m.plugin !== name);
    
    this.plugins.delete(name);
    this.emit('plugin:unregistered', name);
    this.context.logger.log(`Plugin unregistered: ${name}`);
  }
  
  /**
   * Enable/disable plugin
   */
  async setEnabled(name: string, enabled: boolean): Promise<void> {
    const registry = this.plugins.get(name);
    if (!registry) {
      throw new Error(`Plugin '${name}' is not registered`);
    }
    
    registry.enabled = enabled;
    registry.config.enabled = enabled;
    
    const plugin = registry.instance!;
    
    if (enabled && plugin.activate) {
      await plugin.activate();
    } else if (!enabled && plugin.deactivate) {
      await plugin.deactivate();
    }
    
    this.emit('plugin:toggled', name, enabled);
  }
  
  /**
   * Get all commands from enabled plugins
   */
  getCommands(): Record<string, any> {
    const commands: Record<string, any> = {};
    
    for (const registry of this.plugins.values()) {
      if (registry.enabled && registry.instance?.commands) {
        Object.assign(commands, registry.instance.commands);
      }
    }
    
    return commands;
  }
  
  /**
   * Execute hooks
   */
  async executeHook(hookName: keyof PluginHooks, ...args: any[]): Promise<void> {
    const handlers = this.hooks.get(hookName) || [];
    
    // Sort by priority (higher priority first)
    const sortedHandlers = [...handlers].sort((a, b) => b.priority - a.priority);
    
    for (const { plugin, handler } of sortedHandlers) {
      const registry = this.plugins.get(plugin);
      if (registry?.enabled) {
        try {
          await handler(...args, this.context);
        } catch (error) {
          this.context.logger.error(`Hook '${hookName}' failed in plugin '${plugin}': ${error.message}`);
          this.emit('plugin:error', plugin, error);
        }
      }
    }
  }
  
  /**
   * Execute middleware stack
   */
  async executeMiddleware(context: any): Promise<void> {
    let index = 0;
    
    const next = async (): Promise<void> => {
      if (index >= this.middleware.length) return;
      
      const { plugin, middleware } = this.middleware[index++];
      const registry = this.plugins.get(plugin);
      
      if (registry?.enabled) {
        try {
          await middleware.handler(context, next);
        } catch (error) {
          this.context.logger.error(`Middleware '${middleware.name}' failed in plugin '${plugin}': ${error.message}`);
          this.emit('plugin:error', plugin, error);
        }
      } else {
        await next();
      }
    };
    
    await next();
  }
  
  /**
   * List all plugins
   */
  list(): PluginRegistry[] {
    return Array.from(this.plugins.values());
  }
  
  /**
   * Get plugin by name
   */
  get(name: string): PluginRegistry | undefined {
    return this.plugins.get(name);
  }
  
  private validatePlugin(plugin: any): plugin is Plugin {
    return (
      plugin &&
      typeof plugin === 'object' &&
      typeof plugin.name === 'string' &&
      typeof plugin.version === 'string' &&
      typeof plugin.description === 'string'
    );
  }
  
  private registerHook(
    hookName: keyof PluginHooks,
    handler: Function,
    plugin: string,
    priority: number
  ) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }
    
    this.hooks.get(hookName)!.push({ plugin, handler, priority });
  }
  
  private unregisterHook(hookName: keyof PluginHooks, plugin: string) {
    const handlers = this.hooks.get(hookName);
    if (handlers) {
      const filtered = handlers.filter(h => h.plugin !== plugin);
      this.hooks.set(hookName, filtered);
    }
  }
}

/**
 * Plugin CLI Commands
 */
export const pluginCommand = defineCommand({
  meta: {
    name: 'plugin',
    description: 'Plugin management commands'
  },
  subCommands: {
    list: defineCommand({
      meta: {
        name: 'list',
        description: 'List installed plugins'
      },
      args: {
        enabled: {
          type: 'boolean',
          description: 'Show only enabled plugins'
        }
      },
      run({ args }) {
        const manager = new PluginManager();
        const plugins = manager.list();
        const filtered = args.enabled ? plugins.filter(p => p.enabled) : plugins;
        
        if (filtered.length === 0) {
          console.log('No plugins found.');
          return;
        }
        
        console.log('\n🔌 Installed Plugins:\n');
        
        for (const plugin of filtered) {
          const status = plugin.enabled ? '✅' : '❌';
          console.log(`${status} ${plugin.name}@${plugin.version}`);
          if (plugin.instance) {
            console.log(`  ${plugin.instance.description}`);
            if (plugin.instance.author) {
              console.log(`  Author: ${plugin.instance.author}`);
            }
          }
          console.log(`  Path: ${plugin.path}`);
          console.log('');
        }
      }
    }),
    
    install: defineCommand({
      meta: {
        name: 'install',
        description: 'Install plugin from path or npm'
      },
      args: {
        plugin: {
          type: 'positional',
          description: 'Plugin path or npm package name',
          required: true
        }
      },
      async run({ args }) {
        const manager = new PluginManager();
        
        try {
          console.log(`Installing plugin: ${args.plugin}`);
          await manager.load(args.plugin);
          console.log('✅ Plugin installed successfully!');
        } catch (error) {
          console.error(`❌ Failed to install plugin: ${error.message}`);
        }
      }
    }),
    
    uninstall: defineCommand({
      meta: {
        name: 'uninstall',
        description: 'Uninstall plugin'
      },
      args: {
        name: {
          type: 'positional',
          description: 'Plugin name',
          required: true
        }
      },
      async run({ args }) {
        const manager = new PluginManager();
        
        try {
          console.log(`Uninstalling plugin: ${args.name}`);
          await manager.unregister(args.name);
          console.log('✅ Plugin uninstalled successfully!');
        } catch (error) {
          console.error(`❌ Failed to uninstall plugin: ${error.message}`);
        }
      }
    }),
    
    enable: defineCommand({
      meta: {
        name: 'enable',
        description: 'Enable plugin'
      },
      args: {
        name: {
          type: 'positional',
          description: 'Plugin name',
          required: true
        }
      },
      async run({ args }) {
        const manager = new PluginManager();
        
        try {
          await manager.setEnabled(args.name, true);
          console.log(`✅ Plugin '${args.name}' enabled`);
        } catch (error) {
          console.error(`❌ Failed to enable plugin: ${error.message}`);
        }
      }
    }),
    
    disable: defineCommand({
      meta: {
        name: 'disable',
        description: 'Disable plugin'
      },
      args: {
        name: {
          type: 'positional',
          description: 'Plugin name',
          required: true
        }
      },
      async run({ args }) {
        const manager = new PluginManager();
        
        try {
          await manager.setEnabled(args.name, false);
          console.log(`❌ Plugin '${args.name}' disabled`);
        } catch (error) {
          console.error(`❌ Failed to disable plugin: ${error.message}`);
        }
      }
    }),
    
    discover: defineCommand({
      meta: {
        name: 'discover',
        description: 'Discover available plugins'
      },
      args: {
        directories: {
          type: 'string',
          description: 'Directories to search',
          multiple: true
        }
      },
      async run({ args }) {
        const manager = new PluginManager();
        const directories = args.directories || ['./plugins', './node_modules'];
        
        console.log('Discovering plugins...');
        
        try {
          const discovered = await manager.discover(directories);
          
          if (discovered.length === 0) {
            console.log('No plugins discovered.');
            return;
          }
          
          console.log(`\n🔍 Found ${discovered.length} plugin(s):\n`);
          
          for (const path of discovered) {
            console.log(`  ${path}`);
          }
          
          console.log('\nUse `plugin install <path>` to install a plugin.');
        } catch (error) {
          console.error(`❌ Discovery failed: ${error.message}`);
        }
      }
    })
  }
});

/**
 * Plugin Development Utilities
 */
export const createPlugin = (definition: Omit<Plugin, 'name' | 'version'> & {
  name: string;
  version: string;
}): Plugin => {
  return {
    ...definition,
    config: definition.config || { enabled: true, settings: {} }
  };
};

/**
 * Decorator for plugin commands
 */
export function pluginCommand(meta: { name: string; description: string }) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!target.constructor.commands) {
      target.constructor.commands = {};
    }
    
    target.constructor.commands[meta.name] = defineCommand({
      meta,
      run: descriptor.value
    });
  };
}

/**
 * Example plugin template
 */
export const examplePlugin: Plugin = createPlugin({
  name: 'example-plugin',
  version: '1.0.0',
  description: 'Example plugin for demonstration',
  author: 'Citty Team',
  license: 'MIT',
  keywords: ['example', 'demo'],
  
  commands: {
    hello: defineCommand({
      meta: {
        name: 'hello',
        description: 'Say hello from plugin'
      },
      args: {
        name: {
          type: 'string',
          description: 'Name to greet',
          default: 'Plugin User'
        }
      },
      run({ args }) {
        console.log(`👋 Hello, ${args.name}! This message is from the example plugin.`);
      }
    })
  },
  
  hooks: {
    'before:init': (context) => {
      console.log('🔌 Example plugin initialized');
    },
    'before:command': (command, args) => {
      console.log(`📥 Example plugin: Before running command '${command}'`);
    },
    'after:command': (command, args, result) => {
      console.log(`📤 Example plugin: After running command '${command}'`);
    }
  },
  
  async install() {
    console.log('📦 Example plugin installed');
  },
  
  async uninstall() {
    console.log('🗡️ Example plugin uninstalled');
  }
});
