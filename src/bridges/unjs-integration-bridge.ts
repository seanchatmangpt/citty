/**
 * UnJS Integration Bridge
 * Comprehensive integration with popular UnJS tools and ecosystem
 */

import { defineCommand } from 'citty';
import { defu } from 'defu';
import { ofetch } from 'ofetch';
import { joinURL, parseURL, withQuery } from 'ufo';
import { consola } from 'consola';
import { klona } from 'klona';
import { pascalCase, camelCase, kebabCase } from 'scule';

export interface UnJSBridge {
  name: string;
  version: string;
  tools: UnJSTool[];
  commands: Record<string, any>;
}

export interface UnJSTool {
  name: string;
  package: string;
  description: string;
  category: 'server' | 'utility' | 'build' | 'dev' | 'data';
  commands?: Record<string, any>;
  integration?: ToolIntegration;
}

export interface ToolIntegration {
  setup?: () => Promise<void>;
  commands?: Record<string, any>;
  middleware?: any[];
  config?: Record<string, any>;
}

/**
 * Nitro Bridge
 */
export const nitroBridge: UnJSTool = {
  name: 'nitro',
  package: 'nitropack',
  description: 'Universal web server with zero-configuration',
  category: 'server',
  commands: {
    dev: defineCommand({
      meta: {
        name: 'nitro:dev',
        description: 'Start Nitro development server'
      },
      args: {
        port: {
          type: 'string',
          description: 'Port number',
          default: '3000'
        },
        host: {
          type: 'string',
          description: 'Host address',
          default: 'localhost'
        },
        preset: {
          type: 'string',
          description: 'Build preset',
          default: 'node-server'
        }
      },
      async run({ args }) {
        try {
          const { createDevServer, build } = await import('nitropack');
          
          consola.info('Starting Nitro development server...');
          
          const server = createDevServer({
            rootDir: process.cwd(),
            dev: true,
            preset: args.preset
          });
          
          await server.listen(parseInt(args.port), {
            hostname: args.host
          });
          
          consola.success(`Nitro server running at http://${args.host}:${args.port}`);
          
          // Handle graceful shutdown
          process.on('SIGINT', async () => {
            consola.info('Shutting down Nitro server...');
            await server.close();
            process.exit(0);
          });
          
        } catch (error) {
          consola.error('Failed to start Nitro server:', error.message);
        }
      }
    }),
    
    build: defineCommand({
      meta: {
        name: 'nitro:build',
        description: 'Build Nitro application for production'
      },
      args: {
        preset: {
          type: 'string',
          description: 'Build preset',
          default: 'node-server'
        },
        minify: {
          type: 'boolean',
          description: 'Enable minification',
          default: true
        },
        output: {
          type: 'string',
          description: 'Output directory',
          default: '.output'
        }
      },
      async run({ args }) {
        try {
          const { build } = await import('nitropack');
          
          consola.info('Building Nitro application...');
          
          await build({
            rootDir: process.cwd(),
            preset: args.preset,
            minify: args.minify,
            output: { dir: args.output }
          });
          
          consola.success('Nitro build completed!');
          
        } catch (error) {
          consola.error('Nitro build failed:', error.message);
        }
      }
    })
  }
};

/**
 * H3 Bridge
 */
