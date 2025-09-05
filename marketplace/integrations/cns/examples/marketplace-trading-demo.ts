/**
 * CNS Marketplace Trading Demo
 * 
 * Demonstrates the full CNS integration for marketplace trading scenarios
 * with real-time news validation, semantic processing, and distributed execution.
 */

import { CNSMarketplaceIntegration, CNSIntegrationConfig, MarketplaceOperation } from '../index.js'

/**
 * Demo: High-frequency trading with CNS integration
 */
async function runHFTDemo(): Promise<void> {
  console.log('🚀 Starting CNS Marketplace HFT Demo')
  console.log('=====================================')

  // Configure CNS integration
  const config: CNSIntegrationConfig = {
    cnsPath: '~/cns',
    enableOWLCompiler: true,
    enableUHFTEngine: true,
    enableMemoryLayer: true,
    enableBitActorSystem: true,
    marketplaceOntology: 'trading',
    swarmConfig: {
      name: 'hft_marketplace_swarm',
      topology: 'mesh',
      nodeCount: 6,
      replicationFactor: 2,
      consensusProtocol: 'raft'
    }
  }

  // Initialize CNS integration
  const cns = new CNSMarketplaceIntegration(config)
  
  // Setup event listeners for monitoring
  setupEventListeners(cns)

  try {
    // Initialize all components
    console.log('🔧 Initializing CNS components...')
    await cns.initialize()
    console.log('✅ CNS initialization complete')

    // Run HFT scenario
    console.log('\n📈 Running High-Frequency Trading Scenario...')
    const hftScenario = cns.getMarketplaceScenarios().find(s => s.name === 'High-Frequency Trading Pipeline')
    
    if (!hftScenario) {
      throw new Error('HFT scenario not found')
    }

    const scenarioResult = await cns.runMarketplaceScenario(hftScenario)
    
    console.log('\n📊 HFT Scenario Results:')
    console.log(`   Success: ${scenarioResult.success ? '✅' : '❌'}`)
    console.log(`   Operations: ${scenarioResult.results.length}`)
    console.log(`   Success Rate: ${scenarioResult.overallMetrics.successfulOperations}/${scenarioResult.overallMetrics.totalOperations}`)
    console.log(`   Avg Processing Time: ${scenarioResult.overallMetrics.averageProcessingTime.toFixed(2)}ms`)
    console.log(`   Avg Validation Score: ${scenarioResult.overallMetrics.averageValidationScore.toFixed(2)}/100`)

    // Show detailed results
    console.log('\n🔍 Detailed Operation Results:')
    for (const result of scenarioResult.results) {
      console.log(`   ${result.operationId}: ${result.success ? '✅' : '❌'} (${result.metrics.processingTimeMs}ms)`)
      
      if (result.results.validation) {
        console.log(`      News Validation Score: ${result.results.validation.overallScore}/100`)
        console.log(`      Decision: ${result.results.validation.decision}`)
      }
      
      if (result.results.actor) {
        console.log(`      Actors Used: ${result.results.actor.actorsUsed}`)
      }
      
      if (result.recommendations.length > 0) {
        console.log(`      Recommendations: ${result.recommendations.join(', ')}`)
      }
    }

    // Get system metrics
    console.log('\n📊 System Metrics:')
    const metrics = await cns.getSystemMetrics()
    console.log('   Memory Layer:')
    Object.entries(metrics.memory).forEach(([layer, stats]: [string, any]) => {
      console.log(`     ${layer}: ${stats.blockCount} blocks, ${(stats.utilizationPercent || 0).toFixed(1)}% full`)
    })
    
    console.log('   BitActor System:')
    console.log(`     Total Actors: ${metrics.bitactor.totalActors}`)
    console.log(`     Active Actors: ${metrics.bitactor.activeActors}`)
    console.log(`     Messages/sec: ${metrics.bitactor.messagesThroughput}`)
    console.log(`     Fault Tolerance: ${metrics.bitactor.faultToleranceScore?.toFixed(1)}%`)
    console.log(`     Consensus: ${metrics.bitactor.consensusStatus}`)

    // Demonstrate custom operations
    console.log('\n🎯 Testing Custom Market Operations...')
    await runCustomOperations(cns)

  } catch (error) {
    console.error('❌ Demo failed:', error.message)
  } finally {
    // Cleanup
    console.log('\n🛑 Shutting down CNS components...')
    await cns.shutdown()
    console.log('✅ Shutdown complete')
  }
}

