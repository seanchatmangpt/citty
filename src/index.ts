export * from "./types";
export type { RunCommandOptions } from "./command";
export type { RunMainOptions } from "./main";

export { defineCommand, runCommand } from "./command";
export { parseArgs } from "./args";
export { renderUsage, showUsage } from "./usage";
export { runMain, createMain } from "./main";
export {
  toOntology,
  toSimpleOntology,
  fromOntology,
  generateFromOntology,
  validateOntology,
} from "./ontology";

// Commands
export { generateCommand } from "./commands/generate";
export { generateProCommand } from "./commands/generate-pro";

// AI Generation
export { 
  OllamaGenerator, 
  generateCLI, 
  enhanceCLI, 
  checkOllama 
} from "./ai/ollama-generator";
export type { AIPromptConfig } from "./ai/ollama-generator";

// Weaver Forge
export { 
  WeaverForge
} from "./weaver/forge-integration";
export type { WeaverForgeConfig } from "./weaver/forge-integration";

// OpenTelemetry
export {
  initializeTelemetry,
  shutdownTelemetry,
  setupCLITelemetry,
  traceCommand,
  monitorPerformance,
  CLIMetrics
} from "./otel/instrumentation";
export type { TelemetryConfig } from "./otel/instrumentation";