import { promises as fs } from 'fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { resolve, dirname } from 'path';
import { PipelineConfig, PipelineConfigSchema } from '../types.js';

export class ConfigManager {
  async loadConfig(configPath: string): Promise<PipelineConfig> {
    try {
      const resolvedPath = resolve(configPath);
      const content = await fs.readFile(resolvedPath, 'utf-8');
      
      let config: any;
      
      if (configPath.endsWith('.yaml') || configPath.endsWith('.yml')) {
        config = parseYaml(content);
      } else if (configPath.endsWith('.json')) {
        config = JSON.parse(content);
      } else {
        // Try YAML first, then JSON
        try {
          config = parseYaml(content);
        } catch {
          config = JSON.parse(content);
        }
      }
      
      // Resolve relative paths
      config = await this.resolveConfigPaths(config, dirname(resolvedPath));
      
      // Validate configuration
      const validatedConfig = PipelineConfigSchema.parse(config);
      
      return validatedConfig;
      
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new Error(`Configuration file not found: ${configPath}`);
      }
      
      throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async saveConfig(configPath: string, config: PipelineConfig): Promise<void> {
    try {
      const resolvedPath = resolve(configPath);
      
      // Ensure directory exists
      await fs.mkdir(dirname(resolvedPath), { recursive: true });
      
      let content: string;
      
      if (configPath.endsWith('.json')) {
        content = JSON.stringify(config, null, 2);
      } else {
        // Default to YAML
        content = stringifyYaml(config, {
          indent: 2,
          quotingType: '"',
          defaultKeyType: 'PLAIN',
          defaultStringType: 'PLAIN',
        });
      }
      
      await fs.writeFile(resolvedPath, content, 'utf-8');
      
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async resolveConfigPaths(config: any, baseDir: string): Promise<any> {
    const resolved = { ...config };
    
    // Resolve ontology paths
    if (resolved.ontologies && Array.isArray(resolved.ontologies)) {
      resolved.ontologies = resolved.ontologies.map((ontology: any) => ({
        ...ontology,
        path: this.resolvePath(ontology.path, baseDir),
      }));
    }
    
    // Resolve template paths
    if (resolved.templates && Array.isArray(resolved.templates)) {
      resolved.templates = resolved.templates.map((template: any) => ({
        ...template,
        path: this.resolvePath(template.path, baseDir),
      }));
    }
    
    // Resolve output directory
    if (resolved.output && resolved.output.directory) {
      resolved.output.directory = this.resolvePath(resolved.output.directory, baseDir);
    }
    
    // Resolve validation schema path
    if (resolved.validation && resolved.validation.schema) {
      resolved.validation.schema = this.resolvePath(resolved.validation.schema, baseDir);
    }
    
    return resolved;
  }

  private resolvePath(path: string, baseDir: string): string {
    if (path.startsWith('./') || path.startsWith('../') || !path.startsWith('/')) {
      return resolve(baseDir, path);
    }
    return path;
  }

  async generateDefaultConfig(): Promise<PipelineConfig> {
    return {
      name: 'default-pipeline',
      ontologies: [
        {
          path: './ontology.ttl',
          format: 'turtle',
        },
      ],
      templates: [
        {
          path: './templates/**/*.njk',
          output: '{{ template.name | replace(".njk", "") }}.{{ template.ext | default("txt") }}',
        },
      ],
      output: {
        directory: './generated',
        clean: true,
      },
      hiveQueen: {
        enabled: true,
        workers: 4,
        parallelism: 'templates',
      },
      watch: {
        enabled: false,
        debounce: 500,
        ignore: [
          'node_modules/**',
          '.git/**',
          '**/*.log',
          '**/.*',
        ],
      },
      validation: {
        strict: false,
      },
    };
  }

  async mergeConfigs(baseConfig: PipelineConfig, overrides: Partial<PipelineConfig>): Promise<PipelineConfig> {
    const merged = { ...baseConfig };
    
    // Simple deep merge for nested objects
    if (overrides.ontologies) {
      merged.ontologies = overrides.ontologies;
    }
    
    if (overrides.templates) {
      merged.templates = overrides.templates;
    }
    
    if (overrides.output) {
      merged.output = { ...merged.output, ...overrides.output };
    }
    
    if (overrides.hiveQueen) {
      merged.hiveQueen = { ...merged.hiveQueen, ...overrides.hiveQueen };
    }
    
    if (overrides.watch) {
      merged.watch = { ...merged.watch, ...overrides.watch };
    }
    
    if (overrides.validation) {
      merged.validation = { ...merged.validation, ...overrides.validation };
    }
    
    // Direct assignments for simple fields
    if (overrides.name) merged.name = overrides.name;
    
    return merged;
  }

  async loadEnvironmentConfig(config: PipelineConfig): Promise<PipelineConfig> {
    const envConfig = { ...config };
    
    // Override with environment variables
    if (process.env.UNJUCKS_OUTPUT_DIR) {
      envConfig.output.directory = process.env.UNJUCKS_OUTPUT_DIR;
    }
    
    if (process.env.UNJUCKS_WORKERS) {
      const workers = parseInt(process.env.UNJUCKS_WORKERS, 10);
      if (!isNaN(workers)) {
        envConfig.hiveQueen = envConfig.hiveQueen || { enabled: true };
        envConfig.hiveQueen.workers = workers;
      }
    }
    
    if (process.env.UNJUCKS_HIVE_QUEEN === 'false') {
      envConfig.hiveQueen = { enabled: false };
    }
    
    if (process.env.UNJUCKS_WATCH === 'true') {
      envConfig.watch = envConfig.watch || { enabled: true };
      envConfig.watch.enabled = true;
    }
    
    if (process.env.UNJUCKS_VALIDATION_STRICT === 'true') {
      envConfig.validation = envConfig.validation || {};
      envConfig.validation.strict = true;
    }
    
    return envConfig;
  }

  validateConfigStructure(config: any): string[] {
    const errors: string[] = [];
    
    try {
      PipelineConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof Error && 'issues' in error) {
        const issues = (error as any).issues as Array<{ path: string[]; message: string }>;
        for (const issue of issues) {
          errors.push(`${issue.path.join('.')}: ${issue.message}`);
        }
      } else {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    
    return errors;
  }

  async createConfigTemplate(outputPath: string, options: {
    includeComments?: boolean;
    minimal?: boolean;
  } = {}): Promise<void> {
    const config = await this.generateDefaultConfig();
    
    let content: string;
    
    if (options.minimal) {
      const minimalConfig = {
        name: config.name,
        ontologies: config.ontologies,
        templates: config.templates,
        output: config.output,
      };
      content = stringifyYaml(minimalConfig, { indent: 2 });
    } else {
      content = stringifyYaml(config, { indent: 2 });
    }
    
    if (options.includeComments) {
      content = this.addConfigComments(content);
    }
    
    await fs.writeFile(outputPath, content, 'utf-8');
  }

  private addConfigComments(yamlContent: string): string {
    const lines = yamlContent.split('\n');
    const commented: string[] = [];
    
    commented.push('# Unjucks Pipeline Configuration');
    commented.push('# This file defines how ontologies are processed and templates are rendered');
    commented.push('');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('name:')) {
        commented.push('# Unique name for this pipeline configuration');
      } else if (line.includes('ontologies:')) {
        commented.push('# Source ontology files to load and process');
      } else if (line.includes('templates:')) {
        commented.push('# Template files to render with ontology context');
      } else if (line.includes('output:')) {
        commented.push('# Output configuration for generated files');
      } else if (line.includes('hiveQueen:')) {
        commented.push('# HIVE QUEEN orchestration settings for parallel processing');
      } else if (line.includes('watch:')) {
        commented.push('# File watching configuration for auto-regeneration');
      } else if (line.includes('validation:')) {
        commented.push('# Validation settings for generated output');
      }
      
      commented.push(line);
    }
    
    return commented.join('\n');
  }

  async findConfigFile(startDir: string = process.cwd()): Promise<string | null> {
    const configNames = [
      'unjucks.config.yaml',
      'unjucks.config.yml',
      'unjucks.config.json',
      '.unjucks.yaml',
      '.unjucks.yml',
      '.unjucks.json',
    ];
    
    let currentDir = resolve(startDir);
    
    while (true) {
      for (const configName of configNames) {
        const configPath = resolve(currentDir, configName);
        
        try {
          await fs.access(configPath);
          return configPath;
        } catch {
          // File doesn't exist, continue searching
        }
      }
      
      const parentDir = resolve(currentDir, '..');
      if (parentDir === currentDir) {
        // Reached filesystem root
        break;
      }
      currentDir = parentDir;
    }
    
    return null;
  }
}