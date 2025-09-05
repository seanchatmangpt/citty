import { promises as fs } from 'fs';
import { glob } from 'glob';
import { PipelineConfig, ValidationError } from '../types.js';
import { OntologyLoader } from '../pipeline/ontology-loader.js';
import { TemplateEngine } from '../pipeline/template-engine.js';

interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    message: string;
    type: 'ontology' | 'template' | 'config' | 'dependency';
    context?: Record<string, unknown>;
  }>;
  warnings: Array<{
    message: string;
    type: 'ontology' | 'template' | 'config' | 'performance';
    context?: Record<string, unknown>;
  }>;
}

export class ValidationService {
  private ontologyLoader: OntologyLoader;
  private templateEngine: TemplateEngine;

  constructor() {
    this.ontologyLoader = new OntologyLoader();
    this.templateEngine = new TemplateEngine();
  }

  async validate(
    config: PipelineConfig,
    options: { strict?: boolean } = {}
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    try {
      // Validate configuration structure
      await this.validateConfiguration(config, result);

      // Validate ontology files
      await this.validateOntologies(config.ontologies, result);

      // Validate template files
      await this.validateTemplates(config.templates, result);

      // Validate output configuration
      await this.validateOutput(config.output, result);

      // Validate dependencies
      await this.validateDependencies(config, result);

      // Cross-validation between ontologies and templates
      if (result.errors.length === 0) {
        await this.validateCompatibility(config, result, options);
      }

    } catch (error) {
      result.errors.push({
        message: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
        type: 'config',
      });
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  private async validateConfiguration(
    config: PipelineConfig,
    result: ValidationResult
  ): Promise<void> {
    // Check required fields
    if (!config.name || typeof config.name !== 'string') {
      result.errors.push({
        message: 'Pipeline name is required and must be a string',
        type: 'config',
      });
    }

    if (!config.ontologies || !Array.isArray(config.ontologies) || config.ontologies.length === 0) {
      result.errors.push({
        message: 'At least one ontology source is required',
        type: 'config',
      });
    }

    if (!config.templates || !Array.isArray(config.templates) || config.templates.length === 0) {
      result.errors.push({
        message: 'At least one template configuration is required',
        type: 'config',
      });
    }

    if (!config.output || !config.output.directory) {
      result.errors.push({
        message: 'Output directory is required',
        type: 'config',
      });
    }

    // Validate HIVE QUEEN configuration
    if (config.hiveQueen?.enabled) {
      if (config.hiveQueen.workers && config.hiveQueen.workers < 1) {
        result.errors.push({
          message: 'HIVE QUEEN worker count must be at least 1',
          type: 'config',
        });
      }

      if (config.hiveQueen.workers && config.hiveQueen.workers > 16) {
        result.warnings.push({
          message: 'High worker count may consume excessive resources',
          type: 'performance',
          context: { workers: config.hiveQueen.workers },
        });
      }
    }

    // Validate watch configuration
    if (config.watch?.enabled) {
      if (config.watch.debounce && config.watch.debounce < 100) {
        result.warnings.push({
          message: 'Very low debounce value may cause excessive regeneration',
          type: 'performance',
          context: { debounce: config.watch.debounce },
        });
      }
    }
  }

  private async validateOntologies(
    ontologies: any[],
    result: ValidationResult
  ): Promise<void> {
    for (const [index, ontology] of ontologies.entries()) {
      try {
        // Check file existence
        await fs.access(ontology.path);

        // Validate syntax
        const syntaxValidation = await this.ontologyLoader.validateSyntax(ontology);
        if (!syntaxValidation.valid) {
          result.errors.push({
            message: `Ontology syntax errors in ${ontology.path}`,
            type: 'ontology',
            context: {
              index,
              path: ontology.path,
              errors: syntaxValidation.errors,
            },
          });
        }

        // Check file size
        const stats = await fs.stat(ontology.path);
        if (stats.size > 10 * 1024 * 1024) { // 10MB
          result.warnings.push({
            message: `Large ontology file may impact performance: ${ontology.path}`,
            type: 'performance',
            context: {
              path: ontology.path,
              sizeBytes: stats.size,
            },
          });
        }

        // Validate format
        const validFormats = ['turtle', 'n3', 'rdf-xml', 'json-ld'];
        if (!validFormats.includes(ontology.format)) {
          result.errors.push({
            message: `Unsupported ontology format: ${ontology.format}`,
            type: 'ontology',
            context: {
              path: ontology.path,
              format: ontology.format,
              supportedFormats: validFormats,
            },
          });
        }

      } catch (error) {
        result.errors.push({
          message: `Cannot access ontology file: ${ontology.path}`,
          type: 'ontology',
          context: {
            index,
            path: ontology.path,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }
  }

  private async validateTemplates(
    templates: any[],
    result: ValidationResult
  ): Promise<void> {
    for (const [index, template] of templates.entries()) {
      try {
        // Resolve template files (support glob patterns)
        const templateFiles = await glob(template.path, { absolute: true });
        
        if (templateFiles.length === 0) {
          result.errors.push({
            message: `No template files found matching pattern: ${template.path}`,
            type: 'template',
            context: { index, pattern: template.path },
          });
          continue;
        }

        // Validate each template file
        for (const templateFile of templateFiles) {
          const validation = await this.templateEngine.validateTemplate(templateFile);
          
          if (!validation.valid) {
            result.errors.push({
              message: `Template validation failed: ${templateFile}`,
              type: 'template',
              context: {
                file: templateFile,
                errors: validation.errors,
              },
            });
          }

          if (validation.warnings.length > 0) {
            result.warnings.push({
              message: `Template warnings: ${templateFile}`,
              type: 'template',
              context: {
                file: templateFile,
                warnings: validation.warnings,
              },
            });
          }
        }

        // Validate output pattern
        if (!template.output || typeof template.output !== 'string') {
          result.errors.push({
            message: 'Template output pattern is required and must be a string',
            type: 'template',
            context: { index, template: template.path },
          });
        }

      } catch (error) {
        result.errors.push({
          message: `Error validating template: ${template.path}`,
          type: 'template',
          context: {
            index,
            template: template.path,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }
  }

  private async validateOutput(
    output: any,
    result: ValidationResult
  ): Promise<void> {
    try {
      // Check if output directory is writable
      const stats = await fs.stat(output.directory).catch(() => null);
      
      if (!stats) {
        // Directory doesn't exist - try to create it
        try {
          await fs.mkdir(output.directory, { recursive: true });
        } catch (error) {
          result.errors.push({
            message: `Cannot create output directory: ${output.directory}`,
            type: 'config',
            context: {
              directory: output.directory,
              error: error instanceof Error ? error.message : String(error),
            },
          });
        }
      } else if (!stats.isDirectory()) {
        result.errors.push({
          message: `Output path exists but is not a directory: ${output.directory}`,
          type: 'config',
          context: { directory: output.directory },
        });
      }

      // Test write permissions
      const testFile = `${output.directory}/.unjucks-test-${Date.now()}`;
      try {
        await fs.writeFile(testFile, 'test');
        await fs.unlink(testFile);
      } catch (error) {
        result.errors.push({
          message: `Output directory is not writable: ${output.directory}`,
          type: 'config',
          context: {
            directory: output.directory,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }

    } catch (error) {
      result.errors.push({
        message: `Error validating output configuration`,
        type: 'config',
        context: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  private async validateDependencies(
    config: PipelineConfig,
    result: ValidationResult
  ): Promise<void> {
    const requiredPackages = ['n3', 'nunjucks'];
    const optionalPackages = ['chokidar', 'yaml', 'glob'];

    for (const pkg of requiredPackages) {
      try {
        await import(pkg);
      } catch (error) {
        result.errors.push({
          message: `Missing required dependency: ${pkg}`,
          type: 'dependency',
          context: { package: pkg },
        });
      }
    }

    for (const pkg of optionalPackages) {
      try {
        await import(pkg);
      } catch (error) {
        result.warnings.push({
          message: `Optional dependency not found: ${pkg}`,
          type: 'dependency',
          context: { package: pkg },
        });
      }
    }
  }

  private async validateCompatibility(
    config: PipelineConfig,
    result: ValidationResult,
    options: { strict?: boolean }
  ): Promise<void> {
    try {
      // Load a sample ontology to check template compatibility
      if (config.ontologies.length > 0) {
        const sampleOntology = await this.ontologyLoader.load(config.ontologies[0]);
        
        // Check if ontology has content
        if (sampleOntology.triples.length === 0) {
          result.warnings.push({
            message: `Ontology appears to be empty: ${config.ontologies[0].path}`,
            type: 'ontology',
            context: { path: config.ontologies[0].path },
          });
        }

        // Check for common ontology elements
        const hasClasses = sampleOntology.triples.some(t => 
          t.predicate === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
          (t.object === 'http://www.w3.org/2002/07/owl#Class' || 
           t.object === 'http://www.w3.org/2000/01/rdf-schema#Class')
        );

        const hasProperties = sampleOntology.triples.some(t =>
          t.predicate === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
          (t.object === 'http://www.w3.org/2002/07/owl#ObjectProperty' ||
           t.object === 'http://www.w3.org/2002/07/owl#DatatypeProperty' ||
           t.object === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property')
        );

        if (!hasClasses && !hasProperties) {
          result.warnings.push({
            message: 'Ontology does not appear to contain classes or properties',
            type: 'ontology',
            context: { path: config.ontologies[0].path },
          });
        }

        // Template variable analysis
        for (const template of config.templates) {
          const templateFiles = await glob(template.path, { absolute: true });
          
          for (const templateFile of templateFiles) {
            const templateInfo = this.templateEngine.getTemplateInfo(templateFile);
            
            // Check for undefined variables that might cause issues
            const problematicVariables = templateInfo.variables.filter(v => 
              !['ontology', 'query', 'filter', 'namespace', 'custom', 'loop', 'super', 'self'].includes(v)
            );

            if (problematicVariables.length > 0 && options.strict) {
              result.warnings.push({
                message: `Template uses potentially undefined variables: ${problematicVariables.join(', ')}`,
                type: 'template',
                context: {
                  template: templateFile,
                  variables: problematicVariables,
                },
              });
            }
          }
        }
      }

    } catch (error) {
      // Compatibility check failed - this is not necessarily an error
      result.warnings.push({
        message: `Could not perform compatibility check: ${error instanceof Error ? error.message : String(error)}`,
        type: 'config',
      });
    }
  }

  async validateGenerated(outputDirectory: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    try {
      // Check if output directory exists
      const stats = await fs.stat(outputDirectory).catch(() => null);
      
      if (!stats) {
        result.errors.push({
          message: `Output directory does not exist: ${outputDirectory}`,
          type: 'config',
        });
        return result;
      }

      // Get generated files
      const generatedFiles = await glob(`${outputDirectory}/**/*`, { 
        nodir: true,
        absolute: true,
      });

      if (generatedFiles.length === 0) {
        result.warnings.push({
          message: 'No files were generated',
          type: 'config',
        });
        return result;
      }

      // Validate each generated file
      for (const file of generatedFiles) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          
          // Check for template syntax that wasn't rendered
          if (content.includes('{{') || content.includes('{%')) {
            result.errors.push({
              message: `Generated file contains unrendered template syntax: ${file}`,
              type: 'template',
              context: { file },
            });
          }

          // Check file size
          if (content.length === 0) {
            result.warnings.push({
              message: `Generated file is empty: ${file}`,
              type: 'template',
              context: { file },
            });
          }

        } catch (error) {
          result.errors.push({
            message: `Cannot read generated file: ${file}`,
            type: 'config',
            context: {
              file,
              error: error instanceof Error ? error.message : String(error),
            },
          });
        }
      }

    } catch (error) {
      result.errors.push({
        message: `Error validating generated files: ${error instanceof Error ? error.message : String(error)}`,
        type: 'config',
      });
    }

    result.isValid = result.errors.length === 0;
    return result;
  }
}