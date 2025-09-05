/**
 * Unjucks Filter Functions for Template Transformation
 * Provides filters for semantic conventions and code generation
 */

export interface SemanticConventionAttribute {
  name: string
  type: string
  description?: string
  value?: any
  required?: boolean
}

/**
 * Unjucks template filters for semantic convention processing
 */
export class UnjucksFilters {
  /**
   * Convert string to camelCase
   */
  static camelCase(str: string): string {
    return str.replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '')
  }

  /**
   * Convert string to PascalCase
   */
  static pascalCase(str: string): string {
    const camelCase = UnjucksFilters.camelCase(str)
    return camelCase.charAt(0).toUpperCase() + camelCase.slice(1)
  }

  /**
   * Convert string to snake_case
   */
  static snakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (match) => '_' + match.toLowerCase())
      .replace(/[-\s]+/g, '_')
      .replace(/^_/, '')
  }

  /**
   * Convert string to kebab-case
   */
  static kebabCase(str: string): string {
    return str.replace(/[A-Z]/g, (match) => '-' + match.toLowerCase())
      .replace(/[_\s]+/g, '-')
      .replace(/^-/, '')
  }

  /**
   * Filter semantic convention attributes
   */
  static filterAttributes(
    attributes: SemanticConventionAttribute[], 
    filter: string
  ): SemanticConventionAttribute[] {
    switch (filter) {
      case 'required':
        return attributes.filter(attr => attr.required === true)
      case 'optional':
        return attributes.filter(attr => attr.required !== true)
      case 'string':
        return attributes.filter(attr => attr.type === 'string')
      case 'number':
        return attributes.filter(attr => attr.type === 'number')
      case 'boolean':
        return attributes.filter(attr => attr.type === 'boolean')
      default:
        return attributes
    }
  }

  /**
   * Generate TypeScript type from attribute
   */
  static toTsType(attr: SemanticConventionAttribute): string {
    let type = attr.type
    switch (attr.type) {
      case 'string':
        type = 'string'
        break
      case 'int':
      case 'double':
        type = 'number'
        break
      case 'boolean':
        type = 'boolean'
        break
      default:
        type = 'unknown'
    }
    return attr.required ? type : `${type} | undefined`
  }

  /**
   * Generate default value for attribute
   */
  static defaultValue(attr: SemanticConventionAttribute): string {
    if (attr.value !== undefined) {
      return typeof attr.value === 'string' ? `"${attr.value}"` : String(attr.value)
    }
    
    switch (attr.type) {
      case 'string':
        return '""'
      case 'int':
      case 'double':
        return '0'
      case 'boolean':
        return 'false'
      default:
        return 'undefined'
    }
  }

  /**
   * Get all filter functions for Nunjucks registration
   */
  static getAllFilters() {
    return {
      camelCase: UnjucksFilters.camelCase,
      pascalCase: UnjucksFilters.pascalCase,
      snakeCase: UnjucksFilters.snakeCase,
      kebabCase: UnjucksFilters.kebabCase,
      filterAttributes: UnjucksFilters.filterAttributes,
      toTsType: UnjucksFilters.toTsType,
      defaultValue: UnjucksFilters.defaultValue,
    }
  }
}

// Default export for convenience
export default UnjucksFilters