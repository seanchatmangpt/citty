/**
 * Quantum BDD Test Suite
 * Main entry point for running quantum-enhanced BDD tests
 */

import QuantumTestRunner, { QuantumTestConfig } from './support/quantum-test-runner';

/**
 * Default quantum test configuration
 */
const defaultConfig: QuantumTestConfig = {
  scenarios: [
    // Quantum State Testing
    'User in quantum superposition state',
    'Entangled transaction verification',
    'Quantum interference in price discovery',
    'Quantum decoherence in user sessions',
    'Quantum tunneling in payment processing',
    'Bell state creation for secure transactions',
    'Multi-party GHZ state for group transactions',
    'Quantum phase estimation for market timing',
    'Amplitude amplification for rare event detection',
    'Quantum random walks for recommendation paths',
    
    // Quantum Algorithms
    'Shor\'s algorithm for cryptographic key factorization',
    'Security audit using Shor\'s algorithm',
    'Grover\'s search for database queries',
    'Inventory optimization with Grover\'s search',
    'Quantum annealing for route optimization',
    'Portfolio optimization using quantum annealing',
    'VQE for pricing model optimization',
    'QAOA for combinatorial optimization',
    'HHL algorithm for linear systems',
    'Quantum Fourier Transform for signal processing',
    
    // Post-Quantum Security
    'Lattice-based key generation and encryption',
    'CRYSTALS-Kyber key encapsulation',
    'CRYSTALS-Dilithium digital signatures',
    'McEliece cryptosystem for secure messaging',
    'BIKE key encapsulation mechanism',
    'XMSS hash-based signatures',
    'SPHINCS+ stateless signatures',
    'Rainbow multivariate signatures',
    'Hybrid classical-quantum cryptography',
    'Cryptographic agility and migration',
    
    // Quantum Machine Learning
    'Quantum Neural Network training',
    'QNN convergence analysis',
    'Variational Quantum Classifier for fraud detection',
    'Quantum feature map optimization',
    'Quantum Generative Adversarial Network',
    'Quantum Reinforcement Learning agent',
    'Quantum advantage in exploration',
    'Quantum Support Vector Machine',
    'Quantum Principal Component Analysis',
    'Hybrid quantum-classical machine learning',
    
    // Quantum Marketplace
    'Quantum-secured auction system',
    'Quantum sealed-bid auction',
    'Entangled supply chain tracking',
    'Quantum product authentication',
    'Quantum-enhanced recommendation system',
    'Quantum collaborative filtering',
    'Quantum dynamic pricing',
    'Multi-dimensional quantum price optimization',
    'Quantum inventory optimization',
    'Quantum demand forecasting',
    'Quantum fraud detection',
    'Quantum portfolio optimization',
    'Quantum logistics optimization',
    'Quantum buyer-seller matching',
    'Quantum privacy-preserving transactions'
  ],
  
  quantumSimulation: {
    qubits: 8,
    decoherenceTime: 1000, // microseconds
    errorRate: 0.01, // 1% error rate
    noiseLevel: 0.05 // 5% noise
  },
  
  cryptographicSecurity: {
    level: 128, // 128-bit security level
    algorithms: ['lattice', 'code-based', 'hash-based', 'multivariate']
  },
  
  mlPerformance: {
    accuracyThreshold: 0.85, // 85% minimum accuracy
    speedupTarget: 2.0 // 2x speedup target
  },
  
  verificationCriteria: {
    fidelityThreshold: 0.9, // 90% fidelity
    entanglementThreshold: 0.7, // 70% entanglement strength
    quantumAdvantageThreshold: 1.5 // 1.5x quantum advantage
  }
};

/**
 * Run quantum BDD test suite
 */
