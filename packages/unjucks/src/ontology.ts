/**
 * Ontology Integration for Unjucks
 * Bridges Untology with template context
 */

import { loadGraph, findEntities, getValue, toContextObjects, askGraph } from 'untology'
import { ofetch } from 'ofetch'
import { readFile } from 'node:fs/promises'
import { resolve } from 'pathe'
import { existsSync } from 'node:fs'
import type { OntologyContext, EntityContext, TemplateContext, OntologyError as OntologyErrorType } from './types'
import { OntologyError } from './types'

/**
 * Ontology Manager class
 */
export class OntologyManager {
  private loaded: boolean = false
  private context: OntologyContext | null = null

  /**
   * Load ontology from file or URL
   */
  async load(source: string): Promise<OntologyContext> {
    try {
      let content: string

      // Determine source type
      if (source.startsWith('http://') || source.startsWith('https://')) {
        // Load from URL
        content = await ofetch(source)
      } else {
        // Load from file
        const path = resolve(source)
        if (!existsSync(path)) {
          throw new OntologyError(`Ontology file not found: ${path}`)
        }
        content = await readFile(path, 'utf-8')
      }

      // Parse based on format
      if (source.endsWith('.json')) {
        // JSON-LD format
        this.context = JSON.parse(content)
      } else if (source.endsWith('.ttl') || source.endsWith('.n3')) {
        // Turtle/N3 format - use Untology
        await loadGraph(content)
        
        // Extract all entities
        const allEntities = findEntities()
        const entities: EntityContext[] = []
        
        for (const entityId of allEntities) {
          const type = getValue(entityId, 'rdf:type') || 'Thing'
          const properties = await this.extractProperties(entityId)
          const relations = await this.extractRelations(entityId)
          
          entities.push({
            id: entityId,
            type,
            properties,
            relations
          })
        }
        
        this.context = {
          entities,
          namespaces: {
            rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
            rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
            owl: 'http://www.w3.org/2002/07/owl#',
            citty: 'https://citty.pro/ontology#'
          }
        }
      } else {
        throw new OntologyError(`Unsupported ontology format: ${source}`)
      }

      this.loaded = true
      return this.context!
    } catch (error) {
      throw new OntologyError(
        `Failed to load ontology: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { source, error }
      )
    }
  }

  /**
   * Extract properties for an entity
   */
  private async extractProperties(entityId: string): Promise<Record<string, any>> {
    const props: Record<string, any> = {}
    
    // Get common properties
    const name = getValue(entityId, 'citty:name')
    if (name) props.name = name
    
    const description = getValue(entityId, 'citty:description')
    if (description) props.description = description
    
    const type = getValue(entityId, 'rdf:type')
    if (type) props.type = type
    
    // Get all properties (simplified)
    try {
      const results = await askGraph(`describe ${entityId}`)
      if (results && typeof results === 'object' && 'properties' in results) {
        Object.assign(props, results.properties)
      }
    } catch {
      // Ignore query errors
    }
    
    return props
  }

  /**
   * Extract relations for an entity
   */
  private async extractRelations(entityId: string): Promise<Record<string, string[]>> {
    const relations: Record<string, string[]> = {}
    
    // Get known relations
    const knows = getValue(entityId, 'foaf:knows')
    if (knows) relations.knows = [knows]
    
    const uses = getValue(entityId, 'citty:uses')
    if (uses) relations.uses = [uses]
    
    const hasInput = getValue(entityId, 'citty:hasInput')
    if (hasInput) relations.hasInput = [hasInput]
    
    const hasOutput = getValue(entityId, 'citty:hasOutput')
    if (hasOutput) relations.hasOutput = [hasOutput]
    
    return relations
  }

  /**
   * Query entities by type
   */
  async queryByType(type: string): Promise<EntityContext[]> {
    if (!this.loaded || !this.context) {
      throw new OntologyError('Ontology not loaded')
    }

    return this.context.entities.filter(e => e.type === type)
  }

  /**
   * Query entities with natural language
   */
  async query(question: string): Promise<any> {
    if (!this.loaded) {
      throw new OntologyError('Ontology not loaded')
    }

    try {
      return await askGraph(question)
    } catch (error) {
      throw new OntologyError(
        `Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { question, error }
      )
    }
  }

  /**
   * Get the loaded context
   */
  getContext(): OntologyContext | null {
    return this.context
  }

  /**
   * Check if ontology is loaded
   */
  isLoaded(): boolean {
    return this.loaded
  }

  /**
   * Clear the loaded ontology
   */
  clear(): void {
    this.loaded = false
    this.context = null
  }
}

