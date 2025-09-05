/**
 * CNS OWL Compiler Integration for Citty Marketplace
 * 
 * Integrates the actual CNS Ontology Web Language compiler for semantic processing
 * of marketplace data, product catalogs, and trading ontologies.
 * 
 * Based on ~/cns/owl_compiler_tests/test_runner.py and related CNS components
 */

import { spawn, exec } from 'child_process'
import { promises as fs } from 'fs'
import { join } from 'path'
import { EventEmitter } from 'events'

export interface OntologyCompileOptions {
  inputFile: string
  outputDir: string
  optimizationLevel: number
  enableInference: boolean
  enableEightfoldIntegration: boolean
  templateType: 'c' | 'typescript' | 'json'
}

export interface OntologyClass {
  name: string
  iri: string
  superClasses: string[]
  properties: string[]
  constraints: OntologyConstraint[]
}

export interface OntologyProperty {
  name: string
  iri: string
  domain: string[]
  range: string[]
  characteristics: string[]
  restrictions: any[]
}

export interface OntologyConstraint {
  type: 'shacl' | 'owl'
  path: string
  constraint: string
  value: any
}

export interface CompilationResult {
  success: boolean
  classes: OntologyClass[]
  properties: OntologyProperty[]
  constraints: OntologyConstraint[]
  generatedFiles: string[]
  statistics: {
    totalTriples: number
    classCount: number
    propertyCount: number
    constraintCount: number
  }
  errors: string[]
}

export interface MarketplaceOntology {
  // Marketplace-specific ontology types
  products: OntologyClass[]
  vendors: OntologyClass[]
  transactions: OntologyClass[]
  metadata: OntologyClass[]
}

export class CNSOWLCompiler extends EventEmitter {
  private cnsPath: string
  private pythonPath: string

  constructor(cnsPath: string = '~/cns', pythonPath: string = 'python3') {
    super()
    this.cnsPath = cnsPath.replace('~', process.env.HOME || '')
    this.pythonPath = pythonPath
  }

  /**
   * Compile an OWL ontology specification into marketplace-ready code
   */
  async compile(options: OntologyCompileOptions): Promise<CompilationResult> {
    const startTime = Date.now()
    this.emit('compilation:start', options)

    try {
      // Ensure output directory exists
      await fs.mkdir(options.outputDir, { recursive: true })

      // Create compilation config
      const configPath = join(options.outputDir, 'compile_config.json')
      const config = {
        input_files: [options.inputFile],
        output_dir: options.outputDir,
        optimization_level: options.optimizationLevel,
        enable_tests: false,
        inference_enabled: options.enableInference,
        eightfold_integration: options.enableEightfoldIntegration,
        template_type: options.templateType
      }
      
      await fs.writeFile(configPath, JSON.stringify(config, null, 2))

      // Execute CNS OWL compiler
      const compilerScript = join(this.cnsPath, 'owl_compiler_tests', 'test_runner.py')
      const result = await this.executePython(compilerScript, [
        '--config', configPath,
        '--output-format', 'json'
      ])

      if (!result.success) {
        throw new Error(`Compilation failed: ${result.stderr}`)
      }

      // Parse compilation results
      const resultData = JSON.parse(result.stdout)
      const compilationResult: CompilationResult = {
        success: true,
        classes: resultData.classes || [],
        properties: resultData.properties || [],
        constraints: resultData.constraints || [],
        generatedFiles: resultData.generated_files || [],
        statistics: resultData.statistics || {
          totalTriples: 0,
          classCount: 0,
          propertyCount: 0,
          constraintCount: 0
        },
        errors: []
      }

      this.emit('compilation:success', {
        ...compilationResult,
        duration: Date.now() - startTime
      })

      return compilationResult

    } catch (error) {
      const failureResult: CompilationResult = {
        success: false,
        classes: [],
        properties: [],
        constraints: [],
        generatedFiles: [],
        statistics: { totalTriples: 0, classCount: 0, propertyCount: 0, constraintCount: 0 },
        errors: [error.message]
      }

      this.emit('compilation:error', {
        ...failureResult,
        duration: Date.now() - startTime,
        error: error.message
      })

      return failureResult
    }
  }

  /**
   * Create marketplace-specific ontologies
   */
  async createMarketplaceOntology(name: string, outputDir: string): Promise<string> {
    const ontologyPath = join(outputDir, `${name}_marketplace.ttl`)
    
    const ontologyContent = this.generateMarketplaceOntology(name)
    await fs.writeFile(ontologyPath, ontologyContent)

    return ontologyPath
  }

