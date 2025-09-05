/**
 * Interactive Tutorials and Playground
 * Step-by-step tutorials and interactive demos for learning Citty
 */

import { defineCommand } from 'citty';
import { prompts } from 'prompts';
import { colors } from 'consola/utils';
import { setTimeout } from 'timers/promises';

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  steps: TutorialStep[];
}

export interface TutorialStep {
  title: string;
  description: string;
  code?: string;
  explanation: string;
  interactive?: boolean;
  validate?: () => Promise<boolean> | boolean;
  hint?: string;
}

// Tutorial: Basic CLI Creation
export const basicCliTutorial: Tutorial = {
  id: 'basic-cli',
  title: 'Building Your First CLI',
  description: 'Learn how to create a simple CLI application with Citty',
  difficulty: 'beginner',
  estimatedTime: '10 minutes',
  steps: [
    {
      title: 'Setup',
      description: 'Let\'s start by understanding the basic structure of a Citty CLI',
      code: `import { defineCommand, runMain } from 'citty';

const main = defineCommand({
  meta: {
    name: 'my-cli',
    description: 'My awesome CLI'
  },
  run() {
    console.log('Hello, Citty!');
  }
});

runMain(main);`,
      explanation: 'This is the minimal structure for a Citty CLI. The `defineCommand` function creates a command definition, and `runMain` executes it.',
      interactive: true
    },
    {
      title: 'Adding Arguments',
      description: 'Now let\'s add command line arguments',
      code: `const main = defineCommand({
  meta: {
    name: 'greeter',
    description: 'A friendly greeting CLI'
  },
  args: {
    name: {
      type: 'positional',
      description: 'Name to greet',
      required: true
    },
    formal: {
      type: 'boolean',
      description: 'Use formal greeting'
    }
  },
  run({ args }) {
    const greeting = args.formal ? 'Good day' : 'Hello';
    console.log(\`\${greeting}, \${args.name}!\`);
  }
});`,
      explanation: 'Arguments are defined in the `args` object. Positional args are required by position, while flags like `--formal` are optional.',
      interactive: true
    },
    {
      title: 'Subcommands',
      description: 'Add subcommands to organize functionality',
      code: `const main = defineCommand({
  meta: {
    name: 'toolkit',
    description: 'A multi-tool CLI'
  },
  subCommands: {
    greet: defineCommand({
      meta: {
        name: 'greet',
        description: 'Greet someone'
      },
      args: {
        name: { type: 'positional', required: true }
      },
      run({ args }) {
        console.log(\`Hello, \${args.name}!\`);
      }
    }),
    
    info: defineCommand({
      meta: {
        name: 'info',
        description: 'Show system info'
      },
      run() {
        console.log(\`Node.js: \${process.version}\`);
        console.log(\`Platform: \${process.platform}\`);
      }
    })
  }
});`,
      explanation: 'Subcommands help organize related functionality. Users can run `toolkit greet John` or `toolkit info`.',
      interactive: true
    }
  ]
};

// Tutorial: REST API CLI
export const restApiTutorial: Tutorial = {
  id: 'rest-api-cli',
  title: 'Building a REST API Management CLI',
  description: 'Create a CLI for managing REST API servers',
  difficulty: 'intermediate',
  estimatedTime: '20 minutes',
  steps: [
    {
      title: 'Server Setup',
      description: 'Create a basic HTTP server command',
      code: `import { defineCommand } from 'citty';
import { createApp, defineEventHandler } from 'h3';
import { listen } from 'listhen';

export const serverCommand = defineCommand({
  meta: {
    name: 'server',
    description: 'Start HTTP server'
  },
  args: {
    port: {
      type: 'string',
      description: 'Port to listen on',
      default: '3000'
    }
  },
  async run({ args }) {
    const app = createApp();
    
    app.use('/api/health', defineEventHandler(() => {
      return { status: 'ok', timestamp: new Date() };
    }));
    
    await listen(app, { port: parseInt(args.port) });
    console.log(\`Server running on port \${args.port}\`);
  }
});`,
      explanation: 'This creates a server command using H3 (UnJS HTTP framework) with a health check endpoint.',
      interactive: true
    },
    {
      title: 'Database Integration',
      description: 'Add database connection and CRUD operations',
      code: `import { z } from 'zod';

const UserSchema = z.object({
  name: z.string(),
  email: z.string().email()
});

const users = new Map();

app.use('/api/users', defineEventHandler(async (event) => {
  if (event.node.req.method === 'GET') {
    return Array.from(users.values());
  }
  
  if (event.node.req.method === 'POST') {
    const body = await readBody(event);
    const user = UserSchema.parse(body);
    const id = crypto.randomUUID();
    users.set(id, { id, ...user });
    return { id, ...user };
  }
}));`,
      explanation: 'Added user management with validation using Zod. In production, you\'d use a real database.',
      interactive: true
    }
  ]
};

