import { consola } from 'consola';
import colors from 'picocolors';
import { UnjucksError, TemplateNotFoundError, OntologyError, ContextError } from '../types.js';
import { CommandSuggester } from './command-suggester.js';
import { EcosystemIntegration } from './ecosystem-integration.js';

export interface ErrorContext {
  command?: string;
  generator?: string;
  action?: string;
  templateDir?: string;
  availableGenerators?: string[];
  availableActions?: string[];
}

export class EnhancedErrorHandler {
  private suggester = new CommandSuggester();
  private ecosystem = new EcosystemIntegration();

  async handleError(error: unknown, context?: ErrorContext): Promise<void> {
    if (error instanceof TemplateNotFoundError) {
      await this.handleTemplateNotFound(error, context);
    } else if (error instanceof OntologyError) {
      await this.handleOntologyError(error, context);
    } else if (error instanceof ContextError) {
      await this.handleContextError(error, context);
    } else if (error instanceof UnjucksError) {
      await this.handleUnjucksError(error, context);
    } else {
      await this.handleUnexpectedError(error, context);
    }
  }

  private async handleTemplateNotFound(error: TemplateNotFoundError, context?: ErrorContext): Promise<void> {
    consola.error(colors.red('🚫 Template Not Found'));
    consola.error(colors.dim(`   ${error.message}`));
    
    console.log('');
    
    // Suggest similar generators/actions
    if (context?.generator && context.availableGenerators) {
      const suggestions = this.suggester.suggestCommands(context.generator, context.availableGenerators);
      if (suggestions.length > 0) {
        consola.info(colors.yellow('💡 Did you mean:'));
        suggestions.forEach(suggestion => {
          console.log(colors.dim('   • ') + colors.cyan(suggestion));
        });
        console.log('');
      }
    }

    // Show available options
    consola.info(colors.blue('📋 Available generators:'));
    if (context?.availableGenerators && context.availableGenerators.length > 0) {
      context.availableGenerators.forEach(gen => {
        console.log(colors.dim('   • ') + colors.green(gen));
      });
    } else {
      console.log(colors.dim('   No generators found. Run ') + colors.cyan('unjucks init') + colors.dim(' to create samples.'));
    }
    
    console.log('');
    this.showQuickStart();
  }

  private async handleOntologyError(error: OntologyError, context?: ErrorContext): Promise<void> {
    consola.error(colors.red('🧠 Ontology Error'));
    consola.error(colors.dim(`   ${error.message}`));
    
    console.log('');
    consola.info(colors.yellow('💡 Troubleshooting:'));
    
    if (error.details?.source) {
      console.log(colors.dim('   • Check ontology file format: ') + colors.cyan(error.details.source));
      console.log(colors.dim('   • Ensure valid JSON/RDF syntax'));
    }
    
    console.log(colors.dim('   • Validate with: ') + colors.cyan('unjucks validate --ontology <file>'));
    console.log(colors.dim('   • Create sample: ') + colors.cyan('unjucks init --force'));
    
    console.log('');
    this.showOntologyDocs();
  }

  private async handleContextError(error: ContextError, context?: ErrorContext): Promise<void> {
    consola.error(colors.red('📝 Context Error'));
    consola.error(colors.dim(`   ${error.message}`));
    
    console.log('');
    
    if (error.details?.missingKeys) {
      consola.info(colors.yellow('🔍 Missing context variables:'));
      error.details.missingKeys.forEach((key: string) => {
        console.log(colors.dim('   • ') + colors.red(key));
      });
      console.log('');
    }
    
    consola.info(colors.blue('💡 Solutions:'));
    console.log(colors.dim('   • Use interactive mode: ') + colors.cyan('unjucks --interactive'));
    console.log(colors.dim('   • Provide context file: ') + colors.cyan('unjucks --context context.json'));
    console.log(colors.dim('   • Create context file: ') + colors.cyan('echo \'{"key": "value"}\' > context.json'));
    
    console.log('');
    this.showContextExamples();
  }

  private async handleUnjucksError(error: UnjucksError, context?: ErrorContext): Promise<void> {
    consola.error(colors.red(`⚠️  ${error.name}`));
    consola.error(colors.dim(`   ${error.message}`));
    
    if (error.details) {
      console.log('');
      consola.debug('🔧 Debug details:', error.details);
    }
    
    console.log('');
    this.showGeneralHelp();
  }