/**
 * Run custom marketplace operations
 */
async function runCustomOperations(cns: CNSMarketplaceIntegration): Promise<void> {
  // Custom operation 1: Real-time news validation
  const newsOperation: MarketplaceOperation = {
    id: 'custom_news_validation',
    type: 'validate',
    data: {
      news: 'Federal Reserve announces 0.25% interest rate increase',
      sources: ['federal_reserve', 'bloomberg', 'reuters', 'wsj'],
      confidence: 0.9
    },
    priority: 'critical',
    timestamp: Date.now(),
    requiresSemanticProcessing: true,
    requiresNewsValidation: true,
    requiresFaultTolerance: true
  }

  const newsResult = await cns.processMarketplaceOperation(newsOperation)
  console.log(`   News Validation: ${newsResult.success ? '✅' : '❌'} (Score: ${newsResult.metrics.validationScore}/100)`)

  // Custom operation 2: Semantic product analysis
  const productOperation: MarketplaceOperation = {
    id: 'custom_product_analysis',
    type: 'analyze',
    data: {
      products: [
        { name: 'Tesla Model S', category: 'automotive', price: 79999, sustainability_rating: 'A+' },
        { name: 'Ford F-150 Lightning', category: 'automotive', price: 52974, sustainability_rating: 'A' },
        { name: 'Toyota Prius', category: 'automotive', price: 27450, sustainability_rating: 'A++' }
      ],
      analysis_type: 'semantic_similarity'
    },
    priority: 'medium',
    timestamp: Date.now(),
    requiresSemanticProcessing: true,
    requiresNewsValidation: false,
    requiresFaultTolerance: false
  }

  const productResult = await cns.processMarketplaceOperation(productOperation)
  console.log(`   Product Analysis: ${productResult.success ? '✅' : '❌'} (${productResult.metrics.processingTimeMs}ms)`)

  // Custom operation 3: Distributed risk assessment
  const riskOperation: MarketplaceOperation = {
    id: 'custom_risk_assessment',
    type: 'analyze',
    data: {
      portfolio: {
        'TSLA': { shares: 1000, current_price: 250.00, volatility: 0.35 },
        'AAPL': { shares: 2000, current_price: 175.00, volatility: 0.25 },
        'NVDA': { shares: 500, current_price: 480.00, volatility: 0.40 }
      },
      market_conditions: {
        vix: 22.5,
        trend: 'bearish',
        news_sentiment: -0.2
      }
    },
    priority: 'high',
    timestamp: Date.now(),
    requiresSemanticProcessing: false,
    requiresNewsValidation: true,
    requiresFaultTolerance: true
  }

  const riskResult = await cns.processMarketplaceOperation(riskOperation)
  console.log(`   Risk Assessment: ${riskResult.success ? '✅' : '❌'} (Actors: ${riskResult.metrics.actorsInvolved})`)

  // Show recommendations from all operations
  const allRecommendations = [
    ...newsResult.recommendations,
    ...productResult.recommendations,
    ...riskResult.recommendations
  ].filter(r => r.length > 0)

  if (allRecommendations.length > 0) {
    console.log('\n💡 System Recommendations:')
    allRecommendations.forEach(rec => console.log(`   • ${rec}`))
  }
}

/**
 * Setup event listeners for monitoring system behavior
 */
