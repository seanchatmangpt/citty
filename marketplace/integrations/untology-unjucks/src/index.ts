// Main exports for the Untology → Unjucks Pipeline
export * from './types.js';
export { PipelineCoordinator } from './pipeline/coordinator.js';
export { ContextBridge } from './pipeline/context-bridge.js';
export { OntologyLoader } from './pipeline/ontology-loader.js';
export { TemplateEngine } from './pipeline/template-engine.js';
export { CacheManager } from './pipeline/cache-manager.js';
export { PerformanceMonitor } from './pipeline/performance-monitor.js';

export { ConfigManager } from './config/config-manager.js';
export { WatchService } from './services/watch-service.js';
export { ValidationService } from './services/validation-service.js';
export { GitHubIntegration } from './integrations/github-integration.js';
export { JenkinsIntegration } from './integrations/jenkins-integration.js';

// Convenience factory functions
export { createPipeline } from './factory.js';