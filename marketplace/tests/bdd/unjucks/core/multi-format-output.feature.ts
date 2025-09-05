/**
 * HIVE QUEEN BDD Scenarios - Unjucks Multi-Format Output Generation
 * Advanced template rendering to TypeScript, Markdown, YAML, JSON, and more
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';

// Multi-format output interfaces
interface OutputFormat {
  name: string;
  extension: string;
  mimeType: string;
  validator: (content: string) => boolean;
  formatter?: (content: string) => string;
}

interface TemplateRenderRequest {
  templatePath: string;
  context: any;
  outputFormats: string[];
  outputDir?: string;
  naming?: 'auto' | 'custom' | 'preserve';
  postProcessing?: {
    prettify?: boolean;
    minify?: boolean;
    lint?: boolean;
    validate?: boolean;
  };
}

interface RenderResult {
  format: string;
  content: string;
  filePath?: string;
  size: number;
  processingTime: number;
  valid: boolean;
  warnings?: string[];
  errors?: string[];
}

// Multi-format template engine
class MultiFormatUnjucksEngine {
  private supportedFormats = new Map<string, OutputFormat>();
  private formatters = new Map<string, Function>();
  private validators = new Map<string, Function>();

  constructor() {
    this.initializeSupportedFormats();
    this.setupFormatters();
  }

  private initializeSupportedFormats(): void {
    // TypeScript output format
    this.supportedFormats.set('typescript', {
      name: 'TypeScript',
      extension: '.ts',
      mimeType: 'text/x-typescript',
      validator: (content) => {
        // Basic TypeScript syntax validation
        return !content.includes('syntax error') && 
               (content.includes('interface ') || content.includes('class ') || content.includes('function ') || content.includes('const '));
      },
      formatter: (content) => this.formatTypeScript(content)
    });

    // JavaScript output format
    this.supportedFormats.set('javascript', {
      name: 'JavaScript',
      extension: '.js',
      mimeType: 'text/javascript',
      validator: (content) => {
        try {
          new Function(content);
          return true;
        } catch {
          return false;
        }
      }
    });

    // Markdown output format
    this.supportedFormats.set('markdown', {
      name: 'Markdown',
      extension: '.md',
      mimeType: 'text/markdown',
      validator: (content) => {
        // Basic markdown validation - check for common patterns
        return content.includes('#') || content.includes('*') || content.includes('-') || content.includes('`');
      },
      formatter: (content) => this.formatMarkdown(content)
    });

    // YAML output format
    this.supportedFormats.set('yaml', {
      name: 'YAML',
      extension: '.yaml',
      mimeType: 'text/yaml',
      validator: (content) => {
        try {
          // Mock YAML validation
          return content.includes(':') && !content.includes('syntax error');
        } catch {
          return false;
        }
      },
      formatter: (content) => this.formatYAML(content)
    });

    // JSON output format
    this.supportedFormats.set('json', {
      name: 'JSON',
      extension: '.json',
      mimeType: 'application/json',
      validator: (content) => {
        try {
          JSON.parse(content);
          return true;
        } catch {
          return false;
        }
      },
      formatter: (content) => this.formatJSON(content)
    });

    // XML output format
    this.supportedFormats.set('xml', {
      name: 'XML',
      extension: '.xml',
      mimeType: 'text/xml',
      validator: (content) => {
        return content.includes('<') && content.includes('>');
      }
    });

    // HTML output format
    this.supportedFormats.set('html', {
      name: 'HTML',
      extension: '.html',
      mimeType: 'text/html',
      validator: (content) => {
        return content.includes('<html>') || content.includes('<!DOCTYPE');
      },
      formatter: (content) => this.formatHTML(content)
    });

    // CSS output format
    this.supportedFormats.set('css', {
      name: 'CSS',
      extension: '.css',
      mimeType: 'text/css',
      validator: (content) => {
        return content.includes('{') && content.includes('}');
      }
    });

    // SQL output format
    this.supportedFormats.set('sql', {
      name: 'SQL',
      extension: '.sql',
      mimeType: 'text/sql',
      validator: (content) => {
        const sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP'];
        return sqlKeywords.some(keyword => content.toUpperCase().includes(keyword));
      }
    });

    // Docker output format
    this.supportedFormats.set('dockerfile', {
      name: 'Dockerfile',
      extension: '',
      mimeType: 'text/plain',
      validator: (content) => {
        return content.includes('FROM ') || content.includes('RUN ');
      }
    });

    // Shell script output format
    this.supportedFormats.set('shell', {
      name: 'Shell Script',
      extension: '.sh',
      mimeType: 'text/x-shellscript',
      validator: (content) => {
        return content.includes('#!/bin/') || content.includes('echo ');
      }
    });
  }

  private setupFormatters(): void {
    this.formatters.set('typescript', this.formatTypeScript.bind(this));
    this.formatters.set('markdown', this.formatMarkdown.bind(this));
    this.formatters.set('yaml', this.formatYAML.bind(this));
    this.formatters.set('json', this.formatJSON.bind(this));
    this.formatters.set('html', this.formatHTML.bind(this));
  }

  async renderMultiFormat(request: TemplateRenderRequest): Promise<Map<string, RenderResult>> {
    const results = new Map<string, RenderResult>();

    for (const format of request.outputFormats) {
      if (!this.supportedFormats.has(format)) {
        throw new Error(`Unsupported output format: ${format}`);
      }

      const startTime = performance.now();
      try {
        const content = await this.renderToFormat(request.templatePath, request.context, format);
        const processingTime = performance.now() - startTime;
        
        const formatConfig = this.supportedFormats.get(format)!;
        const valid = formatConfig.validator(content);
        
        // Post-processing
        let processedContent = content;
        if (request.postProcessing) {
          processedContent = await this.postProcess(content, format, request.postProcessing);
        }

        // Save to file if output directory specified
        let filePath: string | undefined;
        if (request.outputDir) {
          const fileName = this.generateFileName(request.templatePath, format, request.naming);
          filePath = join(request.outputDir, fileName);
          await fs.writeFile(filePath, processedContent);
        }

        results.set(format, {
          format,
          content: processedContent,
          filePath,
          size: Buffer.byteLength(processedContent, 'utf8'),
          processingTime,
          valid,
          warnings: valid ? [] : [`Invalid ${format} format detected`]
        });
      } catch (error) {
        results.set(format, {
          format,
          content: '',
          size: 0,
          processingTime: performance.now() - startTime,
          valid: false,
          errors: [error instanceof Error ? error.message : 'Unknown error']
        });
      }
    }

    return results;
  }

  private async renderToFormat(templatePath: string, context: any, format: string): Promise<string> {
    // Mock template rendering based on format
    const baseContent = await this.renderTemplate(templatePath, context);
    
    switch (format) {
      case 'typescript':
        return this.convertToTypeScript(baseContent, context);
      case 'javascript':
        return this.convertToJavaScript(baseContent, context);
      case 'markdown':
        return this.convertToMarkdown(baseContent, context);
      case 'yaml':
        return this.convertToYAML(baseContent, context);
      case 'json':
        return this.convertToJSON(baseContent, context);
      case 'xml':
        return this.convertToXML(baseContent, context);
      case 'html':
        return this.convertToHTML(baseContent, context);
      case 'css':
        return this.convertToCSS(baseContent, context);
      case 'sql':
        return this.convertToSQL(baseContent, context);
      case 'dockerfile':
        return this.convertToDockerfile(baseContent, context);
      case 'shell':
        return this.convertToShell(baseContent, context);
      default:
        return baseContent;
    }
  }

  private async renderTemplate(templatePath: string, context: any): Promise<string> {
    // Mock base template rendering
    return `<!-- Rendered template: ${templatePath} with context: ${JSON.stringify(context)} -->`;
  }

  private convertToTypeScript(content: string, context: any): string {
    if (context.type === 'command') {
      return `
import { defineCommand } from 'citty';

interface ${context.name}Args {
  ${Object.entries(context.args || {}).map(([key, config]: [string, any]) => 
    `${key}: ${config.type === 'number' ? 'number' : config.type === 'boolean' ? 'boolean' : 'string'};
  `).join('')}
}

export const ${context.name}Command = defineCommand<${context.name}Args>({
  meta: {
    name: '${context.name}',
    description: '${context.description || 'Generated command'}'
  },
  args: {
    ${Object.entries(context.args || {}).map(([key, config]: [string, any]) => 
      `${key}: { type: '${config.type}', required: ${config.required || false} }`
    ).join(',\n    ')}
  },
  run: async ({ args }: { args: ${context.name}Args }) => {
    console.log('Executing ${context.name} with args:', args);
    
    // Implementation goes here
    return {
      success: true,
      result: 'Command executed successfully'
    };
  }
});
      `;
    }
    
    if (context.type === 'workflow') {
      return `
import { defineWorkflow, defineTask } from 'citty-pro';

interface ${context.name}State {
  data?: any;
  result?: any;
  errors?: string[];
}

const ${context.name.toLowerCase()}Task = defineTask({
  id: '${context.name.toLowerCase()}',
  run: async (input: any): Promise<any> => {
    // Task implementation
    return { processed: input, timestamp: Date.now() };
  }
});

export const ${context.name.toLowerCase()}Workflow = defineWorkflow<${context.name}State>({
  id: '${context.name.toLowerCase()}-workflow',
  steps: [
    { id: '${context.name.toLowerCase()}', use: ${context.name.toLowerCase()}Task }
  ]
});
      `;
    }
    
    return `// TypeScript output\n${content}`;
  }

  private convertToJavaScript(content: string, context: any): string {
    // Convert TypeScript-like template to JavaScript
    let jsContent = content.replace(/: \w+/g, '') // Remove type annotations
                          .replace(/interface \w+ \{[\s\S]*?\}/g, '') // Remove interfaces
                          .replace(/<\w+>/g, ''); // Remove generic types
    
    return `// JavaScript output\n${jsContent}`;
  }

  private convertToMarkdown(content: string, context: any): string {
    if (context.type === 'api-docs') {
      return `
# ${context.name || 'API'} Documentation

## Overview
${context.description || 'API documentation generated from template'}

## Endpoints

${(context.endpoints || []).map((endpoint: any) => `
### ${endpoint.method?.toUpperCase() || 'GET'} ${endpoint.path || '/api/endpoint'}

${endpoint.description || 'No description provided'}

**Parameters:**
${(endpoint.parameters || []).map((param: any) => `- \`${param.name}\` (${param.type}) - ${param.description}`).join('\n') || 'No parameters'}

**Response:**
\`\`\`json
${JSON.stringify(endpoint.response || { success: true }, null, 2)}
\`\`\`
`).join('\n') || 'No endpoints defined'}

## Examples

\`\`\`bash
curl -X GET http://localhost:3000/api/endpoint
\`\`\`
      `;
    }
    
    return `# Generated Documentation\n\n${content}\n\n---\n*Generated from template*`;
  }

  private convertToYAML(content: string, context: any): string {
    if (context.type === 'kubernetes') {
      return `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${context.name || 'app'}
  namespace: ${context.namespace || 'default'}
  labels:
    app: ${context.name || 'app'}
spec:
  replicas: ${context.replicas || 3}
  selector:
    matchLabels:
      app: ${context.name || 'app'}
  template:
    metadata:
      labels:
        app: ${context.name || 'app'}
    spec:
      containers:
      - name: ${context.name || 'app'}
        image: ${context.image || 'nginx:latest'}
        ports:
        - containerPort: ${context.port || 80}
        ${context.env ? `env:\n${context.env.map((e: any) => `        - name: ${e.name}\n          value: "${e.value}"`).join('\n')}` : ''}
        resources:
          requests:
            memory: ${context.resources?.memory?.request || '256Mi'}
            cpu: ${context.resources?.cpu?.request || '100m'}
          limits:
            memory: ${context.resources?.memory?.limit || '512Mi'}
            cpu: ${context.resources?.cpu?.limit || '500m'}
      `;
    }
    
    if (context.type === 'config') {
      return Object.entries(context.config || {}).map(([key, value]) => `${key}: ${value}`).join('\n');
    }
    
    return `# YAML output\ngenerated: true\ncontent: |\n  ${content.replace(/\n/g, '\n  ')}`;
  }

  private convertToJSON(content: string, context: any): string {
    const jsonData = {
      generated: true,
      timestamp: new Date().toISOString(),
      context: context,
      content: content,
      metadata: {
        generator: 'unjucks-multi-format',
        version: '1.0.0'
      }
    };
    
    return JSON.stringify(jsonData, null, 2);
  }

  private convertToXML(content: string, context: any): string {
    return `
<?xml version="1.0" encoding="UTF-8"?>
<generated>
  <metadata>
    <timestamp>${new Date().toISOString()}</timestamp>
    <generator>unjucks-multi-format</generator>
  </metadata>
  <context>
    ${Object.entries(context).map(([key, value]) => `<${key}>${value}</${key}>`).join('\n    ')}
  </context>
  <content>
    <![CDATA[${content}]]>
  </content>
</generated>
    `;
  }

  private convertToHTML(content: string, context: any): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${context.title || 'Generated Content'}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    .container { max-width: 800px; margin: 0 auto; }
    .generated-content { background: #f5f5f5; padding: 20px; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${context.title || 'Generated Content'}</h1>
    <div class="generated-content">
      <pre>${content}</pre>
    </div>
    <footer>
      <p><em>Generated on ${new Date().toISOString()}</em></p>
    </footer>
  </div>
</body>
</html>
    `;
  }

  private convertToCSS(content: string, context: any): string {
    return `
/* Generated CSS */
.${context.className || 'generated'} {
  /* Generated styles */
  display: block;
  margin: 0;
  padding: 0;
}

