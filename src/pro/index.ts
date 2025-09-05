// Citty Pro Framework - Main exports
export { hooks, registerCoreHooks, typedHooks } from './hooks';
export { runLifecycle } from './lifecycle';
export { defineTask } from './task';
export { defineWorkflow } from './workflow';
export { defineAIWrapperCommand } from './ai-wrapper-command';
export { 
  cittyContext,
  withContext,
  useContext,
  requireContext,
  createDefaultContext,
  type CittyProContext
} from './context';
export {
  registerPlugin,
  unregisterPlugin,
  applyPlugins,
  getPlugins,
  hasPlugin
} from './plugins';
export { createOtelPlugin } from './plugins/otel.plugin';
export { createAINotesPlugin, readAINotes, analyzeNotes } from './plugins/ai-notes.plugin';
export { runMain, createMain } from './main';
export { showUsage } from './usage';

// Workflow Generation exports
export {
  WorkflowGenerator,
  workflowGenerator,
  WorkflowEntitySchema,
  TaskOntologySchema,
  WorkflowOntologySchema,
  PipelineOntologySchema,
  WorkflowTemplates,
  SchemaHelpers
} from './workflow-generator';

// UNJUCKS Production Systems - Complete DARK MATTER implementation
export {
  UNJUCKS,
  // Semantic context system
  SemanticContextManager,
  semanticContextManager,
  createSemanticContext,
  propagateContext,
  // Template resolution
  templateResolver,
  templateDiscovery,
  discoverTemplates,
  // Ontology bridge
  ontologyTemplateBridge,
  generateFromSemanticOntology,
  bridgeOntologyToTemplate,
  syncTemplateToOntology,
  // Production monitoring
  productionMonitor,
  performanceProfiler,
  errorRecoverySystem,
  developerTools,
  recordMetric,
  createAlert,
  startTrace,
  finishTrace,
  // Documentation
  documentationSystem,
  generateDocs,
  // Integrated workflows
  withSemanticContext,
  withPerformanceMonitoring,
  withFullErrorRecovery,
  withDebugging,
  withProductionMonitoring,
  // System management
  getSystemHealth,
  initializeProductionSystems,
  shutdownProductionSystems,
  // Types
  type SemanticContext,
  type TemplateResolution,
  type BridgeResult,
  type PerformanceMetrics,
  type ErrorContext,
  type DebugSession,
  type MetricData,
  type Alert,
  type DocSection
} from '../unjucks';

// Re-export types
export type {
  // Core types
  Output,
  Unhook,
  ProviderAIModel,
  RunCtx,
  
  // Hook types
  HookPayload,
  HookName,
  Hooks,
  
  // Task types
  TaskSpec,
  Task,
  
  // Workflow types
  StepFn,
  StepSpec,
  WorkflowSeed,
  Workflow,
  WithKey,
  
  // AI types
  AITool,
  AIWrapperOptions,
  AIWrapperCommandSpec,
  
  // Command types
  ArgType,
  ArgDef,
  CommandMeta,
  Command,
  
  // Plugin types
  Plugin,
  LifecycleAPI,
  PersistAdapter,
  ReportAdapter,
  
  // Orchestration types
  RunLifecycleOptions
} from '../types/citty-pro';

// Create the main cittyPro export
import { defineTask } from './task';
import { defineWorkflow } from './workflow';
import { defineAIWrapperCommand } from './ai-wrapper-command';
import { runLifecycle } from './lifecycle';

export const cittyPro = {
  // Core Citty Pro functionality
  defineTask,
  defineWorkflow,
  defineAIWrapperCommand,
  runLifecycle,
  
  // UNJUCKS Production Systems - Complete implementation
  unjucks: UNJUCKS,
  
  // Quick access to key production capabilities
  monitoring: productionMonitor,
  profiler: performanceProfiler,
  errorRecovery: errorRecoverySystem,
  debugger: developerTools,
  docs: documentationSystem,
  
  // System health and management
  getSystemHealth,
  initializeProduction: initializeProductionSystems,
  shutdownProduction: shutdownProductionSystems
};