export const h3Bridge: UnJSTool = {
  name: 'h3',
  package: 'h3',
  description: 'Minimal HTTP framework with maximum performance',
  category: 'server',
  commands: {
    serve: defineCommand({
      meta: {
        name: 'h3:serve',
        description: 'Start H3 HTTP server'
      },
      args: {
        port: {
          type: 'string',
          description: 'Port number',
          default: '3000'
        },
        routes: {
          type: 'string',
          description: 'Routes directory',
          default: './routes'
        },
        watch: {
          type: 'boolean',
          description: 'Enable hot reload',
          default: true
        }
      },
      async run({ args }) {
        try {
          const { createApp, createRouter, defineEventHandler } = await import('h3');
          const { listen } = await import('listhen');
          const { watch } = await import('chokidar');
          
          const app = createApp({
            debug: true
          });
          
          const router = createRouter();
          
          // Health check endpoint
          router.get('/health', defineEventHandler(() => ({
            status: 'ok',
            timestamp: new Date().toISOString()
          })));
          
          app.use(router);
          
          if (args.watch) {
            const watcher = watch(args.routes, { ignored: /node_modules/ });
            watcher.on('change', () => {
              consola.info('Routes changed, restarting...');
              // Route reloading logic would go here
            });
          }
          
          const listener = await listen(app, {
            port: parseInt(args.port),
            showURL: true
          });
          
          consola.success('H3 server ready!');
          
          // Graceful shutdown
          process.on('SIGINT', async () => {
            consola.info('Shutting down H3 server...');
            await listener.close();
            process.exit(0);
          });
          
        } catch (error) {
          consola.error('Failed to start H3 server:', error.message);
        }
      }
    })
  }
};

/**
 * UnStorage Bridge
 */
export const unstorageBridge: UnJSTool = {
  name: 'unstorage',
  package: 'unstorage',
  description: 'Universal storage layer',
  category: 'data',
  commands: {
    test: defineCommand({
      meta: {
        name: 'storage:test',
        description: 'Test storage operations'
      },
      args: {
        driver: {
          type: 'string',
          description: 'Storage driver to test',
          default: 'fs'
        },
        operations: {
          type: 'string',
          description: 'Operations to test (comma-separated)',
          default: 'get,set,delete,keys'
        }
      },
      async run({ args }) {
        try {
          const { createStorage } = await import('unstorage');
          
          let driver;
          switch (args.driver) {
            case 'fs':
              const fsDriver = await import('unstorage/drivers/fs');
              driver = fsDriver.default({ base: './storage' });
              break;
            case 'memory':
              const memoryDriver = await import('unstorage/drivers/memory');
              driver = memoryDriver.default();
              break;
            case 'redis':
              const redisDriver = await import('unstorage/drivers/redis');
              driver = redisDriver.default({ host: 'localhost', port: 6379 });
              break;
            default:
              throw new Error(`Unknown driver: ${args.driver}`);
          }
          
          const storage = createStorage({ driver });
          const operations = args.operations.split(',');
          
          consola.info(`Testing ${args.driver} storage driver...`);
          
          if (operations.includes('set')) {
            await storage.setItem('test:key', 'test-value');
            consola.success('Set operation: OK');
          }
          
          if (operations.includes('get')) {
            const value = await storage.getItem('test:key');
            consola.success(`Get operation: ${value}`);
          }
          
          if (operations.includes('keys')) {
            const keys = await storage.getKeys();
            consola.success(`Keys operation: ${keys.length} keys found`);
          }
          
          if (operations.includes('delete')) {
            await storage.removeItem('test:key');
            consola.success('Delete operation: OK');
          }
          
          consola.success('Storage test completed!');
          
        } catch (error) {
          consola.error('Storage test failed:', error.message);
        }
      }
    })
  }
};

/**
 * Ofetch Bridge
 */
export const ofetchBridge: UnJSTool = {
  name: 'ofetch',
  package: 'ofetch',
  description: 'Better fetch API',
  category: 'utility',
  commands: {
    request: defineCommand({
      meta: {
        name: 'fetch:request',
        description: 'Make HTTP request with ofetch'
      },
      args: {
        url: {
          type: 'string',
          description: 'URL to request',
          required: true
        },
        method: {
          type: 'string',
          description: 'HTTP method',
          default: 'GET'
        },
        headers: {
          type: 'string',
          description: 'Request headers (JSON string)'
        },
        data: {
          type: 'string',
          description: 'Request body (JSON string)'
        },
        query: {
          type: 'string',
          description: 'Query parameters (JSON string)'
        }
      },
      async run({ args }) {
        try {
          let url = args.url;
          
          if (args.query) {
            const query = JSON.parse(args.query);
            url = withQuery(url, query);
          }
          
          const options: any = {
            method: args.method.toUpperCase()
          };
          
          if (args.headers) {
            options.headers = JSON.parse(args.headers);
          }
          
          if (args.data) {
            options.body = JSON.parse(args.data);
          }
          
          consola.info(`Making ${options.method} request to ${url}`);
          
          const response = await ofetch(url, options);
          
          consola.success('Request successful!');
          console.log(JSON.stringify(response, null, 2));
          
        } catch (error) {
          consola.error('Request failed:', error.message);
          if (error.data) {
            console.log('Error data:', error.data);
          }
        }
      }
    })
  }
};

