/**
 * Template Documentation Generator
 * Automatic documentation generation for templates and CLI projects
 */

import { defineCommand } from 'citty';
import { readFile, writeFile, readdir, mkdir, stat } from 'fs/promises';
import { join, basename, dirname, extname } from 'pathe';
import { consola } from 'consola';
import { colors } from 'consola/utils';

export interface DocTemplate {
  name: string;
  description: string;
  sections: DocSection[];
  frontMatter?: Record<string, any>;
}

export interface DocSection {
  id: string;
  title: string;
  content: string;
  order: number;
  type: 'text' | 'code' | 'api' | 'example' | 'table';
}

export interface APIDocumentation {
  commands: CommandDoc[];
  types: TypeDoc[];
  examples: ExampleDoc[];
}

export interface CommandDoc {
  name: string;
  description: string;
  usage: string;
  arguments: ArgumentDoc[];
  examples: string[];
  subcommands?: CommandDoc[];
}

export interface ArgumentDoc {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: any;
  alias?: string;
}

export interface TypeDoc {
  name: string;
  type: 'interface' | 'type' | 'enum';
  description: string;
  properties?: PropertyDoc[];
  values?: string[];
}

export interface PropertyDoc {
  name: string;
  type: string;
  description: string;
  optional: boolean;
  default?: any;
}

export interface ExampleDoc {
  title: string;
  description: string;
  code: string;
  output?: string;
}

/**
 * Template Documentation Analyzer
 */
export class DocumentationAnalyzer {
  async analyzeProject(projectPath: string): Promise<{
    commands: CommandDoc[];
    types: TypeDoc[];
    examples: ExampleDoc[];
    packageInfo: any;
  }> {
    const commands = await this.extractCommands(projectPath);
    const types = await this.extractTypes(projectPath);
    const examples = await this.extractExamples(projectPath);
    const packageInfo = await this.getPackageInfo(projectPath);
    
    return { commands, types, examples, packageInfo };
  }
  
  private async extractCommands(projectPath: string): Promise<CommandDoc[]> {
    const commands: CommandDoc[] = [];
    
    try {
      // Look for command files
      const srcPath = join(projectPath, 'src');
      const commandFiles = await this.findCommandFiles(srcPath);
      
      for (const file of commandFiles) {
        try {
          const content = await readFile(file, 'utf-8');
          const extractedCommands = this.parseCommandsFromCode(content);
          commands.push(...extractedCommands);
        } catch (error) {
          consola.warn(`Failed to parse commands from ${file}:`, error.message);
        }
      }
    } catch (error) {
      consola.warn('Failed to extract commands:', error.message);
    }
    
    return commands;
  }
  
  private async findCommandFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await readdir(dirPath);
      
      for (const entry of entries) {
        const fullPath = join(dirPath, entry);
        const stats = await stat(fullPath);
        
        if (stats.isDirectory() && !entry.startsWith('.')) {
          const subFiles = await this.findCommandFiles(fullPath);
          files.push(...subFiles);
        } else if (stats.isFile() && (entry.endsWith('.ts') || entry.endsWith('.js'))) {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist or permission error
    }
    
    return files;
  }
  
  private parseCommandsFromCode(code: string): CommandDoc[] {
    const commands: CommandDoc[] = [];
    
    // Simple regex-based extraction - could be enhanced with AST parsing
    const defineCommandRegex = /defineCommand\(\s*{([\s\S]*?)}\s*\)/g;
    let match;
    
    while ((match = defineCommandRegex.exec(code)) !== null) {
      try {
        const commandConfig = match[1];
        const command = this.parseCommandConfig(commandConfig);
        if (command) {
          commands.push(command);
        }
      } catch (error) {
        // Skip malformed commands
      }
    }
    
    return commands;
  }
  
