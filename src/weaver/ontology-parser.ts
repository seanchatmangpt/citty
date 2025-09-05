/**
 * Ontology Parser for Weaver Integration
 * Parses semantic conventions from various formats
 */

export interface SemanticConvention {
  name: string
  description?: string
  attributes: SemanticConventionAttribute[]
  groups?: SemanticConventionGroup[]
}

export interface SemanticConventionAttribute {
  name: string
  type: string
  description?: string
  value?: any
  required?: boolean
  examples?: string[]
}

export interface SemanticConventionGroup {
  name: string
  description?: string
  attributes: SemanticConventionAttribute[]
}

export interface ParsedOntology {
  conventions: SemanticConvention[]
  version?: string
  metadata?: Record<string, any>
}

/**
 * Ontology parser for semantic conventions
 */
export class OntologyParser {
  /**
   * Parse semantic conventions from YAML content
   */
  static parseYaml(yamlContent: string): ParsedOntology {
    try {
      // Basic YAML parsing - in production would use proper YAML parser
      const lines = yamlContent.split('\n')
      const conventions: SemanticConvention[] = []
      
      let currentConvention: Partial<SemanticConvention> = {}
      let currentAttributes: SemanticConventionAttribute[] = []
      
      for (const line of lines) {
        const trimmed = line.trim()
        
        if (trimmed.startsWith('name:')) {
          if (currentConvention.name) {
            // Save previous convention
            conventions.push({
              ...currentConvention,
              attributes: currentAttributes
            } as SemanticConvention)
          }
          
          currentConvention = {
            name: trimmed.replace('name:', '').trim().replace(/['"]/g, '')
          }
          currentAttributes = []
        } else if (trimmed.startsWith('description:')) {
          currentConvention.description = trimmed.replace('description:', '').trim().replace(/['"]/g, '')
        } else if (trimmed.includes('- name:')) {
          const attrName = trimmed.replace('- name:', '').trim().replace(/['"]/g, '')
          currentAttributes.push({
            name: attrName,
            type: 'string',
            required: false
          })
        }
      }
      
      // Save last convention
      if (currentConvention.name) {
        conventions.push({
          ...currentConvention,
          attributes: currentAttributes
        } as SemanticConvention)
      }
      
      return {
        conventions,
        version: '1.0.0'
      }
    } catch (error) {
      console.warn('Failed to parse YAML:', error)
      return {
        conventions: [],
        version: '1.0.0'
      }
    }
  }

  /**
   * Parse semantic conventions from JSON content
   */
  static parseJson(jsonContent: string): ParsedOntology {
    try {
      const data = JSON.parse(jsonContent)
      
      if (data.conventions && Array.isArray(data.conventions)) {
        return data
      }
      
      // Handle other JSON formats
      return {
        conventions: [],
        version: data.version || '1.0.0',
        metadata: data.metadata
      }
    } catch (error) {
      console.warn('Failed to parse JSON:', error)
      return {
        conventions: [],
        version: '1.0.0'
      }
    }
  }

  /**
   * Parse semantic conventions from RDF/Turtle content
   */
  static parseRdf(rdfContent: string): ParsedOntology {
    try {
      // Basic RDF parsing - would use proper RDF parser in production
      const lines = rdfContent.split('\n')
      const conventions: SemanticConvention[] = []
      
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.includes('a :SemanticConvention')) {
          const match = trimmed.match(/^:(\w+)\s+a\s+:SemanticConvention/)
          if (match) {
            conventions.push({
              name: match[1],
              description: `Parsed semantic convention: ${match[1]}`,
              attributes: []
            })
          }
        }
      }
      
      return {
        conventions,
        version: '1.0.0'
      }
    } catch (error) {
      console.warn('Failed to parse RDF:', error)
      return {
        conventions: [],
        version: '1.0.0'
      }
    }
  }

  /**
   * Auto-detect format and parse content
   */
  static parseAuto(content: string, filename?: string): ParsedOntology {
    if (filename) {
      if (filename.endsWith('.yaml') || filename.endsWith('.yml')) {
        return this.parseYaml(content)
      } else if (filename.endsWith('.json')) {
        return this.parseJson(content)
      } else if (filename.endsWith('.ttl') || filename.endsWith('.rdf')) {
        return this.parseRdf(content)
      }
    }

    // Auto-detect based on content
    const trimmed = content.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return this.parseJson(content)
    } else if (trimmed.includes('@prefix') || trimmed.includes('a :')) {
      return this.parseRdf(content)
    } else {
      return this.parseYaml(content)
    }
  }

  /**
   * Validate parsed ontology
   */
  static validate(ontology: ParsedOntology): boolean {
    if (!ontology.conventions || !Array.isArray(ontology.conventions)) {
      return false
    }

    for (const convention of ontology.conventions) {
      if (!convention.name || typeof convention.name !== 'string') {
        return false
      }
      
      if (convention.attributes && !Array.isArray(convention.attributes)) {
        return false
      }
    }

    return true
  }
}

// Default export
export default OntologyParser