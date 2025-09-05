import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'pathe';
import type { 
  OntologyEntity, 
  OntologyContext, 
  TemplateContext 
} from './types.js';
import { OntologyError } from './types.js';

// Note: untology package not available in npm registry
// This is a basic implementation without untology integration

/**
 * Ontology manager for untology integration
 */
export class OntologyManager {
  private entities: Map<string, OntologyEntity> = new Map();
  private typeDefinitions: Map<string, any> = new Map();
  private relationships: Map<string, any> = new Map();

  /**
   * Loads ontology context from a source file or URL
   */
  async loadOntologyContext(source: string): Promise<OntologyContext> {
    try {
      let ontologyData: any;

      if (source.startsWith('http://') || source.startsWith('https://')) {
        // Load from URL
        ontologyData = await this.loadFromUrl(source);
      } else {
        // Load from file
        ontologyData = await this.loadFromFile(source);
      }

      // Parse and validate ontology data
      const context = this.parseOntologyData(ontologyData);
      
      // Store entities and types
      this.storeOntologyData(context);
      
      return context;
    } catch (error) {
      throw new OntologyError(
        `Failed to load ontology from ${source}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        source
      );
    }
  }

  /**
   * Queries entities by type
   */
  queryEntities(type: string): OntologyEntity[] {
    const entities: OntologyEntity[] = [];
    
    for (const entity of this.entities.values()) {
      if (entity.type === type) {
        entities.push(entity);
      }
    }
    
    return entities;
  }

  /**
   * Queries entities by property
   */
  queryEntitiesByProperty(property: string, value?: any): OntologyEntity[] {
    const entities: OntologyEntity[] = [];
    
    for (const entity of this.entities.values()) {
      if (property in entity.properties) {
        if (value === undefined || entity.properties[property] === value) {
          entities.push(entity);
        }
      }
    }
    
    return entities;
  }

  /**
   * Gets an entity by ID
   */
  getEntity(id: string): OntologyEntity | undefined {
    return this.entities.get(id);
  }

  /**
   * Gets entities related to a specific entity
   */
  getRelatedEntities(entityId: string, relationshipType?: string): OntologyEntity[] {
    const entity = this.getEntity(entityId);
    if (!entity) {
      return [];
    }

    const relatedEntities: OntologyEntity[] = [];
    
    for (const relationship of entity.relationships) {
      if (!relationshipType || relationship.type === relationshipType) {
        const relatedEntity = this.getEntity(relationship.target);
        if (relatedEntity) {
          relatedEntities.push(relatedEntity);
        }
      }
    }
    
    return relatedEntities;
  }

  /**
   * Expands template context with ontology entities
   */
  expandContext(entities: OntologyEntity[]): TemplateContext {
    const context: TemplateContext = {};
    
    // Group entities by type
    const entitiesByType: Record<string, OntologyEntity[]> = {};
    
    for (const entity of entities) {
      if (!entitiesByType[entity.type]) {
        entitiesByType[entity.type] = [];
      }
      entitiesByType[entity.type].push(entity);
    }
    
    // Add entities to context
    for (const [type, typeEntities] of Object.entries(entitiesByType)) {
      context[type.toLowerCase()] = typeEntities.length === 1 
        ? this.entityToContext(typeEntities[0])
        : typeEntities.map(e => this.entityToContext(e));
    }
    
    // Add utility functions
    context.$ontology = {
      query: (type: string) => this.queryEntities(type),
      getEntity: (id: string) => this.getEntity(id),
      getRelated: (id: string, relationshipType?: string) => 
        this.getRelatedEntities(id, relationshipType)
    };
    
    return context;
  }

  /**
   * Creates a context from all loaded entities
   */
  createFullContext(): TemplateContext {
    const entities = Array.from(this.entities.values());
    return this.expandContext(entities);
  }

  /**
   * Validates ontology structure
   */
  validateOntology(ontologyData: any): boolean {
    try {
      if (!ontologyData || typeof ontologyData !== 'object') {
        return false;
      }

      // Check for required fields
      if (!ontologyData.entities || !Array.isArray(ontologyData.entities)) {
        return false;
      }

      // Validate each entity
      for (const entity of ontologyData.entities) {
        if (!this.validateEntity(entity)) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Loads ontology from file
   */
  private async loadFromFile(filePath: string): Promise<any> {
    const absolutePath = resolve(filePath);
    
    if (!existsSync(absolutePath)) {
      throw new OntologyError(`Ontology file not found: ${absolutePath}`, filePath);
    }

    try {
      const content = readFileSync(absolutePath, 'utf-8');
      
      // Support multiple formats
      if (filePath.endsWith('.json')) {
        return JSON.parse(content);
      } else if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
        // For now, treat as JSON - could add YAML parser later
        throw new OntologyError('YAML format not yet supported', filePath);
      } else {
        // Try to parse as JSON
        return JSON.parse(content);
      }
    } catch (error) {
      throw new OntologyError(
        `Failed to parse ontology file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath
      );
    }
  }