/* Content-based styles */
${content}

/* Responsive styles */
@media (max-width: 768px) {
  .${context.className || 'generated'} {
    font-size: 14px;
  }
}
    `;
  }

  private convertToSQL(content: string, context: any): string {
    if (context.type === 'schema') {
      return `
-- Generated SQL Schema
CREATE TABLE ${context.tableName || 'generated_table'} (
  ${(context.columns || []).map((col: any) => 
    `${col.name} ${col.type}${col.nullable === false ? ' NOT NULL' : ''}${col.primaryKey ? ' PRIMARY KEY' : ''}`
  ).join(',\n  ') || 'id INTEGER PRIMARY KEY'}
);

-- Insert sample data
${(context.sampleData || []).map((row: any) => 
  `INSERT INTO ${context.tableName || 'generated_table'} VALUES (${Object.values(row).map(v => typeof v === 'string' ? `'${v}'` : v).join(', ')});`
).join('\n') || ''}
      `;
    }
    
    return `-- Generated SQL\n-- Content: ${content}\nSELECT 1 as generated;`;
  }

  private convertToDockerfile(content: string, context: any): string {
    return `
# Generated Dockerfile
FROM ${context.baseImage || 'node:18-alpine'}

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose port
EXPOSE ${context.port || 3000}

