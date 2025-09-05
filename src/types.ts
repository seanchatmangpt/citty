export interface TemplateContext {
  [key: string]: any;
}

export interface TemplateFilter {
  (value: any, ...args: any[]): any;
}

export interface TemplateOptions {
  autoescape?: boolean;
  throwOnUndefined?: boolean;
  trimBlocks?: boolean;
  lstripBlocks?: boolean;
  tags?: {
    blockStart?: string;
    blockEnd?: string;
    variableStart?: string;
    variableEnd?: string;
    commentStart?: string;
    commentEnd?: string;
  };
}

export interface WalkOptions {
  extensions?: string[];
  ignore?: string[];
  maxDepth?: number;
}

export interface TemplateInfo {
  path: string;
  generator: string;
  action: string;
  relativePath: string;
}

export interface OntologyEntity {
  id: string;
  type: string;
  properties: Record<string, any>;
  relationships: Array<{
    type: string;
    target: string;
    properties?: Record<string, any>;
  }>;
}

export interface OntologyContext {
  entities: OntologyEntity[];
  types: Record<string, any>;
  relationships: Record<string, any>;
}

export interface CliOptions {
  generator?: string;
  action?: string;
  output?: string;
  dryRun?: boolean;
  diff?: boolean;
  context?: string;
  ontology?: string;
  interactive?: boolean;
}

export interface RenderResult {
  output: string;
  metadata: {
    template: string;
    context: TemplateContext;
    timestamp: Date;
    duration: number;
  };
}

export class UnjucksError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'UnjucksError';
  }
}

export class TemplateNotFoundError extends UnjucksError {
  constructor(generator: string, action: string) {
    super(
      `Template not found for generator "${generator}" and action "${action}"`,
      'TEMPLATE_NOT_FOUND',
      { generator, action }
    );
  }
}

export class OntologyError extends UnjucksError {
  constructor(message: string, source?: string) {
    super(message, 'ONTOLOGY_ERROR', { source });
  }
}

export class ContextError extends UnjucksError {
  constructor(message: string, missingKeys?: string[]) {
    super(message, 'CONTEXT_ERROR', { missingKeys });
  }
}