// Global ontology manager
let globalManager: OntologyManager | null = null

/**
 * Get or create global ontology manager
 */
function getGlobalManager(): OntologyManager {
  if (!globalManager) {
    globalManager = new OntologyManager()
  }
  return globalManager
}

/**
 * Load ontology and return context
 */
export async function loadOntologyContext(source: string): Promise<OntologyContext> {
  const manager = getGlobalManager()
  return manager.load(source)
}

/**
 * Query entities by type
 */
export async function queryEntities(type: string): Promise<EntityContext[]> {
  const manager = getGlobalManager()
  return manager.queryByType(type)
}

/**
 * Expand ontology context into template context
 */
export function expandContext(entities: EntityContext[]): TemplateContext {
  const context: TemplateContext = {}

  // Group entities by type
  const byType: Record<string, EntityContext[]> = {}
  for (const entity of entities) {
    const type = entity.type.replace(/^.*[#/]/, '') // Get local name
    if (!byType[type]) {
      byType[type] = []
    }
    byType[type].push(entity)
  }

  // Add to context
  for (const [type, items] of Object.entries(byType)) {
    // Pluralize type name (simple)
    const plural = type.endsWith('s') ? type + 'es' : type + 's'
    context[plural.toLowerCase()] = items.map(e => ({
      id: e.id,
      ...e.properties,
      _relations: e.relations
    }))
    
    // Also add singular if only one
    if (items.length === 1) {
      context[type.toLowerCase()] = {
        id: items[0].id,
        ...items[0].properties,
        _relations: items[0].relations
      }
    }
  }

  return context
}

/**
 * Create sample ontology for testing
 */
export function createSampleOntology(): OntologyContext {
  return {
    entities: [
      {
        id: 'deploy-command',
        type: 'Command',
        properties: {
          name: 'deploy',
          description: 'Deploy application to environment',
          category: 'deployment'
        },
        relations: {
          hasInput: ['Environment', 'Version'],
          hasOutput: ['DeploymentResult']
        }
      },
      {
        id: 'test-command',
        type: 'Command',
        properties: {
          name: 'test',
          description: 'Run test suite',
          category: 'testing'
        },
        relations: {
          hasInput: ['TestPattern'],
          hasOutput: ['TestResult']
        }
      },
      {
        id: 'user-component',
        type: 'Component',
        properties: {
          name: 'UserProfile',
          description: 'User profile component',
          props: ['userId', 'username', 'email']
        },
        relations: {
          uses: ['UserService', 'AuthService']
        }
      }
    ],
    namespaces: {
      citty: 'https://citty.pro/ontology#',
      foaf: 'http://xmlns.com/foaf/0.1/'
    },
    version: '1.0.0'
  }
}

/**
 * Validate ontology context
 */
export function validateOntologyContext(context: any): context is OntologyContext {
  if (!context || typeof context !== 'object') {
    return false
  }

  if (!Array.isArray(context.entities)) {
    return false
  }

  for (const entity of context.entities) {
    if (!entity.id || !entity.type || !entity.properties) {
      return false
    }
  }

  if (!context.namespaces || typeof context.namespaces !== 'object') {
    return false
  }

  return true
}

/**
 * Merge multiple ontology contexts
 */
export function mergeOntologyContexts(...contexts: OntologyContext[]): OntologyContext {
  const merged: OntologyContext = {
    entities: [],
    namespaces: {}
  }

  const entityMap = new Map<string, EntityContext>()

  for (const context of contexts) {
    // Merge namespaces
    Object.assign(merged.namespaces, context.namespaces)

    // Merge entities (deduplicate by id)
    for (const entity of context.entities) {
      entityMap.set(entity.id, entity)
    }

    // Preserve version from last context
    if (context.version) {
      merged.version = context.version
    }
  }

  merged.entities = Array.from(entityMap.values())
  return merged
}

/**
 * Filter entities by predicate
 */
export function filterEntities(
  context: OntologyContext,
  predicate: (entity: EntityContext) => boolean
): EntityContext[] {
  return context.entities.filter(predicate)
}

/**
 * Find entity by ID
 */
export function findEntity(
  context: OntologyContext,
  id: string
): EntityContext | undefined {
  return context.entities.find(e => e.id === id)
}

/**
 * Transform entity properties
 */
export function transformEntity(
  entity: EntityContext,
  transform: (props: Record<string, any>) => Record<string, any>
): EntityContext {
  return {
    ...entity,
    properties: transform(entity.properties)
  }
}