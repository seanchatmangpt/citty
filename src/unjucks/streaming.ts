/**
 * Streaming Template Support for Large Template Processing
 * Production v1.0.0 - Memory-efficient template rendering
 */

import { PassThrough, Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import nunjucks from 'nunjucks';
import type { Template, RenderResult, UnjucksContext } from './index';

export interface StreamingOptions {
  chunkSize?: number;
  highWaterMark?: number;
  objectMode?: boolean;
}

/**
 * Streaming template renderer for large templates
 */
export class StreamingRenderer {
  private env: nunjucks.Environment;
  private options: StreamingOptions;

  constructor(env: nunjucks.Environment, options: StreamingOptions = {}) {
    this.env = env;
    this.options = {
      chunkSize: 1024 * 16, // 16KB chunks
      highWaterMark: 1024 * 64, // 64KB buffer
      objectMode: false,
      ...options
    };
  }

  /**
   * Create a readable stream from a template and context
   */
  createTemplateStream(template: Template, context: any = {}): Readable {
    const stream = new PassThrough({
      highWaterMark: this.options.highWaterMark,
      objectMode: this.options.objectMode
    });

    // Start rendering asynchronously
    this.renderToStream(template, context, stream).catch(error => {
      stream.destroy(error);
    });

    return stream;
  }

  /**
   * Render template directly to a stream
   */
  private async renderToStream(
    template: Template, 
    context: any, 
    stream: PassThrough
  ): Promise<void> {
    try {
      // For large templates, we need to chunk the rendering process
      const content = template.content;
      
      // Split template into logical chunks (by blocks, loops, etc.)
      const chunks = this.splitTemplateIntoChunks(content);
      
      for (const chunk of chunks) {
        try {
          // Render chunk
          const rendered = this.env.renderString(chunk, context);
          
          // Write to stream in smaller pieces if needed
          if (rendered.length > this.options.chunkSize!) {
            const pieces = this.splitStringIntoChunks(rendered, this.options.chunkSize!);
            for (const piece of pieces) {
              if (!stream.write(piece)) {
                // Wait for drain if buffer is full
                await new Promise(resolve => stream.once('drain', resolve));
              }
            }
          } else {
            if (!stream.write(rendered)) {
              await new Promise(resolve => stream.once('drain', resolve));
            }
          }
        } catch (error) {
          // Handle partial rendering errors gracefully
          const errorMsg = `<!-- Template chunk error: ${error instanceof Error ? error.message : 'Unknown error'} -->`;
          stream.write(errorMsg);
        }
      }
      
      stream.end();
    } catch (error) {
      stream.destroy(error);
    }
  }

  /**
   * Split template content into logical chunks for streaming
   */
  private splitTemplateIntoChunks(content: string): string[] {
    const chunks: string[] = [];
    const lines = content.split('\n');
    let currentChunk: string[] = [];
    let braceLevel = 0;
    let inBlock = false;
    
    for (const line of lines) {
      // Track template block nesting
      const openBraces = (line.match(/\{\%/g) || []).length;
      const closeBraces = (line.match(/\%\}/g) || []).length;
      
      braceLevel += openBraces - closeBraces;
      
      // Detect block boundaries
      if (line.trim().match(/^\{\%\s*(for|if|block|macro)/)) {
        inBlock = true;
      }
      
      currentChunk.push(line);
      
      // Break chunks at block boundaries or size limits
      const chunkContent = currentChunk.join('\n');
      if (
        (braceLevel === 0 && !inBlock && currentChunk.length > 10) ||
        chunkContent.length > this.options.chunkSize! * 2
      ) {
        chunks.push(chunkContent);
        currentChunk = [];
        inBlock = false;
      }
      
      if (line.trim().match(/^\{\%\s*end/)) {
        inBlock = false;
      }
    }
    
    // Add remaining content
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }
    
    return chunks.filter(chunk => chunk.trim().length > 0);
  }

  /**
   * Split string into chunks of specified size
   */
  private splitStringIntoChunks(str: string, size: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < str.length; i += size) {
      chunks.push(str.slice(i, i + size));
    }
    return chunks;
  }
}

/**
 * Transform stream for processing multiple templates
 */
export class TemplateTransform extends Transform {
  private renderer: StreamingRenderer;
  private context: any;

  constructor(
    renderer: StreamingRenderer, 
    context: any = {}, 
    options?: StreamingOptions
  ) {
    super({
      objectMode: true,
      highWaterMark: options?.highWaterMark || 16
    });
    
    this.renderer = renderer;
    this.context = context;
  }

  _transform(
    template: Template, 
    encoding: BufferEncoding, 
    callback: (error?: Error | null, data?: any) => void
  ): void {
    try {
      const stream = this.renderer.createTemplateStream(template, this.context);
      let content = '';
      
      stream.on('data', (chunk) => {
        content += chunk.toString();
      });
      
      stream.on('end', () => {
        const result: RenderResult = {
          path: this.generateOutputPath(template, this.context),
          content
        };
        callback(null, result);
      });
      
      stream.on('error', (error) => {
        callback(error);
      });
    } catch (error) {
      callback(error as Error);
    }
  }

  private generateOutputPath(template: Template, context: any): string {
    // Simple path generation - could be enhanced
    const frontMatter = template.frontMatter || {};
    const to = frontMatter.to || frontMatter.output;
    
    if (to) {
      // Basic template variable substitution
      return to.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => context[key] || key);
    }
    
    const name = context.name || context.id || template.generator || 'output';
    const extension = frontMatter.extension || 'txt';
    return `${name}.${extension}`;
  }
}