  /**
   * Generate marketplace ontology TTL content
   */
  private generateMarketplaceOntology(name: string): string {
    return `@prefix : <http://marketplace.citty.org/${name}#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix marketplace: <http://marketplace.citty.org/core#> .
@prefix trading: <http://marketplace.citty.org/trading#> .

# Marketplace Ontology for ${name}
: a owl:Ontology ;
    rdfs:label "${name} Marketplace Ontology" ;
    rdfs:comment "Semantic ontology for ${name} marketplace operations" ;
    owl:imports <http://marketplace.citty.org/core> .

# Core Marketplace Classes
:Product a owl:Class ;
    rdfs:label "Product" ;
    rdfs:comment "A product offered in the marketplace" ;
    rdfs:subClassOf marketplace:MarketplaceItem .

:Vendor a owl:Class ;
    rdfs:label "Vendor" ;
    rdfs:comment "A vendor selling products" ;
    rdfs:subClassOf marketplace:MarketplaceAgent .

:Transaction a owl:Class ;
    rdfs:label "Transaction" ;
    rdfs:comment "A marketplace transaction" ;
    rdfs:subClassOf trading:TradingEvent .

:PaymentMethod a owl:Class ;
    rdfs:label "Payment Method" ;
    rdfs:comment "Method of payment for transactions" .

# Properties
:hasPrice a owl:DatatypeProperty ;
    rdfs:label "has price" ;
    rdfs:domain :Product ;
    rdfs:range xsd:decimal .

:hasVendor a owl:ObjectProperty ;
    rdfs:label "has vendor" ;
    rdfs:domain :Product ;
    rdfs:range :Vendor .

:participatesInTransaction a owl:ObjectProperty ;
    rdfs:label "participates in transaction" ;
    rdfs:domain marketplace:MarketplaceAgent ;
    rdfs:range :Transaction .

:usesPaymentMethod a owl:ObjectProperty ;
    rdfs:label "uses payment method" ;
    rdfs:domain :Transaction ;
    rdfs:range :PaymentMethod .

# UHFT Trading Extensions
:UHFTOrder a owl:Class ;
    rdfs:subClassOf trading:Order ;
    rdfs:label "Ultra High-Frequency Trading Order" ;
    rdfs:comment "Orders processed in sub-10ns timeframes" .

:has10nsValidation a owl:DatatypeProperty ;
    rdfs:label "has 10ns validation" ;
    rdfs:domain :UHFTOrder ;
    rdfs:range xsd:boolean .

:hasNewsValidation a owl:ObjectProperty ;
    rdfs:label "has news validation" ;
    rdfs:domain :UHFTOrder ;
    rdfs:range trading:NewsEvent .

# Constraints using SHACL
:ProductShape a sh:NodeShape ;
    sh:targetClass :Product ;
    sh:property [
        sh:path :hasPrice ;
        sh:datatype xsd:decimal ;
        sh:minInclusive 0.0 ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
    ] ;
    sh:property [
        sh:path :hasVendor ;
        sh:class :Vendor ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
    ] .

:TransactionShape a sh:NodeShape ;
    sh:targetClass :Transaction ;
    sh:property [
        sh:path :usesPaymentMethod ;
        sh:class :PaymentMethod ;
        sh:minCount 1 ;
    ] .
`
  }

  /**
   * Validate ontology using SHACL constraints
   */
  async validateOntology(ontologyPath: string, shapesPath?: string): Promise<{
    valid: boolean
    violations: any[]
    report: string
  }> {
    try {
      const validatorScript = join(this.cnsPath, 'validation', 'shacl_validator.py')
      const args = [ontologyPath]
      if (shapesPath) {
        args.push('--shapes', shapesPath)
      }

      const result = await this.executePython(validatorScript, args)
      const validation = JSON.parse(result.stdout)

      return {
        valid: validation.conforms,
        violations: validation.violations || [],
        report: validation.text || ''
      }
    } catch (error) {
      return {
        valid: false,
        violations: [],
        report: `Validation error: ${error.message}`
      }
    }
  }

  /**
   * Apply inference rules to expand the ontology
   */
  async applyInference(ontologyPath: string): Promise<{
    originalTriples: number
    inferredTriples: number
    newTriples: any[]
  }> {
    try {
      const inferenceScript = join(this.cnsPath, 'inference', 'owl_reasoner.py')
      const result = await this.executePython(inferenceScript, [
        ontologyPath,
        '--format', 'json'
      ])

      const inference = JSON.parse(result.stdout)
      
      return {
        originalTriples: inference.original_count || 0,
        inferredTriples: inference.inferred_count || 0,
        newTriples: inference.new_triples || []
      }
    } catch (error) {
      throw new Error(`Inference failed: ${error.message}`)
    }
  }

  /**
   * Execute Python script with arguments
   */
  private async executePython(scriptPath: string, args: string[] = []): Promise<{
    success: boolean
    stdout: string
    stderr: string
    code: number
  }> {
    return new Promise((resolve) => {
      const process = spawn(this.pythonPath, [scriptPath, ...args], {
        cwd: this.cnsPath,
        env: {
          ...process.env,
          PYTHONPATH: `${this.cnsPath}:${process.env.PYTHONPATH || ''}`
        }
      })

      let stdout = ''
      let stderr = ''

      process.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      process.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      process.on('close', (code) => {
        resolve({
          success: code === 0,
          stdout,
          stderr,
          code: code || 0
        })
      })

      process.on('error', (error) => {
        resolve({
          success: false,
          stdout: '',
          stderr: error.message,
          code: 1
        })
      })
    })
  }

  /**
   * Get available Eightfold Path mappings
   */
  getEightfoldMappings(): Record<string, string> {
    return {
      'Right Understanding': 'Knowledge Base and semantic reasoning',
      'Right Thought': 'Intention processing and planning',
      'Right Speech': 'Communication interfaces and APIs',
      'Right Action': 'Execution engines and transaction processing',
      'Right Livelihood': 'Maintenance and sustainability systems',
      'Right Effort': 'Optimization modules and performance tuning',
      'Right Mindfulness': 'Monitoring services and observability',
      'Right Concentration': 'Integration hubs and system coordination'
    }
  }
}

/**
 * Factory function to create CNS OWL Compiler instance
 */
export function createOWLCompiler(cnsPath?: string): CNSOWLCompiler {
  return new CNSOWLCompiler(cnsPath)
}

/**
 * Predefined marketplace ontology templates
 */
export const MARKETPLACE_ONTOLOGY_TEMPLATES = {
  ecommerce: 'Basic e-commerce marketplace with products, vendors, and transactions',
  trading: 'Financial trading marketplace with UHFT capabilities',
  services: 'Service marketplace with providers and consumers',
  digital: 'Digital goods marketplace with licensing and DRM',
  b2b: 'Business-to-business marketplace with contracts and negotiations'
}

export default CNSOWLCompiler