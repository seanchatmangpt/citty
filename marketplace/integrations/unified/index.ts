/**
 * Unified Orchestration Layer
 * 
 * This module provides a comprehensive orchestration layer that seamlessly integrates
 * CNS, ByteStar, and Marketplace systems through:
 * 
 * 1. Unified API Gateway - Single entry point with intelligent routing
 * 2. Cross-System Data Flow - Real-time synchronization and transformations
 * 3. Workflow Orchestration - Complex workflows spanning all systems
 * 4. Monitoring & Observability - Unified logging, metrics, and health checks
 */

// Main orchestrator
export { UnifiedOrchestrator, createUnifiedOrchestrator, orchestrator } from './unified-orchestrator';

// Gateway components
export { UnifiedAPIGateway, createUnifiedGateway } from './gateway/api-gateway';
export { RequestRouter } from './gateway/request-router';
export { LoadBalancer } from './gateway/load-balancer';
export { CircuitBreaker } from './gateway/circuit-breaker';

// Workflow orchestration
export { WorkflowEngine } from './orchestrator/workflow-engine';

// Event system
export { EventBus } from './messaging/event-bus';

// Authentication and authorization
export { AuthenticationService } from './auth/auth-service';
export { RateLimiter } from './auth/rate-limiter';

// Monitoring and observability
export { Logger } from './monitoring/logger';
export { MetricsCollector } from './monitoring/metrics-collector';

// Data transformations
export { ResponseTransformer } from './transformations/response-transformer';

// Configuration management
export { ConfigManager, configManager } from './config/config-manager';

// Type definitions
export type {
  UnifiedRequest,
  UnifiedResponse,
  SystemType,
  DataFlow,
  Workflow,
  WorkflowStep,
  Event,
  AuthContext,
  RateLimit,
  SystemHealth,
  SystemConfig,
  SystemOperation,
  CrossSystemWorkflow,
  UnifiedConfig
} from './types/orchestration';

// Schemas for validation
export {
  UnifiedRequestSchema,
  UnifiedResponseSchema,
  DataFlowSchema,
  WorkflowSchema,
  WorkflowStepSchema,
  EventSchema,
  AuthContextSchema,
  RateLimitSchema,
  SystemHealthSchema,
  SystemConfigSchema
} from './types/orchestration';

/**
 * Quick Start Example:
 * 
 * ```typescript
 * import { createUnifiedOrchestrator } from './marketplace/integrations/unified';
 * 
 * const orchestrator = createUnifiedOrchestrator({
 *   environment: 'production',
 *   configPath: './config/production.json',
 *   enableMetrics: true,
 *   enableWorkflows: true,
 *   enableEvents: true
 * });
 * 
 * await orchestrator.initialize();
 * await orchestrator.start();
 * 
 * // Process a cross-system workflow
 * const executionId = await orchestrator.executeCrossSystemWorkflow(
 *   'validate-enhance-execute',
 *   { data: 'input-data' }
 * );
 * 
 * // Check health
 * const health = orchestrator.getHealth();
 * console.log('System health:', health.overall);
 * ```
 */

/**
 * Configuration Example:
 * 
 * ```json
 * {
 *   "environment": "production",
 *   "version": "1.0.0",
 *   "systems": {
 *     "cns": {
 *       "endpoints": {
 *         "primary": { "url": "https://cns.example.com", "timeout": 30000 },
 *         "secondary": { "url": "https://cns-backup.example.com", "timeout": 30000 }
 *       },
 *       "auth": { "type": "api-key", "config": {} },
 *       "features": { "uhftValidation": true, "semanticParsing": true }
 *     },
 *     "bytestar": {
 *       "endpoints": {
 *         "primary": { "url": "https://bytestar.example.com", "timeout": 60000 }
 *       },
 *       "auth": { "type": "oauth2", "config": {} },
 *       "features": { "aiEnhancement": true, "contentGeneration": true }
 *     },
 *     "marketplace": {
 *       "endpoints": {
 *         "primary": { "url": "https://marketplace.example.com", "timeout": 30000 }
 *       },
 *       "auth": { "type": "bearer", "config": {} },
 *       "features": { "dimensionalSearch": true, "quantumMarketplace": true }
 *     }
 *   },
 *   "gateway": {
 *     "port": 3000,
 *     "cors": {
 *       "origins": ["https://app.example.com"],
 *       "methods": ["GET", "POST", "PUT", "DELETE"],
 *       "headers": ["Content-Type", "Authorization"]
 *     },
 *     "rateLimit": {
 *       "global": { "requests": 10000, "window": 3600 },
 *       "perUser": { "requests": 1000, "window": 3600 }
 *     },
 *     "loadBalancing": {
 *       "strategy": "health-based",
 *       "healthCheck": { "enabled": true, "interval": 30000 }
 *     }
 *   }
 * }
 * ```
 */

/**
 * Workflow Examples:
 * 
 * 1. **CNS → ByteStar → Marketplace Pipeline:**
 *    ```typescript
 *    await orchestrator.executeCrossSystemWorkflow('validate-enhance-execute', {
 *      data: 'content-to-process',
 *      options: { validateFirst: true, enhanceAlways: false }
 *    });
 *    ```
 * 
 * 2. **Semantic Processing → AI Enhancement → Search:**
 *    ```typescript
 *    await orchestrator.executeCrossSystemWorkflow('semantic-ai-marketplace', {
 *      query: 'find quantum computing resources',
 *      context: 'research-focused'
 *    });
 *    ```
 * 
 * 3. **Custom Multi-Step Workflow:**
 *    ```typescript
 *    await orchestrator.executeComplexWorkflow([
 *      { system: 'cns', operation: 'validate-uhft', data: { input } },
 *      { system: 'bytestar', operation: 'ai-enhance', data: { validated } },
 *      { system: 'marketplace', operation: 'publish', data: { enhanced } }
 *    ]);
 *    ```
 */

/**
 * Event System Examples:
 * 
 * ```typescript
 * // Subscribe to all CNS events
 * orchestrator.subscribeToEvents('cns.*', (event) => {
 *   console.log('CNS event:', event.type, event.data);
 * });
 * 
 * // Publish cross-system event
 * await orchestrator.publishEvent('workflow.completed', {
 *   workflowId: 'validate-enhance-execute',
 *   result: 'success',
 *   metrics: { processingTime: 2500, systemsUsed: 3 }
 * }, 'marketplace');
 * ```
 */

/**
 * Monitoring Examples:
 * 
 * ```typescript
 * // Check overall system health
 * const health = orchestrator.getHealth();
 * if (health.overall === 'unhealthy') {
 *   console.error('System health issues detected:', health.components);
 * }
 * 
 * // Get detailed metrics
 * const metrics = orchestrator.getMetrics();
 * console.log('Request throughput:', metrics.gateway.requestsPerSecond);
 * console.log('Active workflows:', metrics.workflows.active);
 * console.log('Event queue length:', metrics.events.queueLength);
 * ```
 */

// Default exports for convenience
export default UnifiedOrchestrator;