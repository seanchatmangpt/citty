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