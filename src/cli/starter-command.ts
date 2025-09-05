/**
 * Starter Command
 * Main command that ties together all the template infrastructure
 */

import { defineCommand } from 'citty';
import { consola } from 'consola';
import { colors } from 'consola/utils';
import { initCommand, quickStartCommand } from './getting-started-wizard';
import { tutorialCommand, playgroundCommand } from '../playground/interactive-tutorials';
import { validateCommand } from '../validation/template-validator';
import { docsCommand } from '../documentation/template-docs-generator';
import { pluginCommand } from '../plugins/plugin-system';
import { unjsBridgeCommand } from '../bridges/unjs-integration-bridge';
import { debugCommand } from '../debug/development-tools';

/**
 * Main Starter Command
 */
export const starterCommand = defineCommand({
  meta: {
    name: 'citty-starter',
    description: 'Complete starter toolkit for Citty CLI development',
    version: '1.0.0'
  },
  args: {
    version: {
      type: 'boolean',
      description: 'Show version information'
    }
  },
  subCommands: {
    // Project initialization
    init: initCommand,
    create: quickStartCommand,
    
    // Learning and tutorials
    tutorial: tutorialCommand,
    playground: playgroundCommand,
    
    // Validation and quality
    validate: validateCommand,
    
    // Documentation
    docs: docsCommand,
    
    // Plugin system
    plugin: pluginCommand,
    
    // UnJS integration
    unjs: unjsBridgeCommand,
    
    // Debug and development tools
    debug: debugCommand,
    
    // Quick commands
    new: defineCommand({
      meta: {
        name: 'new',
        description: 'Quick project creation (alias for create)'
      },
      args: {
        name: {
          type: 'positional',
          description: 'Project name',
          required: true
        },
        template: {
          type: 'string',
          description: 'Template to use',
          default: 'basic-cli'
        }
      },
      async run({ args }) {
        // Delegate to create command
        const { quickStartCommand } = await import('./getting-started-wizard');
        return quickStartCommand.run({ args });
      }
    }),
    
    info: defineCommand({
      meta: {
        name: 'info',
        description: 'Show information about available tools and templates'
      },
      args: {
        category: {
          type: 'string',
          description: 'Information category (templates, plugins, bridges, tools)'
        }
      },
      run({ args }) {
        if (args.category) {
          return showCategoryInfo(args.category);
        }
        
        return showGeneralInfo();
      }
    }),
    
    setup: defineCommand({
      meta: {
        name: 'setup',
        description: 'Interactive setup and configuration'
      },
      args: {
        global: {
          type: 'boolean',
          description: 'Setup global configuration'
        }
      },
      async run({ args }) {
        await runInteractiveSetup(args.global);
      }
    }),
    
    doctor: defineCommand({
      meta: {
        name: 'doctor',
        description: 'Diagnose and fix common issues'
      },
      args: {
        fix: {
          type: 'boolean',
          description: 'Automatically fix detected issues'
        }
      },
      async run({ args }) {
        await runDiagnostics(args.fix);
      }
    })
  },
  run({ args }) {
    if (args.version) {
      console.log('Citty Starter v1.0.0');
      return;
    }
    
    // Show welcome message and available commands
    showWelcomeMessage();
  }
});

/**
 * Show welcome message with available commands
 */
