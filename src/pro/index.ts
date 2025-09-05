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
  RunLifecycleOptions
} from '../types/citty-pro';

// Create the main cittyPro export
import { defineTask } from './task';
import { defineWorkflow } from './workflow';
import { defineAIWrapperCommand } from './ai-wrapper-command';
import { runLifecycle } from './lifecycle';

export const cittyPro = {
  defineTask,
  defineWorkflow,
  defineAIWrapperCommand,
  runLifecycle
};