/**
 * Integration Patterns Examples
 * Real-world examples showing how to integrate Citty with popular tools and frameworks
 */

export const integrationPatterns = {
  // Nitro Integration
  nitroIntegration: {
    name: 'Nitro Server Integration',
    description: 'Build CLI tools that work with Nitro server applications',
    code: `
import { defineCommand } from 'citty';
import { build, createDevServer } from 'nitropack';

export const nitroCommand = defineCommand({
  meta: {
    name: 'nitro',
    description: 'Nitro server management commands'
  },
  subCommands: {
    dev: defineCommand({
      meta: {
        name: 'dev',
        description: 'Start Nitro development server'
      },
      args: {
        port: {
          type: 'string',
          description: 'Port to run on',
          default: '3000'
        },
        host: {
          type: 'string', 
          description: 'Host to bind to',
          default: 'localhost'
        }
      },
      async run({ args }) {
        const server = createDevServer({
          rootDir: process.cwd(),
          dev: true
        });
        
        await server.listen(parseInt(args.port), {
          hostname: args.host
        });
        
        console.log(\`🚀 Nitro dev server running at http://\${args.host}:\${args.port}\`);
      }
    }),
    
    build: defineCommand({
      meta: {
        name: 'build',
        description: 'Build Nitro application'
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
        }
      },
      async run({ args }) {
        console.log('📦 Building Nitro application...');
        
        await build({
          rootDir: process.cwd(),
          preset: args.preset,
          minify: args.minify
        });
        
        console.log('✅ Build complete!');
      }
    })
  }
});
    `,
    dependencies: ['citty', 'nitropack']
  },

  // Nuxi Integration
  nuxiIntegration: {
    name: 'Nuxi CLI Integration',
    description: 'Extend Nuxi with custom commands and workflows',
    code: `
import { defineCommand } from 'citty';
import { loadKit } from '@nuxt/kit';
import { consola } from 'consola';

export const nuxtCommand = defineCommand({
  meta: {
    name: 'nuxt',
    description: 'Enhanced Nuxt development commands'
  },
  subCommands: {
    analyze: defineCommand({
      meta: {
        name: 'analyze',
        description: 'Analyze Nuxt application performance'
      },
      args: {
        bundle: {
          type: 'boolean',
          description: 'Analyze bundle size',
          default: true
        },
        routes: {
          type: 'boolean',
          description: 'Analyze route performance',
          default: true
        }
      },
      async run({ args }) {
        const { nuxt } = await loadKit(process.cwd());
        
        if (args.bundle) {
          consola.info('Analyzing bundle size...');
          // Bundle analysis logic
        }
        
        if (args.routes) {
          consola.info('Analyzing routes...');
          // Route analysis logic
        }
      }
    }),
    
    scaffold: defineCommand({
      meta: {
        name: 'scaffold',
        description: 'Scaffold Nuxt components and pages'
      },
      args: {
        type: {
          type: 'string',
          description: 'Type to scaffold',
          required: true
        },
        name: {
          type: 'string',
          description: 'Component/page name',
          required: true
        }
      },
      async run({ args }) {
        const templates = {
          component: \`<template>\n  <div class="\${args.name.toLowerCase()}">\n    <!-- \${args.name} component -->\n  </div>\n</template>\n\n<script setup lang="ts">\n\n</script>\n\n<style scoped>\n\n</style>\`,
          page: \`<template>\n  <div class="page-\${args.name.toLowerCase()}">\n    <h1>\${args.name}</h1>\n  </div>\n</template>\n\n<script setup lang="ts">\nuseHead({\n  title: '\${args.name}'\n});\n</script>\`
        };
        
        // Scaffolding logic here
        consola.success(\`Scaffolded \${args.type}: \${args.name}\`);
      }
    })
  }
});
    `,
    dependencies: ['citty', '@nuxt/kit', 'consola']
  },

  // H3 Integration
  h3Integration: {
    name: 'H3 Server Integration',
    description: 'Build server management CLIs with H3',
    code: `
import { defineCommand } from 'citty';
import { createApp, createRouter, defineEventHandler } from 'h3';
import { listen } from 'listhen';
import { watch } from 'chokidar';

export const h3Command = defineCommand({
  meta: {
    name: 'h3-server',
    description: 'H3 server with hot reload and development tools'
  },
  args: {
    port: {
      type: 'string',
      description: 'Port to listen on',
      default: '3000'
    },
    watch: {
      type: 'boolean',
      description: 'Enable hot reload',
      default: true
    },
    routes: {
      type: 'string',
      description: 'Routes directory',
      default: './routes'
    }
  },
  async run({ args }) {
    const app = createApp({
      debug: true,
      onError(error) {
        console.error('❌ Server error:', error);
      }
    });
    
    const router = createRouter();
    
    // Dynamic route loading
    const loadRoutes = async () => {
      // Route loading logic here
      router.get('/api/health', defineEventHandler(() => ({ status: 'ok' })));
    };
    
    await loadRoutes();
    app.use(router);
    
    // Hot reload setup
    if (args.watch) {
      watch(args.routes, { ignored: /node_modules/ })
        .on('change', async () => {
          console.log('🔄 Reloading routes...');
          await loadRoutes();
        });
    }
    
    const listener = await listen(app, {
      port: parseInt(args.port),
      showURL: true
    });
    
    console.log('✨ H3 server ready with hot reload!');
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🔄 Shutting down gracefully...');
      await listener.close();
      process.exit(0);
    });
  }
});
    `,
    dependencies: ['citty', 'h3', 'listhen', 'chokidar']
  },

  // UnJS Ecosystem Integration
  unjsEcosystem: {
    name: 'Complete UnJS Ecosystem',
    description: 'Full integration with UnJS tools ecosystem',
    code: `
import { defineCommand } from 'citty';
import { defu } from 'defu';
import { ofetch } from 'ofetch';
import { withQuery } from 'ufo';
import { joinURL } from 'ufo';
import consola from 'consola';

export const unjsCommand = defineCommand({
  meta: {
    name: 'unjs-tools',
    description: 'Unified UnJS ecosystem tools'
  },
  subCommands: {
    config: defineCommand({
      meta: {
        name: 'config',
        description: 'Configuration management with defu'
      },
      args: {
        merge: {
          type: 'string',
          description: 'Config files to merge',
          multiple: true
        }
      },
      async run({ args }) {
        const configs = args.merge || [];
        let finalConfig = {};
        
        for (const configPath of configs) {
          try {
            const config = await import(configPath);
            finalConfig = defu(finalConfig, config.default || config);
          } catch (error) {
            consola.error(\`Failed to load config: \${configPath}\`);
          }
        }
        
        consola.box('Merged Configuration');
        console.log(JSON.stringify(finalConfig, null, 2));
      }
    }),
    
    fetch: defineCommand({
      meta: {
        name: 'fetch',
        description: 'HTTP client with ofetch'
      },
      args: {
        url: {
          type: 'string',
          description: 'URL to fetch',
          required: true
        },
        method: {
          type: 'string',
          description: 'HTTP method',
          default: 'GET'
        },
        query: {
          type: 'string',
          description: 'Query parameters (JSON string)'
        },
        headers: {
          type: 'string',
          description: 'Request headers (JSON string)'
        }
      },
      async run({ args }) {
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
        
        try {
          const response = await ofetch(url, options);
          consola.success('Request successful!');
          console.log(JSON.stringify(response, null, 2));
        } catch (error) {
          consola.error('Request failed:', error.message);
        }
      }
    }),
    
    url: defineCommand({
      meta: {
        name: 'url',
        description: 'URL utilities with ufo'
      },
      args: {
        base: {
          type: 'string',
          description: 'Base URL',
          required: true
        },
        path: {
          type: 'string',
          description: 'Path to join',
          required: true
        }
      },
      run({ args }) {
        const joined = joinURL(args.base, args.path);
        consola.info('Joined URL:', joined);
        console.log(joined);
      }
    })
  }
});
    `,
    dependencies: ['citty', 'defu', 'ofetch', 'ufo', 'consola']
  },

  // Database Integration
  databaseIntegration: {
    name: 'Database CLI Integration',
    description: 'Database management commands with migrations and seeding',
    code: `
import { defineCommand } from 'citty';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export const databaseCommand = defineCommand({
  meta: {
    name: 'db',
    description: 'Database management commands'
  },
  subCommands: {
    migrate: defineCommand({
      meta: {
        name: 'migrate',
        description: 'Run database migrations'
      },
      args: {
        config: {
          type: 'string',
          description: 'Database config file',
          default: './db.config.json'
        },
        migrations: {
          type: 'string',
          description: 'Migrations directory',
          default: './migrations'
        }
      },
      async run({ args }) {
        try {
          const config: DatabaseConfig = require(args.config);
          const pool = new Pool(config);
          const db = drizzle(pool);
          
          console.log('📦 Running migrations...');
          await migrate(db, { migrationsFolder: args.migrations });
          
          console.log('✅ Migrations completed!');
          await pool.end();
        } catch (error) {
          console.error('❌ Migration failed:', error.message);
          process.exit(1);
        }
      }
    }),
    
    seed: defineCommand({
      meta: {
        name: 'seed',
        description: 'Seed database with test data'
      },
      args: {
        file: {
          type: 'string',
          description: 'Seed file to run',
          required: true
        }
      },
      async run({ args }) {
        try {
          const seedModule = await import(args.file);
          const seedFn = seedModule.default || seedModule.seed;
          
          if (typeof seedFn === 'function') {
            console.log('🌱 Running seed...');
            await seedFn();
            console.log('✅ Seed completed!');
          } else {
            console.error('❌ Seed file must export a function');
          }
        } catch (error) {
          console.error('❌ Seed failed:', error.message);
          process.exit(1);
        }
      }
    })
  }
});
    `,
    dependencies: ['citty', 'drizzle-orm', 'pg']
  },

  // Docker Integration
  dockerIntegration: {
    name: 'Docker Development Integration',
    description: 'Docker container management for development workflows',
    code: `
import { defineCommand } from 'citty';
import { execa } from 'execa';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'pathe';

export const dockerCommand = defineCommand({
  meta: {
    name: 'docker',
    description: 'Docker development tools'
  },
  subCommands: {
    dev: defineCommand({
      meta: {
        name: 'dev',
        description: 'Start development environment'
      },
      args: {
        services: {
          type: 'string',
          description: 'Services to start',
          multiple: true
        },
        detach: {
          type: 'boolean',
          description: 'Run in background',
          default: true
        }
      },
      async run({ args }) {
        const services = args.services || [];
        const command = ['docker-compose', 'up'];
        
        if (args.detach) command.push('-d');
        if (services.length > 0) command.push(...services);
        
        console.log('🐳 Starting development environment...');
        
        try {
          await execa(command[0], command.slice(1), {
            stdio: 'inherit',
            cwd: process.cwd()
          });
          console.log('✅ Development environment started!');
        } catch (error) {
          console.error('❌ Failed to start environment:', error.message);
        }
      }
    }),
    
    logs: defineCommand({
      meta: {
        name: 'logs',
        description: 'View service logs'
      },
      args: {
        service: {
          type: 'string',
          description: 'Service to view logs for'
        },
        follow: {
          type: 'boolean',
          description: 'Follow log output',
          default: false
        }
      },
      async run({ args }) {
        const command = ['docker-compose', 'logs'];
        
        if (args.follow) command.push('-f');
        if (args.service) command.push(args.service);
        
        try {
          await execa(command[0], command.slice(1), {
            stdio: 'inherit',
            cwd: process.cwd()
          });
        } catch (error) {
          console.error('❌ Failed to get logs:', error.message);
        }
      }
    })
  }
});
    `,
    dependencies: ['citty', 'execa', 'pathe']
  }
};

// Export utility function to get all patterns
export function getAllIntegrationPatterns() {
  return Object.values(integrationPatterns);
}

// Export specific pattern getter
export function getIntegrationPattern(name: string) {
  return Object.values(integrationPatterns).find(pattern => 
    pattern.name.toLowerCase().includes(name.toLowerCase())
  );
}