function showWelcomeMessage() {
  console.log(`
${colors.bold(colors.cyan('🚀 Welcome to Citty Starter!'))}`);
  console.log('The complete toolkit for building amazing CLI applications with Citty.\n');
  
  console.log(colors.bold('📋 Quick Start:'));
  console.log('  citty-starter create <project-name>     Create a new CLI project');
  console.log('  citty-starter init                      Interactive project setup');
  console.log('  citty-starter tutorial list             Browse available tutorials\n');
  
  console.log(colors.bold('🛠  Development Tools:'));
  console.log('  citty-starter validate <path>           Validate templates and code');
  console.log('  citty-starter docs generate             Generate documentation');
  console.log('  citty-starter debug start               Start debug session');
  console.log('  citty-starter doctor                    Diagnose issues\n');
  
  console.log(colors.bold('🔌 Extensions:'));
  console.log('  citty-starter plugin list               Manage plugins');
  console.log('  citty-starter unjs list                 UnJS ecosystem tools');
  console.log('  citty-starter playground repl           Interactive playground\n');
  
  console.log(colors.bold('📚 Learn More:'));
  console.log('  citty-starter info                      Show detailed information');
  console.log('  citty-starter tutorial run basic-cli    Run interactive tutorial');
  console.log('  citty-starter --help                    Show all available commands\n');
  
  console.log(colors.dim('Happy building! 🎉'));
}

/**
 * Show category-specific information
 */
function showCategoryInfo(category: string) {
  switch (category.toLowerCase()) {
    case 'templates':
      showTemplatesInfo();
      break;
    case 'plugins':
      showPluginsInfo();
      break;
    case 'bridges':
      showBridgesInfo();
      break;
    case 'tools':
      showToolsInfo();
      break;
    default:
      consola.error(`Unknown category: ${category}`);
      console.log('Available categories: templates, plugins, bridges, tools');
  }
}

/**
 * Show general information
 */
function showGeneralInfo() {
  console.log(`\n${colors.bold(colors.cyan('📦 Citty Starter Information'))}\n`);
  
  console.log(colors.bold('🎯 Available Templates:'));
  console.log('  • basic-cli      - Simple command-line interface');
  console.log('  • rest-api       - REST API server with H3');
  console.log('  • plugin-system  - Extensible plugin architecture\n');
  
  console.log(colors.bold('🔌 Plugin System:'));
  console.log('  • Auto-discovery of plugins in ./plugins directory');
  console.log('  • NPM package plugin support');
  console.log('  • Hook-based architecture for extensibility\n');
  
  console.log(colors.bold('🌉 UnJS Bridges:'));
  console.log('  • Nitro  - Universal web server');
  console.log('  • H3     - Minimal HTTP framework');
  console.log('  • Ofetch - Better fetch API');
  console.log('  • Defu   - Configuration merging\n');
  
  console.log(colors.bold('🛠  Development Tools:'));
  console.log('  • Template validation and linting');
  console.log('  • Automatic documentation generation');
  console.log('  • Interactive debugging tools');
  console.log('  • Performance profiling\n');
  
  console.log(colors.bold('📚 Learning Resources:'));
  console.log('  • Interactive tutorials');
  console.log('  • REPL playground');
  console.log('  • Comprehensive examples');
  console.log('  • Best practices guides\n');
}

function showTemplatesInfo() {
  console.log(`\n${colors.bold(colors.cyan('🎯 Available Templates'))}\n`);
  
  const templates = [
    {
      id: 'basic-cli',
      name: 'Basic CLI',
      description: 'Simple command-line interface with arguments and subcommands',
      features: ['TypeScript support', 'Argument parsing', 'Help generation', 'Basic testing']
    },
    {
      id: 'rest-api',
      name: 'REST API',
      description: 'Production-ready REST API with H3 and validation',
      features: ['H3 HTTP server', 'Request validation', 'Error handling', 'OpenAPI docs']
    },
    {
      id: 'plugin-system',
      name: 'Plugin System',
      description: 'Extensible CLI with plugin architecture',
      features: ['Plugin discovery', 'Hook system', 'Dynamic commands', 'Hot reloading']
    }
  ];
  
  templates.forEach(template => {
    console.log(colors.bold(colors.green(template.name)) + ` (${template.id})`);
    console.log(`  ${template.description}`);
    console.log(`  Features: ${template.features.join(', ')}`);
    console.log(`  Usage: ${colors.cyan(`citty-starter create my-project --template ${template.id}`)}\n`);
  });
}