function setupEventListeners(cns: CNSMarketplaceIntegration): void {
  // CNS main events
  cns.on('cns:initialized', (data) => {
    console.log('🎉 CNS Initialized:', Object.keys(data.components).filter(k => data.components[k]).join(', '))
  })

  cns.on('cns:processing_start', (operation) => {
    console.log(`⚡ Processing ${operation.type} operation: ${operation.id}`)
  })

  cns.on('cns:processing_complete', (result) => {
    const status = result.success ? '✅' : '❌'
    console.log(`${status} Operation ${result.operationId} completed in ${result.metrics.processingTimeMs}ms`)
  })

  // OWL Compiler events
  cns.on('cns:owl:compilation_success', (data) => {
    console.log(`📚 OWL Compilation successful: ${data.generatedFiles?.length || 0} files generated`)
  })

  // UHFT Engine events
  cns.on('cns:uhft:validation_complete', (data) => {
    console.log(`⚡ UHFT Validation: Score ${data.overallScore}/100, Decision: ${data.decision}`)
  })

  // Memory Layer events
  cns.on('cns:memory:leak_detected', (data) => {
    console.log(`⚠️  Memory leak detected: ${data.leakRateMbPerHour.toFixed(2)} MB/hour`)
  })

  cns.on('cns:memory:healing_complete', (data) => {
    console.log(`🔧 Memory healing completed: ${data.type} on ${data.targetLayer}`)
  })

  // BitActor System events
  cns.on('cns:bitactor:spawned', (data) => {
    console.log(`🤖 Actor spawned: ${data.type} (${data.id})`)
  })

  cns.on('cns:bitactor:fault_injected', (data) => {
    console.log(`⚠️  Fault injected: ${data.faultType} on actor ${data.actorId}`)
  })

  // Error events
  cns.on('cns:processing_error', (data) => {
    console.error(`❌ Processing error for ${data.operation.id}: ${data.error}`)
  })
}

/**
 * Demo: Fault tolerance testing
 */
async function runFaultToleranceDemo(): Promise<void> {
  console.log('\n🔧 Starting Fault Tolerance Demo')
  console.log('=================================')

  const config: CNSIntegrationConfig = {
    cnsPath: '~/cns',
    enableBitActorSystem: true,
    enableUHFTEngine: false,
    enableOWLCompiler: false,
    enableMemoryLayer: true,
    swarmConfig: {
      name: 'fault_tolerance_test',
      topology: 'mesh',
      nodeCount: 8,
      faultTolerance: {
        enableHeartbeat: true,
        heartbeatInterval: 2000,
        failureThreshold: 2,
        recoveryTimeout: 10000,
        enableAutoRestart: true,
        maxAutoRestarts: 3
      }
    }
  }

  const cns = new CNSMarketplaceIntegration(config)
  
  try {
    await cns.initialize()
    
    // Run distributed risk management scenario
    const scenario = cns.getMarketplaceScenarios().find(s => s.name === 'Distributed Risk Management')
    if (scenario) {
      console.log('📊 Running distributed risk management...')
      const result = await cns.runMarketplaceScenario(scenario)
      console.log(`Result: ${result.success ? '✅' : '❌'}`)
      
      // Get BitActor metrics
      const metrics = await cns.getSystemMetrics()
      console.log(`Fault Tolerance Score: ${metrics.bitactor.faultToleranceScore?.toFixed(1)}%`)
      console.log(`Consensus Status: ${metrics.bitactor.consensusStatus}`)
    }

  } finally {
    await cns.shutdown()
  }
}

/**
 * Main demo execution
 */
async function main(): Promise<void> {
  console.log('🌟 CNS Marketplace Integration Demo')
  console.log('===================================')
  console.log('Demonstrating CNS integration with:')
  console.log('• OWL Compiler for semantic processing')
  console.log('• UHFT Engine for 10ns news validation')
  console.log('• Memory Layer for intelligent data management')
  console.log('• BitActor System for fault-tolerant distributed processing')
  console.log()

  try {
    // Run main HFT demo
    await runHFTDemo()

    console.log('\n' + '='.repeat(50))
    
    // Run fault tolerance demo
    await runFaultToleranceDemo()

    console.log('\n✅ All demos completed successfully!')
    console.log('\n📋 Summary:')
    console.log('• High-frequency trading pipeline demonstrated')
    console.log('• Real-time news validation with 10ns processing')
    console.log('• Semantic ontology processing for marketplace data')
    console.log('• Distributed fault-tolerant operations')
    console.log('• Intelligent memory management with L1-L4 layers')
    console.log('• Actor-based coordination and messaging')

  } catch (error) {
    console.error('❌ Demo suite failed:', error.message)
    process.exit(1)
  }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export {
  runHFTDemo,
  runFaultToleranceDemo,
  runCustomOperations,
  setupEventListeners
}