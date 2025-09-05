#!/usr/bin/env node
/**
 * Citty Pro v2026.1.1 Reference Implementation
 * Playground CLI demonstrating production-grade autonomous CLI generation
 * with Weaver Forge, OpenTelemetry, and AI orchestration
 */

import { defineCommand, runMain } from "../src/index.js";
import { setupCLITelemetry, initializeTelemetry } from "../src/otel/instrumentation.js";
import consola from "consola";

// Initialize telemetry for the playground
const telemetry = initializeTelemetry({
  serviceName: 'citty-pro-playground',
  serviceVersion: '2026.1.1',
  environment: 'development',
  enableTracing: true,
  enableMetrics: true,
  exporters: {
    traces: ['console'],
    metrics: ['console', 'prometheus'],
    logs: ['console']
  }
});

const main = defineCommand({
  meta: {
    name: "citty-pro",
    version: "2026.1.1",
    description: "🚀 Citty Pro - Production-grade autonomous CLI generation framework with AI orchestration",
  },
  
  setup() {
    consola.success("🔧 Citty Pro Playground initialized");
    consola.info("🔍 OpenTelemetry instrumentation active");
    consola.info("📊 Prometheus metrics available at http://localhost:9464/metrics");
    consola.box("Welcome to the future of CLI development!");
  },
  
  cleanup() {
    consola.info("🧹 Cleaning up Citty Pro Playground");
    telemetry?.shutdown();
  },
  
  subCommands: {
    // Core generation commands
    generate: () => import("./commands/generate.js").then((r) => r.default),
    forge: () => import("./commands/forge.js").then((r) => r.default),
    analyze: () => import("./commands/analyze.js").then((r) => r.default),
    
    // Production workflow commands  
    build: () => import("./commands/build.js").then((r) => r.default),
    deploy: () => import("./commands/deploy.js").then((r) => r.default),
    publish: () => import("./commands/publish.js").then((r) => r.default),
    
    // AI orchestration commands
    orchestrate: () => import("./commands/orchestrate.js").then((r) => r.default),
    swarm: () => import("./commands/swarm.js").then((r) => r.default),
    queen: () => import("./commands/queen.js").then((r) => r.default),
    
    // Monitoring and observability
    telemetry: () => import("./commands/telemetry.js").then((r) => r.default),
    metrics: () => import("./commands/metrics.js").then((r) => r.default),
    trace: () => import("./commands/trace.js").then((r) => r.default),
    
    // Development and debugging
    debug: () => import("./commands/debug.js").then((r) => r.default),
    validate: () => import("./commands/validate.js").then((r) => r.default),
    benchmark: () => import("./commands/benchmark.js").then((r) => r.default),
  },
});

// Run with enhanced error handling and telemetry
runMain(main, {
  showUsage(usage) {
    consola.log("\n🎯 Citty Pro v2026.1.1 - Autonomous CLI Generation Framework\n");
    consola.log(usage);
    consola.log("\n📚 Quick Start:");
    consola.log("  citty-pro generate \"Create a REST API management CLI\"");
    consola.log("  citty-pro forge --semantic-conventions ./schemas/api.yaml");
    consola.log("  citty-pro orchestrate --hive-queen --agents 5");
    consola.log("\n🔗 Documentation: https://citty-pro.dev/docs");
    consola.log("💬 Discord: https://discord.gg/citty-pro");
  }
}).catch((error) => {
  consola.error("Fatal error in Citty Pro Playground:", error);
  process.exit(1);
});