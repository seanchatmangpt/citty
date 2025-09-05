/**
 * AI-Powered CLI Generator using Ollama
 * Generates CLI commands from natural language prompts using qwen2.5-coder:3b model
 */

import { ollama } from 'ollama-ai-provider-v2';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { CommandGenerationSchema } from '../ontology-to-zod';
import { toOntology } from '../ontology';
import consola from 'consola';
import chalk from 'chalk';
import ora from 'ora';

// Schema for AI command generation
const AIPromptSchema = z.object({
  prompt: z.string().describe('Natural language description of the CLI tool'),
  model: z.string().default('qwen2.5-coder:3b').describe('Ollama model to use'),
  complexity: z.enum(['simple', 'medium', 'complex']).default('medium').describe('CLI complexity level'),
  features: z.array(z.string()).optional().describe('Specific features to include'),
  style: z.enum(['modern', 'classic', 'minimal']).default('modern').describe('CLI style preference'),
  includeSubcommands: z.boolean().default(false).describe('Whether to include subcommands'),
  outputFormat: z.enum(['json', 'ontology', 'both']).default('both').describe('Output format')
});

export type AIPromptConfig = z.infer<typeof AIPromptSchema>;

export class OllamaGenerator {
  private model: string;
  private systemPrompt: string;

  constructor(model = 'qwen2.5-coder:3b') {
    this.model = model;
    this.systemPrompt = this.buildSystemPrompt();
  }

  /**
   * Generate CLI command structure from natural language prompt
   */
  async generateFromPrompt(config: AIPromptConfig): Promise<{
    command: any;
    ontology?: string;
    metadata: {
      model: string;
      prompt: string;
      complexity: string;
      generatedAt: string;
    };
  }> {
    const spinner = ora(chalk.blue('🤖 Connecting to Ollama...')).start();
    
    try {
      // Validate configuration
      const validConfig = AIPromptSchema.parse(config);
      
      spinner.text = chalk.blue(`🧠 Generating CLI with ${validConfig.model}...`);
      
      // Generate structured command using AI
      const result = await generateObject({
        model: ollama(validConfig.model),
        system: this.systemPrompt,
        prompt: this.buildUserPrompt(validConfig),
        schema: CommandGenerationSchema,
        temperature: 0.7,
        maxRetries: 2,
      });

      spinner.text = chalk.blue('🔄 Processing generated command...');
      
      const command = result.object;
      let ontology: string | undefined;

      // Generate ontology if requested
      if (validConfig.outputFormat === 'ontology' || validConfig.outputFormat === 'both') {
        const ontologyCommand = {
          meta: {
            name: command.name,
            description: command.description,
            version: command.version || '1.0.0'
          },
          args: this.convertArgsToOntologyFormat(command.args)
        };
        
        ontology = await toOntology(ontologyCommand);
      }

      spinner.succeed(chalk.green('✅ CLI generated successfully!'));

      const metadata = {
        model: validConfig.model,
        prompt: validConfig.prompt,
        complexity: validConfig.complexity,
        generatedAt: new Date().toISOString()
      };

      consola.success(`Generated "${command.name}" CLI with ${command.args.length} arguments`);
      
      if (command.subCommands?.length) {
        consola.info(`Included ${command.subCommands.length} subcommands`);
      }

      return {
        command,
        ontology,
        metadata
      };

    } catch (error) {
      spinner.fail(chalk.red('❌ Generation failed'));
      
      if (error instanceof Error) {
        if (error.message.includes('connection') || error.message.includes('ECONNREFUSED')) {
          consola.error('Ollama connection failed. Make sure Ollama is running:');
          consola.info('  1. Install Ollama: https://ollama.ai');
          consola.info('  2. Start Ollama: ollama serve');
          consola.info(`  3. Pull model: ollama pull ${this.model}`);
        } else if (error.message.includes('model')) {
          consola.error(`Model "${this.model}" not found. Pull it first:`);
          consola.info(`  ollama pull ${this.model}`);
        } else {
          consola.error('Generation error:', error.message);
        }
      }
      
      throw error;
    }
  }