  /**
   * Loads ontology from URL
   */
  private async loadFromUrl(url: string): Promise<any> {
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        return await response.json();
      } else {
        const text = await response.text();
        return JSON.parse(text);
      }
    } catch (error) {
      throw new OntologyError(
        `Failed to load ontology from URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
        url
      );
    }
  }

  /**
   * Parses raw ontology data into structured format
   */
  private parseOntologyData(data: any): OntologyContext {
    if (!this.validateOntology(data)) {
      throw new OntologyError('Invalid ontology structure');
    }

    const entities: OntologyEntity[] = data.entities.map((entity: any) => ({
      id: entity.id,
      type: entity.type,
      properties: entity.properties || {},
      relationships: entity.relationships || []
    }));

    return {
      entities,
      types: data.types || {},
      relationships: data.relationships || {}
    };
  }

  /**
   * Stores ontology data in internal structures
   */
  private storeOntologyData(context: OntologyContext): void {
    // Clear existing data
    this.entities.clear();
    this.typeDefinitions.clear();
    this.relationships.clear();

    // Store entities
    for (const entity of context.entities) {
      this.entities.set(entity.id, entity);
    }

    // Store type definitions
    for (const [type, definition] of Object.entries(context.types)) {
      this.typeDefinitions.set(type, definition);
    }

    // Store relationship definitions
    for (const [relationship, definition] of Object.entries(context.relationships)) {
      this.relationships.set(relationship, definition);
    }
  }

  /**
   * Validates a single entity structure
   */
  private validateEntity(entity: any): boolean {
    return (
      entity &&
      typeof entity === 'object' &&
      typeof entity.id === 'string' &&
      typeof entity.type === 'string' &&
      (entity.properties === undefined || typeof entity.properties === 'object') &&
      (entity.relationships === undefined || Array.isArray(entity.relationships))
    );
  }

  /**
   * Converts an entity to template context format
   */
  private entityToContext(entity: OntologyEntity): any {
    return {
      id: entity.id,
      type: entity.type,
      ...entity.properties,
      $relationships: entity.relationships
    };
  }
}

/**
 * Default ontology manager instance
 */
export const defaultOntologyManager = new OntologyManager();

/**
 * Convenience function to load ontology context
 */
export async function loadOntologyContext(source: string): Promise<OntologyContext> {
  return defaultOntologyManager.loadOntologyContext(source);
}

/**
 * Convenience function to query entities
 */
export function queryEntities(type: string): OntologyEntity[] {
  return defaultOntologyManager.queryEntities(type);
}

/**
 * Convenience function to expand context with entities
 */
export function expandContext(entities: OntologyEntity[]): TemplateContext {
  return defaultOntologyManager.expandContext(entities);
}

/**
 * Creates a sample ontology for testing
 */
export function createSampleOntology(): OntologyContext {
  return {
    entities: [
      {
        id: 'user-entity',
        type: 'User',
        properties: {
          name: 'John Doe',
          email: 'john@example.com',
          role: 'admin'
        },
        relationships: [
          {
            type: 'owns',
            target: 'project-entity'
          }
        ]
      },
      {
        id: 'project-entity',
        type: 'Project',
        properties: {
          name: 'Sample Project',
          description: 'A sample project for testing',
          status: 'active'
        },
        relationships: [
          {
            type: 'ownedBy',
            target: 'user-entity'
          }
        ]
      }
    ],
    types: {
      User: {
        properties: ['name', 'email', 'role'],
        required: ['name', 'email']
      },
      Project: {
        properties: ['name', 'description', 'status'],
        required: ['name']
      }
    },
    relationships: {
      owns: {
        description: 'User owns project',
        inverse: 'ownedBy'
      },
      ownedBy: {
        description: 'Project is owned by user',
        inverse: 'owns'
      }
    }
  };
}

/**
 * Convert CommandDef to Simple Ontology (minimal format)
 */
export async function toSimpleOntology(commandDef: any): Promise<string> {
  const prefixes = `@prefix citty: <http://example.org/citty#> .

`;

  let ontology = prefixes;
  
  const commandName = commandDef.meta?.name || 'unknown-command';
  const commandUri = `citty:${commandName}`;
  
  // Command metadata
  ontology += `${commandUri} a citty:Command ;\n`;
  ontology += `  citty:hasName "${commandName}" ;\n`;
  
  if (commandDef.meta?.description) {
    const escapedDesc = commandDef.meta.description
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t');
    ontology += `  citty:hasDescription "${escapedDesc}" ;\n`;
  }
  
  // Arguments
  if (commandDef.args) {
    const argNames = Object.keys(commandDef.args);
    for (let i = 0; i < argNames.length; i++) {
      const argName = argNames[i];
      const argDef = commandDef.args[argName];
      const argUri = `citty:${argName}`;
      
      ontology += `  citty:hasArgument ${argUri}`;
      if (i < argNames.length - 1) ontology += ' ;\n';
      else ontology += ' .\n\n';
      
      ontology += `${argUri} a citty:Argument ;\n`;
      ontology += `  citty:hasName "${argName}" ;\n`;
      ontology += `  citty:hasType citty:${argDef.type || 'string'}`;
      
      if (argDef.description) {
        const escapedDesc = argDef.description
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\t/g, '\\t');
        ontology += ` ;\n  citty:hasDescription "${escapedDesc}"`;
      }
      
      ontology += ' .\n\n';
    }
  } else {
    ontology += ' .\n\n';
  }
  
  return ontology;
}

/**
 * Convert CommandDef to Ontology (Turtle format)
 */
export async function toOntology(commandDef: any): Promise<string> {
  const prefixes = `@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix citty: <http://example.org/citty#> .
@prefix type: <http://example.org/citty/type#> .

`;

  let ontology = prefixes;
  
  // Define OWL classes
  ontology += `citty:Command a owl:Class .\n`;
  ontology += `citty:Argument a owl:Class .\n\n`;
  
  const commandName = commandDef.meta?.name || 'unknown-command';
  const commandUri = `http://example.org/citty/command/${commandName}`;
  
  // Command metadata
  ontology += `${commandUri} a citty:Command .\n`;
  ontology += `${commandUri} citty:hasName "${commandName}" .\n`;
  
  if (commandDef.meta?.description) {
    const escapedDesc = commandDef.meta.description
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t');
    ontology += `${commandUri} citty:hasDescription "${escapedDesc}" .\n`;
  }
  
  if (commandDef.meta?.version) {
    ontology += `${commandUri} citty:hasVersion "${commandDef.meta.version}" .\n`;
  }
  
  // Arguments
  if (commandDef.args) {
    for (const [argName, argDef] of Object.entries(commandDef.args as Record<string, any>)) {
      const argUri = `${commandUri}/arg/${argName}`;
      ontology += `${commandUri} citty:hasArgument ${argUri} .\n`;
      ontology += `${argUri} a citty:Argument .\n`;
      ontology += `${argUri} citty:hasName "${argName}" .\n`;
      ontology += `${argUri} citty:hasType type:${argDef.type || 'string'} .\n`;
      
      if (argDef.description) {
        const escapedDesc = argDef.description
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\t/g, '\\t');
        ontology += `${argUri} citty:hasDescription "${escapedDesc}" .\n`;
      }
      
      if (argDef.required !== undefined) {
        ontology += `${argUri} citty:isRequired "${argDef.required}"^^xsd:boolean .\n`;
      }
      
      if (argDef.default !== undefined) {
        ontology += `${argUri} citty:hasDefaultValue "${argDef.default}" .\n`;
      }
      
      if (argDef.alias) {
        const aliases = Array.isArray(argDef.alias) ? argDef.alias : [argDef.alias];
        for (const alias of aliases) {
          ontology += `${argUri} citty:hasAlias "${alias}" .\n`;
        }
      }
      
      if (argDef.options) {
        for (const option of argDef.options) {
          ontology += `${argUri} citty:hasOption "${option}" .\n`;
        }
      }
      
      if (argDef.valueHint) {
        ontology += `${argUri} citty:hasValueHint "${argDef.valueHint}" .\n`;
      }
    }
  }
  
  // Subcommands
  if (commandDef.subCommands) {
    for (const [subName, subCmd] of Object.entries(commandDef.subCommands as Record<string, any>)) {
      const subUri = `${commandUri}/sub/${subName}`;
      ontology += `${commandUri} citty:hasSubCommand ${subUri} .\n`;
      ontology += `${subUri} a citty:Command .\n`;
      ontology += `${subUri} citty:hasName "${subName}" .\n`;
      
      if (subCmd.meta?.description) {
        const escapedDesc = subCmd.meta.description
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\t/g, '\\t');
        ontology += `${subUri} citty:hasDescription "${escapedDesc}" .\n`;
      }
      
      // Subcommand arguments
      if (subCmd.args) {
        for (const [argName, argDef] of Object.entries(subCmd.args as Record<string, any>)) {
          const argUri = `${subUri}/arg/${argName}`;
          ontology += `${subUri} citty:hasArgument ${argUri} .\n`;
          ontology += `${argUri} a citty:Argument .\n`;
          ontology += `${argUri} citty:hasName "${argName}" .\n`;
          ontology += `${argUri} citty:hasType type:${argDef.type || 'string'} .\n`;
          
          if (argDef.description) {
            const escapedDesc = argDef.description
              .replace(/\\/g, '\\\\')
              .replace(/"/g, '\\"')
              .replace(/\n/g, '\\n')
              .replace(/\t/g, '\\t');
            ontology += `${argUri} citty:hasDescription "${escapedDesc}" .\n`;
          }
        }
      }
    }
  }
  
  return ontology;
}

