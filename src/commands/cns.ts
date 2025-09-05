/**
 * CNS Commands for Citty CLI
 * 
 * Provides access to CNS (Cognitive Neural System) functionality including
 * ontology processing, semantic analysis, and AI-driven workflows.
 */

import { defineCommand } from 'citty'
import { PythonBridge } from '../bridges/python-bridge'
import { createUnifiedBridge } from '../bridges'
import * as fs from 'fs/promises'
import * as path from 'path'

// Global bridge instance
let pythonBridge: PythonBridge | null = null
let unifiedBridge: any = null

/**
 * Initialize bridge connections
 */
async function initializeBridge() {
  if (!pythonBridge) {
    const cnsPath = process.env.CNS_PATH || path.join(process.env.HOME || '~', 'cns')
    pythonBridge = new PythonBridge({ cnsPath })
    
    pythonBridge.on('processError', (error) => {
      console.error('CNS Process Error:', error)
    })
    
    pythonBridge.on('metrics', (metrics) => {
      if (process.env.DEBUG) {
        console.log('CNS Metrics:', metrics)
      }
    })
  }
  
  if (!unifiedBridge) {
    unifiedBridge = createUnifiedBridge()
  }
}

/**
 * Main CNS command
 */
export const cnsCommand = defineCommand({
  meta: {
    name: 'cns',
    description: 'CNS (Cognitive Neural System) operations'
  },
  subCommands: {
    ontology: defineCommand({
      meta: {
        name: 'ontology',
        description: 'Ontology processing and validation operations'
      },
      subCommands: {
        validate: defineCommand({
          meta: {
            name: 'validate',
            description: 'Validate ontology files using CNS semantic engine'
          },
          args: {
            file: {
              type: 'positional',
              description: 'Ontology file to validate',
              required: true
            },
            format: {
              type: 'string',
              description: 'Ontology format (owl, rdf, ttl, n3, json-ld)',
              default: 'owl'
            },
            strict: {
              type: 'boolean',
              description: 'Enable strict validation mode',
              default: false
            },
            output: {
              type: 'string',
              description: 'Output format (json, text, detailed)',
              default: 'text'
            }
          },
          async run({ args }) {
            await initializeBridge()

            try {
              // Read ontology file
              const filePath = path.resolve(args.file)
              const ontologyData = await fs.readFile(filePath, 'utf8')

              console.log(`Validating ontology: ${args.file}`)
              console.log(`Format: ${args.format}, Strict: ${args.strict}`)
              
              // Validate using CNS bridge
              const result = await pythonBridge!.validateOntology(ontologyData, args.format)

              if (result.success) {
                console.log('✅ Ontology validation successful')
                
                if (args.output === 'detailed' || args.output === 'json') {
                  console.log('\nValidation Results:')
                  console.log(JSON.stringify(result.data, null, 2))
                }
                
                console.log(`\nPerformance: ${result.performance.latency.toFixed(2)}ms`)
                console.log(`Memory Usage: ${(result.performance.memoryUsage / 1024 / 1024).toFixed(2)}MB`)
                
              } else {
                console.error('❌ Ontology validation failed')
                console.error(`Error: ${result.error}`)
                process.exit(1)
              }

            } catch (error) {
              console.error('❌ Command execution failed:', error)
              process.exit(1)
            }
          }
        }),

        transform: defineCommand({
          meta: {
            name: 'transform',
            description: 'Transform ontology between different formats'
          },
          args: {
            input: {
              type: 'positional',
              description: 'Input ontology file',
              required: true
            },
            output: {
              type: 'positional',
              description: 'Output file path',
              required: true
            },
            from: {
              type: 'string',
              description: 'Source format (owl, rdf, ttl, n3, json-ld)',
              required: true
            },
            to: {
              type: 'string',
              description: 'Target format (owl, rdf, ttl, n3, json-ld, fuller-canon)',
              required: true
            },
            validate: {
              type: 'boolean',
              description: 'Validate before transformation',
              default: true
            }
          },
          async run({ args }) {
            await initializeBridge()

            try {
              const inputPath = path.resolve(args.input)
              const outputPath = path.resolve(args.output)
              const ontologyData = await fs.readFile(inputPath, 'utf8')

              console.log(`Transforming: ${args.input} -> ${args.output}`)
              console.log(`Format: ${args.from} -> ${args.to}`)

              // Transform using bridge
              let result
              if (args.to === 'fuller-canon') {
                // Use unified bridge for cross-system transformation
                result = await unifiedBridge.execute({
                  operation: 'cross-transform',
                  sourceSystem: 'cns',
                  targetSystem: 'bytestar',
                  sourceFormat: args.from,
                  targetFormat: args.to,
                  data: ontologyData
                })
              } else {
                result = await pythonBridge!.transformOntology(
                  ontologyData, 
                  args.from, 
                  args.to
                )
              }

              if (result.success) {
                // Write transformed data
                const transformedData = args.to === 'fuller-canon' 
                  ? result.data.transformedData 
                  : result.data
                
                await fs.writeFile(outputPath, transformedData, 'utf8')
                
                console.log('✅ Transformation successful')
                console.log(`Output written to: ${outputPath}`)
                console.log(`Performance: ${result.performance.latency || result.performance.totalLatency}ms`)
                
              } else {
                console.error('❌ Transformation failed')
                console.error(`Error: ${result.error}`)
                process.exit(1)
              }

            } catch (error) {
              console.error('❌ Command execution failed:', error)
              process.exit(1)
            }
          }
        }),

        reason: defineCommand({
          meta: {
            name: 'reason',
            description: 'Apply semantic reasoning to ontology'
          },
          args: {
            file: {
              type: 'positional',
              description: 'Ontology file for reasoning',
              required: true
            },
            reasoner: {
              type: 'string',
              description: 'Reasoning engine (pellet, hermit, fact++, elk)',
              default: 'pellet'
            },
            output: {
              type: 'string',
              description: 'Output file for inferred ontology'
            },
            profile: {
              type: 'string',
              description: 'OWL profile (DL, EL, QL, RL)',
              default: 'DL'
            },
            consistency: {
              type: 'boolean',
              description: 'Check consistency only',
              default: false
            }
          },
          async run({ args }) {
            await initializeBridge()

            try {
              const filePath = path.resolve(args.file)
              const ontologyData = await fs.readFile(filePath, 'utf8')

              console.log(`Applying reasoning: ${args.file}`)
              console.log(`Reasoner: ${args.reasoner}, Profile: ${args.profile}`)

              const result = await pythonBridge!.applyReasoning(ontologyData, {
                reasoner: args.reasoner,
                profile: args.profile,
                checkConsistency: args.consistency
              })

              if (result.success) {
                console.log('✅ Reasoning completed successfully')
                
                if (args.consistency) {
                  console.log(`Consistency: ${result.data.consistent ? 'CONSISTENT' : 'INCONSISTENT'}`)
                  if (result.data.inconsistencies) {
                    console.log('Inconsistencies found:')
                    result.data.inconsistencies.forEach((inc: string, i: number) => {
                      console.log(`  ${i + 1}. ${inc}`)
                    })
                  }
                } else {
                  if (args.output) {
                    await fs.writeFile(path.resolve(args.output), result.data.inferredOntology, 'utf8')
                    console.log(`Inferred ontology written to: ${args.output}`)
                  }
                  
                  console.log(`Inferences: ${result.data.inferenceCount || 0}`)
                  console.log(`Classes: ${result.data.classCount || 0}`)
                  console.log(`Properties: ${result.data.propertyCount || 0}`)
                }
                
                console.log(`Performance: ${result.performance.latency}ms`)
                
              } else {
                console.error('❌ Reasoning failed')
                console.error(`Error: ${result.error}`)
                process.exit(1)
              }

            } catch (error) {
              console.error('❌ Command execution failed:', error)
              process.exit(1)
            }
          }
        }),

        compile: defineCommand({
          meta: {
            name: 'compile',
            description: 'AOT compile ontology for performance optimization'
          },
          args: {
            file: {
              type: 'positional',
              description: 'Ontology file to compile',
              required: true
            },
            output: {
              type: 'string',
              description: 'Output directory for compiled artifacts'
            },
            optimize: {
              type: 'string',
              description: 'Optimization level (none, basic, aggressive)',
              default: 'basic'
            },
            target: {
              type: 'string',
              description: 'Target runtime (python, java, native)',
              default: 'python'
            }
          },
          async run({ args }) {
            await initializeBridge()

            try {
              const filePath = path.resolve(args.file)
              const ontologyData = await fs.readFile(filePath, 'utf8')
              
              const outputDir = args.output 
                ? path.resolve(args.output)
                : path.join(path.dirname(filePath), 'compiled')

              console.log(`AOT compiling: ${args.file}`)
              console.log(`Target: ${args.target}, Optimization: ${args.optimize}`)
              console.log(`Output directory: ${outputDir}`)

              const result = await pythonBridge!.compileAOT(ontologyData, {
                optimize: args.optimize,
                target: args.target,
                outputDir: outputDir
              })

              if (result.success) {
                console.log('✅ AOT compilation successful')
                console.log(`Compiled artifacts: ${result.data.artifactCount || 1}`)
                console.log(`Code size: ${result.data.codeSize || 'unknown'}`)
                console.log(`Performance gain: ${result.data.speedup || 'unknown'}x`)
                console.log(`Compilation time: ${result.performance.latency}ms`)
                
                if (result.data.artifacts) {
                  console.log('\nGenerated files:')
                  result.data.artifacts.forEach((artifact: string) => {
                    console.log(`  ${artifact}`)
                  })
                }
                
              } else {
                console.error('❌ AOT compilation failed')
                console.error(`Error: ${result.error}`)
                process.exit(1)
              }

            } catch (error) {
              console.error('❌ Command execution failed:', error)
              process.exit(1)
            }
          }
        })
      }
    }),

    semantic: defineCommand({
      meta: {
        name: 'semantic',
        description: 'Semantic analysis and querying operations'
      },
      subCommands: {
        query: defineCommand({
          meta: {
            name: 'query',
            description: 'Execute SPARQL queries against semantic knowledge base'
          },
          args: {
            query: {
              type: 'positional',
              description: 'SPARQL query string or file path',
              required: true
            },
            ontology: {
              type: 'string',
              description: 'Ontology file to query against'
            },
            format: {
              type: 'string',
              description: 'Output format (json, xml, csv, table)',
              default: 'table'
            },
            limit: {
              type: 'string',
              description: 'Maximum number of results',
              default: '100'
            }
          },
          async run({ args }) {
            await initializeBridge()

            try {
              let queryString = args.query
              
              // Check if query is a file path
              try {
                const queryPath = path.resolve(args.query)
                const stat = await fs.stat(queryPath)
                if (stat.isFile()) {
                  queryString = await fs.readFile(queryPath, 'utf8')
                  console.log(`Loading query from: ${args.query}`)
                }
              } catch {
                // Treat as inline query
              }

              console.log('Executing SPARQL query...')
              if (process.env.DEBUG) {
                console.log('Query:', queryString)
              }

              const result = await pythonBridge!.querySemantic(queryString, {
                ontologyFile: args.ontology,
                outputFormat: args.format,
                limit: parseInt(args.limit)
              })

              if (result.success) {
                console.log('✅ Query executed successfully')
                
                if (args.format === 'table' && result.data.results) {
                  // Format as table
                  console.log('\nResults:')
                  console.table(result.data.results)
                } else {
                  console.log('\nResults:')
                  console.log(JSON.stringify(result.data, null, 2))
                }
                
                console.log(`\nRows: ${result.data.count || result.data.results?.length || 0}`)
                console.log(`Query time: ${result.performance.latency}ms`)
                
              } else {
                console.error('❌ Query execution failed')
                console.error(`Error: ${result.error}`)
                process.exit(1)
              }

            } catch (error) {
              console.error('❌ Command execution failed:', error)
              process.exit(1)
            }
          }
        })
      }
    }),

    ai: defineCommand({
      meta: {
        name: 'ai',
        description: 'AI-driven workflow operations'
      },
      subCommands: {
        workflow: defineCommand({
          meta: {
            name: 'workflow',
            description: 'Execute AI-driven workflows'
          },
          args: {
            config: {
              type: 'positional',
              description: 'Workflow configuration file',
              required: true
            },
            input: {
              type: 'string',
              description: 'Input data file or directory'
            },
            output: {
              type: 'string',
              description: 'Output directory for results'
            },
            parallel: {
              type: 'string',
              description: 'Number of parallel workers',
              default: '1'
            }
          },
          async run({ args }) {
            await initializeBridge()

            try {
              const configPath = path.resolve(args.config)
              const workflowConfig = JSON.parse(await fs.readFile(configPath, 'utf8'))

              console.log(`Executing AI workflow: ${args.config}`)
              console.log(`Workers: ${args.parallel}`)
              
              const result = await pythonBridge!.processOntology({
                operation: 'ai-workflow' as any,
                input: JSON.stringify({
                  config: workflowConfig,
                  inputPath: args.input,
                  outputPath: args.output,
                  workers: parseInt(args.parallel)
                }),
                format: 'json' as any
              })

              if (result.success) {
                console.log('✅ AI workflow completed successfully')
                console.log(`Steps completed: ${result.data.stepsCompleted || 0}`)
                console.log(`Processing time: ${result.performance.latency}ms`)
                
                if (result.data.outputs) {
                  console.log('\nGenerated outputs:')
                  result.data.outputs.forEach((output: string) => {
                    console.log(`  ${output}`)
                  })
                }
                
              } else {
                console.error('❌ AI workflow failed')
                console.error(`Error: ${result.error}`)
                process.exit(1)
              }

            } catch (error) {
              console.error('❌ Command execution failed:', error)
              process.exit(1)
            }
          }
        })
      }
    }),

    status: defineCommand({
      meta: {
        name: 'status',
        description: 'Show CNS system status and health'
      },
      args: {
        detailed: {
          type: 'boolean',
          description: 'Show detailed status information',
          default: false
        },
        json: {
          type: 'boolean',
          description: 'Output in JSON format',
          default: false
        }
      },
      async run({ args }) {
        await initializeBridge()

        try {
          const health = await pythonBridge!.getHealth()
          
          if (args.json) {
            console.log(JSON.stringify(health, null, 2))
            return
          }

          console.log('CNS System Status')
          console.log('================')
          console.log(`Status: ${health.status}`)
          console.log(`Pool Size: ${health.poolSize}`)
          console.log(`Available Processes: ${health.availableProcesses}`)
          console.log(`Busy Processes: ${health.busyProcesses}`)
          
          if (args.detailed) {
            console.log('\nMetrics:')
            console.log(`  Success Rate: ${(health.metrics.successRate * 100).toFixed(1)}%`)
            console.log(`  Error Rate: ${(health.metrics.errorRate * 100).toFixed(1)}%`)
            console.log(`  Average Latency: ${health.metrics.averageLatency.toFixed(2)}ms`)
            console.log(`  Total Requests: ${health.metrics.requestsTotal}`)
            
            console.log('\nConfiguration:')
            console.log(`  Python Path: ${health.config.pythonPath}`)
            console.log(`  CNS Path: ${health.config.cnsPath}`)
            console.log(`  Max Retries: ${health.config.maxRetries}`)
            console.log(`  Timeout: ${health.config.timeout}ms`)
          }

        } catch (error) {
          console.error('❌ Failed to get CNS status:', error)
          process.exit(1)
        }
      }
    })
  }
})