/**
 * Batch process multiple templates with streaming
 */
export async function streamTemplates(
  templates: Template[],
  context: any,
  env: nunjucks.Environment,
  options: StreamingOptions = {}
): Promise<RenderResult[]> {
  const renderer = new StreamingRenderer(env, options);
  const transform = new TemplateTransform(renderer, context, options);
  const results: RenderResult[] = [];
  
  // Create readable stream from templates
  const templateStream = Readable.from(templates, { objectMode: true });
  
  // Transform stream to collect results
  const collectStream = new Transform({
    objectMode: true,
    transform(result: RenderResult, encoding, callback) {
      results.push(result);
      callback(null, result);
    }
  });
  
  // Process all templates through streaming pipeline
  await pipeline(templateStream, transform, collectStream);
  
  return results;
}

/**
 * Stream template rendering to file system
 */
export async function streamToFile(
  template: Template,
  context: any,
  outputPath: string,
  env: nunjucks.Environment,
  options: StreamingOptions = {}
): Promise<void> {
  const fs = await import('node:fs');
  const renderer = new StreamingRenderer(env, options);
  const templateStream = renderer.createTemplateStream(template, context);
  const fileStream = fs.createWriteStream(outputPath);
  
  await pipeline(templateStream, fileStream);
}

/**
 * Memory-efficient batch rendering for large datasets
 */
export async function* renderLargeBatch(
  template: Template,
  contexts: any[],
  env: nunjucks.Environment,
  options: StreamingOptions = {}
): AsyncGenerator<RenderResult, void, unknown> {
  const renderer = new StreamingRenderer(env, options);
  
  for (const context of contexts) {
    const stream = renderer.createTemplateStream(template, context);
    let content = '';
    
    // Collect streamed content
    for await (const chunk of stream) {
      content += chunk.toString();
    }
    
    yield {
      path: generateOutputPath(template, context),
      content
    };
  }
}

/**
 * Helper function to generate output path
 */
function generateOutputPath(template: Template, context: any): string {
  const frontMatter = template.frontMatter || {};
  const to = frontMatter.to || frontMatter.output;
  
  if (to) {
    return to.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => context[key] || key);
  }
  
  const name = context.name || context.id || template.generator || 'output';
  const extension = frontMatter.extension || 'txt';
  return `${name}.${extension}`;
}