export async function runQuantumTestSuite(
  config: Partial<QuantumTestConfig> = {}
): Promise<void> {
  const finalConfig = { ...defaultConfig, ...config };
  const runner = new QuantumTestRunner(finalConfig);
  
  console.log('🌌 QUANTUM BDD TEST SUITE');
  console.log('=' .repeat(60));
  console.log('🔬 Testing quantum computing concepts in BDD scenarios');
  console.log('🛡️  Verifying post-quantum cryptographic security');
  console.log('🧠 Evaluating quantum machine learning algorithms');
  console.log('🏪 Validating quantum marketplace enhancements');
  console.log('=' .repeat(60));
  
  try {
    // Initialize quantum testing environment
    await runner.initialize();
    
    // Run all quantum scenarios
    const report = await runner.runScenarios();
    
    // Export detailed report
    await exportTestReport(report);
    
    // Determine exit code based on results
    const exitCode = report.summary.failed > 0 ? 1 : 0;
    
    if (exitCode === 0) {
      console.log('🎉 All quantum tests passed successfully!');
      console.log('🚀 Quantum marketplace ready for deployment');
    } else {
      console.log('⚠️  Some quantum tests failed');
      console.log('🔧 Review recommendations and fix issues before deployment');
    }
    
    process.exit(exitCode);
    
  } catch (error) {
    console.error('💥 Fatal error in quantum test suite:');
    console.error(error);
    process.exit(1);
  }
}

/**
 * Export detailed test report
 */
async function exportTestReport(report: any): Promise<void> {
  const reportPath = './quantum-test-report.json';
  
  try {
    const fs = await import('fs/promises');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Detailed report exported to: ${reportPath}`);
  } catch (error) {
    console.warn('⚠️  Could not export detailed report:', error);
  }
}

/**
 * Run specific quantum test categories
 */
export async function runQuantumTestCategory(
  category: 'state' | 'algorithms' | 'crypto' | 'ml' | 'marketplace'
): Promise<void> {
  const categoryScenarios = {
    state: defaultConfig.scenarios.filter(s => 
      s.includes('superposition') || s.includes('entanglement') || 
      s.includes('interference') || s.includes('decoherence')
    ),
    algorithms: defaultConfig.scenarios.filter(s => 
      s.includes('Shor') || s.includes('Grover') || s.includes('annealing') ||
      s.includes('VQE') || s.includes('QAOA') || s.includes('HHL')
    ),
    crypto: defaultConfig.scenarios.filter(s => 
      s.includes('lattice') || s.includes('hash-based') || 
      s.includes('code-based') || s.includes('multivariate')
    ),
    ml: defaultConfig.scenarios.filter(s => 
      s.includes('Neural') || s.includes('Quantum Classifier') || 
      s.includes('GAN') || s.includes('Reinforcement Learning')
    ),
    marketplace: defaultConfig.scenarios.filter(s => 
      s.includes('auction') || s.includes('supply chain') || 
      s.includes('recommendation') || s.includes('pricing')
    )
  };
  
  const scenarios = categoryScenarios[category];
  if (scenarios.length === 0) {
    console.log(`❌ No scenarios found for category: ${category}`);
    return;
  }
  
  console.log(`🎯 Running ${category.toUpperCase()} quantum tests (${scenarios.length} scenarios)`);
  
  await runQuantumTestSuite({
    scenarios: scenarios
  });
}

/**
 * Performance benchmarking mode
 */
export async function runQuantumBenchmarks(): Promise<void> {
  const benchmarkConfig: Partial<QuantumTestConfig> = {
    scenarios: [
      'Shor\'s algorithm for cryptographic key factorization',
      'Grover\'s search for database queries',
      'Quantum annealing for route optimization',
      'Quantum Neural Network training',
      'Variational Quantum Classifier for fraud detection',
      'Quantum-enhanced recommendation system'
    ],
    verificationCriteria: {
      fidelityThreshold: 0.95,
      entanglementThreshold: 0.8,
      quantumAdvantageThreshold: 3.0 // Higher threshold for benchmarking
    }
  };
  
  console.log('🏁 QUANTUM PERFORMANCE BENCHMARKS');
  console.log('⚡ Testing quantum advantages and speedups');
  
  await runQuantumTestSuite(benchmarkConfig);
}

/**
 * Main entry point
 */
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Run full test suite
    runQuantumTestSuite();
  } else {
    const command = args[0];
    
    switch (command) {
      case 'state':
      case 'algorithms':
      case 'crypto':
      case 'ml':
      case 'marketplace':
        runQuantumTestCategory(command as any);
        break;
      case 'benchmark':
        runQuantumBenchmarks();
        break;
      default:
        console.log('Usage: quantum-test-suite [state|algorithms|crypto|ml|marketplace|benchmark]');
        process.exit(1);
    }
  }
}

export default {
  runQuantumTestSuite,
  runQuantumTestCategory,
  runQuantumBenchmarks
};