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

export class CittyOntologyError extends UnjucksError {
  constructor(message: string, source?: string) {
    super(message, 'ONTOLOGY_ERROR', { source });
  }
}

export class ContextError extends UnjucksError {
  constructor(message: string, missingKeys?: string[]) {
    super(message, 'CONTEXT_ERROR', { missingKeys });
  }
}

// Core CLI Types
export type Resolvable<T> = T | (() => T | Promise<T>);

// Argument Types
export type ArgType = "string" | "boolean" | "number" | "enum" | "positional";

export interface Arg {
  name: string;
  type: ArgType;
  description?: string;
  required?: boolean;
  default?: string | number | boolean;
  alias?: string | string[];
  valueHint?: string;
  options?: (string | number)[];
  negativeDescription?: string;
}

export interface ArgsDef {
  [key: string]: Omit<Arg, "name"> | undefined;
}

export type ParsedArgs<T extends ArgsDef = ArgsDef> = {
  _: string[];
} & {
  [K in keyof T]: T[K] extends { type: "string" }
    ? string
    : T[K] extends { type: "number" }
    ? number
    : T[K] extends { type: "boolean" }
    ? boolean
    : T[K] extends { type: "enum" }
    ? string | number
    : any;
} & Record<string, any>;

// Command Types
export interface CommandMeta {
  name?: string;
  version?: string;
  description?: string;
  hidden?: boolean;
}

export interface CommandContext<T extends ArgsDef = ArgsDef> {
  rawArgs: string[];
  args: ParsedArgs<T>;
  data?: any;
  cmd: CommandDef<T>;
}

export interface CommandDef<T extends ArgsDef = ArgsDef> {
  meta?: Resolvable<CommandMeta>;
  args?: Resolvable<T>;
  run?: (context: CommandContext<T>) => any | Promise<any>;
  setup?: (context: CommandContext<T>) => any | Promise<any>;
  cleanup?: (context: CommandContext<T>) => any | Promise<any>;
  subCommands?: Resolvable<Record<string, Resolvable<CommandDef<any>>>>;
}