/**
 * Convert Ontology to TypeScript code
 */
export async function fromOntology(ontology: string): Promise<string> {
  // Parse ontology to extract command information
  const lines = ontology.split('\n');
  let commandName = 'unknown-command';
  let commandDescription = '';
  let commandUri = '';
  
  // Find the main command (not subcommands) - prioritize root command
  const commandLines = lines.filter(line => 
    line.includes(' a citty:Command') && line.trim().length > 0
  );
  
  // Prefer the command URI that doesn't contain /sub/
  for (const line of commandLines) {
    if (!line.includes('/sub/')) {
      const match = line.match(/^([^\s]+)\s+a\s+citty:Command/);
      if (match) {
        commandUri = match[1];
        break;
      }
    }
  }
  
  // If no root command found, take the first command
  if (!commandUri && commandLines.length > 0) {
    const match = commandLines[0].match(/^([^\s]+)\s+a\s+citty:Command/);
    if (match) {
      commandUri = match[1];
    }
  }
  
  // Extract name and description for the main command
  for (const line of lines) {
    if (line.startsWith(commandUri) && line.includes('citty:hasName')) {
      const match = line.match(/citty:hasName "([^"]+)"/);
      if (match) {
        commandName = match[1];
      }
    }
    if (line.startsWith(commandUri) && line.includes('citty:hasDescription')) {
      const match = line.match(/citty:hasDescription "([^"]+)"/);
      if (match) {
        commandDescription = match[1];
      }
    }
  }
  
  // Generate TypeScript code
  const tsCode = `import { defineCommand } from 'citty';

/**
 * ${commandDescription || 'Generated command from ontology'}
 */
export const ${commandName.replace(/-/g, '')}Command = defineCommand({
  meta: {
    name: '${commandName}',
    description: '${commandDescription || 'Generated command from ontology'}'
  },
  args: {
    // TODO: Add arguments based on ontology
  },
  async run({ args }) {
    console.log('Executing ${commandName} command with:', args);
    // TODO: Implement ${commandDescription}
  }
});

export default ${commandName.replace(/-/g, '')}Command;
`;

  return tsCode;
}

/**
 * Validate ontology format
 */
export function validateOntology(ontology: string): boolean {
  if (!ontology || typeof ontology !== 'string') {
    return false;
  }
  
  // Basic validation - check for required prefixes and structure
  const hasPrefix = ontology.includes('@prefix');
  const hasCittyPrefix = ontology.includes('citty:');
  const hasTriples = ontology.includes(' a ') || ontology.includes(' citty:');
  
  return hasPrefix && hasCittyPrefix && hasTriples;
}