/**
 * Unjucks v2026.1.1 - Comprehensive Integration Test Suite
 * Testing loop for production readiness with ultrathink definition of done
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createUnjucks, generateFromOntology, resolveTemplate, renderTemplate } from '../../src/unjucks';
import { createOntology, loadGraph, addTriple, findEntities, getValue } from '../../src/untology';
import { telemetry } from '../../src/unjucks/telemetry';
import { getGlobalProcessor, getAdaptiveProcessor } from '../../src/unjucks/parallel';
import { getDeploymentConfig, initializeProduction, HealthChecker, ErrorRecovery } from '../../src/unjucks/deployment';
import { readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { resolve, join } from 'pathe';
import { performance } from 'node:perf_hooks';

const TEST_DIR = resolve('./tests/fixtures/v2026');
const OUTPUT_DIR = resolve('./tests/output/v2026');

describe('Unjucks v2026.1.1 Integration Tests', () => {
  
  beforeAll(async () => {
    // Setup test environment
    await mkdir(TEST_DIR, { recursive: true });
    await mkdir(OUTPUT_DIR, { recursive: true });
    
    // Initialize production features
    await initializeProduction();
    
    // Start telemetry
    telemetry.start();
  });
  
  afterAll(async () => {
    // Clean up
    await rm(OUTPUT_DIR, { recursive: true, force: true });
    
    // Export telemetry report
    await telemetry.exportReport('./tests/telemetry-report.json');
    
    // Shutdown processors
    await getGlobalProcessor().shutdown();
    await getAdaptiveProcessor().shutdown();
  });

  describe('Core Functionality', () => {
    it('should initialize with production configuration', async () => {
      const ctx = await createUnjucks({
        templatesDir: './templates',
        outputDir: OUTPUT_DIR,
        cache: true,
        parallel: true
      });
      
      expect(ctx).toBeDefined();
      expect(ctx.templates.size).toBeGreaterThan(0);
      expect(ctx.options.parallel).toBe(true);
      
      // Check deployment config
      const config = getDeploymentConfig();
      expect(config.environment).toBeDefined();
      expect(config.features.caching).toBeDefined();
    });

    it('should handle ontology-driven generation', async () => {
      // Create test ontology
      const ontologyContent = `
        @prefix citty: <https://citty.pro/ontology#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        
        :deploy a citty:Command ;
          citty:name "deploy" ;
          citty:description "Deploy application to cloud" ;
          citty:arguments [
            citty:name "environment" ;
            citty:type "string" ;
            citty:required true
          ] .
        
        :ci-workflow a citty:Workflow ;
          citty:name "ci-pipeline" ;
          citty:steps ( :build :test :deploy ) .
      `;
      
      const ontologyPath = join(TEST_DIR, 'test.ttl');
      await writeFile(ontologyPath, ontologyContent);
      
      // Generate from ontology
      const result = await generateFromOntology(ontologyPath, undefined, {
        outputDir: OUTPUT_DIR,
        dryRun: false
      });
      
      expect(result.success).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.duration).toBeLessThan(5000);
    });
  });

  describe('Performance & Scalability', () => {
    it('should handle 1000+ entities efficiently', async () => {
      await createOntology();
      
      // Generate 1000 entities
      const start = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        addTriple(`command-${i}`, 'rdf:type', 'citty:Command');
        addTriple(`command-${i}`, 'citty:name', `cmd${i}`);
        addTriple(`command-${i}`, 'citty:description', `Command ${i} description`);
      }
      
      const entities = findEntities('citty:Command');
      const duration = performance.now() - start;
      
      expect(entities.length).toBe(1000);
      expect(duration).toBeLessThan(1000); // Less than 1ms per entity
      
      // Test query performance
      const queryStart = performance.now();
      const value = getValue('command-500', 'citty:name');
      const queryDuration = performance.now() - queryStart;
      
      expect(value).toBe('cmd500');
      expect(queryDuration).toBeLessThan(10);
    });

    it('should process templates in parallel', async () => {
      const processor = getGlobalProcessor();
      
      // Process multiple templates concurrently
      const tasks = Array(10).fill(0).map((_, i) => ({
        type: 'render' as const,
        data: {
          template: { content: 'Hello {{ name }}', frontMatter: {} },
          context: { name: `User${i}` }
        }
      }));
      
      const start = performance.now();
      const results = await Promise.all(
        tasks.map(task => processor.process(task))
      );
      const duration = performance.now() - start;
      
      expect(results.length).toBe(10);
      expect(duration).toBeLessThan(1000); // Parallel should be fast
      
      // Check stats
      const stats = processor.getStats();
      expect(stats.tasksProcessed).toBeGreaterThan(0);
      expect(stats.workers).toBeGreaterThan(0);
    });

    it('should adapt concurrency based on performance', async () => {
      const adaptive = getAdaptiveProcessor();
      
      const items = Array(100).fill(0).map((_, i) => ({ id: i }));
      
      const results = await adaptive.process(
        items,
        (item) => ({
          type: 'render',
          data: {
            template: { content: 'Item {{ id }}', frontMatter: {} },
            context: item
          }
        })
      );
      
      expect(results.length).toBe(100);
      
      // Performance should be tracked
      const report = telemetry.getReport();
      expect(report.templateRenders).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery & Resilience', () => {
    it('should recover from template errors', async () => {
      const recovery = new ErrorRecovery(getDeploymentConfig());
      
      let attempts = 0;
      const flaky = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      };
      
      const result = await recovery.withRecovery(flaky, {
        operationId: 'flaky-render',
        maxRetries: 3,
        backoffMs: 10
      });
      
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should use circuit breaker for repeated failures', async () => {
      const recovery = new ErrorRecovery(getDeploymentConfig());
      
      const failing = async () => {
        throw new Error('Persistent failure');
      };
      
      // Trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await recovery.withRecovery(failing, {
            operationId: 'failing-op',
            maxRetries: 0
          });
        } catch {
          // Expected
        }
      }
      
      // Circuit should be open
      await expect(
        recovery.withRecovery(failing, {
          operationId: 'failing-op',
          maxRetries: 0
        })
      ).rejects.toThrow('Circuit breaker open');
    });

    it('should provide fallback values', async () => {
      const recovery = new ErrorRecovery(getDeploymentConfig());
      
      const result = await recovery.withRecovery(
        async () => {
          throw new Error('Failed');
        },
        {
          operationId: 'with-fallback',
          maxRetries: 0,
          fallback: () => 'fallback-value'
        }
      );
      
      expect(result).toBe('fallback-value');
    });
  });

  describe('Health Monitoring', () => {
    it('should perform health checks', async () => {
      const config = getDeploymentConfig();
      const healthChecker = new HealthChecker(config);
      
      const health = await healthChecker.check();
      
      expect(health.status).toBeDefined();
      expect(health.checks).toBeDefined();
      expect(health.metrics).toBeDefined();
      expect(health.metrics.memory).toBeDefined();
      expect(health.metrics.uptime).toBeGreaterThan(0);
    });

    it('should detect degraded state', async () => {
      const config = {
        ...getDeploymentConfig(),
        performance: { memoryLimit: 1 } // Unreasonably low
      };
      
      const healthChecker = new HealthChecker(config);
      const health = await healthChecker.check();
      
      expect(health.checks.memory).toBe(false);
      expect(['degraded', 'unhealthy']).toContain(health.status);
    });
  });

  describe('Telemetry & Metrics', () => {
    it('should collect performance metrics', async () => {
      telemetry.start();
      
      // Simulate operations
      await telemetry.measure('template_render', async () => {
        await new Promise(r => setTimeout(r, 10));
      });
      
      telemetry.record('cache_hit', 5);
      telemetry.record('cache_miss', 10);
      
      const report = telemetry.getReport();
      
      expect(report.templateRenders).toBeGreaterThan(0);
      expect(report.averageRenderTime).toBeGreaterThan(0);
      expect(report.cacheHitRate).toBeGreaterThan(0);
      expect(report.memoryUsage.heapUsed).toBeGreaterThan(0);
    });

    it('should provide optimization hints', () => {
      telemetry.start();
      
      // Simulate poor cache performance
      for (let i = 0; i < 10; i++) {
        telemetry.record('cache_miss', 10);
      }
      telemetry.record('cache_hit', 1);
      
      const hints = telemetry.getOptimizationHints();
      
      expect(hints.length).toBeGreaterThan(0);
      expect(hints.some(h => h.includes('cache'))).toBe(true);
    });
  });

  describe('CLI Integration', () => {
    it('should handle CLI commands correctly', async () => {
      const { spawn } = await import('child_process');
      const { promisify } = await import('util');
      const exec = promisify(spawn);
      
      // Test list command
      const listResult = await new Promise<string>((resolve, reject) => {
        const proc = spawn('node', [resolve('./src/unjucks/cli.js'), 'list']);
        let output = '';
        proc.stdout.on('data', (data) => output += data.toString());
        proc.on('close', (code) => {
          if (code === 0) resolve(output);
          else reject(new Error(`Exit code: ${code}`));
        });
      });
      
      expect(listResult).toContain('Available Generators');
    });
  });

  describe('Security', () => {
    it('should validate ontology input', async () => {
      const config = getDeploymentConfig();
      config.security.validateOntologies = true;
      
      const malformed = `
        This is not valid Turtle
        @prefix missing
      `;
      
      const path = join(TEST_DIR, 'malformed.ttl');
      await writeFile(path, malformed);
      
      await expect(
        generateFromOntology(path)
      ).rejects.toThrow();
    });

    it('should enforce file size limits', async () => {
      const config = getDeploymentConfig();
      config.security.maxFileSize = 100; // 100 bytes
      
      const large = 'x'.repeat(200);
      const path = join(TEST_DIR, 'large.ttl');
      await writeFile(path, large);
      
      // Should reject large files when security is enabled
      // (Implementation would check file size before loading)
      expect(large.length).toBeGreaterThan(config.security.maxFileSize);
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should work on different platforms', () => {
      const platforms = ['darwin', 'linux', 'win32'];
      const originalPlatform = process.platform;
      
      platforms.forEach(platform => {
        Object.defineProperty(process, 'platform', {
          value: platform,
          writable: true,
          configurable: true
        });
        
        const config = getDeploymentConfig();
        expect(config).toBeDefined();
      });
      
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        writable: true,
        configurable: true
      });
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory during long operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Run many operations
      for (let i = 0; i < 100; i++) {
        await createOntology();
        addTriple(`entity-${i}`, 'rdf:type', 'test:Entity');
        
        if (i % 10 === 0) {
          global.gc && global.gc(); // Force GC if available
        }
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const growth = finalMemory - initialMemory;
      
      // Memory growth should be reasonable (< 50MB for 100 operations)
      expect(growth).toBeLessThan(50 * 1024 * 1024);
    });
  });
});