  private parseCommandConfig(config: string): CommandDoc | null {
    try {
      // Extract meta information
      const metaMatch = config.match(/meta\s*:\s*{([\s\S]*?)}/)
      const argsMatch = config.match(/args\s*:\s*{([\s\S]*?)}/)
      
      if (!metaMatch) return null;
      
      const metaContent = metaMatch[1];
      const nameMatch = metaContent.match(/name\s*:\s*['"`]([^'"`]+)['"`]/);
      const descMatch = metaContent.match(/description\s*:\s*['"`]([^'"`]+)['"`]/);
      
      if (!nameMatch) return null;
      
      const command: CommandDoc = {
        name: nameMatch[1],
        description: descMatch?.[1] || '',
        usage: `${nameMatch[1]} [options]`,
        arguments: [],
        examples: []
      };
      
      // Extract arguments
      if (argsMatch) {
        const argsContent = argsMatch[1];
        command.arguments = this.parseArguments(argsContent);
        
        // Update usage with arguments
        const requiredArgs = command.arguments.filter(arg => arg.required);
        const optionalArgs = command.arguments.filter(arg => !arg.required);
        
        let usage = command.name;
        if (requiredArgs.length > 0) {
          usage += ' ' + requiredArgs.map(arg => 
            arg.type === 'positional' ? `<${arg.name}>` : `--${arg.name} <value>`
          ).join(' ');
        }
        if (optionalArgs.length > 0) {
          usage += ' [options]';
        }
        
        command.usage = usage;
      }
      
      return command;
    } catch {
      return null;
    }
  }
  
  private parseArguments(argsContent: string): ArgumentDoc[] {
    const argumentDocs: ArgumentDoc[] = [];
    
    // Simple parsing - could be enhanced
    const argRegex = /(\w+)\s*:\s*{([^}]*)}/g;
    let match;
    
    while ((match = argRegex.exec(argsContent)) !== null) {
      const argName = match[1];
      const argConfig = match[2];
      
      const typeMatch = argConfig.match(/type\s*:\s*['"`]([^'"`]+)['"`]/);
      const descMatch = argConfig.match(/description\s*:\s*['"`]([^'"`]+)['"`]/);
      const requiredMatch = argConfig.match(/required\s*:\s*(true|false)/);
      const defaultMatch = argConfig.match(/default\s*:\s*([^,}]+)/);
      const aliasMatch = argConfig.match(/alias\s*:\s*['"`]([^'"`]+)['"`]/);
      
      argumentDocs.push({
        name: argName,
        type: typeMatch?.[1] || 'string',
        description: descMatch?.[1] || '',
        required: requiredMatch?.[1] === 'true',
        default: defaultMatch?.[1]?.trim(),
        alias: aliasMatch?.[1]
      });
    }
    
    return argumentDocs;
  }
  
  private async extractTypes(projectPath: string): Promise<TypeDoc[]> {
    const types: TypeDoc[] = [];
    
    try {
      const srcPath = join(projectPath, 'src');
      const typeFiles = await this.findTypeFiles(srcPath);
      
      for (const file of typeFiles) {
        try {
          const content = await readFile(file, 'utf-8');
          const extractedTypes = this.parseTypesFromCode(content);
          types.push(...extractedTypes);
        } catch (error) {
          consola.warn(`Failed to parse types from ${file}:`, error.message);
        }
      }
    } catch (error) {
      consola.warn('Failed to extract types:', error.message);
    }
    
    return types;
  }
  
  private async findTypeFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await readdir(dirPath);
      
      for (const entry of entries) {
        const fullPath = join(dirPath, entry);
        const stats = await stat(fullPath);
        
        if (stats.isDirectory() && !entry.startsWith('.')) {
          const subFiles = await this.findTypeFiles(fullPath);
          files.push(...subFiles);
        } else if (stats.isFile() && (entry.endsWith('.ts') || entry.includes('types'))) {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist
    }
    
    return files;
  }
  
  private parseTypesFromCode(code: string): TypeDoc[] {
    const types: TypeDoc[] = [];
    
    // Extract interfaces
    const interfaceRegex = /export\s+interface\s+(\w+)\s*{([^}]*)}/g;
    let match;
    
    while ((match = interfaceRegex.exec(code)) !== null) {
      const name = match[1];
      const content = match[2];
      
      types.push({
        name,
        type: 'interface',
        description: this.extractJSDocComment(code, match.index) || `${name} interface`,
        properties: this.parseInterfaceProperties(content)
      });
    }
    
    // Extract type aliases
    const typeRegex = /export\s+type\s+(\w+)\s*=\s*([^;]+);/g;
    
    while ((match = typeRegex.exec(code)) !== null) {
      const name = match[1];
      const definition = match[2].trim();
      
      types.push({
        name,
        type: 'type',
        description: this.extractJSDocComment(code, match.index) || `${name} type alias`
      });
    }
    
    // Extract enums
    const enumRegex = /export\s+enum\s+(\w+)\s*{([^}]*)}/g;
    
    while ((match = enumRegex.exec(code)) !== null) {
      const name = match[1];
      const content = match[2];
      
      types.push({
        name,
        type: 'enum',
        description: this.extractJSDocComment(code, match.index) || `${name} enum`,
        values: this.parseEnumValues(content)
      });
    }
    
    return types;
  }
  
  private extractJSDocComment(code: string, position: number): string | null {
    // Look backwards for JSDoc comment
    const beforeCode = code.substring(0, position);
    const commentMatch = beforeCode.match(/\/\*\*([\s\S]*?)\*\//g);
    
    if (commentMatch && commentMatch.length > 0) {
      const lastComment = commentMatch[commentMatch.length - 1];
      return lastComment.replace(/\/\*\*|\*\//g, '').replace(/^\s*\*\s?/gm, '').trim();
    }
    
    return null;
  }
  
  private parseInterfaceProperties(content: string): PropertyDoc[] {
    const properties: PropertyDoc[] = [];
    
    const propRegex = /(\w+)(\?)?:\s*([^;,}]+)/g;
    let match;
    
    while ((match = propRegex.exec(content)) !== null) {
      properties.push({
        name: match[1],
        type: match[3].trim(),
        description: '',
        optional: !!match[2]
      });
    }
    
    return properties;
  }
  
  private parseEnumValues(content: string): string[] {
    const values: string[] = [];
    
    const valueRegex = /(\w+)\s*(?:=\s*[^,}]+)?/g;
    let match;
    
    while ((match = valueRegex.exec(content)) !== null) {
      values.push(match[1]);
    }
    
    return values;
  }
  
  private async extractExamples(projectPath: string): Promise<ExampleDoc[]> {
    const examples: ExampleDoc[] = [];
    
    try {
      // Look for example files
      const possibleDirs = ['examples', 'docs/examples', 'src/examples'];
      
      for (const dir of possibleDirs) {
        const examplePath = join(projectPath, dir);
        try {
          const exampleFiles = await this.findExampleFiles(examplePath);
          
          for (const file of exampleFiles) {
            try {
              const content = await readFile(file, 'utf-8');
              const example = this.parseExampleFile(file, content);
              if (example) {
                examples.push(example);
              }
            } catch (error) {
              consola.warn(`Failed to parse example ${file}:`, error.message);
            }
          }
        } catch {
          // Directory doesn't exist
        }
      }
    } catch (error) {
      consola.warn('Failed to extract examples:', error.message);
    }
    
    return examples;
  }
  
  private async findExampleFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await readdir(dirPath);
      
      for (const entry of entries) {
        const fullPath = join(dirPath, entry);
        const stats = await stat(fullPath);
        
        if (stats.isFile() && (entry.endsWith('.ts') || entry.endsWith('.js') || entry.endsWith('.md'))) {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist
    }
    
    return files;
  }
  
  private parseExampleFile(filePath: string, content: string): ExampleDoc | null {
    const fileName = basename(filePath, extname(filePath));
    
    // Extract title and description from comments or markdown
    let title = fileName.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    let description = '';
    
    if (filePath.endsWith('.md')) {
      const lines = content.split('\n');
      const titleMatch = lines[0]?.match(/^#+\s*(.+)$/);
      if (titleMatch) {
        title = titleMatch[1];
        description = lines.slice(1).find(line => line.trim() && !line.startsWith('#'))?.trim() || '';
      }
    } else {
      // Look for JSDoc comments
      const commentMatch = content.match(/\/\*\*([\s\S]*?)\*\*\//);
      if (commentMatch) {
        const comment = commentMatch[1].replace(/^\s*\*\s?/gm, '').trim();
        const lines = comment.split('\n');
        if (lines.length > 0) {
          title = lines[0] || title;
          description = lines.slice(1).join(' ').trim();
        }
      }
    }
    
    return {
      title,
      description,
      code: content
    };
  }
  
  private async getPackageInfo(projectPath: string): Promise<any> {
    try {
      const packageJsonPath = join(projectPath, 'package.json');
      const content = await readFile(packageJsonPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {
        name: 'Unknown Project',
        version: '0.0.0',
        description: 'No description available'
      };
    }
  }
}

/**
 * Documentation Generator
 */
export class DocumentationGenerator {
  private analyzer = new DocumentationAnalyzer();
  
  async generateDocs(projectPath: string, outputPath: string = 'docs'): Promise<void> {
    consola.start('Analyzing project...');
    
    const analysis = await this.analyzer.analyzeProject(projectPath);
    
    consola.info(`Found ${analysis.commands.length} commands, ${analysis.types.length} types, ${analysis.examples.length} examples`);
    
    // Ensure output directory exists
    const fullOutputPath = join(projectPath, outputPath);
    await mkdir(fullOutputPath, { recursive: true });
    
    // Generate different documentation files
    await this.generateReadme(fullOutputPath, analysis);
    await this.generateAPIReference(fullOutputPath, analysis);
    await this.generateExamplesDoc(fullOutputPath, analysis);
    
    if (analysis.commands.length > 0) {
      await this.generateCommandReference(fullOutputPath, analysis);
    }
    
    if (analysis.types.length > 0) {
      await this.generateTypeReference(fullOutputPath, analysis);
    }
    
    consola.success(`Documentation generated in ${fullOutputPath}`);
  }
  
  private async generateReadme(outputPath: string, analysis: any): Promise<void> {
    const { packageInfo, commands, examples } = analysis;
    
    const readme = `# ${packageInfo.name}

${packageInfo.description || 'A CLI application built with Citty'}

## Installation

\`\`\`bash
npm install -g ${packageInfo.name}
\`\`\`

## Usage

${commands.length > 0 ? `### Available Commands\n\n${commands.map(cmd => `- \`${cmd.name}\` - ${cmd.description}`).join('\n')}\n\n` : ''}${examples.length > 0 ? `### Quick Examples\n\n\`\`\`bash\n# Basic usage\n${packageInfo.name} --help\n\`\`\`\n\n` : ''}## Documentation

- [API Reference](./api.md)
- [Command Reference](./commands.md)
${examples.length > 0 ? '- [Examples](./examples.md)\n' : ''}${analysis.types.length > 0 ? '- [Type Reference](./types.md)\n' : ''}
## Development

\`\`\`bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test
\`\`\`

## License

${packageInfo.license || 'MIT'}
`;
    
    await writeFile(join(outputPath, 'README.md'), readme);
  }
  
  private async generateAPIReference(outputPath: string, analysis: any): Promise<void> {
    const { packageInfo, commands, types } = analysis;
    
    let content = `# ${packageInfo.name} - API Reference

${packageInfo.description || ''}

`;
    
    if (commands.length > 0) {
      content += `## Commands\n\n${commands.map(cmd => this.formatCommandDoc(cmd)).join('\n\n')}\n\n`;
    }
    
    if (types.length > 0) {
      content += `## Types\n\n${types.map(type => this.formatTypeDoc(type)).join('\n\n')}\n`;
    }
    
    await writeFile(join(outputPath, 'api.md'), content);
  }
  
  private async generateCommandReference(outputPath: string, analysis: any): Promise<void> {
    const { commands } = analysis;
    
    let content = `# Command Reference\n\nDetailed reference for all available commands.\n\n`;
    
    for (const command of commands) {
      content += this.formatDetailedCommandDoc(command) + '\n\n---\n\n';
    }
    
    await writeFile(join(outputPath, 'commands.md'), content);
  }
  
  private async generateTypeReference(outputPath: string, analysis: any): Promise<void> {
    const { types } = analysis;
    
    let content = `# Type Reference\n\nTypeScript type definitions and interfaces.\n\n`;
    
    const interfaces = types.filter(t => t.type === 'interface');
    const typeAliases = types.filter(t => t.type === 'type');
    const enums = types.filter(t => t.type === 'enum');
    
    if (interfaces.length > 0) {
      content += `## Interfaces\n\n${interfaces.map(type => this.formatDetailedTypeDoc(type)).join('\n\n')}\n\n`;
    }
    
    if (typeAliases.length > 0) {
      content += `## Type Aliases\n\n${typeAliases.map(type => this.formatDetailedTypeDoc(type)).join('\n\n')}\n\n`;
    }
    
    if (enums.length > 0) {
      content += `## Enums\n\n${enums.map(type => this.formatDetailedTypeDoc(type)).join('\n\n')}\n`;
    }
    
    await writeFile(join(outputPath, 'types.md'), content);
  }
  
  private async generateExamplesDoc(outputPath: string, analysis: any): Promise<void> {
    const { examples } = analysis;
    
    if (examples.length === 0) return;
    
    let content = `# Examples\n\nPractical examples of using this CLI.\n\n`;
    
    for (const example of examples) {
      content += `## ${example.title}\n\n${example.description}\n\n\`\`\`${extname(example.code) === '.ts' ? 'typescript' : 'javascript'}\n${example.code}\n\`\`\`\n\n${example.output ? `### Output\n\n\`\`\`\n${example.output}\n\`\`\`\n\n` : ''}`;
    }
    
    await writeFile(join(outputPath, 'examples.md'), content);
  }
  
  private formatCommandDoc(command: CommandDoc): string {
    let doc = `### \`${command.name}\`\n\n${command.description}\n\n**Usage:** \`${command.usage}\`\n`;
    
    if (command.arguments.length > 0) {
      doc += `\n**Arguments:**\n\n${command.arguments.map(arg => {
        const required = arg.required ? '(required)' : '(optional)';
        const alias = arg.alias ? ` (alias: \`-${arg.alias}\`)` : '';
        const defaultVal = arg.default ? ` (default: \`${arg.default}\`)` : '';
        return `- \`--${arg.name}\` ${required}${alias} - ${arg.description}${defaultVal}`;
      }).join('\n')}\n`;
    }
    
    return doc;
  }
  
  private formatDetailedCommandDoc(command: CommandDoc): string {
    let doc = `## \`${command.name}\`\n\n${command.description}\n\n### Usage\n\n\`\`\`bash\n${command.usage}\n\`\`\`\n`;
    
    if (command.arguments.length > 0) {
      doc += `\n### Arguments\n\n| Name | Type | Required | Default | Description |\n|------|------|----------|---------|-------------|\n`;
      doc += command.arguments.map(arg => {
        const required = arg.required ? 'Yes' : 'No';
        const defaultVal = arg.default || '-';
        return `| \`${arg.name}\` | \`${arg.type}\` | ${required} | \`${defaultVal}\` | ${arg.description} |`;
      }).join('\n');
    }
    
    if (command.examples.length > 0) {
      doc += `\n\n### Examples\n\n${command.examples.map(example => `\`\`\`bash\n${example}\n\`\`\``).join('\n\n')}`;
    }
    
    if (command.subcommands && command.subcommands.length > 0) {
      doc += `\n\n### Subcommands\n\n${command.subcommands.map(sub => `- \`${sub.name}\` - ${sub.description}`).join('\n')}`;
    }
    
    return doc;
  }
  
  private formatTypeDoc(type: TypeDoc): string {
    return `### \`${type.name}\`\n\n${type.description}\n\n**Type:** \`${type.type}\``;
  }
  
  private formatDetailedTypeDoc(type: TypeDoc): string {
    let doc = `### \`${type.name}\`\n\n${type.description}\n`;
    
    if (type.properties && type.properties.length > 0) {
      doc += `\n#### Properties\n\n| Name | Type | Optional | Description |\n|------|------|----------|-------------|\n`;
      doc += type.properties.map(prop => {
        const optional = prop.optional ? 'Yes' : 'No';
        return `| \`${prop.name}\` | \`${prop.type}\` | ${optional} | ${prop.description || '-'} |`;
      }).join('\n');
    }
    
    if (type.values && type.values.length > 0) {
      doc += `\n#### Values\n\n${type.values.map(value => `- \`${value}\``).join('\n')}`;
    }
    
    return doc;
  }
}

/**
 * Documentation CLI Commands
 */
export const docsCommand = defineCommand({
  meta: {
    name: 'docs',
    description: 'Generate documentation for CLI projects'
  },
  subCommands: {
    generate: defineCommand({
      meta: {
        name: 'generate',
        description: 'Generate documentation from source code'
      },
      args: {
        input: {
          type: 'string',
          description: 'Input project directory',
          default: '.'
        },
        output: {
          type: 'string',
          description: 'Output documentation directory',
          default: 'docs'
        },
        format: {
          type: 'string',
          description: 'Output format',
          default: 'markdown'
        }
      },
      async run({ args }) {
        const generator = new DocumentationGenerator();
        
        try {
          await generator.generateDocs(args.input, args.output);
        } catch (error) {
          consola.error('Documentation generation failed:', error.message);
          process.exit(1);
        }
      }
    }),
    
    analyze: defineCommand({
      meta: {
        name: 'analyze',
        description: 'Analyze project structure for documentation'
      },
      args: {
        path: {
          type: 'string',
          description: 'Project path to analyze',
          default: '.'
        },
        format: {
          type: 'string',
          description: 'Output format (json, table)',
          default: 'table'
        }
      },
      async run({ args }) {
        const analyzer = new DocumentationAnalyzer();
        
        try {
          consola.start('Analyzing project structure...');
          
          const analysis = await analyzer.analyzeProject(args.path);
          
          if (args.format === 'json') {
            console.log(JSON.stringify(analysis, null, 2));
          } else {
            // Table format
            console.log('\n' + colors.bold('Project Analysis Summary'));
            console.log('='.repeat(40));
            console.log(`Package: ${analysis.packageInfo.name}@${analysis.packageInfo.version}`);
            console.log(`Description: ${analysis.packageInfo.description || 'No description'}`);
            console.log(`Commands found: ${analysis.commands.length}`);
            console.log(`Types found: ${analysis.types.length}`);
            console.log(`Examples found: ${analysis.examples.length}`);
            
            if (analysis.commands.length > 0) {
              console.log('\n' + colors.bold('Commands:'));
              analysis.commands.forEach(cmd => {
                console.log(`  - ${colors.cyan(cmd.name)}: ${cmd.description}`);
              });
            }
            
            if (analysis.types.length > 0) {
              console.log('\n' + colors.bold('Types:'));
              analysis.types.forEach(type => {
                console.log(`  - ${colors.yellow(type.name)} (${type.type}): ${type.description}`);
              });
            }
          }
          
          consola.success('Analysis completed!');
          
        } catch (error) {
          consola.error('Analysis failed:', error.message);
          process.exit(1);
        }
      }
    })
  }
});
