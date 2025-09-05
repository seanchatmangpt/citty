/**
 * CLI Init Templates
 * Comprehensive collection of starter templates for common use cases
 */

import { defu } from 'defu';
import { join } from 'pathe';

export interface InitTemplate {
  id: string;
  name: string;
  description: string;
  category: 'basic' | 'api' | 'microservice' | 'plugin' | 'full-stack' | 'enterprise';
  tags: string[];
  files: TemplateFile[];
  dependencies: string[];
  devDependencies: string[];
  scripts: Record<string, string>;
  prompts?: TemplatePrompt[];
  postInstall?: string[];
}

export interface TemplateFile {
  path: string;
  content: string;
  template?: boolean; // Whether to process as template with variables
}

export interface TemplatePrompt {
  name: string;
  type: 'text' | 'select' | 'multiselect' | 'confirm';
  message: string;
  initial?: any;
  choices?: Array<{ title: string; value: any; description?: string }>;
  validate?: (value: any) => boolean | string;
}

// Basic CLI Template
export const basicCliTemplate: InitTemplate = {
  id: 'basic-cli',
  name: 'Basic CLI',
  description: 'Simple command-line interface with basic commands',
  category: 'basic',
  tags: ['cli', 'basic', 'starter'],
  files: [
    {
      path: 'src/main.ts',
      content: `import { defineCommand, runMain } from 'citty';
import { version } from '../package.json';

const main = defineCommand({
  meta: {
    name: '{{projectName}}',
    version,
    description: '{{description}}'
  },
  args: {
    name: {
      type: 'positional',
      description: 'Name to greet'
    },
    formal: {
      type: 'boolean',
      description: 'Use formal greeting'
    }
  },
  run({ args }) {
    const greeting = args.formal ? 'Good day' : 'Hello';
    console.log(\`\${greeting}, \${args.name || 'World'}!\`);
  }
});

export { main };
if (import.meta.main) {
  runMain(main);
}
`,
      template: true
    },
    {
      path: 'src/commands/info.ts',
      content: `import { defineCommand } from 'citty';
import { version, description } from '../../package.json';

export default defineCommand({
  meta: {
    name: 'info',
    description: 'Show project information'
  },
  run() {
    console.log(\`\n📦 \${JSON.parse(process.env.npm_package_name || '"{{projectName}}"')}\`);
    console.log(\`📝 \${description}\`);
    console.log(\`🏷️  v\${version}\`);
    console.log(\`📍 \${process.cwd()}\n\`);
  }
});
`,
      template: true
    },
    {
      path: 'package.json',
      content: `{
  "name": "{{projectName}}",
  "version": "0.1.0",
  "description": "{{description}}",
  "type": "module",
  "bin": {
    "{{binName}}": "./dist/main.mjs"
  },
  "main": "./dist/main.mjs",
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "unbuild",
    "dev": "unbuild --stub",
    "test": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
`,
      template: true
    },
    {
      path: 'build.config.ts',
      content: `import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: [
    'src/main'
  ],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: false
  }
});
`
    },
    {
      path: 'tsconfig.json',
      content: `{
  "extends": "@tsconfig/node18/tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}
`
    },
    {
      path: 'README.md',
      content: `# {{projectName}}

{{description}}

## Installation

\`\`\`bash
npm install -g {{projectName}}
\`\`\`

## Usage

\`\`\`bash
# Basic usage
{{binName}} "John Doe"

# Formal greeting
{{binName}} "John Doe" --formal

# Show info
{{binName}} info
\`\`\`

## Development

\`\`\`bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test
\`\`\`
`,
      template: true
    }
  ],
  dependencies: ['citty'],
  devDependencies: ['typescript', 'unbuild', 'vitest', '@tsconfig/node18'],
  scripts: {
    'build': 'unbuild',
    'dev': 'unbuild --stub',
    'test': 'vitest',
    'typecheck': 'tsc --noEmit'
  },
  prompts: [
    {
      name: 'projectName',
      type: 'text',
      message: 'Project name:',
      initial: 'my-cli'
    },
    {
      name: 'description',
      type: 'text',
      message: 'Project description:',
      initial: 'A simple CLI built with Citty'
    },
    {
      name: 'binName',
      type: 'text',
      message: 'Binary name:',
      initial: 'my-cli'
    }
  ]
};