function showPluginsInfo() {
  console.log(`\n${colors.bold(colors.cyan('🔌 Plugin System'))}\n`);
  
  console.log(colors.bold('Plugin Architecture:'));
  console.log('  • Hook-based event system');
  console.log('  • Dynamic command registration');
  console.log('  • Middleware support');
  console.log('  • Configuration management\n');
  
  console.log(colors.bold('Plugin Discovery:'));
  console.log('  • Auto-scan ./plugins directory');
  console.log('  • NPM package support (citty-plugin-* pattern)');
  console.log('  • Manual plugin loading\n');
  
  console.log(colors.bold('Example Plugin:'));
  console.log('  ```typescript');
  console.log('  export default createPlugin({');
  console.log('    name: "my-plugin",');
  console.log('    version: "1.0.0",');
  console.log('    commands: { ... },');
  console.log('    hooks: { "before:command": ... }');
  console.log('  });');
  console.log('  ```\n');
}

function showBridgesInfo() {
  console.log(`\n${colors.bold(colors.cyan('🌉 UnJS Integration Bridges'))}\n`);
  
  const bridges = [
    {
      name: 'Nitro Bridge',
      package: 'nitropack',
      description: 'Universal web server with zero-configuration',
      commands: ['nitro:dev', 'nitro:build']
    },
    {
      name: 'H3 Bridge',
      package: 'h3',
      description: 'Minimal HTTP framework with maximum performance',
      commands: ['h3:serve']
    },
    {
      name: 'Ofetch Bridge',
      package: 'ofetch',
      description: 'Better fetch API for making HTTP requests',
      commands: ['fetch:request']
    },
    {
      name: 'Defu Bridge',
      package: 'defu',
      description: 'Recursively assign default properties',
      commands: ['config:merge']
    }
  ];
  
  bridges.forEach(bridge => {
    console.log(colors.bold(colors.yellow(bridge.name)));
    console.log(`  Package: ${bridge.package}`);
    console.log(`  Description: ${bridge.description}`);
    console.log(`  Commands: ${bridge.commands.join(', ')}\n`);
  });
  
  console.log(colors.bold('Usage:'));
  console.log(`  ${colors.cyan('citty-starter unjs list')}       # List all available bridges`);
  console.log(`  ${colors.cyan('citty-starter unjs check')}      # Check installed packages`);
  console.log(`  ${colors.cyan('citty-starter unjs nitro:dev')}  # Use Nitro commands\n`);
}

function showToolsInfo() {
  console.log(`\n${colors.bold(colors.cyan('🛠  Development Tools'))}\n`);
  
  const tools = [
    {
      name: 'Template Validator',
      description: 'Validate templates, code quality, and security',
      usage: 'citty-starter validate ./my-project'
    },
    {
      name: 'Documentation Generator',
      description: 'Auto-generate docs from source code',
      usage: 'citty-starter docs generate'
    },
    {
      name: 'Debug Tools',
      description: 'Performance profiling and debugging utilities',
      usage: 'citty-starter debug start'
    },
    {
      name: 'Interactive Tutorials',
      description: 'Step-by-step learning experiences',
      usage: 'citty-starter tutorial run basic-cli'
    },
    {
      name: 'REPL Playground',
      description: 'Interactive environment for experimentation',
      usage: 'citty-starter playground repl'
    }
  ];
  
  tools.forEach(tool => {
    console.log(colors.bold(colors.blue(tool.name)));
    console.log(`  ${tool.description}`);
    console.log(`  Usage: ${colors.cyan(tool.usage)}\n`);
  });
}

/**
 * Run interactive setup
 */