/**
 * Scule Bridge (String utilities)
 */
export const sculeBridge: UnJSTool = {
  name: 'scule',
  package: 'scule',
  description: 'String utilities and case conversion',
  category: 'utility',
  commands: {
    convert: defineCommand({
      meta: {
        name: 'string:convert',
        description: 'Convert string case'
      },
      args: {
        text: {
          type: 'string',
          description: 'Text to convert',
          required: true
        },
        case: {
          type: 'string',
          description: 'Target case',
          required: true
        }
      },
      run({ args }) {
        let result: string;
        
        switch (args.case.toLowerCase()) {
          case 'pascal':
            result = pascalCase(args.text);
            break;
          case 'camel':
            result = camelCase(args.text);
            break;
          case 'kebab':
            result = kebabCase(args.text);
            break;
          default:
            consola.error('Unsupported case type. Use: pascal, camel, or kebab');
            return;
        }
        
        consola.info(`${args.case} case:`);
        console.log(result);
      }
    })
  }
};

/**
 * Defu Bridge (Configuration merging)
 */
export const defuBridge: UnJSTool = {
  name: 'defu',
  package: 'defu',
  description: 'Recursively assign default properties',
  category: 'utility',
  commands: {
    merge: defineCommand({
      meta: {
        name: 'config:merge',
        description: 'Merge configuration objects'
      },
      args: {
        files: {
          type: 'string',
          description: 'Config files to merge (comma-separated)',
          required: true
        },
        output: {
          type: 'string',
          description: 'Output file path'
        }
      },
      async run({ args }) {
        try {
          const { readFile, writeFile } = await import('fs/promises');
          
          const files = args.files.split(',').map(f => f.trim());
          let merged = {};
          
          consola.info('Merging configuration files...');
          
          for (const file of files) {
            try {
              const content = await readFile(file, 'utf-8');
              const config = JSON.parse(content);
              merged = defu(merged, config);
              consola.success(`Merged: ${file}`);
            } catch (error) {
              consola.error(`Failed to merge ${file}:`, error.message);
            }
          }
          
          const result = JSON.stringify(merged, null, 2);
          
          if (args.output) {
            await writeFile(args.output, result);
            consola.success(`Merged config saved to: ${args.output}`);
          } else {
            console.log('Merged configuration:');
            console.log(result);
          }
          
        } catch (error) {
          consola.error('Configuration merge failed:', error.message);
        }
      }
    })
  }
};

/**
 * UnJS Bridge Manager
 */
export class UnJSBridgeManager {
  private bridges = new Map<string, UnJSTool>();
  
  constructor() {
    this.registerDefaultBridges();
  }
  
  private registerDefaultBridges() {
    this.register(nitroBridge);
    this.register(h3Bridge);
    this.register(unstorageBridge);
    this.register(ofetchBridge);
    this.register(sculeBridge);
    this.register(defuBridge);
  }
  
  register(bridge: UnJSTool) {
    this.bridges.set(bridge.name, bridge);
  }
  
  get(name: string): UnJSTool | undefined {
    return this.bridges.get(name);
  }
  
  list(): UnJSTool[] {
    return Array.from(this.bridges.values());
  }
  
  getCommands(): Record<string, any> {
    const commands: Record<string, any> = {};
    
    for (const bridge of this.bridges.values()) {
      if (bridge.commands) {
        Object.assign(commands, bridge.commands);
      }
    }
    
    return commands;
  }
  