// REST API Template
export const restApiTemplate: InitTemplate = {
  id: 'rest-api',
  name: 'REST API',
  description: 'Production-ready REST API with authentication and validation',
  category: 'api',
  tags: ['api', 'rest', 'server', 'auth'],
  files: [
    {
      path: 'src/main.ts',
      content: `import { defineCommand, runMain } from 'citty';
import { createServer } from './server';
import { version } from '../package.json';

const main = defineCommand({
  meta: {
    name: '{{projectName}}-api',
    version,
    description: '{{description}}'
  },
  args: {
    port: {
      type: 'string',
      description: 'Port to listen on',
      default: '3000'
    },
    host: {
      type: 'string',
      description: 'Host to bind to',
      default: '127.0.0.1'
    },
    env: {
      type: 'string',
      description: 'Environment',
      default: 'development'
    }
  },
  async run({ args }) {
    const server = createServer({
      port: parseInt(args.port),
      host: args.host,
      env: args.env
    });
    
    await server.listen();
    console.log(\`🚀 Server running at http://\${args.host}:\${args.port}\`);
  }
});

export { main };
if (import.meta.main) {
  runMain(main);
}
`,
      template: true
    },
    {
      path: 'src/server.ts',
      content: `import { createApp, createRouter, defineEventHandler, readBody } from 'h3';
import { listen } from 'listhen';
import { z } from 'zod';

const UserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().min(0).optional()
});

type User = z.infer<typeof UserSchema>;

interface ServerConfig {
  port: number;
  host: string;
  env: string;
}

export function createServer(config: ServerConfig) {
  const app = createApp();
  const router = createRouter();
  
  // In-memory storage (use database in production)
  const users: Map<string, User & { id: string }> = new Map();
  
  // Middleware
  app.use('/api/**', defineEventHandler(async (event) => {
    // CORS
    event.node.res.setHeader('Access-Control-Allow-Origin', '*');
    event.node.res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    event.node.res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    
    if (event.node.req.method === 'OPTIONS') {
      event.node.res.statusCode = 200;
      event.node.res.end();
      return;
    }
  }));
  
  // Routes
  router.get('/health', defineEventHandler(() => ({ status: 'ok', timestamp: new Date().toISOString() })));
  
  router.get('/users', defineEventHandler(() => Array.from(users.values())));
  
  router.post('/users', defineEventHandler(async (event) => {
    const body = await readBody(event);
    const validation = UserSchema.safeParse(body);
    
    if (!validation.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid user data',
        data: validation.error.errors
      });
    }
    
    const id = crypto.randomUUID();
    const user = { id, ...validation.data };
    users.set(id, user);
    
    return user;
  }));
  
  router.get('/users/:id', defineEventHandler((event) => {
    const id = getRouterParam(event, 'id');
    const user = users.get(id!);
    
    if (!user) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found'
      });
    }
    
    return user;
  }));
  
  router.put('/users/:id', defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id');
    const body = await readBody(event);
    
    if (!users.has(id!)) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found'
      });
    }
    
    const validation = UserSchema.partial().safeParse(body);
    if (!validation.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid user data',
        data: validation.error.errors
      });
    }
    
    const existingUser = users.get(id!)!;
    const updatedUser = { ...existingUser, ...validation.data };
    users.set(id!, updatedUser);
    
    return updatedUser;
  }));
  
  router.delete('/users/:id', defineEventHandler((event) => {
    const id = getRouterParam(event, 'id');
    
    if (!users.has(id!)) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found'
      });
    }
    
    users.delete(id!);
    return { success: true };
  }));
  
  app.use('/api', router);
  
  return {
    async listen() {
      return listen(app, {
        port: config.port,
        hostname: config.host
      });
    }
  };
}

// Helper function
function getRouterParam(event: any, name: string) {
  return event.context.params?.[name];
}

function createError(options: { statusCode: number; statusMessage: string; data?: any }) {
  const error = new Error(options.statusMessage);
  (error as any).statusCode = options.statusCode;
  (error as any).data = options.data;
  return error;
}
`
    },
    {
      path: 'package.json',
      content: `{
  "name": "{{projectName}}-api",
  "version": "0.1.0",
  "description": "{{description}}",
  "type": "module",
  "main": "./dist/main.mjs",
  "bin": {
    "{{binName}}": "./dist/main.mjs"
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "unbuild",
    "dev": "unbuild --stub && node dist/main.mjs",
    "test": "vitest",
    "test:e2e": "vitest run --config vitest.e2e.config.ts",
    "typecheck": "tsc --noEmit"
  }
}
`,
      template: true
    }
  ],
  dependencies: ['citty', 'h3', 'listhen', 'zod'],
  devDependencies: ['typescript', 'unbuild', 'vitest', '@tsconfig/node18', 'supertest', '@types/supertest'],
  scripts: {
    'build': 'unbuild',
    'dev': 'unbuild --stub && node dist/main.mjs',
    'test': 'vitest',
    'test:e2e': 'vitest run --config vitest.e2e.config.ts',
    'typecheck': 'tsc --noEmit'
  },
  prompts: [
    {
      name: 'projectName',
      type: 'text',
      message: 'Project name:',
      initial: 'my-api'
    },
    {
      name: 'description',
      type: 'text',
      message: 'API description:',
      initial: 'A REST API built with Citty and H3'
    },
    {
      name: 'binName',
      type: 'text',
      message: 'Binary name:',
      initial: 'my-api'
    }
  ]
};