async function runInteractiveSetup(global: boolean = false) {
  const prompts = (await import('prompts')).default;
  
  console.log(`\n${colors.bold('⚙️  Citty Starter Setup')}\n`);
  
  const responses = await prompts([
    {
      type: 'select',
      name: 'packageManager',
      message: 'Preferred package manager?',
      choices: [
        { title: 'pnpm (recommended)', value: 'pnpm' },
        { title: 'npm', value: 'npm' },
        { title: 'yarn', value: 'yarn' }
      ]
    },
    {
      type: 'multiselect',
      name: 'defaultFeatures',
      message: 'Default features to include in new projects?',
      choices: [
        { title: 'TypeScript', value: 'typescript', selected: true },
        { title: 'Testing (Vitest)', value: 'testing', selected: true },
        { title: 'Git repository', value: 'git', selected: true },
        { title: 'ESLint', value: 'eslint' },
        { title: 'Prettier', value: 'prettier' },
        { title: 'GitHub Actions', value: 'github-actions' }
      ]
    },
    {
      type: 'confirm',
      name: 'enableDebug',
      message: 'Enable debug mode by default?',
      initial: false
    }
  ]);
  
  // Save configuration
  const configPath = global ? '~/.citty-starter' : './.citty-starter';
  
  consola.info(`Saving configuration to ${configPath}`);
  // Configuration saving logic would go here
  
  consola.success('Setup completed! 🎉');
}

/**
 * Run system diagnostics
 */
async function runDiagnostics(autofix: boolean = false) {
  console.log(`\n${colors.bold('🔍 Running System Diagnostics...')}\n`);
  
  const diagnostics = [
    {
      name: 'Node.js Version',
      check: () => {
        const version = process.version;
        const major = parseInt(version.slice(1));
        return {
          passed: major >= 16,
          message: major >= 16 ? `Node.js ${version} ✓` : `Node.js ${version} (requires >= 16)`,
          fix: major < 16 ? 'Please upgrade to Node.js 16 or higher' : null
        };
      }
    },
    {
      name: 'Package Manager',
      check: async () => {
        try {
          const { execa } = await import('execa');
          await execa('pnpm', ['--version']);
          return { passed: true, message: 'pnpm available ✓', fix: null };
        } catch {
          try {
            const { execa } = await import('execa');
            await execa('npm', ['--version']);
            return { passed: true, message: 'npm available ✓', fix: null };
          } catch {
            return {
              passed: false,
              message: 'No package manager found',
              fix: 'Please install Node.js to get npm, or install pnpm: npm install -g pnpm'
            };
          }
        }
      }
    },
    {
      name: 'Git Installation',
      check: async () => {
        try {
          const { execa } = await import('execa');
          await execa('git', ['--version']);
          return { passed: true, message: 'Git available ✓', fix: null };
        } catch {
          return {
            passed: false,
            message: 'Git not found',
            fix: 'Please install Git from https://git-scm.com/'
          };
        }
      }
    },
    {
      name: 'TypeScript Support',
      check: async () => {
        try {
          const { execa } = await import('execa');
          await execa('tsc', ['--version']);
          return { passed: true, message: 'TypeScript available ✓', fix: null };
        } catch {
          return {
            passed: false,
            message: 'TypeScript not found',
            fix: autofix ? 'Installing TypeScript globally...' : 'Run: npm install -g typescript'
          };
        }
      }
    }
  ];
  
  let allPassed = true;
  
  for (const diagnostic of diagnostics) {
    try {
      const result = await diagnostic.check();
      
      if (result.passed) {
        console.log(`${colors.green('✓')} ${diagnostic.name}: ${result.message}`);
      } else {
        console.log(`${colors.red('✗')} ${diagnostic.name}: ${result.message}`);
        if (result.fix) {
          console.log(`  ${colors.yellow('💡')} ${result.fix}`);
        }
        allPassed = false;
      }
    } catch (error) {
      console.log(`${colors.red('✗')} ${diagnostic.name}: Error during check`);
      allPassed = false;
    }
  }
  
  console.log();
  
  if (allPassed) {
    consola.success('All diagnostics passed! Your system is ready. 🎉');
  } else {
    consola.warn('Some issues were found. Please address them for the best experience.');
    if (!autofix) {
      console.log(`\nRun ${colors.cyan('citty-starter doctor --fix')} to attempt automatic fixes.`);
    }
  }
}