  /**
   * Generate multiple CLI variations from a single prompt
   */
  async generateVariations(config: AIPromptConfig, count = 3): Promise<Array<{
    command: any;
    ontology?: string;
    metadata: any;
  }>> {
    const variations = [];
    const complexities: Array<'simple' | 'medium' | 'complex'> = ['simple', 'medium', 'complex'];
    
    for (let i = 0; i < count; i++) {
      const variationConfig = {
        ...config,
        complexity: complexities[i % complexities.length],
        model: config.model,
      };
      
      try {
        const result = await this.generateFromPrompt(variationConfig);
        variations.push(result);
      } catch (error) {
        consola.warn(`Failed to generate variation ${i + 1}:`, (error as Error).message);
      }
    }

    return variations;
  }

  /**
   * Enhance existing CLI command using AI
   */
  async enhanceCommand(command: any, enhancements: string[]): Promise<any> {
    const spinner = ora(chalk.blue('🚀 Enhancing CLI command...')).start();
    
    try {
      const enhancementPrompt = `
Enhance this existing CLI command with the following improvements:
${enhancements.map(e => `- ${e}`).join('\n')}

Current command:
${JSON.stringify(command, null, 2)}

Please return an enhanced version that includes the requested improvements while maintaining backward compatibility.
      `.trim();

      const result = await generateObject({
        model: ollama(this.model),
        system: this.systemPrompt,
        prompt: enhancementPrompt,
        schema: CommandGenerationSchema,
        temperature: 0.5,
      });

      spinner.succeed(chalk.green('✅ Command enhanced successfully!'));
      return result.object;

    } catch (error) {
      spinner.fail(chalk.red('❌ Enhancement failed'));
      throw error;
    }
  }

  /**
   * Generate CLI from existing tool documentation
   */
  async generateFromDocs(documentation: string, toolName: string): Promise<any> {
    const spinner = ora(chalk.blue('📚 Analyzing documentation...')).start();
    
    try {
      const docsPrompt = `
Analyze this documentation for "${toolName}" and generate a CLI command structure:

${documentation}

Create a comprehensive CLI that covers all the functionality described in the documentation.
Focus on the most important commands and options mentioned.
      `.trim();

      const result = await generateObject({
        model: ollama(this.model),
        system: this.systemPrompt,
        prompt: docsPrompt,
        schema: CommandGenerationSchema,
        temperature: 0.3,
      });

      spinner.succeed(chalk.green('✅ CLI generated from documentation!'));
      return result.object;

    } catch (error) {
      spinner.fail(chalk.red('❌ Documentation analysis failed'));
      throw error;
    }
  }

  /**
   * Build system prompt for consistent CLI generation
   */
  private buildSystemPrompt(): string {
    return `
You are an expert CLI designer and developer. Your task is to generate high-quality command-line interface structures from natural language descriptions.

Rules for CLI generation:
1. Create intuitive and user-friendly command names
2. Use consistent naming conventions (kebab-case for commands, camelCase for internal)
3. Include helpful descriptions for all commands and arguments
4. Add appropriate default values where sensible
5. Use proper argument types (string, number, boolean, enum)
6. Include aliases for commonly used options
7. Design commands following Unix philosophy (do one thing well)
8. Include validation and error handling considerations

For complex CLIs, create logical subcommand hierarchies.
For simple CLIs, focus on essential arguments and flags.

Always return valid JSON that matches the provided schema exactly.
Focus on practical, real-world usage patterns.
    `.trim();
  }

