/**
 * Unjucks Filter Functions for Template Transformation
 * Provides filters for semantic conventions and code generation
 */

export interface SemanticConventionAttribute {
  id: string
  type: 'string' | 'number' | 'boolean' | 'string[]' | 'number[]' | 'boolean[]'
  brief: string
  requirement_level: 'required' | 'conditionally_required' | 'recommended' | 'opt_in'
  examples?: string[] | string | number | boolean
  stability?: 'stable' | 'experimental' | 'deprecated'
  deprecated?: string
  note?: string
  tag?: string
  prefix?: string
  namespace?: string
  name?: string
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
    if (typeof str !== 'string' || !str) return ''
    // First normalize to handle camelCase input properly
    return str
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Insert space before capitals
      .toLowerCase()
      .replace(/[-_\s]+(.)/g, (_, char) => char.toUpperCase())
  }

  /**
   * Convert string to PascalCase
   */
  static pascalCase(str: string): string {
    if (typeof str !== 'string' || !str) return ''
    // First normalize to handle camelCase input properly
    return str
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Insert space before capitals
      .toLowerCase()
      .replace(/[-_\s]+(.)/g, (_, char) => char.toUpperCase())
      .replace(/^(.)/, c => c.toUpperCase())
  }

  /**
   * Convert string to snake_case
   */
  static snakeCase(str: string): string {
    if (!str) return str
    return str
      .replace(/([A-Z])/g, '_$1')
      .replace(/[-\s]+/g, '_')
      .replace(/^_/, '')
      .toLowerCase()
  }

  /**
   * Convert string to kebab-case
   */
  static kebabCase(str: string): string {
    if (!str) return str
    return str
      .replace(/([A-Z])/g, '-$1')
      .replace(/[_\s]+/g, '-')
      .replace(/^-/, '')
      .toLowerCase()
  }

  /**
   * Convert string to CONSTANT_CASE
   */
  static constantCase(str: string): string {
    if (!str) return str
    // Handle already constant case
    if (str === str.toUpperCase() && str.includes('_')) {
      return str
    }
    return UnjucksFilters.snakeCase(str).toUpperCase()
  }

  /**
   * Convert attribute to TypeScript type
   */
  static toTypeScriptType(attr: SemanticConventionAttribute): string {
    switch (attr.type) {
      case 'string':
        return 'string'
      case 'number':
        return 'number'
      case 'boolean':
        return 'boolean'
      case 'string[]':
        return 'string[]'
      case 'number[]':
        return 'number[]'
      case 'boolean[]':
        return 'boolean[]'
      default:
        return 'unknown'
    }
  }

  /**
   * Convert attribute to Go type
   */
  static toGoType(attr: SemanticConventionAttribute): string {
    switch (attr.type) {
      case 'string':
        return 'string'
      case 'number':
        return 'float64'
      case 'boolean':
        return 'bool'
      case 'string[]':
        return '[]string'
      case 'number[]':
        return '[]float64'
      case 'boolean[]':
        return '[]bool'
      default:
        return 'interface{}'
    }
  }

  /**
   * Convert attribute to Rust type
   */
  static toRustType(attr: SemanticConventionAttribute): string {
    switch (attr.type) {
      case 'string':
        return 'String'
      case 'number':
        return 'f64'
      case 'boolean':
        return 'bool'
      case 'string[]':
        return 'Vec<String>'
      case 'number[]':
        return 'Vec<f64>'
      case 'boolean[]':
        return 'Vec<bool>'
      default:
        return 'serde_json::Value'
    }
  }

  /**
   * Sort array
   */
  static sort(arr: any[], key?: string): any[] {
    if (!Array.isArray(arr)) return []
    const sorted = [...arr]
    if (key) {
      return sorted.sort((a, b) => {
        const aVal = a[key]
        const bVal = b[key]
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return aVal.localeCompare(bVal)
        }
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      })
    }
    return sorted.sort()
  }

  /**
   * Group array by property
   */
  static groupBy(arr: any[], key: string): Record<string, any[]> {
    if (!Array.isArray(arr)) return {}
    return arr.reduce((groups, item) => {
      const groupKey = item[key] || 'default'
      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(item)
      return groups
    }, {} as Record<string, any[]>)
  }

  /**
   * Filter array
   */
  static filter(arr: any[], predicate: string | ((item: any) => boolean)): any[] {
    if (!Array.isArray(arr)) return []
    if (typeof predicate === 'function') {
      return arr.filter(predicate)
    }
    // Simple property-based filtering
    return arr.filter(item => item && typeof item === 'object' && predicate in item)
  }

  /**
   * Map array
   */
  static map(arr: any[], mapper: string | ((item: any) => any)): any[] {
    if (!Array.isArray(arr)) return []
    if (typeof mapper === 'function') {
      return arr.map(mapper)
    }
    // Simple property extraction
    return arr.map(item => item && typeof item === 'object' ? item[mapper] : item)
  }

  /**
   * Get unique values from array
   */
  static unique(arr: any[], key?: string): any[] {
    if (!Array.isArray(arr)) return []
    if (key) {
      const seen = new Set()
      const result: any[] = []
      for (const item of arr) {
        const value = item && typeof item === 'object' ? item[key] : item
        if (!seen.has(value)) {
          seen.add(value)
          result.push(value)
        }
      }
      return result
    }
    return [...new Set(arr)]
  }

  /**
   * Capitalize first letter of string
   */
  static capitalize(str: string): string {
    if (typeof str !== 'string') return ''
    if (str.length === 0) return ''
    // For single word strings, apply normal capitalization (first uppercase, rest lowercase)
    // For camelCase strings, just uppercase the first letter
    if (str.includes(' ') || str === str.toLowerCase()) {
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
    }
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  /**
   * Title case string
   */
  static title(str: string): string {
    if (typeof str !== 'string') return ''
    return str
      .replace(/[_-]/g, ' ')
      .replace(/\w\S*/g, (txt) => 
        txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
      )
  }

  /**
   * Truncate string
   */
  static truncate(str: string | any, length: number = 50): string {
    const s = typeof str === 'string' ? str : String(str)
    return s.length > length ? s.substring(0, length) + '...' : s
  }

  /**
   * Pad string start
   */
  static padStart(str: string, length: number, fill: string = ' '): string {
    if (typeof str !== 'string') return ''
    return str.padStart(length, fill)
  }

  /**
   * Pad string end
   */
  static padEnd(str: string, length: number, fill: string = ' '): string {
    if (typeof str !== 'string') return ''
    return str.padEnd(length, fill)
  }

  /**
   * Replace string content
   */
  static replace(str: string, search: string, replace: string): string {
    if (typeof str !== 'string') return ''
    return str.replace(new RegExp(search, 'g'), replace)
  }

  /**
   * Split string
   */
  static split(str: string, separator: string = ','): string[] {
    if (typeof str !== 'string') return []
    return str.split(separator).map(s => s.trim())
  }

  /**
   * Join array into string
   */
  static join(arr: any[], separator: string = ','): string {
    if (!Array.isArray(arr)) return ''
    return arr.join(separator)
  }

  /**
   * Generate documentation comment
   */
  static toDocComment(str: string, note?: string, examples?: string[]): string[] {
    if (typeof str !== 'string') return []
    const result = [str]
    if (note) {
      result.push('')
      result.push(note)
    }
    if (examples && Array.isArray(examples)) {
      result.push('')
      result.push('Examples:')
      examples.forEach(example => {
        result.push(`  - ${example}`)
      })
    }
    return result
  }

  /**
   * Format date
   */
  static date(date?: Date | string | number, format?: string): string {
    const d = date ? new Date(date) : new Date()
    
    if (!format) return d.toString()
    if (format === 'iso') return d.toISOString()
    if (format === 'date') return d.toDateString() 
    if (format === 'time') return d.toTimeString()
    
    // Handle specific format patterns
    if (format === 'YYYY-MM-DD') {
      return d.getFullYear() + '-' + 
        String(d.getMonth() + 1).padStart(2, '0') + '-' + 
        String(d.getDate()).padStart(2, '0')
    }
    if (format === 'DD/MM/YYYY') {
      return String(d.getDate()).padStart(2, '0') + '/' + 
        String(d.getMonth() + 1).padStart(2, '0') + '/' + 
        d.getFullYear()
    }
    if (format === 'YYYY') {
      return String(d.getFullYear())
    }
    
    return d.toString()
  }

  /**
   * Convert to JSON
   */
  static tojson(obj: any, indent?: number): string {
    return JSON.stringify(obj, null, indent)
  }

  /**
   * Get default value if undefined/null/empty
   */
  static default(value: any, defaultValue: any): any {
    return (value != null && value !== '') ? value : defaultValue
  }

  /**
   * Add numbers
   */
  static add(a: number, b: number): number {
    return Number(a) + Number(b)
  }

  /**
   * Subtract numbers  
   */
  static subtract(a: number, b: number): number {
    return Number(a) - Number(b)
  }

  /**
   * Multiply numbers
   */
  static multiply(a: number, b: number): number {
    return Number(a) * Number(b)
  }

  /**
   * Divide numbers
   */
  static divide(a: number, b: number): number {
    const num = Number(a)
    const divisor = Number(b)
    if (divisor === 0) {
      if (num === 0) return NaN
      return num > 0 ? Infinity : -Infinity
    }
    return num / divisor
  }

  /**
   * Modulo operation
   */
  static modulo(a: number, b: number): number {
    return Number(a) % Number(b)
  }

  /**
   * Floor number
   */
  static floor(num: number): number {
    return Math.floor(Number(num))
  }

  /**
   * Ceiling number
   */
  static ceil(num: number): number {
    return Math.ceil(Number(num))
  }

  /**
   * Absolute value
   */
  static abs(num: number): number {
    return Math.abs(Number(num))
  }

  /**
   * Round number
   */
  static round(num: number, precision: number = 0): number {
    const factor = Math.pow(10, precision)
    return Math.round(Number(num) * factor) / factor
  }

  /**
   * Check if value is string
   */
  static isString(value: any): boolean {
    return typeof value === 'string'
  }

  /**
   * Check if value is empty
   */
  static isEmpty(value: any): boolean {
    if (value == null) return true
    if (typeof value === 'string') return value.trim().length === 0
    if (Array.isArray(value)) return value.length === 0
    if (typeof value === 'object') return Object.keys(value).length === 0
    return false
  }

  /**
   * Check if value is number
   */
  static isNumber(value: any): boolean {
    return typeof value === 'number' && !isNaN(value)
  }

  /**
   * Check if value is boolean
   */
  static isBoolean(value: any): boolean {
    return typeof value === 'boolean'
  }

  /**
   * Check if value is array
   */
  static isArray(value: any): boolean {
    return Array.isArray(value)
  }

  /**
   * Check if value is object
   */
  static isObject(value: any): boolean {
    return value != null && typeof value === 'object' && !Array.isArray(value)
  }

  /**
   * Sort attributes by requirement level
   */
  static sortAttributes(attributes: SemanticConventionAttribute[]): SemanticConventionAttribute[] {
    if (!Array.isArray(attributes)) return []
    const levelOrder = { 
      required: 0, 
      conditionally_required: 1, 
      recommended: 2, 
      opt_in: 3 
    }
    return [...attributes].sort((a, b) => {
      const aLevel = levelOrder[a.requirement_level] || 3
      const bLevel = levelOrder[b.requirement_level] || 3
      return aLevel - bLevel || (a.name || a.id || '').localeCompare(b.name || b.id || '')
    })
  }

  /**
   * Filter attributes by stability
   */
  static filterByStability(attributes: SemanticConventionAttribute[], stability: string[] | string): SemanticConventionAttribute[] {
    if (!Array.isArray(attributes)) return []
    if (typeof stability === 'string') {
      return attributes.filter(attr => attr.stability === stability)
    }
    if (Array.isArray(stability)) {
      return attributes.filter(attr => 
        !attr.stability && stability.includes('stable') || // Include attributes without stability only if 'stable' is requested
        (attr.stability && stability.includes(attr.stability))
      )
    }
    return attributes
  }

  /**
   * Group attributes by namespace
   */
  static groupByNamespace(attributes: SemanticConventionAttribute[]): Record<string, SemanticConventionAttribute[]> {
    if (!Array.isArray(attributes)) return {}
    return attributes.reduce((groups, attr) => {
      const namespace = (attr as any).namespace || 'default'
      if (!groups[namespace]) {
        groups[namespace] = []
      }
      groups[namespace].push(attr)
      return groups
    }, {} as Record<string, SemanticConventionAttribute[]>)
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
      // String case conversions
      camelCase: UnjucksFilters.camelCase,
      pascalCase: UnjucksFilters.pascalCase,
      snakeCase: UnjucksFilters.snakeCase,
      kebabCase: UnjucksFilters.kebabCase,
      constantCase: UnjucksFilters.constantCase,
      
      // Type conversions
      toTypeScriptType: UnjucksFilters.toTypeScriptType,
      toGoType: UnjucksFilters.toGoType,
      toRustType: UnjucksFilters.toRustType,
      
      // Array operations
      sort: UnjucksFilters.sort,
      groupBy: UnjucksFilters.groupBy,
      filter: UnjucksFilters.filter,
      map: UnjucksFilters.map,
      unique: UnjucksFilters.unique,
      
      // String operations
      capitalize: UnjucksFilters.capitalize,
      title: UnjucksFilters.title,
      truncate: UnjucksFilters.truncate,
      padStart: UnjucksFilters.padStart,
      padEnd: UnjucksFilters.padEnd,
      replace: UnjucksFilters.replace,
      split: UnjucksFilters.split,
      join: UnjucksFilters.join,
      
      // Documentation and format
      toDocComment: UnjucksFilters.toDocComment,
      date: UnjucksFilters.date,
      tojson: UnjucksFilters.tojson,
      default: UnjucksFilters.default,
      
      // Mathematical operations
      add: UnjucksFilters.add,
      subtract: UnjucksFilters.subtract,
      multiply: UnjucksFilters.multiply,
      divide: UnjucksFilters.divide,
      modulo: UnjucksFilters.modulo,
      round: UnjucksFilters.round,
      floor: UnjucksFilters.floor,
      ceil: UnjucksFilters.ceil,
      abs: UnjucksFilters.abs,
      
      // Type checking
      isString: UnjucksFilters.isString,
      isEmpty: UnjucksFilters.isEmpty,
      isNumber: UnjucksFilters.isNumber,
      isBoolean: UnjucksFilters.isBoolean,
      isArray: UnjucksFilters.isArray,
      isObject: UnjucksFilters.isObject,
      
      // Semantic convention specific
      sortAttributes: UnjucksFilters.sortAttributes,
      filterByStability: UnjucksFilters.filterByStability,
      groupByNamespace: UnjucksFilters.groupByNamespace,
      filterAttributes: UnjucksFilters.filterAttributes,
      toTsType: UnjucksFilters.toTsType,
      defaultValue: UnjucksFilters.defaultValue
    }
  }
}

// Default export for convenience
export default UnjucksFilters