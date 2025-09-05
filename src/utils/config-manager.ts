/**
 * Configuration Manager for Citty CLI
 * Handles loading, merging, and validating configuration from multiple sources
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { consola } from 'consola';
import { defu } from 'defu';
import type { TemplateContext } from '../types.js';

export interface CliConfig {
  version: string;
  templatesDir: string;
  outputDir: string;
  contextFiles: string[];
  ontologyFiles: string[];
  defaultGenerator: string;
  interactive: boolean;
  dryRun: boolean;
  showDiff: boolean;
  verbose: boolean;
  filters: Record<string, string>;
  env: Record<string, string>;
  hooks?: {
    beforeRender?: string;
    afterRender?: string;
    onError?: string;
  };
}

export interface ConfigValidationError {
  field: string;
  message: string;
  value?: any;
}

export class ConfigManager {
  private config: CliConfig;
  private configPath?: string;

  constructor() {
    this.config = this.getDefaultConfig();
  }

  /**
   * Load configuration from file and environment
   */
  async loadConfig(configPath?: string): Promise<CliConfig> {
    try {
      // Try to find config file if not specified
      if (!configPath) {
        const possiblePaths = [
          '.unjucks.json',
          '.unjucks.yaml',
          '.unjucks.yml',
          'unjucks.config.js',
          'unjucks.config.ts'
        ];

        for (const path of possiblePaths) {
          if (existsSync(path)) {
            configPath = path;
            break;
          }
        }
      }

      let fileConfig = {};

      if (configPath && existsSync(configPath)) {
        fileConfig = await this.loadConfigFile(configPath);
        this.configPath = configPath;
        consola.debug(`Loaded configuration from ${configPath}`);
      }

      // Load environment variables
      const envConfig = this.loadEnvironmentConfig();

      // Merge configurations (env > file > defaults)
      this.config = defu(envConfig, fileConfig, this.getDefaultConfig());

      // Validate merged configuration
      await this.validateConfig();

      return this.config;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      consola.error(`Failed to load configuration: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): CliConfig {
    return { ...this.config };
  }

  /**
   * Update configuration dynamically
   */
  updateConfig(updates: Partial<CliConfig>): void {
    this.config = defu(updates, this.config);
  }

  /**
   * Load configuration from file
   */
  private async loadConfigFile(filePath: string): Promise<Partial<CliConfig>> {
    const absolutePath = resolve(filePath);
    
    if (!existsSync(absolutePath)) {
      throw new Error(`Configuration file not found: ${absolutePath}`);
    }

    try {
      const content = readFileSync(absolutePath, 'utf-8');
      const ext = filePath.toLowerCase().split('.').pop();

      switch (ext) {
        case 'json':
          return JSON.parse(content);
        
        case 'yaml':
        case 'yml':
          return parseYaml(content);
        
        case 'js':
        case 'ts':
          // Dynamic import for JS/TS config files
          const configModule = await import(absolutePath);
          return configModule.default || configModule;
        
        default:
          throw new Error(`Unsupported configuration file format: ${ext}`);
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid configuration syntax in ${filePath}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Load configuration from environment variables
   */
  private loadEnvironmentConfig(): Partial<CliConfig> {
    const envConfig: Partial<CliConfig> = {};

    // Map environment variables to configuration
    const envMappings: Array<[string, keyof CliConfig, (value: string) => any]> = [
      ['UNJUCKS_TEMPLATES_DIR', 'templatesDir', (v) => v],
      ['UNJUCKS_OUTPUT_DIR', 'outputDir', (v) => v],
      ['UNJUCKS_DEFAULT_GENERATOR', 'defaultGenerator', (v) => v],
      ['UNJUCKS_INTERACTIVE', 'interactive', (v) => v.toLowerCase() === 'true'],
      ['UNJUCKS_DRY_RUN', 'dryRun', (v) => v.toLowerCase() === 'true'],
      ['UNJUCKS_SHOW_DIFF', 'showDiff', (v) => v.toLowerCase() === 'true'],
      ['UNJUCKS_VERBOSE', 'verbose', (v) => v.toLowerCase() === 'true'],
    ];

    for (const [envVar, configKey, transform] of envMappings) {
      const value = process.env[envVar];
      if (value !== undefined) {
        (envConfig as any)[configKey] = transform(value);
      }
    }

    // Handle array environment variables
    if (process.env.UNJUCKS_CONTEXT_FILES) {
      envConfig.contextFiles = process.env.UNJUCKS_CONTEXT_FILES.split(',').map(f => f.trim());
    }

    if (process.env.UNJUCKS_ONTOLOGY_FILES) {
      envConfig.ontologyFiles = process.env.UNJUCKS_ONTOLOGY_FILES.split(',').map(f => f.trim());
    }

    // Collect all environment variables starting with UNJUCKS_ENV_
    const envVars: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith('UNJUCKS_ENV_') && value !== undefined) {
        const envKey = key.replace('UNJUCKS_ENV_', '').toLowerCase();
        envVars[envKey] = value;
      }
    }

    if (Object.keys(envVars).length > 0) {
      envConfig.env = envVars;
    }

    return envConfig;
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): CliConfig {
    return {
      version: '1.0.0',
      templatesDir: './templates',
      outputDir: './generated',
      contextFiles: ['context.json'],
      ontologyFiles: ['ontology.json'],
      defaultGenerator: 'component',
      interactive: false,
      dryRun: false,
      showDiff: true,
      verbose: false,
      filters: {
        kebabCase: 'Convert to kebab-case',
        pascalCase: 'Convert to PascalCase',
        camelCase: 'Convert to camelCase',
        snakeCase: 'Convert to snake_case',
        upperCase: 'Convert to UPPER CASE',
        lowerCase: 'Convert to lower case',
        title: 'Convert to Title Case'
      },
      env: {},
      hooks: {
        beforeRender: undefined,
        afterRender: undefined,
        onError: undefined
      }
    };
  }

  /**
   * Validate configuration
   */
  private async validateConfig(): Promise<void> {
    const errors: ConfigValidationError[] = [];

    // Validate required fields
    if (!this.config.templatesDir) {
      errors.push({ field: 'templatesDir', message: 'Templates directory is required' });
    }

    if (!this.config.outputDir) {
      errors.push({ field: 'outputDir', message: 'Output directory is required' });
    }

    // Validate paths exist
    const templatesPath = resolve(this.config.templatesDir);
    if (!existsSync(templatesPath)) {
      errors.push({ 
        field: 'templatesDir', 
        message: `Templates directory does not exist: ${templatesPath}`,
        value: this.config.templatesDir
      });
    }

    // Validate context files exist
    for (const contextFile of this.config.contextFiles) {
      const contextPath = resolve(contextFile);
      if (!existsSync(contextPath)) {
        consola.warn(`Context file not found: ${contextPath}`);
      }
    }

    // Validate ontology files exist
    for (const ontologyFile of this.config.ontologyFiles) {
      const ontologyPath = resolve(ontologyFile);
      if (!existsSync(ontologyPath)) {
        consola.warn(`Ontology file not found: ${ontologyPath}`);
      }
    }

    // Validate version format
    const versionRegex = /^\d+\.\d+\.\d+(-.*)?$/;
    if (!versionRegex.test(this.config.version)) {
      errors.push({ 
        field: 'version', 
        message: 'Version must follow semantic versioning (x.y.z)',
        value: this.config.version
      });
    }

    if (errors.length > 0) {
      const errorMessage = errors.map(err => `${err.field}: ${err.message}`).join('\n');
      throw new Error(`Configuration validation failed:\n${errorMessage}`);
    }
  }

  /**
   * Resolve file paths relative to config file
   */
  resolveConfigPath(path: string): string {
    if (!this.configPath) {
      return resolve(path);
    }

    const configDir = resolve(this.configPath, '..');
    return resolve(configDir, path);
  }

  /**
   * Get resolved template directories
   */
  getTemplateDirs(): string[] {
    const dirs = Array.isArray(this.config.templatesDir) 
      ? this.config.templatesDir 
      : [this.config.templatesDir];
    
    return dirs.map(dir => this.resolveConfigPath(dir));
  }

  /**
   * Get resolved context files
   */
  getContextFiles(): string[] {
    return this.config.contextFiles.map(file => this.resolveConfigPath(file));
  }

  /**
   * Get resolved ontology files  
   */
  getOntologyFiles(): string[] {
    return this.config.ontologyFiles.map(file => this.resolveConfigPath(file));
  }

  /**
   * Get environment variables for templates
   */
  getEnvironmentVariables(): Record<string, string> {
    return {
      ...process.env,
      ...this.config.env
    };
  }

  /**
   * Execute configuration hook
   */
  async executeHook(hookName: keyof NonNullable<CliConfig['hooks']>, context: any): Promise<void> {
    const hook = this.config.hooks?.[hookName];
    if (!hook) return;

    try {
      if (typeof hook === 'string') {
        // Execute shell command
        const { spawn } = await import('node:child_process');
        const child = spawn(hook, { 
          stdio: 'inherit', 
          shell: true,
          env: this.getEnvironmentVariables()
        });

        await new Promise<void>((resolve, reject) => {
          child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Hook ${hookName} failed with exit code ${code}`));
          });
          child.on('error', reject);
        });
      } else if (typeof hook === 'function') {
        // Execute JavaScript function
        await hook(context);
      }
    } catch (error) {
      consola.warn(`Hook ${hookName} failed:`, error);
    }
  }

  /**
   * Get configuration summary for debugging
   */
  getSummary(): string {
    const summary = [
      `Configuration Summary:`,
      `  Templates Directory: ${this.config.templatesDir}`,
      `  Output Directory: ${this.config.outputDir}`,
      `  Default Generator: ${this.config.defaultGenerator}`,
      `  Interactive Mode: ${this.config.interactive}`,
      `  Dry Run: ${this.config.dryRun}`,
      `  Show Diff: ${this.config.showDiff}`,
      `  Context Files: ${this.config.contextFiles.join(', ')}`,
      `  Ontology Files: ${this.config.ontologyFiles.join(', ')}`,
      `  Custom Filters: ${Object.keys(this.config.filters).length}`,
      `  Environment Variables: ${Object.keys(this.config.env).length}`
    ];

    if (this.configPath) {
      summary.splice(1, 0, `  Config File: ${this.configPath}`);
    }

    return summary.join('\n');
  }
}

// Export singleton instance
export const configManager = new ConfigManager();
export default configManager;