  /**
   * Build user prompt with context and requirements
   */
  private buildUserPrompt(config: AIPromptConfig): string {
    const { prompt, complexity, features, style, includeSubcommands } = config;
    
    let userPrompt = `Generate a ${complexity} CLI tool: ${prompt}`;
    
    if (features?.length) {
      userPrompt += `\n\nRequired features:\n${features.map(f => `- ${f}`).join('\n')}`;
    }
    
    userPrompt += `\n\nStyle: ${style}`;
    
    if (includeSubcommands) {
      userPrompt += '\n\nInclude appropriate subcommands for different operations.';
    }
    
    switch (complexity) {
      case 'simple': {
        userPrompt += '\n\nKeep it simple with 3-5 essential arguments/flags.';
        break;
      }
      case 'complex': {
        userPrompt += '\n\nCreate a comprehensive CLI with multiple subcommands and advanced options.';
        break;
      }
      default: {
        userPrompt += '\n\nBalance functionality with usability.';
      }
    }
    
    return userPrompt;
  }

  /**
   * Convert generated args to ontology format
   */
  private convertArgsToOntologyFormat(args: any[]): Record<string, any> {
    const ontologyArgs: Record<string, any> = {};
    
    for (const arg of args) {
      ontologyArgs[arg.name] = {
        type: arg.type,
        description: arg.description,
        ...(arg.required && { required: arg.required }),
        ...(arg.default !== undefined && { default: arg.default }),
        ...(arg.alias && { alias: arg.alias }),
        ...(arg.options && { options: arg.options })
      };
    }
    
    return ontologyArgs;
  }

  /**
   * Check if Ollama is available and model exists
   */
  async checkAvailability(): Promise<{
    ollamaRunning: boolean;
    modelAvailable: boolean;
    suggestions: string[];
  }> {
    const suggestions: string[] = [];
    let ollamaRunning = false;
    let modelAvailable = false;

    try {
      // Try to generate a simple test with the model
      await generateText({
        model: ollama(this.model),
        prompt: 'Hello',
        maxRetries: 1
      });
      
      ollamaRunning = true;
      modelAvailable = true;
      
    } catch (error) {
      if ((error as Error).message.includes('connection')) {
        suggestions.push('Start Ollama: ollama serve');
        suggestions.push('Install Ollama: https://ollama.ai');
      } else if ((error as Error).message.includes('model')) {
        ollamaRunning = true;
        suggestions.push(`Pull model: ollama pull ${this.model}`);
        suggestions.push('List models: ollama list');
      }
    }

    return { ollamaRunning, modelAvailable, suggestions };
  }

  /**
   * List available models from Ollama
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      // Attempt to connect to Ollama and get actual models
      const response = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        const models = data.models?.map((model: any) => model.name) || [];
        
        if (models.length > 0) {
          consola.success(`Found ${models.length} Ollama models`);
          return models.sort();
        }
      }
      
      // Fallback to common coding models if Ollama is not available
      consola.warn('Ollama not available, using default model list');
      const defaultModels = [
        'qwen2.5-coder:3b',
        'qwen2.5-coder:7b', 
        'qwen2.5-coder:14b',
        'codellama:7b',
        'codellama:13b',
        'deepseek-coder:6.7b',
        'llama3:8b',
        'mistral:7b',
        'phi3:medium'
      ];
      
      return defaultModels;
      
    } catch (error) {
      consola.warn(`Failed to fetch Ollama models: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Return minimal fallback models
      return [
        'qwen2.5-coder:3b',
        'codellama:7b',
        'llama3:8b'
      ];
    }
  }
}

// Export convenience functions
export const generateCLI = async (prompt: string, options?: Partial<AIPromptConfig>) => {
  const generator = new OllamaGenerator();
  const config: AIPromptConfig = {
    prompt,
    model: options?.model || 'qwen2.5-coder:3b',
    complexity: options?.complexity || 'medium',
    style: options?.style || 'modern',
    includeSubcommands: options?.includeSubcommands || false,
    outputFormat: options?.outputFormat || 'both',
    features: options?.features
  };
  return generator.generateFromPrompt(config);
};

export const enhanceCLI = async (command: any, enhancements: string[]) => {
  const generator = new OllamaGenerator();
  return generator.enhanceCommand(command, enhancements);
};

export const checkOllama = async (model?: string) => {
  const generator = new OllamaGenerator(model);
  return generator.checkAvailability();
};