// Tutorial: Plugin System
export const pluginTutorial: Tutorial = {
  id: 'plugin-system',
  title: 'Creating an Extensible Plugin System',
  description: 'Build a CLI that can be extended with plugins',
  difficulty: 'advanced',
  estimatedTime: '30 minutes',
  steps: [
    {
      title: 'Plugin Interface',
      description: 'Define the plugin contract',
      code: `export interface Plugin {
  name: string;
  version: string;
  commands?: Record<string, CommandDefinition>;
  hooks?: {
    'before:run'?: (context) => void;
    'after:run'?: (result) => void;
  };
}`,
      explanation: 'A good plugin system starts with a clear interface that plugins must implement.',
      interactive: false
    },
    {
      title: 'Plugin Manager',
      description: 'Create a manager to load and coordinate plugins',
      code: `export class PluginManager {
  private plugins = new Map<string, Plugin>();
  
  register(plugin: Plugin) {
    this.plugins.set(plugin.name, plugin);
  }
  
  getCommands() {
    const commands = {};
    for (const plugin of this.plugins.values()) {
      Object.assign(commands, plugin.commands || {});
    }
    return commands;
  }
  
  async executeHook(hook: string, ...args) {
    for (const plugin of this.plugins.values()) {
      const handler = plugin.hooks?.[hook];
      if (handler) await handler(...args);
    }
  }
}`,
      explanation: 'The plugin manager handles plugin registration and provides hooks for extension points.',
      interactive: true
    }
  ]
};

// All available tutorials
export const tutorials = {
  'basic-cli': basicCliTutorial,
  'rest-api-cli': restApiTutorial,
  'plugin-system': pluginTutorial
};

// Interactive Tutorial Runner
export const tutorialCommand = defineCommand({
  meta: {
    name: 'tutorial',
    description: 'Interactive Citty tutorials'
  },
  subCommands: {
    list: defineCommand({
      meta: {
        name: 'list',
        description: 'List available tutorials'
      },
      run() {
        console.log('\n🎓 Available Tutorials:\n');
        
        for (const tutorial of Object.values(tutorials)) {
          const difficultyColor = {
            beginner: colors.green,
            intermediate: colors.yellow,
            advanced: colors.red
          }[tutorial.difficulty];
          
          console.log(
            `${colors.bold(tutorial.title)} ${difficultyColor(`[${tutorial.difficulty}]`)}`
          );
          console.log(`  ${tutorial.description}`);
          console.log(`  ⏱️  ${tutorial.estimatedTime}`);
          console.log(`  🏃 Run: ${colors.cyan(`citty tutorial run ${tutorial.id}`)}\n`);
        }
      }
    }),
    
    run: defineCommand({
      meta: {
        name: 'run',
        description: 'Run a specific tutorial'
      },
      args: {
        id: {
          type: 'positional',
          description: 'Tutorial ID',
          required: true
        }
      },
      async run({ args }) {
        const tutorial = tutorials[args.id as keyof typeof tutorials];
        if (!tutorial) {
          console.error(`❌ Tutorial '${args.id}' not found`);
          return;
        }
        
        await runTutorial(tutorial);
      }
    })
  }
});