  private async handleUnexpectedError(error: unknown, context?: ErrorContext): Promise<void> {
    consola.error(colors.red('💥 Unexpected Error'));
    consola.error(colors.dim(`   ${error instanceof Error ? error.message : String(error)}`));
    
    console.log('');
    consola.info(colors.yellow('🐛 This seems to be a bug. Please help us fix it:'));
    console.log(colors.dim('   • Report issue: ') + colors.cyan('https://github.com/unjs/unjucks/issues/new'));
    console.log(colors.dim('   • Include error details and command used'));
    console.log(colors.dim('   • Check existing issues first'));
    
    console.log('');
    this.showSupportInfo();
  }

  private showQuickStart(): void {
    consola.info(colors.blue('🚀 Quick Start:'));
    console.log(colors.dim('   1. Initialize: ') + colors.cyan('unjucks init'));
    console.log(colors.dim('   2. List templates: ') + colors.cyan('unjucks --list'));
    console.log(colors.dim('   3. Generate: ') + colors.cyan('unjucks component create --interactive'));
    console.log('');
  }

  private showOntologyDocs(): void {
    consola.info(colors.blue('📚 Ontology Documentation:'));
    console.log(colors.dim('   • Guide: ') + colors.cyan('https://unjucks.unjs.io/guide/ontology'));
    console.log(colors.dim('   • Examples: ') + colors.cyan('https://unjucks.unjs.io/examples/ontology'));
    console.log(colors.dim('   • Schema: ') + colors.cyan('https://unjucks.unjs.io/schema/ontology.json'));
    console.log('');
  }

  private showContextExamples(): void {
    consola.info(colors.blue('📋 Context Examples:'));
    console.log(colors.dim('   JSON: ') + colors.cyan('{"name": "Button", "props": ["onClick", "disabled"]}'));
    console.log(colors.dim('   YAML: ') + colors.cyan('name: Button\\nprops: [onClick, disabled]'));
    console.log('');
  }

  private showGeneralHelp(): void {
    consola.info(colors.blue('📖 Getting Help:'));
    console.log(colors.dim('   • Documentation: ') + colors.cyan('https://unjucks.unjs.io'));
    console.log(colors.dim('   • Examples: ') + colors.cyan('unjucks --examples'));
    console.log(colors.dim('   • Interactive help: ') + colors.cyan('unjucks --tips'));
    console.log(colors.dim('   • Community: ') + colors.cyan('https://discord.unjs.io'));
    console.log('');
  }

  private showSupportInfo(): void {
    consola.info(colors.blue('🤝 Support:'));
    console.log(colors.dim('   • Discord: ') + colors.cyan('https://discord.unjs.io'));
    console.log(colors.dim('   • GitHub: ') + colors.cyan('https://github.com/unjs/unjucks'));
    console.log(colors.dim('   • Twitter: ') + colors.cyan('@unjsio'));
    console.log('');
  }

  /**
   * Show recovery suggestions based on error type
   */
  async suggestRecovery(error: unknown, context?: ErrorContext): Promise<string[]> {
    const suggestions: string[] = [];
    
    if (error instanceof TemplateNotFoundError) {
      suggestions.push('Run `unjucks init` to create sample templates');
      suggestions.push('Use `unjucks --list` to see available templates');
      suggestions.push('Check template directory with `unjucks validate`');
    } else if (error instanceof ContextError) {
      suggestions.push('Use `unjucks --interactive` for guided setup');
      suggestions.push('Create a context file with required variables');
      suggestions.push('Use `unjucks --dry-run` to preview without errors');
    } else if (error instanceof OntologyError) {
      suggestions.push('Validate ontology file format');
      suggestions.push('Use `unjucks validate --ontology <file>`');
      suggestions.push('Check the ontology documentation');
    }
    
    return suggestions;
  }

  /**
   * Check if error might be due to missing dependencies
   */
  async checkDependencies(error: unknown): Promise<string[]> {
    const missing: string[] = [];
    
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('yaml') && message.includes('cannot find module')) {
        missing.push('yaml - Install with: npm install yaml');
      }
      
      if (message.includes('nunjucks') && message.includes('cannot find module')) {
        missing.push('nunjucks - Install with: npm install nunjucks');
      }
    }
    
    return missing;
  }
}