  getByCategory(category: UnJSTool['category']): UnJSTool[] {
    return Array.from(this.bridges.values())
      .filter(bridge => bridge.category === category);
  }
  
  async checkDependencies(): Promise<{
    available: string[];
    missing: string[];
  }> {
    const available: string[] = [];
    const missing: string[] = [];
    
    for (const bridge of this.bridges.values()) {
      try {
        await import(bridge.package);
        available.push(bridge.package);
      } catch {
        missing.push(bridge.package);
      }
    }
    
    return { available, missing };
  }
}

/**
 * UnJS Bridge CLI Commands
 */
export const unjsBridgeCommand = defineCommand({
  meta: {
    name: 'unjs',
    description: 'UnJS ecosystem integration'
  },
  subCommands: {
    list: defineCommand({
      meta: {
        name: 'list',
        description: 'List available UnJS integrations'
      },
      args: {
        category: {
          type: 'string',
          description: 'Filter by category'
        }
      },
      run({ args }) {
        const manager = new UnJSBridgeManager();
        const bridges = args.category 
          ? manager.getByCategory(args.category as any)
          : manager.list();
        
        if (bridges.length === 0) {
          consola.info('No UnJS integrations found.');
          return;
        }
        
        consola.box('UnJS Ecosystem Integrations');
        
        const categories = bridges.reduce((acc, bridge) => {
          if (!acc[bridge.category]) acc[bridge.category] = [];
          acc[bridge.category].push(bridge);
          return acc;
        }, {} as Record<string, UnJSTool[]>);
        
        for (const [category, tools] of Object.entries(categories)) {
          console.log(`\n📦 ${category.toUpperCase()}:`);
          for (const tool of tools) {
            console.log(`  • ${tool.name} (${tool.package})`);
            console.log(`    ${tool.description}`);
          }
        }
        
        console.log('\nUse `unjs check` to verify installed packages.');
      }
    }),
    
    check: defineCommand({
      meta: {
        name: 'check',
        description: 'Check UnJS package availability'
      },
      async run() {
        const manager = new UnJSBridgeManager();
        const { available, missing } = await manager.checkDependencies();
        
        console.log('📚 UnJS Package Status:\n');
        
        if (available.length > 0) {
          console.log('✅ Available packages:');
          available.forEach(pkg => console.log(`  • ${pkg}`));
        }
        
        if (missing.length > 0) {
          console.log('\n❌ Missing packages:');
          missing.forEach(pkg => console.log(`  • ${pkg}`));
          console.log('\nInstall missing packages with: pnpm add <package-name>');
        }
        
        if (missing.length === 0) {
          consola.success('All UnJS packages are available!');
        }
      }
    }),
    
    install: defineCommand({
      meta: {
        name: 'install',
        description: 'Install UnJS packages'
      },
      args: {
        packages: {
          type: 'string',
          description: 'Packages to install (comma-separated)',
          multiple: true
        },
        dev: {
          type: 'boolean',
          description: 'Install as dev dependencies'
        }
      },
      async run({ args }) {
        if (!args.packages || args.packages.length === 0) {
          consola.error('No packages specified');
          return;
        }
        
        try {
          const { execa } = await import('execa');
          
          const packages = Array.isArray(args.packages) 
            ? args.packages.flatMap(p => p.split(','))
            : [args.packages];
          
          const command = args.dev ? 'add' : 'add';
          const flags = args.dev ? ['-D'] : [];
          
          consola.info(`Installing UnJS packages: ${packages.join(', ')}`);
          
          await execa('pnpm', [command, ...flags, ...packages], {
            stdio: 'inherit',
            cwd: process.cwd()
          });
          
          consola.success('UnJS packages installed successfully!');
          
        } catch (error) {
          consola.error('Failed to install packages:', error.message);
        }
      }
    }),
    
    // Include all bridge commands
    ...(() => {
      const manager = new UnJSBridgeManager();
      return manager.getCommands();
    })()
  }
});

// Export the bridge manager instance
export const unjsBridge = new UnJSBridgeManager();
