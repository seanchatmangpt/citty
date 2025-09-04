/**
 * Template Management for Weaver Forge
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { existsSync } from 'node:fs';
import type { WeaverForgeConfig } from './forge-integration';

export interface TemplateInfo {
  name: string;
  description: string;
  type: 'cli' | 'otel' | 'custom';
  path: string;
}

export class WeaverTemplateManager {
  /**
   * List all available templates in a registry
   */
  async listTemplates(registryPath: string): Promise<TemplateInfo[]> {
    const templatesDir = join(registryPath, 'templates');
    const templates: TemplateInfo[] = [];
    
    if (!existsSync(templatesDir)) {
      return templates;
    }

    const files = await readdir(templatesDir);
    
    for (const file of files) {
      if (extname(file) === '.j2') {
        const templatePath = join(templatesDir, file);
        const content = await readFile(templatePath, 'utf-8');
        
        // Extract template metadata from comments
        const metadata = this.extractTemplateMetadata(content);
        
        templates.push({
          name: file.replace('.j2', ''),
          description: metadata.description || 'No description',
          type: metadata.type || 'custom',
          path: templatePath,
        });
      }
    }
    
    return templates;
  }

  /**
   * Create initial Weaver configuration
   */
  async createInitialConfig(registryPath: string, template: string): Promise<void> {
    const config = this.getConfigTemplate(template);
    const configPath = join(registryPath, 'weaver.yaml');
    const templatesDir = join(registryPath, 'templates');
    
    // Create templates directory
    await mkdir(templatesDir, { recursive: true });
    
    // Create default templates based on type
    await this.createDefaultTemplates(templatesDir, template);
    
    // Write configuration
    const configYaml = this.configToYaml(config);
    await writeFile(configPath, configYaml);
  }

  /**
   * Create a new template
   */
  async createTemplate(registryPath: string, name: string, type: 'cli' | 'otel' | 'custom'): Promise<void> {
    const templatesDir = join(registryPath, 'templates');
    const templatePath = join(templatesDir, `${name}.j2`);
    
    await mkdir(templatesDir, { recursive: true });
    
    const templateContent = this.getTemplateContent(type, name);
    await writeFile(templatePath, templateContent);
  }

  private extractTemplateMetadata(content: string): { description?: string; type?: 'cli' | 'otel' | 'custom' } {
    const lines = content.split('\n').slice(0, 10); // Check first 10 lines
    const metadata: any = {};
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('{#') && trimmed.includes('description:')) {
        const match = trimmed.match(/description:\s*(.+?)\s*#}/);
        if (match) {
          metadata.description = match[1];
        }
      }
      
      if (trimmed.startsWith('{#') && trimmed.includes('type:')) {
        const match = trimmed.match(/type:\s*(cli|otel|custom)\s*#}/);
        if (match) {
          metadata.type = match[1];
        }
      }
    }
    
    return metadata;
  }

  private getConfigTemplate(template: string): WeaverForgeConfig {
    switch (template) {
      case 'cli': {
        return {
          templates: [
            {
              template: 'cli_command.j2',
              filter: 'semconv_grouped_attributes',
              application_mode: 'each',
              output: 'commands/{group}.ts'
            },
            {
              template: 'cli_index.j2',
              filter: 'stable_attributes',
              application_mode: 'single',
              output: 'commands/index.ts'
            }
          ],
          whitespace_control: {
            trim_blocks: true,
            lstrip_blocks: true
          }
        };
      }
      
      case 'otel': {
        return {
          templates: [
            {
              template: 'otel_attributes.j2',
              filter: 'stable_attributes',
              application_mode: 'single',
              output: 'otel-attributes.ts'
            },
            {
              template: 'otel_instrumentation.j2',
              filter: 'semconv_grouped_attributes',
              application_mode: 'single',
              output: 'otel-instrumentation.ts'
            }
          ],
          whitespace_control: {
            trim_blocks: true,
            lstrip_blocks: true
          }
        };
      }
      
      case 'basic':
      default: {
        return {
          templates: [
            {
              template: 'attributes.j2',
              filter: 'stable_attributes',
              application_mode: 'single',
              output: 'attributes.ts'
            },
            {
              template: 'groups.j2',
              filter: 'semconv_grouped_attributes',
              application_mode: 'each',
              output: '{group}.ts'
            }
          ],
          whitespace_control: {
            trim_blocks: true,
            lstrip_blocks: true
          }
        };
      }
    }
  }

  private async createDefaultTemplates(templatesDir: string, template: string): Promise<void> {
    switch (template) {
      case 'cli': {
        await this.createCLITemplates(templatesDir);
        break;
      }
      case 'otel': {
        await this.createOTelTemplates(templatesDir);
        break;
      }
      case 'basic':
      default: {
        await this.createBasicTemplates(templatesDir);
        break;
      }
    }
  }

  private async createCLITemplates(templatesDir: string): Promise<void> {
    // CLI command template
    const cliCommandTemplate = `{# description: Generate Citty CLI commands from semantic conventions #}
{# type: cli #}
/**
 * {{ group.brief }}
 * Generated from semantic convention: {{ group.id }}
 */

import { defineCommand } from '../index';

export const {{ group.id | replace(".", "") | camelCase }}Command = defineCommand({
  meta: {
    name: '{{ group.id | kebabCase }}',
    description: '{{ group.brief }}',
    {% if group.note %}
    // {{ group.note }}
    {% endif %}
  },
  args: {
    {% for attr in group.attributes | sortAttributes %}
    {{ attr.id | camelCase }}: {
      type: '{{ attr.type | toArgType }}',
      description: '{{ attr.brief }}',
      {% if attr.requirement_level == 'required' %}
      required: true,
      {% endif %}
      {% if attr.examples %}
      valueHint: '{{ attr.examples[0] if attr.examples is iterable else attr.examples }}',
      {% endif %}
    },
    {% endfor %}
  },
  async run({ args }) {
    console.log('Executing {{ group.id }} with attributes:', args);
    
    // OpenTelemetry instrumentation
    const attributes = {
      {% for attr in group.attributes %}
      '{{ attr.id }}': args.{{ attr.id | camelCase }},
      {% endfor %}
    };
    
    // Add your implementation here
    // Example: const span = tracer.startSpan('{{ group.id }}', { attributes });
  },
});`;

    // CLI index template
    const cliIndexTemplate = `{# description: Generate index file for CLI commands #}
{# type: cli #}
/**
 * Semantic Convention CLI Commands
 * Generated from OpenTelemetry semantic conventions
 */

{% for group in groups %}
export { {{ group.id | replace(".", "") | camelCase }}Command } from './{{ group.id | kebabCase }}';
{% endfor %}

// Re-export all commands as a collection
export const semanticConventionCommands = {
  {% for group in groups %}
  {{ group.id | replace(".", "") | camelCase }}: {{ group.id | replace(".", "") | camelCase }}Command,
  {% endfor %}
};`;

    await writeFile(join(templatesDir, 'cli_command.j2'), cliCommandTemplate);
    await writeFile(join(templatesDir, 'cli_index.j2'), cliIndexTemplate);
  }

  private async createOTelTemplates(templatesDir: string): Promise<void> {
    // OTel attributes template
    const otelAttributesTemplate = `{# description: Generate OpenTelemetry attribute constants #}
{# type: otel #}
/**
 * OpenTelemetry Semantic Convention Attributes
 * Generated from semantic convention registry
 */

export const SEMANTIC_ATTRIBUTES = {
  {% for attr in attributes | sortAttributes %}
  {% for line in attr | toDocComment %}
  // {{ line }}
  {% endfor %}
  {{ attr.id | constantCase }}: '{{ attr.id }}',
  
  {% endfor %}
} as const;

export type SemanticAttributeKeys = keyof typeof SEMANTIC_ATTRIBUTES;
export type SemanticAttributeValues = typeof SEMANTIC_ATTRIBUTES[SemanticAttributeKeys];`;

    // OTel instrumentation template
    const otelInstrumentationTemplate = `{# description: Generate OpenTelemetry instrumentation helpers #}
{# type: otel #}
/**
 * OpenTelemetry Instrumentation Helpers
 * Generated from semantic convention registry
 */

import { trace, Span, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { SEMANTIC_ATTRIBUTES } from './otel-attributes';

export class SemanticConventionInstrumentation {
  private tracer = trace.getTracer('semantic-convention-instrumentation');

  {% for group in groups %}
  /**
   * {{ group.brief }}
   * {% if group.note %}
   * {{ group.note }}
   * {% endif %}
   */
  create{{ group.id | replace(".", "") | pascalCase }}Span(attributes: {
    {% for attr in group.attributes | sortAttributes %}
    {{ attr.id | camelCase }}{% if attr.requirement_level != 'required' %}?{% endif %}: {{ attr.type | toTypeScriptType }};
    {% endfor %}
  }): Span {
    return this.tracer.startSpan('{{ group.id }}', {
      kind: SpanKind.INTERNAL,
      attributes: {
        {% for attr in group.attributes %}
        [SEMANTIC_ATTRIBUTES.{{ attr.id | constantCase }}]: attributes.{{ attr.id | camelCase }},
        {% endfor %}
      }
    });
  }
  
  {% endfor %}
}

export const instrumentation = new SemanticConventionInstrumentation();`;

    await writeFile(join(templatesDir, 'otel_attributes.j2'), otelAttributesTemplate);
    await writeFile(join(templatesDir, 'otel_instrumentation.j2'), otelInstrumentationTemplate);
  }

  private async createBasicTemplates(templatesDir: string): Promise<void> {
    // Basic attributes template
    const attributesTemplate = `{# description: Generate basic attribute definitions #}
{# type: custom #}
/**
 * Semantic Convention Attributes
 */

export interface SemanticAttributes {
  {% for attr in attributes | sortAttributes %}
  /** {{ attr.brief }} */
  {{ attr.id | camelCase }}: {{ attr.type | toTypeScriptType }};
  {% endfor %}
}

export const ATTRIBUTE_KEYS = {
  {% for attr in attributes | sortAttributes %}
  {{ attr.id | constantCase }}: '{{ attr.id }}',
  {% endfor %}
} as const;`;

    // Basic groups template
    const groupsTemplate = `{# description: Generate group definitions #}
{# type: custom #}
/**
 * {{ group.brief }}
 * Semantic Convention Group: {{ group.id }}
 */

export interface {{ group.id | replace(".", "") | pascalCase }}Attributes {
  {% for attr in group.attributes | sortAttributes %}
  /** {{ attr.brief }} */
  {{ attr.id | camelCase }}{% if attr.requirement_level != 'required' %}?{% endif %}: {{ attr.type | toTypeScriptType }};
  {% endfor %}
}

export const {{ group.id | replace(".", "") | constantCase }}_ATTRIBUTES = {
  {% for attr in group.attributes %}
  {{ attr.id | constantCase }}: '{{ attr.id }}',
  {% endfor %}
} as const;`;

    await writeFile(join(templatesDir, 'attributes.j2'), attributesTemplate);
    await writeFile(join(templatesDir, 'groups.j2'), groupsTemplate);
  }

  private getTemplateContent(type: 'cli' | 'otel' | 'custom', name: string): string {
    switch (type) {
      case 'cli': {
        return `{# description: ${name} CLI command template #}
{# type: cli #}
/**
 * {{ group.brief }}
 */

import { defineCommand } from '../index';

export const ${name}Command = defineCommand({
  meta: {
    name: '${name}',
    description: '{{ group.brief }}',
  },
  args: {
    // Add your arguments here
  },
  async run({ args }) {
    // Add your implementation here
  },
});`;
      }

      case 'otel': {
        return `{# description: ${name} OpenTelemetry template #}
{# type: otel #}
/**
 * OpenTelemetry ${name}
 */

import { trace } from '@opentelemetry/api';

// Add your OpenTelemetry implementation here`;
      }

      case 'custom':
      default: {
        return `{# description: ${name} custom template #}
{# type: custom #}
/**
 * ${name}
 * Custom template
 */

// Add your custom template content here`;
      }
    }
  }

  private configToYaml(config: WeaverForgeConfig): string {
    let yaml = '';
    
    if (config.text_maps) {
      yaml += 'text_maps:\n';
      for (const [key, value] of Object.entries(config.text_maps)) {
        yaml += `  ${key}:\n`;
        for (const [k, v] of Object.entries(value)) {
          yaml += `    ${k}: "${v}"\n`;
        }
      }
      yaml += '\n';
    }
    
    yaml += 'templates:\n';
    for (const template of config.templates) {
      yaml += `  - template: "${template.template}"\n`;
      if (template.filter) {
        yaml += `    filter: ${template.filter}\n`;
      }
      yaml += `    application_mode: ${template.application_mode}\n`;
      if (template.output) {
        yaml += `    output: "${template.output}"\n`;
      }
      if (template.parameters) {
        yaml += '    parameters:\n';
        for (const [key, value] of Object.entries(template.parameters)) {
          yaml += `      ${key}: ${JSON.stringify(value)}\n`;
        }
      }
    }
    
    if (config.default_prefix) {
      yaml += `\ndefault_prefix: "${config.default_prefix}"\n`;
    }
    
    if (config.whitespace_control) {
      yaml += '\nwhitespace_control:\n';
      if (config.whitespace_control.trim_blocks !== undefined) {
        yaml += `  trim_blocks: ${config.whitespace_control.trim_blocks}\n`;
      }
      if (config.whitespace_control.lstrip_blocks !== undefined) {
        yaml += `  lstrip_blocks: ${config.whitespace_control.lstrip_blocks}\n`;
      }
    }
    
    if (config.params) {
      yaml += '\nparams:\n';
      for (const [key, value] of Object.entries(config.params)) {
        yaml += `  ${key}: ${JSON.stringify(value)}\n`;
      }
    }
    
    return yaml;
  }
}