// Plugin System Template
export const pluginSystemTemplate: InitTemplate = {
  id: 'plugin-system',
  name: 'Plugin System',
  description: 'Extensible CLI with plugin architecture and auto-discovery',
  category: 'plugin',
  tags: ['plugin', 'extensible', 'architecture'],
  files: [
    {
      path: 'src/main.ts',
      content: `import { defineCommand, runMain } from 'citty';
import { PluginManager } from './plugins/plugin-manager';
import { version } from '../package.json';

const pluginManager = new PluginManager();

const main = defineCommand({
  meta: {
    name: '{{projectName}}',
    version,
    description: '{{description}}'
  },
  args: {
    'load-plugin': {
      type: 'string',
      description: 'Load a specific plugin',
      multiple: true
    }
  },
  async setup(ctx) {
    // Auto-discover plugins
    await pluginManager.discover();
    
    // Load specified plugins
    if (ctx.args['load-plugin']) {
      const plugins = Array.isArray(ctx.args['load-plugin']) 
        ? ctx.args['load-plugin'] 
        : [ctx.args['load-plugin']];
      
      for (const plugin of plugins) {
        await pluginManager.load(plugin);
      }
    }
    
    // Register plugin commands
    const subCommands = pluginManager.getCommands();
    return { subCommands };
  },
  run() {
    console.log('🔌 Plugin-powered CLI ready!');
    console.log('\nAvailable plugins:');
    pluginManager.list().forEach(plugin => {
      console.log(\`  - \${plugin.name}: \${plugin.description}\`);
    });
    console.log('\nUse --help to see all available commands.');
  }
});

export { main };
if (import.meta.main) {
  runMain(main);
}
`,
      template: true
    },
    {
      path: 'src/plugins/plugin-manager.ts',
      content: `import { readdir } from 'fs/promises';
import { join, dirname } from 'pathe';
import { fileURLToPath } from 'url';
import { defineCommand } from 'citty';

export interface Plugin {
  name: string;
  version: string;
  description: string;
  commands?: Record<string, any>;
  hooks?: PluginHooks;
  setup?: () => Promise<void> | void;
  teardown?: () => Promise<void> | void;
}

export interface PluginHooks {
  'before:command'?: (command: string, args: any) => Promise<void> | void;
  'after:command'?: (command: string, args: any, result: any) => Promise<void> | void;
  'on:error'?: (error: Error, context: any) => Promise<void> | void;
}

export class PluginManager {
  private plugins = new Map<string, Plugin>();
  private hooks = new Map<keyof PluginHooks, Array<Function>>();
  
  async discover() {
    try {
      // Discover built-in plugins
      const pluginsDir = join(dirname(fileURLToPath(import.meta.url)), 'built-in');
      const files = await readdir(pluginsDir);
      
      for (const file of files) {
        if (file.endsWith('.js') || file.endsWith('.ts')) {
          const pluginPath = join(pluginsDir, file);
          try {
            const module = await import(pluginPath);
            const plugin = module.default || module;
            if (plugin && plugin.name) {
              await this.register(plugin);
            }
          } catch (error) {
            console.warn(\`Failed to load plugin \${file}:\`, error.message);
          }
        }
      }
    } catch {
      // Plugins directory doesn't exist, that's fine
    }
  }
  
  async register(plugin: Plugin) {
    if (this.plugins.has(plugin.name)) {
      throw new Error(\`Plugin '\${plugin.name}' is already registered\`);
    }
    
    this.plugins.set(plugin.name, plugin);
    
    // Register hooks
    if (plugin.hooks) {
      for (const [hook, handler] of Object.entries(plugin.hooks)) {
        if (!this.hooks.has(hook as keyof PluginHooks)) {
          this.hooks.set(hook as keyof PluginHooks, []);
        }
        this.hooks.get(hook as keyof PluginHooks)!.push(handler);
      }
    }
    
    // Setup plugin
    if (plugin.setup) {
      await plugin.setup();
    }
    
    console.log(\`✅ Registered plugin: \${plugin.name}\`);
  }
  
  async load(name: string) {
    try {
      // Try to require as npm package
      const module = await import(name);
      const plugin = module.default || module;
      if (plugin && plugin.name) {
        await this.register(plugin);
      }
    } catch (error) {
      console.error(\`Failed to load plugin '\${name}':\`, error.message);
    }
  }
  
  getCommands() {
    const commands: Record<string, any> = {};
    
    for (const plugin of this.plugins.values()) {
      if (plugin.commands) {
        Object.assign(commands, plugin.commands);
      }
    }
    
    return commands;
  }
  
  list() {
    return Array.from(this.plugins.values());
  }
  
  async executeHook(hook: keyof PluginHooks, ...args: any[]) {
    const handlers = this.hooks.get(hook) || [];
    for (const handler of handlers) {
      try {
        await handler(...args);
      } catch (error) {
        console.error(\`Hook '\${hook}' failed:\`, error.message);
      }
    }
  }
  
  async shutdown() {
    for (const plugin of this.plugins.values()) {
      if (plugin.teardown) {
        try {
          await plugin.teardown();
        } catch (error) {
          console.error(\`Plugin '\${plugin.name}' teardown failed:\`, error.message);
        }
      }
    }
  }
}
`
    },
    {
      path: 'src/plugins/built-in/example.ts',
      content: `import { defineCommand } from 'citty';
import type { Plugin } from '../plugin-manager';

const examplePlugin: Plugin = {
  name: 'example',
  version: '1.0.0',
  description: 'Example plugin demonstrating the plugin system',
  
  commands: {
    example: defineCommand({
      meta: {
        name: 'example',
        description: 'Run example command from plugin'
      },
      args: {
        message: {
          type: 'string',
          description: 'Message to display',
          default: 'Hello from plugin!'
        }
      },
      run({ args }) {
        console.log(\`🔌 \${args.message}\`);
      }
    })
  },
  
  hooks: {
    'before:command': async (command, args) => {
      console.log(\`📥 Example plugin: Before running \${command}\`);
    },
    'after:command': async (command, args, result) => {
      console.log(\`📤 Example plugin: After running \${command}\`);
    }
  },
  
  async setup() {
    console.log('🔧 Example plugin setup complete');
  },
  
  async teardown() {
    console.log('🧹 Example plugin cleanup complete');
  }
};

export default examplePlugin;
`
    }
  ],
  dependencies: ['citty', 'pathe'],
  devDependencies: ['typescript', 'unbuild', 'vitest', '@tsconfig/node18'],
  scripts: {
    'build': 'unbuild',
    'dev': 'unbuild --stub',
    'test': 'vitest',
    'typecheck': 'tsc --noEmit'
  },
  prompts: [
    {
      name: 'projectName',
      type: 'text',
      message: 'Project name:',
      initial: 'my-plugin-cli'
    },
    {
      name: 'description',
      type: 'text',
      message: 'Project description:',
      initial: 'An extensible CLI with plugin system'
    }
  ]
};

// All available templates
export const initTemplates = {
  'basic-cli': basicCliTemplate,
  'rest-api': restApiTemplate,
  'plugin-system': pluginSystemTemplate
} as const;

export type TemplateId = keyof typeof initTemplates;
