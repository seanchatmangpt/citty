import { z } from 'zod';

// Core Pipeline Types
export interface OntologySource {
  path: string;
  format: 'turtle' | 'n3' | 'rdf-xml' | 'json-ld';
  namespace?: string;
}

export interface TemplateConfig {
  path: string;
  output: string;
  context?: Record<string, unknown>;
  filters?: string[];
}

export interface PipelineConfig {
  name: string;
  ontologies: OntologySource[];
  templates: TemplateConfig[];
  output: {
    directory: string;
    clean?: boolean;
  };
  hiveQueen?: {
    enabled: boolean;
    workers?: number;
    parallelism?: 'templates' | 'ontologies' | 'both';
  };
  validation?: {
    schema?: string;
    strict?: boolean;
  };
  watch?: {
    enabled: boolean;
    debounce?: number;
    ignore?: string[];
  };
}

// HIVE QUEEN Orchestration Types
export interface HiveQueenRole {
  type: 'queen' | 'worker' | 'scout' | 'soldier';
  id: string;
  capabilities: string[];
}

export interface OntologyContext {
  triples: Triple[];
  prefixes: Map<string, string>;
  metadata: {
    source: string;
    timestamp: Date;
    size: number;
  };
}

export interface Triple {
  subject: string;
  predicate: string;
  object: string;
  graph?: string;
}

export interface TemplateContext {
  ontology: OntologyContext;
  query: (sparql: string) => Promise<QueryResult[]>;
  filter: (predicate: string, object?: string) => Triple[];
  namespace: (prefix: string) => string;
  custom: Record<string, unknown>;
}

export interface QueryResult {
  [variable: string]: {
    type: 'uri' | 'literal' | 'bnode';
    value: string;
    datatype?: string;
    lang?: string;
  };
}

// Production Workflow Types
export interface GenerationJob {
  id: string;
  config: PipelineConfig;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  metrics: {
    ontologiesProcessed: number;
    templatesRendered: number;
    filesGenerated: number;
    errors: string[];
  };
}

export interface CacheEntry {
  key: string;
  data: unknown;
  timestamp: Date;
  ttl: number;
  dependencies: string[];
}

// Validation Schemas
export const OntologySourceSchema = z.object({
  path: z.string(),
  format: z.enum(['turtle', 'n3', 'rdf-xml', 'json-ld']),
  namespace: z.string().optional(),
});

export const TemplateConfigSchema = z.object({
  path: z.string(),
  output: z.string(),
  context: z.record(z.unknown()).optional(),
  filters: z.array(z.string()).optional(),
});

export const PipelineConfigSchema = z.object({
  name: z.string(),
  ontologies: z.array(OntologySourceSchema),
  templates: z.array(TemplateConfigSchema),
  output: z.object({
    directory: z.string(),
    clean: z.boolean().optional(),
  }),
  hiveQueen: z.object({
    enabled: z.boolean(),
    workers: z.number().optional(),
    parallelism: z.enum(['templates', 'ontologies', 'both']).optional(),
  }).optional(),
  validation: z.object({
    schema: z.string().optional(),
    strict: z.boolean().optional(),
  }).optional(),
  watch: z.object({
    enabled: z.boolean(),
    debounce: z.number().optional(),
    ignore: z.array(z.string()).optional(),
  }).optional(),
});

// Error Types
export class PipelineError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PipelineError';
  }
}

export class OntologyParseError extends PipelineError {
  constructor(message: string, public file: string, public line?: number) {
    super(message, 'ONTOLOGY_PARSE_ERROR', { file, line });
  }
}

export class TemplateRenderError extends PipelineError {
  constructor(message: string, public template: string, public context?: Record<string, unknown>) {
    super(message, 'TEMPLATE_RENDER_ERROR', { template, context });
  }
}

export class ValidationError extends PipelineError {
  constructor(message: string, public violations: string[]) {
    super(message, 'VALIDATION_ERROR', { violations });
  }
}