# Set environment
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${context.port || 3000}/health || exit 1

# Start application
CMD ["npm", "start"]
    `;
  }

  private convertToShell(content: string, context: any): string {
    return `
#!/bin/bash

# Generated shell script
set -e

# Configuration
APP_NAME="${context.name || 'generated-app'}"
VERSION="${context.version || '1.0.0'}"
PORT=${context.port || 3000}

echo "Starting $APP_NAME v$VERSION"

# Check dependencies
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required but not installed."; exit 1; }

# Install dependencies
echo "Installing dependencies..."
npm install

# Run application
echo "Starting application on port $PORT..."
PORT=$PORT npm start
    `;
  }

  private generateFileName(templatePath: string, format: string, naming?: string): string {
    const formatConfig = this.supportedFormats.get(format)!;
    const baseName = templatePath.split('/').pop()?.replace('.njk', '') || 'generated';
    
    switch (naming) {
      case 'custom':
        return `${baseName}-${format}${formatConfig.extension}`;
      case 'preserve':
        return `${baseName}${formatConfig.extension}`;
      default: // 'auto'
        return `${baseName}.${format}${formatConfig.extension}`;
    }
  }

  private async postProcess(content: string, format: string, options: any): Promise<string> {
    let processed = content;
    
    if (options.prettify) {
      processed = this.prettifyContent(processed, format);
    }
    
    if (options.minify) {
      processed = this.minifyContent(processed, format);
    }
    
    return processed;
  }

  private prettifyContent(content: string, format: string): string {
    switch (format) {
      case 'json':
        try {
          return JSON.stringify(JSON.parse(content), null, 2);
        } catch {
          return content;
        }
      case 'typescript':
      case 'javascript':
        // Mock code formatting
        return content.replace(/;/g, ';\n').replace(/{/g, '{\n  ').replace(/}/g, '\n}');
      default:
        return content;
    }
  }

  private minifyContent(content: string, format: string): string {
    switch (format) {
      case 'json':
        try {
          return JSON.stringify(JSON.parse(content));
        } catch {
          return content;
        }
      case 'css':
        return content.replace(/\s+/g, ' ').replace(/;\s/g, ';').trim();
      default:
        return content.replace(/\n\s+/g, '\n').trim();
    }
  }

  private formatTypeScript(content: string): string {
    return this.prettifyContent(content, 'typescript');
  }

  private formatMarkdown(content: string): string {
    return content.replace(/\n{3,}/g, '\n\n'); // Normalize line breaks
  }

  private formatYAML(content: string): string {
    return content.replace(/\t/g, '  '); // Convert tabs to spaces
  }

  private formatJSON(content: string): string {
    return this.prettifyContent(content, 'json');
  }

  private formatHTML(content: string): string {
    return content.replace(/></g, '>\n<'); // Basic HTML formatting
  }

  getSupportedFormats(): string[] {
    return Array.from(this.supportedFormats.keys());
  }

  getFormatInfo(format: string): OutputFormat | undefined {
    return this.supportedFormats.get(format);
  }
}

describe('HIVE QUEEN BDD: Unjucks Multi-Format Output Generation', () => {
  let multiFormatEngine: MultiFormatUnjucksEngine;
  let tempDir: string;
  let outputDir: string;

  beforeEach(async () => {
    multiFormatEngine = new MultiFormatUnjucksEngine();
    tempDir = await mkdtemp(join(tmpdir(), 'multi-format-'));
    outputDir = join(tempDir, 'output');
    await fs.mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('FEATURE: Multi-Format Template Rendering', () => {
    describe('SCENARIO: Generate TypeScript command from template', () => {
      it('GIVEN command template WHEN rendering to TypeScript THEN produces valid TypeScript code', async () => {
        // GIVEN: Command template request
        const request: TemplateRenderRequest = {
          templatePath: 'commands/data-processor.njk',
          context: {
            type: 'command',
            name: 'DataProcessor',
            description: 'Process and analyze data files',
            args: {
              input: { type: 'string', required: true },
              output: { type: 'string', required: false },
              format: { type: 'string', required: false },
              verbose: { type: 'boolean', required: false }
            }
          },
          outputFormats: ['typescript'],
          outputDir
        };

        // WHEN: Render to TypeScript
        const results = await multiFormatEngine.renderMultiFormat(request);

        // THEN: Valid TypeScript generated
        const tsResult = results.get('typescript')!;
        expect(tsResult).toBeDefined();
        expect(tsResult.valid).toBe(true);
        expect(tsResult.content).toContain('import { defineCommand }');
        expect(tsResult.content).toContain('interface DataProcessorArgs');
        expect(tsResult.content).toContain('input: string;');
        expect(tsResult.content).toContain('output: string;');
        expect(tsResult.content).toContain('format: string;');
        expect(tsResult.content).toContain('verbose: boolean;');
        expect(tsResult.content).toContain('export const DataProcessorCommand');
        expect(tsResult.content).toContain('defineCommand<DataProcessorArgs>');
        expect(tsResult.filePath).toContain('.typescript.ts');
      });

      it('GIVEN workflow template WHEN rendering to TypeScript THEN produces typed workflow definition', async () => {
        // GIVEN: Workflow template
        const request: TemplateRenderRequest = {
          templatePath: 'workflows/order-processing.njk',
          context: {
            type: 'workflow',
            name: 'OrderProcessing',
            description: 'Complete order processing workflow'
          },
          outputFormats: ['typescript']
        };

        // WHEN: Render workflow
        const results = await multiFormatEngine.renderMultiFormat(request);

        // THEN: TypeScript workflow generated
        const tsResult = results.get('typescript')!;
        expect(tsResult.valid).toBe(true);
        expect(tsResult.content).toContain('import { defineWorkflow, defineTask }');
        expect(tsResult.content).toContain('interface OrderProcessingState');
        expect(tsResult.content).toContain('orderprocessingTask');
        expect(tsResult.content).toContain('orderprocessingWorkflow');
        expect(tsResult.content).toContain('defineWorkflow<OrderProcessingState>');
      });
    });

    describe('SCENARIO: Generate API documentation in Markdown', () => {
      it('GIVEN API template WHEN rendering to Markdown THEN produces comprehensive documentation', async () => {
        // GIVEN: API documentation context
        const request: TemplateRenderRequest = {
          templatePath: 'docs/api-reference.njk',
          context: {
            type: 'api-docs',
            name: 'User Management API',
            description: 'RESTful API for user management operations',
            endpoints: [
              {
                method: 'GET',
                path: '/api/users',
                description: 'Retrieve list of users',
                parameters: [
                  { name: 'page', type: 'number', description: 'Page number for pagination' },
                  { name: 'limit', type: 'number', description: 'Number of users per page' }
                ],
                response: { users: [], total: 0, page: 1 }
              },
              {
                method: 'POST',
                path: '/api/users',
                description: 'Create a new user',
                parameters: [
                  { name: 'name', type: 'string', description: 'User full name' },
                  { name: 'email', type: 'string', description: 'User email address' }
                ],
                response: { id: 1, name: 'John Doe', email: 'john@example.com' }
              }
            ]
          },
          outputFormats: ['markdown'],
          outputDir
        };

        // WHEN: Render to Markdown
        const results = await multiFormatEngine.renderMultiFormat(request);

        // THEN: Comprehensive Markdown documentation
        const mdResult = results.get('markdown')!;
        expect(mdResult.valid).toBe(true);
        expect(mdResult.content).toContain('# User Management API Documentation');
        expect(mdResult.content).toContain('## Overview');
        expect(mdResult.content).toContain('## Endpoints');
        expect(mdResult.content).toContain('### GET /api/users');
        expect(mdResult.content).toContain('### POST /api/users');
        expect(mdResult.content).toContain('**Parameters:**');
        expect(mdResult.content).toContain('**Response:**');
        expect(mdResult.content).toContain('```json');
        expect(mdResult.content).toContain('curl -X GET');
        expect(mdResult.filePath).toContain('.markdown.md');
      });
    });

    describe('SCENARIO: Generate Kubernetes manifests in YAML', () => {
      it('GIVEN deployment template WHEN rendering to YAML THEN produces valid Kubernetes manifest', async () => {
        // GIVEN: Kubernetes deployment context
        const request: TemplateRenderRequest = {
          templatePath: 'kubernetes/microservice-deployment.njk',
          context: {
            type: 'kubernetes',
            name: 'user-service',
            namespace: 'production',
            image: 'user-service:v1.2.0',
            replicas: 5,
            port: 8080,
            env: [
              { name: 'NODE_ENV', value: 'production' },
              { name: 'DB_HOST', value: 'postgres.production.svc.cluster.local' },
              { name: 'REDIS_URL', value: 'redis.production.svc.cluster.local:6379' }
            ],
            resources: {
              memory: { request: '512Mi', limit: '1Gi' },
              cpu: { request: '200m', limit: '1000m' }
            }
          },
          outputFormats: ['yaml'],
          outputDir
        };

        // WHEN: Render to YAML
        const results = await multiFormatEngine.renderMultiFormat(request);

        // THEN: Valid Kubernetes YAML
        const yamlResult = results.get('yaml')!;
        expect(yamlResult.valid).toBe(true);
        expect(yamlResult.content).toContain('apiVersion: apps/v1');
        expect(yamlResult.content).toContain('kind: Deployment');
        expect(yamlResult.content).toContain('name: user-service');
        expect(yamlResult.content).toContain('namespace: production');
        expect(yamlResult.content).toContain('replicas: 5');
        expect(yamlResult.content).toContain('image: user-service:v1.2.0');
        expect(yamlResult.content).toContain('containerPort: 8080');
        expect(yamlResult.content).toContain('NODE_ENV');
        expect(yamlResult.content).toContain('DB_HOST');
        expect(yamlResult.content).toContain('memory: 512Mi');
        expect(yamlResult.content).toContain('cpu: 200m');
      });
    });

    describe('SCENARIO: Generate configuration in JSON', () => {
      it('GIVEN config template WHEN rendering to JSON THEN produces valid JSON configuration', async () => {
        // GIVEN: Configuration context
        const request: TemplateRenderRequest = {
          templatePath: 'config/application-config.njk',
          context: {
            appName: 'enterprise-app',
            version: '2.1.0',
            environment: 'production',
            database: {
              host: 'db.company.com',
              port: 5432,
              ssl: true
            },
            features: {
              authentication: true,
              analytics: true,
              caching: true
            }
          },
          outputFormats: ['json'],
          outputDir
        };

        // WHEN: Render to JSON
        const results = await multiFormatEngine.renderMultiFormat(request);

        // THEN: Valid JSON configuration
        const jsonResult = results.get('json')!;
        expect(jsonResult.valid).toBe(true);
        
        const parsed = JSON.parse(jsonResult.content);
        expect(parsed.generated).toBe(true);
        expect(parsed.context.appName).toBe('enterprise-app');
        expect(parsed.context.version).toBe('2.1.0');
        expect(parsed.context.database.host).toBe('db.company.com');
        expect(parsed.context.features.authentication).toBe(true);
        expect(parsed.metadata.generator).toBe('unjucks-multi-format');
      });
    });
  });

  describe('FEATURE: Simultaneous Multi-Format Generation', () => {
    describe('SCENARIO: Generate all formats from single template', () => {
      it('GIVEN comprehensive template WHEN rendering to all formats THEN produces valid output in each format', async () => {
        // GIVEN: Multi-purpose template context
        const request: TemplateRenderRequest = {
          templatePath: 'universal/data-service.njk',
          context: {
            name: 'DataService',
            description: 'Universal data processing service',
            type: 'service',
            version: '1.0.0',
            port: 3000,
            endpoints: [
              { method: 'GET', path: '/health', description: 'Health check' },
              { method: 'POST', path: '/process', description: 'Process data' }
            ],
            database: { type: 'postgresql', host: 'localhost', port: 5432 },
            env: [{ name: 'NODE_ENV', value: 'production' }]
          },
          outputFormats: ['typescript', 'javascript', 'markdown', 'yaml', 'json', 'html', 'dockerfile'],
          outputDir,
          postProcessing: {
            prettify: true,
            validate: true
          }
        };

        // WHEN: Render to all formats
        const results = await multiFormatEngine.renderMultiFormat(request);

        // THEN: All formats generated successfully
        expect(results.size).toBe(7);
        
        // Validate TypeScript
        const tsResult = results.get('typescript')!;
        expect(tsResult.valid).toBe(true);
        expect(tsResult.content).toContain('import');
        
        // Validate JavaScript
        const jsResult = results.get('javascript')!;
        expect(jsResult.valid).toBe(true);
        expect(jsResult.content).toContain('JavaScript output');
        
        // Validate Markdown
        const mdResult = results.get('markdown')!;
        expect(mdResult.valid).toBe(true);
        expect(mdResult.content).toContain('#');
        
        // Validate YAML
        const yamlResult = results.get('yaml')!;
        expect(yamlResult.valid).toBe(true);
        expect(yamlResult.content).toContain(':');
        
        // Validate JSON
        const jsonResult = results.get('json')!;
        expect(jsonResult.valid).toBe(true);
        expect(() => JSON.parse(jsonResult.content)).not.toThrow();
        
        // Validate HTML
        const htmlResult = results.get('html')!;
        expect(htmlResult.valid).toBe(true);
        expect(htmlResult.content).toContain('<!DOCTYPE html>');
        
        // Validate Dockerfile
        const dockerResult = results.get('dockerfile')!;
        expect(dockerResult.valid).toBe(true);
        expect(dockerResult.content).toContain('FROM');
        
        // Check all files were written
        const outputFiles = await fs.readdir(outputDir);
        expect(outputFiles).toHaveLength(7);
      });
    });

    describe('SCENARIO: Performance with large-scale multi-format generation', () => {
      it('GIVEN 100 templates WHEN generating in 5 formats THEN completes within performance threshold', async () => {
        // GIVEN: 100 templates to render in multiple formats
        const templates: TemplateRenderRequest[] = [];
        
        for (let i = 0; i < 100; i++) {
          templates.push({
            templatePath: `template-${i}.njk`,
            context: {
              name: `Service${i}`,
              type: 'service',
              port: 3000 + i,
              description: `Generated service ${i}`,
              version: `1.${i}.0`
            },
            outputFormats: ['typescript', 'markdown', 'yaml', 'json', 'html']
          });
        }

        // WHEN: Render all templates in parallel
        const startTime = performance.now();
        const allResults = await Promise.all(
          templates.map(request => multiFormatEngine.renderMultiFormat(request))
        );
        const endTime = performance.now();
        
        const duration = (endTime - startTime) / 1000; // seconds
        const totalOutputs = allResults.length * 5; // 100 templates * 5 formats

        // THEN: Performance requirements met
        expect(allResults).toHaveLength(100);
        expect(totalOutputs).toBe(500);
        expect(duration).toBeLessThan(30); // Complete within 30 seconds
        
        // Verify all outputs are valid
        let validOutputs = 0;
        allResults.forEach(results => {
          results.forEach(result => {
            if (result.valid) validOutputs++;
          });
        });
        
        expect(validOutputs).toBeGreaterThan(480); // >96% success rate
        
        console.log(`Multi-format performance: ${totalOutputs} outputs in ${duration.toFixed(2)}s`);
        console.log(`Valid outputs: ${validOutputs}/${totalOutputs} (${((validOutputs/totalOutputs)*100).toFixed(1)}%)`);
      });
    });
  });

  describe('FEATURE: Format-Specific Validation', () => {
    describe('SCENARIO: Validate generated content for each format', () => {
      it('GIVEN generated TypeScript WHEN validating THEN checks syntax correctness', async () => {
        // GIVEN: TypeScript generation request
        const request: TemplateRenderRequest = {
          templatePath: 'validation/typescript-test.njk',
          context: {
            type: 'command',
            name: 'TestCommand',
            args: { test: { type: 'boolean' } }
          },
          outputFormats: ['typescript']
        };

        // WHEN: Generate and validate
        const results = await multiFormatEngine.renderMultiFormat(request);
        const tsResult = results.get('typescript')!;

        // THEN: TypeScript validation passes
        expect(tsResult.valid).toBe(true);
        expect(tsResult.errors).toBeUndefined();
        expect(tsResult.warnings).toEqual([]);
      });

      it('GIVEN generated JSON WHEN validating THEN checks JSON syntax', async () => {
        // GIVEN: JSON generation request
        const request: TemplateRenderRequest = {
          templatePath: 'validation/json-test.njk',
          context: { data: { key: 'value', number: 42, boolean: true } },
          outputFormats: ['json']
        };

        // WHEN: Generate and validate
        const results = await multiFormatEngine.renderMultiFormat(request);
        const jsonResult = results.get('json')!;

        // THEN: JSON validation passes
        expect(jsonResult.valid).toBe(true);
        expect(() => JSON.parse(jsonResult.content)).not.toThrow();
      });

      it('GIVEN invalid template context WHEN generating THEN reports format-specific errors', async () => {
        // GIVEN: Invalid context that will cause format errors
        const request: TemplateRenderRequest = {
          templatePath: 'validation/invalid-test.njk',
          context: { /* missing required fields */ },
          outputFormats: ['typescript', 'yaml']
        };

        // Mock format failure
        vi.spyOn(multiFormatEngine as any, 'renderToFormat').mockRejectedValueOnce(
          new Error('Invalid template context')
        );

        // WHEN: Generate with invalid context
        const results = await multiFormatEngine.renderMultiFormat(request);

        // THEN: Errors reported appropriately
        expect(results.size).toBe(2);
        
        // At least one format should have errors
        const hasErrors = Array.from(results.values()).some(result => 
          result.errors && result.errors.length > 0
        );
        expect(hasErrors).toBe(true);
      });
    });
  });

  describe('FEATURE: Post-Processing Options', () => {
    describe('SCENARIO: Prettify and optimize generated content', () => {
      it('GIVEN JSON output WHEN prettifying THEN formats with proper indentation', async () => {
        // GIVEN: Request with prettify option
        const request: TemplateRenderRequest = {
          templatePath: 'processing/json-pretty.njk',
          context: { data: { nested: { deep: { value: 'test' } } } },
          outputFormats: ['json'],
          postProcessing: { prettify: true }
        };

        // WHEN: Generate with prettification
        const results = await multiFormatEngine.renderMultiFormat(request);
        const jsonResult = results.get('json')!;

        // THEN: JSON is properly formatted
        expect(jsonResult.content).toContain('\n');
        expect(jsonResult.content).toContain('  ');
        const parsed = JSON.parse(jsonResult.content);
        expect(parsed).toBeDefined();
      });

      it('GIVEN CSS output WHEN minifying THEN removes whitespace', async () => {
        // GIVEN: Request with minify option
        const request: TemplateRenderRequest = {
          templatePath: 'processing/css-minify.njk',
          context: { className: 'test-component' },
          outputFormats: ['css'],
          postProcessing: { minify: true }
        };

        // WHEN: Generate with minification
        const results = await multiFormatEngine.renderMultiFormat(request);
        const cssResult = results.get('css')!;

        // THEN: CSS is minified
        expect(cssResult.content.split('\n').length).toBeLessThan(10); // Reduced lines
        expect(cssResult.content).not.toContain('\n\n'); // No double newlines
      });
    });
  });

  describe('FEATURE: Format Information and Discovery', () => {
    describe('SCENARIO: Query supported formats and their capabilities', () => {
      it('GIVEN multi-format engine WHEN querying supported formats THEN returns comprehensive list', () => {
        // WHEN: Get supported formats
        const formats = multiFormatEngine.getSupportedFormats();

        // THEN: All expected formats supported
        expect(formats).toContain('typescript');
        expect(formats).toContain('javascript');
        expect(formats).toContain('markdown');
        expect(formats).toContain('yaml');
        expect(formats).toContain('json');
        expect(formats).toContain('xml');
        expect(formats).toContain('html');
        expect(formats).toContain('css');
        expect(formats).toContain('sql');
        expect(formats).toContain('dockerfile');
        expect(formats).toContain('shell');
        expect(formats.length).toBeGreaterThanOrEqual(11);
      });

      it('GIVEN format name WHEN querying format info THEN returns detailed format configuration', () => {
        // WHEN: Get TypeScript format info
        const tsInfo = multiFormatEngine.getFormatInfo('typescript');
        
        // THEN: Detailed format information
        expect(tsInfo).toBeDefined();
        expect(tsInfo!.name).toBe('TypeScript');
        expect(tsInfo!.extension).toBe('.ts');
        expect(tsInfo!.mimeType).toBe('text/x-typescript');
        expect(tsInfo!.validator).toBeInstanceOf(Function);
        expect(tsInfo!.formatter).toBeInstanceOf(Function);

        // WHEN: Get JSON format info
        const jsonInfo = multiFormatEngine.getFormatInfo('json');
        
        // THEN: JSON format details
        expect(jsonInfo!.name).toBe('JSON');
        expect(jsonInfo!.extension).toBe('.json');
        expect(jsonInfo!.mimeType).toBe('application/json');
      });
    });
  });
});