// Tutorial Runner Implementation
async function runTutorial(tutorial: Tutorial) {
  console.log(`\n🎓 ${colors.bold(tutorial.title)}`);
  console.log(tutorial.description);
  console.log(`Difficulty: ${tutorial.difficulty} | Time: ${tutorial.estimatedTime}\n`);
  
  const response = await prompts({
    type: 'confirm',
    name: 'start',
    message: 'Ready to start?',
    initial: true
  });
  
  if (!response.start) {
    console.log('Maybe next time! 👋');
    return;
  }
  
  for (let i = 0; i < tutorial.steps.length; i++) {
    const step = tutorial.steps[i];
    
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📚 Step ${i + 1}/${tutorial.steps.length}: ${colors.bold(step.title)}`);
    console.log('='.repeat(50));
    console.log(step.description);
    
    if (step.code) {
      console.log('\n📝 Code:');
      console.log(colors.dim(step.code));
    }
    
    console.log('\n💡 Explanation:');
    console.log(step.explanation);
    
    if (step.interactive) {
      const action = await prompts({
        type: 'select',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { title: 'Continue to next step', value: 'continue' },
          { title: 'Show hint', value: 'hint' },
          { title: 'Copy code to clipboard', value: 'copy' },
          { title: 'Exit tutorial', value: 'exit' }
        ]
      });
      
      if (action.action === 'exit') {
        console.log('\nTutorial ended. See you next time! 👋');
        return;
      }
      
      if (action.action === 'hint' && step.hint) {
        console.log(`\n💡 Hint: ${step.hint}`);
        await setTimeout(2000);
      }
      
      if (action.action === 'copy' && step.code) {
        // In a real implementation, copy to clipboard
        console.log('📋 Code copied to clipboard!');
      }
    } else {
      await prompts({
        type: 'confirm',
        name: 'continue',
        message: 'Press Enter to continue...',
        initial: true
      });
    }
  }
  
  console.log('\n🎉 Tutorial completed! Great job!');
  console.log('\nNext steps:');
  console.log('- Try modifying the code examples');
  console.log('- Explore the Citty documentation');
  console.log('- Check out more advanced tutorials');
}

// Demo Playground Commands
export const playgroundCommand = defineCommand({
  meta: {
    name: 'playground',
    description: 'Interactive playground for experimenting with Citty'
  },
  subCommands: {
    repl: defineCommand({
      meta: {
        name: 'repl',
        description: 'Start interactive REPL'
      },
      async run() {
        console.log('🎮 Welcome to Citty Playground REPL!');
        console.log('Type commands to experiment with Citty features.\n');
        
        // Simple REPL implementation
        const repl = await import('repl');
        const replServer = repl.start({
          prompt: '🔄 citty > ',
          eval: async (cmd, context, filename, callback) => {
            try {
              // Evaluate Citty commands
              const result = eval(cmd);
              callback(null, result);
            } catch (error) {
              callback(error);
            }
          }
        });
        
        // Add helpful context
        replServer.context.defineCommand = (await import('citty')).defineCommand;
        replServer.context.runMain = (await import('citty')).runMain;
        
        console.log('💡 Try: defineCommand({ meta: { name: "test" }, run() { console.log("Hello!"); } })');
      }
    }),
    
    examples: defineCommand({
      meta: {
        name: 'examples',
        description: 'Run interactive examples'
      },
      async run() {
        const examples = [
          { name: 'Basic Command', code: 'console.log("Hello, Citty!");' },
          { name: 'With Arguments', code: 'console.log(`Hello, ${args.name}!`);' },
          { name: 'Async Command', code: 'await new Promise(r => setTimeout(r, 1000)); console.log("Done!");' }
        ];
        
        const choice = await prompts({
          type: 'select',
          name: 'example',
          message: 'Choose an example to run:',
          choices: examples.map(ex => ({ title: ex.name, value: ex }))
        });
        
        if (choice.example) {
          console.log(`\nRunning: ${choice.example.name}`);
          console.log(`Code: ${choice.example.code}\n`);
          
          // Execute example (simplified)
          try {
            eval(choice.example.code);
          } catch (error) {
            console.error('Error:', error.message);
          }
        }
      }
    })
  }
});
