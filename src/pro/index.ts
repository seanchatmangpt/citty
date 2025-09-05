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
export { createHiveQueen } from './hive-queen';
export { createPatternOfThree } from './pattern-of-three';
export { createOptimizer } from './weighted-optimizer';
export { runMain, createMain } from './main';
export { showUsage } from './usage';

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
  ArgsDef,
  ParsedArgs,
  CommandMeta,
  Command,
  
  // Plugin types
  Plugin,
  LifecycleAPI,
  PersistAdapter,
  ReportAdapter,
  
  // Orchestration types
  RunLifecycleOptions,
  
  // HIVE QUEEN types
  HiveQueenMode,
  AgentRole,
  HiveAgent,
  HiveQueenConfig,
  HiveQueenOrchestrator,
  
  // Pattern of Three types
  TierType,
  ArchitecturalTier,
  PatternOfThree,
  
  // Exoskeleton types
  ExoskeletonLayer,
  ExoskeletonFramework,
  
  // Optimization types
  WeightedStrategy,
  WeightedOptimizer,
  
  // Observability types
  SemanticSpan,
  SemanticObservability
} from '../types/citty-pro';

// Create the main cittyPro export
import { defineTask } from './task';
import { defineWorkflow } from './workflow';
import { defineAIWrapperCommand } from './ai-wrapper-command';
import { runLifecycle } from './lifecycle';

// Import actual implementations
import { createHiveQueen as createHiveQueenImpl } from './hive-queen';
import { createPatternOfThree as createPatternOfThreeImpl } from './pattern-of-three';
import { createOptimizer as createOptimizerImpl } from './weighted-optimizer';

export const cittyPro = {
  defineTask,
  defineWorkflow,
  defineAIWrapperCommand,
  runLifecycle,
  
  // HIVE QUEEN - Real implementation
  createHiveQueen: createHiveQueenImpl,
  
  // Pattern of Three - Real implementation
  createPatternOfThree: createPatternOfThreeImpl,
  
  // Exoskeleton (still placeholder - less critical for 80/20)
  createExoskeleton: () => {
    console.warn('Exoskeleton framework coming soon');
    return null as any;
  },
  
  // Weighted Optimization - Real implementation
  createOptimizer: createOptimizerImpl,
  
  // Semantic Observability (still placeholder - less critical for 80/20)
  createSemanticObserver: () => {
    console.warn('Semantic observability coming soon');
    return null as any;
  }
};