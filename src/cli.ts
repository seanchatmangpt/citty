import { defineCommand, runMain } from "./index.js";
import * as commands from "./commands/index.js";

/**
 * Citty Pro v2026.1.1 - Production CLI Generation Framework
 * 
 * Architecture: Pattern of Three with HIVE QUEEN Orchestration
 * - Tier 1 (Commands): User interaction and interface layer
 * - Tier 2 (Operations): Business logic and optimization layer  
 * - Tier 3 (Runtime): Infrastructure execution and I/O layer
 * 
 * Features:
 * - 🧠 AI-Native CLI generation with real Ollama integration
 * - 👑 HIVE MIND QUEEN orchestration system
 * - 🏗️ Exoskeleton Pattern for flexible architecture
 * - ⚡ 80/20 weighted optimization system
 * - 📡 Production-grade observability with OpenTelemetry
 * - 🧪 Comprehensive permutation testing
 */
export const main = defineCommand({
  meta: {
    name: "citty-pro",
    version: "2026.1.1", 
    description: "🚀 Production-grade CLI generation framework with HIVE MIND QUEEN orchestration",
  },
  subCommands: {
    // Tier 1: Command Interface Layer
    queen: commands.queen,         // 👑 HIVE MIND QUEEN orchestration
    orchestrate: commands.orchestrate, // 🎼 Multi-agent coordination
    generate: commands.generate,   // 🚀 AI-powered CLI generation
    forge: commands.forge,        // 🔧 Semantic convention processing
    
    // Tier 2: Operations Layer  
    swarm: commands.swarm,        // 🐝 Distributed agent management
    validate: commands.validate,  // ✅ Production readiness validation
    benchmark: commands.benchmark, // ⚡ Performance optimization
    debug: commands.debug,        // 🐛 Intelligent diagnostics
    
    // Tier 3: Runtime Layer
    telemetry: commands.telemetry, // 📡 AI-native observability
    metrics: commands.metrics,    // 📊 Semantic metrics analysis
    trace: commands.trace,        // 🔍 Distributed execution tracing
  },
  
  args: {
    // Global Exoskeleton Pattern Options
    exoskeleton: {
      type: "boolean",
      description: "Enable Exoskeleton Pattern structural framework",
      default: true,
    },
    weightedOptimization: {
      type: "boolean", 
      description: "Enable 80/20 weighted optimization system",
      default: true,
    },
    aiNative: {
      type: "boolean",
      description: "Enable AI-native processing at all layers",
      default: true,
    },
    hiveMode: {
      type: "boolean",
      description: "Enable HIVE MIND QUEEN coordination",
      default: true,
    },
    semanticObservability: {
      type: "boolean",
      description: "Enable semantic observability and tracing",
      default: true,
    },
    verbose: {
      type: "boolean",
      description: "Show detailed architectural information",
      alias: "v",
    },
  },

  async run({ args, cmd }) {
    const {
      exoskeleton,
      weightedOptimization, 
      aiNative,
      hiveMode,
      semanticObservability,
      verbose
    } = args;

    if (verbose) {
      console.log(`
🚀 Citty Pro v2026.1.1 - Production CLI Generation Framework

🏗️  Architecture: Pattern of Three with HIVE QUEEN Orchestration
├── Tier 1 (Commands): queen, orchestrate, generate, forge
├── Tier 2 (Operations): swarm, validate, benchmark, debug  
└── Tier 3 (Runtime): telemetry, metrics, trace

⚡ System Configuration:
├── 🦴 Exoskeleton Pattern: ${exoskeleton ? '✅ Enabled' : '❌ Disabled'}
├── 📊 80/20 Weighted Optimization: ${weightedOptimization ? '✅ Enabled' : '❌ Disabled'}
├── 🧠 AI-Native Processing: ${aiNative ? '✅ Enabled' : '❌ Disabled'}
├── 👑 HIVE MIND QUEEN: ${hiveMode ? '✅ Active' : '❌ Inactive'}
└── 📡 Semantic Observability: ${semanticObservability ? '✅ Enabled' : '❌ Disabled'}

🎯 Usage Examples:
  citty-pro queen --mission "Build production API CLI with tests"
  citty-pro generate --prompt "Create Docker management CLI" --model qwen3-coder:30b
  citty-pro orchestrate --agents architect,coder,tester --topology hierarchical
  citty-pro swarm create --size 8 --topology adaptive --strategy consensus
  citty-pro validate production-api --checks security,performance,scalability
      `);
    }

    // Display help if no subcommand provided
    console.log(`
👑 Citty Pro v2026.1.1 - HIVE MIND QUEEN CLI Generation Framework

🚀 Quick Commands:
  queen           👑 HIVE MIND QUEEN orchestration with 80/20 ultrathink
  generate        🚀 AI-powered CLI generation with real Ollama integration
  orchestrate     🎼 Multi-agent coordination with advanced topologies
  forge           🔧 Semantic convention processing with Weaver Forge
  swarm           🐝 Distributed agent management and scaling
  validate        ✅ Production readiness and compliance validation
  benchmark       ⚡ Advanced performance benchmarking and optimization
  debug           🐛 Intelligent debugging and diagnostic analysis
  telemetry       📡 AI-native semantic observability management
  metrics         📊 Advanced metrics collection and analysis
  trace           🔍 Distributed tracing and execution flow analysis

🎯 Pattern of Three Architecture:
  Commands Layer  → User interface and interaction (queen, orchestrate, generate, forge)
  Operations Layer → Business logic and optimization (swarm, validate, benchmark, debug)
  Runtime Layer   → Infrastructure and execution (telemetry, metrics, trace)

💡 Get started: citty-pro queen --help
    `);
  }
});

if (import.meta.main) {
  runMain(main);
}