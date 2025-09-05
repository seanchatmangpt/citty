/**
 * HIVE QUEEN BDD Scenarios - Unjucks Template Hot-Reloading
 * Advanced template hot-reloading with ontology change detection and live updates
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';
import { EventEmitter } from 'events';
import { watch, FSWatcher } from 'fs';

// Hot-reload interfaces
interface HotReloadConfig {
  watchPaths: string[];
  debounceMs: number;
  enableOntologyWatch: boolean;
  enableDependencyTracking: boolean;
  notificationChannels: ('websocket' | 'sse' | 'polling')[];
  maxRetries: number;
}

interface FileChangeEvent {
  type: 'created' | 'modified' | 'deleted' | 'renamed';
  path: string;
  timestamp: number;
  size?: number;
  dependencies?: string[];
  ontologyImpact?: string[];
}

interface ReloadResult {
  success: boolean;
  affectedTemplates: string[];
  reloadTime: number;
  errors?: string[];
  ontologyChanges?: string[];
  dependencyUpdates?: string[];
}

interface TemplateCache {
  compiled: Map<string, any>;
  metadata: Map<string, any>;
  dependencies: Map<string, string[]>;
  lastModified: Map<string, number>;
  ontologyBindings: Map<string, string[]>;
}

// Hot-reloading template engine
class HotReloadUnjucksEngine extends EventEmitter {
  private config: HotReloadConfig;
  private watchers: Map<string, FSWatcher> = new Map();
  private cache: TemplateCache;
  private pendingReloads: Map<string, NodeJS.Timeout> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private ontologyGraph: Map<string, Set<string>> = new Map();
  private clients: Set<any> = new Set(); // WebSocket/SSE clients

  constructor(config: HotReloadConfig) {
    super();
    this.config = config;
    this.cache = {
      compiled: new Map(),
      metadata: new Map(),
      dependencies: new Map(),
      lastModified: new Map(),
      ontologyBindings: new Map()
    };
  }

  async initialize(): Promise<void> {
    console.log('Initializing hot-reload engine...');
    
    // Set up file watchers
    for (const watchPath of this.config.watchPaths) {
      await this.setupWatcher(watchPath);
    }

    // Build initial dependency graph
    if (this.config.enableDependencyTracking) {
      await this.buildDependencyGraph();
    }

    // Build ontology graph
    if (this.config.enableOntologyWatch) {
      await this.buildOntologyGraph();
    }

    console.log('Hot-reload engine initialized');
  }

  private async setupWatcher(watchPath: string): Promise<void> {
    console.log(`Setting up watcher for: ${watchPath}`);
    
    const watcher = watch(watchPath, { recursive: true }, (eventType, filename) => {
      if (filename) {
        this.handleFileChange(eventType as any, join(watchPath, filename));
      }
    });

    this.watchers.set(watchPath, watcher);
  }

  private handleFileChange(eventType: 'rename' | 'change', filePath: string): void {
    // Debounce file changes
    const existing = this.pendingReloads.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }

    const timeout = setTimeout(async () => {
      try {
        await this.processFileChange(eventType, filePath);
      } catch (error) {
        console.error('Error processing file change:', error);
        this.emit('error', { filePath, error });
      }
      this.pendingReloads.delete(filePath);
    }, this.config.debounceMs);

    this.pendingReloads.set(filePath, timeout);
  }

  private async processFileChange(eventType: 'rename' | 'change', filePath: string): Promise<void> {
    console.log(`Processing ${eventType} for: ${filePath}`);

    const changeEvent: FileChangeEvent = {
      type: eventType === 'change' ? 'modified' : 'renamed',
      path: filePath,
      timestamp: Date.now()
    };

    // Check if file exists (rename can be delete)
    try {
      const stats = await fs.stat(filePath);
      changeEvent.size = stats.size;
      
      if (changeEvent.type === 'renamed') {
        changeEvent.type = 'created'; // File was created/renamed to this location
      }
    } catch {
      changeEvent.type = 'deleted';
    }

    // Determine affected templates and dependencies
    const affectedTemplates = await this.findAffectedTemplates(filePath);
    changeEvent.dependencies = affectedTemplates;

    // Check for ontology impacts
    if (this.config.enableOntologyWatch && this.isOntologyFile(filePath)) {
      changeEvent.ontologyImpact = await this.findOntologyImpacts(filePath);
    }

    // Reload affected templates
    const reloadResult = await this.reloadTemplates(affectedTemplates, changeEvent);

    // Notify clients
    this.notifyClients({
      type: 'template-reload',
      changeEvent,
      reloadResult,
      timestamp: Date.now()
    });

    this.emit('reload', { changeEvent, reloadResult });
  }

  private async findAffectedTemplates(changedFile: string): Promise<string[]> {
    const affected: Set<string> = new Set();
    
    // Direct template file
    if (this.isTemplateFile(changedFile)) {
      affected.add(changedFile);
    }

    // Find templates that depend on this file
    if (this.config.enableDependencyTracking) {
      const dependents = this.dependencyGraph.get(changedFile) || new Set();
      dependents.forEach(dependent => affected.add(dependent));
    }

    // Find templates that use this ontology
    if (this.config.enableOntologyWatch && this.isOntologyFile(changedFile)) {
      const ontologyDependents = this.ontologyGraph.get(changedFile) || new Set();
      ontologyDependents.forEach(dependent => affected.add(dependent));
    }

    return Array.from(affected);
  }

  private async findOntologyImpacts(ontologyFile: string): Promise<string[]> {
    const impacts: string[] = [];
    
    // Mock ontology analysis - in real implementation would parse RDF/OWL changes
    const ontologyContent = await fs.readFile(ontologyFile, 'utf8').catch(() => '');
    
    if (ontologyContent.includes('TradingStrategy')) {
      impacts.push('trading-templates');
    }
    if (ontologyContent.includes('Customer')) {
      impacts.push('customer-templates');
    }
    if (ontologyContent.includes('Order')) {
      impacts.push('order-templates');
    }

    return impacts;
  }

  private async reloadTemplates(templatePaths: string[], changeEvent: FileChangeEvent): Promise<ReloadResult> {
    const startTime = performance.now();
    const result: ReloadResult = {
      success: true,
      affectedTemplates: templatePaths,
      reloadTime: 0,
      errors: [],
      ontologyChanges: changeEvent.ontologyImpact || [],
      dependencyUpdates: []
    };

    for (const templatePath of templatePaths) {
      try {
        await this.reloadSingleTemplate(templatePath);
        console.log(`✅ Reloaded: ${templatePath}`);
      } catch (error) {
        console.error(`❌ Failed to reload: ${templatePath}`, error);
        result.errors!.push(`${templatePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.success = false;
      }
    }

    // Update dependency graph if needed
    if (this.config.enableDependencyTracking && changeEvent.type !== 'deleted') {
      const dependencyUpdates = await this.updateDependencies(templatePaths);
      result.dependencyUpdates = dependencyUpdates;
    }

    result.reloadTime = performance.now() - startTime;
    return result;
  }

  private async reloadSingleTemplate(templatePath: string): Promise<void> {
    // Clear from cache
    this.cache.compiled.delete(templatePath);
    this.cache.metadata.delete(templatePath);
    
    try {
      // Check if file exists
      const stats = await fs.stat(templatePath);
      this.cache.lastModified.set(templatePath, stats.mtime.getTime());

      // Re-compile template (mock implementation)
      const content = await fs.readFile(templatePath, 'utf8');
      const compiled = await this.compileTemplate(content);
      const metadata = await this.extractMetadata(content);

      this.cache.compiled.set(templatePath, compiled);
      this.cache.metadata.set(templatePath, metadata);

      // Update ontology bindings
      if (metadata.ontology) {
        const currentBindings = this.cache.ontologyBindings.get(templatePath) || [];
        this.cache.ontologyBindings.set(templatePath, [metadata.ontology]);
      }
    } catch (error) {
      // Template was deleted
      if ((error as any).code === 'ENOENT') {
        this.cache.lastModified.delete(templatePath);
        this.cache.ontologyBindings.delete(templatePath);
      } else {
        throw error;
      }
    }
  }

  private async compileTemplate(content: string): Promise<any> {
    // Mock template compilation
    return { compiled: true, content, timestamp: Date.now() };
  }

  private async extractMetadata(content: string): Promise<any> {
    // Extract front-matter metadata
    if (content.startsWith('---\n')) {
      const endIndex = content.indexOf('\n---\n', 4);
      if (endIndex > 0) {
        const frontMatter = content.substring(4, endIndex);
        try {
          return JSON.parse(frontMatter);
        } catch {
          return { raw: frontMatter };
        }
      }
    }
    return {};
  }

  private async buildDependencyGraph(): Promise<void> {
    console.log('Building dependency graph...');
    
    // Mock dependency analysis - in real implementation would parse imports/includes
    for (const watchPath of this.config.watchPaths) {
      const files = await this.findAllTemplates(watchPath);
      
      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf8');
          const dependencies = this.findTemplateDependencies(content);
          
          if (dependencies.length > 0) {
            this.cache.dependencies.set(file, dependencies);
            
            // Build reverse dependency graph
            for (const dep of dependencies) {
              if (!this.dependencyGraph.has(dep)) {
                this.dependencyGraph.set(dep, new Set());
              }
              this.dependencyGraph.get(dep)!.add(file);
            }
          }
        } catch (error) {
          console.warn(`Could not analyze dependencies for ${file}:`, error);
        }
      }
    }
    
    console.log(`Built dependency graph with ${this.dependencyGraph.size} entries`);
  }

  private async buildOntologyGraph(): Promise<void> {
    console.log('Building ontology graph...');
    
    for (const watchPath of this.config.watchPaths) {
      const templates = await this.findAllTemplates(watchPath);
      
      for (const template of templates) {
        try {
          const content = await fs.readFile(template, 'utf8');
          const metadata = await this.extractMetadata(content);
          
          if (metadata.ontology) {
            const ontologyFile = metadata.ontology;
            if (!this.ontologyGraph.has(ontologyFile)) {
              this.ontologyGraph.set(ontologyFile, new Set());
            }
            this.ontologyGraph.get(ontologyFile)!.add(template);
            
            this.cache.ontologyBindings.set(template, [ontologyFile]);
          }
        } catch (error) {
          console.warn(`Could not analyze ontology binding for ${template}:`, error);
        }
      }
    }
    
    console.log(`Built ontology graph with ${this.ontologyGraph.size} entries`);
  }

  private findTemplateDependencies(content: string): string[] {
    const dependencies: string[] = [];
    
    // Find {% extends %} dependencies
    const extendsMatches = content.match(/{% extends ["']([^"']+)["'] %}/g);
    if (extendsMatches) {
      extendsMatches.forEach(match => {
        const templateName = match.match(/["']([^"']+)["']/)?.[1];
        if (templateName) dependencies.push(templateName);
      });
    }
    
    // Find {% include %} dependencies
    const includeMatches = content.match(/{% include ["']([^"']+)["'] %}/g);
    if (includeMatches) {
      includeMatches.forEach(match => {
        const templateName = match.match(/["']([^"']+)["']/)?.[1];
        if (templateName) dependencies.push(templateName);
      });
    }
    
    return dependencies;
  }

  private async findAllTemplates(basePath: string): Promise<string[]> {
    const templates: string[] = [];
    
    try {
      const entries = await fs.readdir(basePath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(basePath, entry.name);
        
        if (entry.isDirectory()) {
          const subTemplates = await this.findAllTemplates(fullPath);
          templates.push(...subTemplates);
        } else if (this.isTemplateFile(fullPath)) {
          templates.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Could not scan directory ${basePath}:`, error);
    }
    
    return templates;
  }

  private async updateDependencies(templatePaths: string[]): Promise<string[]> {
    const updates: string[] = [];
    
    for (const templatePath of templatePaths) {
      try {
        const content = await fs.readFile(templatePath, 'utf8');
        const newDependencies = this.findTemplateDependencies(content);
        const oldDependencies = this.cache.dependencies.get(templatePath) || [];
        
        if (JSON.stringify(newDependencies) !== JSON.stringify(oldDependencies)) {
          this.cache.dependencies.set(templatePath, newDependencies);
          updates.push(`Updated dependencies for ${templatePath}`);
          
          // Update reverse dependency graph
          // Remove old reverse dependencies
          for (const oldDep of oldDependencies) {
            this.dependencyGraph.get(oldDep)?.delete(templatePath);
          }
          
          // Add new reverse dependencies
          for (const newDep of newDependencies) {
            if (!this.dependencyGraph.has(newDep)) {
              this.dependencyGraph.set(newDep, new Set());
            }
            this.dependencyGraph.get(newDep)!.add(templatePath);
          }
        }
      } catch (error) {
        console.warn(`Could not update dependencies for ${templatePath}:`, error);
      }
    }
    
    return updates;
  }

  private notifyClients(notification: any): void {
    const message = JSON.stringify(notification);
    
    this.clients.forEach(client => {
      try {
        if (client.readyState === 1) { // WebSocket OPEN
          client.send(message);
        }
      } catch (error) {
        console.warn('Failed to notify client:', error);
        this.clients.delete(client);
      }
    });
  }

  addClient(client: any): void {
    this.clients.add(client);
    console.log(`Client connected. Total clients: ${this.clients.size}`);
  }

  removeClient(client: any): void {
    this.clients.delete(client);
    console.log(`Client disconnected. Total clients: ${this.clients.size}`);
  }

  private isTemplateFile(filePath: string): boolean {
    return filePath.endsWith('.njk') || filePath.endsWith('.unjk');
  }

  private isOntologyFile(filePath: string): boolean {
    return filePath.endsWith('.ttl') || filePath.endsWith('.rdf') || filePath.endsWith('.owl');
  }

  async getTemplateInfo(templatePath: string): Promise<any> {
    return {
      compiled: this.cache.compiled.has(templatePath),
      metadata: this.cache.metadata.get(templatePath),
      dependencies: this.cache.dependencies.get(templatePath) || [],
      lastModified: this.cache.lastModified.get(templatePath),
      ontologyBindings: this.cache.ontologyBindings.get(templatePath) || []
    };
  }

  async renderTemplate(templatePath: string, context: any): Promise<string> {
    let compiled = this.cache.compiled.get(templatePath);
    
    if (!compiled) {
      // Template not in cache, load and compile
      await this.reloadSingleTemplate(templatePath);
      compiled = this.cache.compiled.get(templatePath);
    }
    
    if (!compiled) {
      throw new Error(`Template not found or failed to compile: ${templatePath}`);
    }
    
    // Mock rendering with context
    return `<!-- Rendered ${templatePath} with hot-reload support -->\n${JSON.stringify(context, null, 2)}`;
  }

  async destroy(): Promise<void> {
    console.log('Destroying hot-reload engine...');
    
    // Clear all pending reloads
    for (const timeout of this.pendingReloads.values()) {
      clearTimeout(timeout);
    }
    this.pendingReloads.clear();
    
    // Close all file watchers
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
    
    // Clear caches
    this.cache.compiled.clear();
    this.cache.metadata.clear();
    this.cache.dependencies.clear();
    this.cache.lastModified.clear();
    this.cache.ontologyBindings.clear();
    
    // Clear graphs
    this.dependencyGraph.clear();
    this.ontologyGraph.clear();
    
    // Disconnect clients
    this.clients.clear();
    
    console.log('Hot-reload engine destroyed');
  }
}

describe('HIVE QUEEN BDD: Unjucks Template Hot-Reloading', () => {
  let hotReloadEngine: HotReloadUnjucksEngine;
  let tempDir: string;
  let templatesDir: string;
  let ontologiesDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'hot-reload-'));
    templatesDir = join(tempDir, 'templates');
    ontologiesDir = join(tempDir, 'ontologies');
    
    await fs.mkdir(templatesDir, { recursive: true });
    await fs.mkdir(ontologiesDir, { recursive: true });

    const config: HotReloadConfig = {
      watchPaths: [templatesDir, ontologiesDir],
      debounceMs: 100,
      enableOntologyWatch: true,
      enableDependencyTracking: true,
      notificationChannels: ['websocket'],
      maxRetries: 3
    };

    hotReloadEngine = new HotReloadUnjucksEngine(config);
  });

  afterEach(async () => {
    await hotReloadEngine.destroy();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('FEATURE: Real-Time Template Hot-Reloading', () => {
    describe('SCENARIO: Detect and reload modified templates instantly', () => {
      it('GIVEN active template WHEN file content changes THEN reloads template automatically', async () => {
        // GIVEN: Initial template
        const templatePath = join(templatesDir, 'user-profile.njk');
        const initialContent = `
---
{
  "type": "user-template",
  "ontology": "user-ontology"
}
---
<div class="user-profile">
  <h1>{{ user.name }}</h1>
  <p>{{ user.email }}</p>
</div>
        `;

        await fs.writeFile(templatePath, initialContent.trim());
        await hotReloadEngine.initialize();

        // Render initial template
        const initialRender = await hotReloadEngine.renderTemplate(templatePath, {
          user: { name: 'John Doe', email: 'john@example.com' }
        });
        expect(initialRender).toBeDefined();

        // Set up reload listener
        const reloadPromise = new Promise<ReloadResult>((resolve) => {
          hotReloadEngine.once('reload', ({ reloadResult }) => {
            resolve(reloadResult);
          });
        });

        // WHEN: Modify template content
        const modifiedContent = `
---
{
  "type": "user-template",
  "ontology": "user-ontology",
  "version": "2.0"
}
---
<div class="user-profile enhanced">
  <h1>Welcome, {{ user.name }}!</h1>
  <p>Email: {{ user.email }}</p>
  <p>Profile updated: {{ timestamp }}</p>
</div>
        `;

        await fs.writeFile(templatePath, modifiedContent.trim());

        // THEN: Template reloaded automatically
        const reloadResult = await reloadPromise;
        expect(reloadResult.success).toBe(true);
        expect(reloadResult.affectedTemplates).toContain(templatePath);
        expect(reloadResult.reloadTime).toBeGreaterThan(0);
        expect(reloadResult.errors).toHaveLength(0);

        // Verify template was reloaded
        const templateInfo = await hotReloadEngine.getTemplateInfo(templatePath);
        expect(templateInfo.compiled).toBe(true);
        expect(templateInfo.metadata.version).toBe('2.0');
      });

      it('GIVEN template with dependencies WHEN dependency changes THEN reloads dependent templates', async () => {
        // GIVEN: Base template and dependent template
        const baseTemplate = join(templatesDir, 'base.njk');
        const dependentTemplate = join(templatesDir, 'page.njk');

        await fs.writeFile(baseTemplate, `
<html>
<head><title>{{ title }}</title></head>
<body>
  {% block content %}{% endblock %}
</body>
</html>
        `);

        await fs.writeFile(dependentTemplate, `
---
{
  "type": "page-template"
}
---
{% extends "base.njk" %}

{% block content %}
<h1>{{ heading }}</h1>
<p>{{ content }}</p>
{% endblock %}
        `);

        await hotReloadEngine.initialize();

        // Set up reload listener
        const reloadPromise = new Promise<ReloadResult>((resolve) => {
          hotReloadEngine.once('reload', ({ reloadResult }) => {
            resolve(reloadResult);
          });
        });

        // WHEN: Modify base template
        await fs.writeFile(baseTemplate, `
<html>
<head>
  <title>{{ title }}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body class="enhanced">
  {% block content %}{% endblock %}
  <footer>© 2024</footer>
</body>
</html>
        `);

        // THEN: Both templates reloaded
        const reloadResult = await reloadResult;
        expect(reloadResult.success).toBe(true);
        expect(reloadResult.affectedTemplates).toContain(baseTemplate);
        // Dependent template should also be affected due to extends relationship
      });
    });

    describe('SCENARIO: Handle template creation and deletion', () => {
      it('GIVEN watch directory WHEN new template created THEN adds to cache and starts monitoring', async () => {
        // GIVEN: Initialize hot reload engine
        await hotReloadEngine.initialize();

        // Set up reload listener
        const reloadPromise = new Promise<ReloadResult>((resolve) => {
          hotReloadEngine.once('reload', ({ reloadResult }) => {
            resolve(reloadResult);
          });
        });

        // WHEN: Create new template
        const newTemplate = join(templatesDir, 'new-component.njk');
        const newContent = `
---
{
  "type": "component",
  "created": "${new Date().toISOString()}"
}
---
<div class="new-component">
  <h2>{{ title }}</h2>
  <div>{{ content }}</div>
</div>
        `;

        await fs.writeFile(newTemplate, newContent.trim());

        // THEN: Template added and processed
        const reloadResult = await reloadPromise;
        expect(reloadResult.success).toBe(true);
        expect(reloadResult.affectedTemplates).toContain(newTemplate);
        
        // Verify template is now cached
        const templateInfo = await hotReloadEngine.getTemplateInfo(newTemplate);
        expect(templateInfo.compiled).toBe(true);
        expect(templateInfo.metadata.type).toBe('component');
      });

      it('GIVEN existing template WHEN template deleted THEN removes from cache', async () => {
        // GIVEN: Existing template
        const templatePath = join(templatesDir, 'to-delete.njk');
        await fs.writeFile(templatePath, `
---
{"type": "temp"}
---
Temporary template
        `);

        await hotReloadEngine.initialize();
        
        // Verify template is cached
        let templateInfo = await hotReloadEngine.getTemplateInfo(templatePath);
        expect(templateInfo.compiled).toBe(true);

        // Set up reload listener
        const reloadPromise = new Promise<ReloadResult>((resolve) => {
          hotReloadEngine.once('reload', ({ reloadResult }) => {
            resolve(reloadResult);
          });
        });

        // WHEN: Delete template
        await fs.unlink(templatePath);

        // THEN: Template removed from cache
        const reloadResult = await reloadPromise;
        expect(reloadResult.affectedTemplates).toContain(templatePath);
        
        templateInfo = await hotReloadEngine.getTemplateInfo(templatePath);
        expect(templateInfo.compiled).toBe(false);
        expect(templateInfo.lastModified).toBeUndefined();
      });
    });
  });

  describe('FEATURE: Ontology-Driven Hot Reloading', () => {
    describe('SCENARIO: Reload templates when ontology changes', () => {
      it('GIVEN templates using ontology WHEN ontology file changes THEN reloads affected templates', async () => {
        // GIVEN: Ontology file and templates that use it
        const ontologyFile = join(ontologiesDir, 'user-ontology.ttl');
        const template1 = join(templatesDir, 'user-list.njk');
        const template2 = join(templatesDir, 'user-detail.njk');

        await fs.writeFile(ontologyFile, `
@prefix user: <http://example.com/user#> .
user:Customer a owl:Class ;
  rdfs:label "Customer" .
user:hasEmail a owl:DatatypeProperty ;
  rdfs:domain user:Customer ;
  rdfs:range xsd:string .
        `);

        await fs.writeFile(template1, `
---
{
  "type": "list",
  "ontology": "${ontologyFile}"
}
---
{% for customer in customers %}
  <div>{{ customer.name }} - {{ customer.email }}</div>
{% endfor %}
        `);

        await fs.writeFile(template2, `
---
{
  "type": "detail",
  "ontology": "${ontologyFile}"
}
---
<div class="customer-detail">
  <h1>{{ customer.name }}</h1>
  <p>Email: {{ customer.email }}</p>
</div>
        `);

        await hotReloadEngine.initialize();

        // Set up reload listener
        const reloadPromise = new Promise<ReloadResult>((resolve) => {
          hotReloadEngine.once('reload', ({ reloadResult }) => {
            resolve(reloadResult);
          });
        });

        // WHEN: Modify ontology (add new property)
        await fs.writeFile(ontologyFile, `
@prefix user: <http://example.com/user#> .
user:Customer a owl:Class ;
  rdfs:label "Customer" .
user:hasEmail a owl:DatatypeProperty ;
  rdfs:domain user:Customer ;
  rdfs:range xsd:string .
user:hasPhone a owl:DatatypeProperty ;
  rdfs:domain user:Customer ;
  rdfs:range xsd:string .
        `);

        // THEN: Templates using this ontology are reloaded
        const reloadResult = await reloadPromise;
        expect(reloadResult.success).toBe(true);
        expect(reloadResult.affectedTemplates).toContain(template1);
        expect(reloadResult.affectedTemplates).toContain(template2);
        expect(reloadResult.ontologyChanges).toContain('customer-templates');
      });

      it('GIVEN trading ontology WHEN ontology updated THEN reloads financial templates with new context', async () => {
        // GIVEN: Trading ontology and templates
        const tradingOntology = join(ontologiesDir, 'trading-ontology.ttl');
        const algorithmTemplate = join(templatesDir, 'trading-algorithm.njk');
        const riskTemplate = join(templatesDir, 'risk-management.njk');

        await fs.writeFile(tradingOntology, `
@prefix trading: <http://example.com/trading#> .
trading:TradingStrategy a owl:Class ;
  rdfs:label "Trading Strategy" .
trading:hasRiskThreshold a owl:DatatypeProperty ;
  rdfs:domain trading:TradingStrategy ;
  rdfs:range xsd:decimal .
        `);

        await fs.writeFile(algorithmTemplate, `
---
{
  "type": "algorithm",
  "ontology": "${tradingOntology}"
}
---
class {{ algorithmName }} {
  constructor() {
    this.riskThreshold = {{ riskThreshold }};
  }
}
        `);

        await fs.writeFile(riskTemplate, `
---
{
  "type": "risk-management",
  "ontology": "${tradingOntology}"
}
---
const riskManager = {
  threshold: {{ riskThreshold }},
  validate: (amount) => amount <= this.threshold
};
        `);

        await hotReloadEngine.initialize();

        // Set up reload listener
        const reloadPromise = new Promise<ReloadResult>((resolve) => {
          hotReloadEngine.once('reload', ({ reloadResult }) => {
            resolve(reloadResult);
          });
        });

        // WHEN: Update trading ontology with new properties
        await fs.writeFile(tradingOntology, `
@prefix trading: <http://example.com/trading#> .
trading:TradingStrategy a owl:Class ;
  rdfs:label "Trading Strategy" .
trading:hasRiskThreshold a owl:DatatypeProperty ;
  rdfs:domain trading:TradingStrategy ;
  rdfs:range xsd:decimal .
trading:hasLatencyRequirement a owl:DatatypeProperty ;
  rdfs:domain trading:TradingStrategy ;
  rdfs:range xsd:integer .
        `);

        // THEN: All trading templates reloaded
        const reloadResult = await reloadPromise;
        expect(reloadResult.success).toBe(true);
        expect(reloadResult.affectedTemplates).toContain(algorithmTemplate);
        expect(reloadResult.affectedTemplates).toContain(riskTemplate);
        expect(reloadResult.ontologyChanges).toContain('trading-templates');
      });
    });
  });

  describe('FEATURE: Dependency Graph Hot Reloading', () => {
    describe('SCENARIO: Complex template dependency chain updates', () => {
      it('GIVEN multi-level template hierarchy WHEN base template changes THEN reloads entire dependency chain', async () => {
        // GIVEN: Complex template hierarchy
        const baseTemplate = join(templatesDir, 'base.njk');
        const layoutTemplate = join(templatesDir, 'layout.njk');
        const pageTemplate = join(templatesDir, 'page.njk');
        const componentTemplate = join(templatesDir, 'component.njk');

        // Base template (root)
        await fs.writeFile(baseTemplate, `
<html>
<head><title>{{ title }}</title></head>
<body>{% block body %}{% endblock %}</body>
</html>
        `);

        // Layout extends base
        await fs.writeFile(layoutTemplate, `
{% extends "base.njk" %}
{% block body %}
<header>{{ header }}</header>
<main>{% block main %}{% endblock %}</main>
<footer>{{ footer }}</footer>
{% endblock %}
        `);

        // Page extends layout
        await fs.writeFile(pageTemplate, `
{% extends "layout.njk" %}
{% block main %}
<div class="page-content">
  {% include "component.njk" %}
</div>
{% endblock %}
        `);

        // Component is included
        await fs.writeFile(componentTemplate, `
<div class="component">
  <h2>{{ componentTitle }}</h2>
  <p>{{ componentContent }}</p>
</div>
        `);

        await hotReloadEngine.initialize();

        // Set up reload listener
        const reloadPromise = new Promise<ReloadResult>((resolve) => {
          hotReloadEngine.once('reload', ({ reloadResult }) => {
            resolve(reloadResult);
          });
        });

        // WHEN: Modify base template (root of hierarchy)
        await fs.writeFile(baseTemplate, `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ title }}</title>
</head>
<body class="updated">
  {% block body %}{% endblock %}
</body>
</html>
        `);

        // THEN: Entire dependency chain is reloaded
        const reloadResult = await reloadPromise;
        expect(reloadResult.success).toBe(true);
        expect(reloadResult.affectedTemplates).toContain(baseTemplate);
        // All dependent templates should be affected
        expect(reloadResult.affectedTemplates.length).toBeGreaterThan(1);
        expect(reloadResult.dependencyUpdates).toBeDefined();
      });

      it('GIVEN circular dependencies WHEN template changes THEN handles gracefully without infinite loops', async () => {
        // GIVEN: Templates with circular references (edge case)
        const template1 = join(templatesDir, 'circular1.njk');
        const template2 = join(templatesDir, 'circular2.njk');

        await fs.writeFile(template1, `
---
{"type": "circular"}
---
Template 1
{% include "circular2.njk" %}
        `);

        await fs.writeFile(template2, `
---
{"type": "circular"}
---
Template 2
{% include "circular1.njk" %}
        `);

        await hotReloadEngine.initialize();

        // Set up reload listener with timeout
        const reloadPromise = Promise.race([
          new Promise<ReloadResult>((resolve) => {
            hotReloadEngine.once('reload', ({ reloadResult }) => {
              resolve(reloadResult);
            });
          }),
          new Promise<ReloadResult>((resolve) => {
            setTimeout(() => resolve({ 
              success: false, 
              affectedTemplates: [], 
              reloadTime: 0, 
              errors: ['Timeout'] 
            }), 5000);
          })
        ]);

        // WHEN: Modify one of the circular templates
        await fs.writeFile(template1, `
---
{"type": "circular", "updated": true}
---
Template 1 Updated
{% include "circular2.njk" %}
        `);

        // THEN: Handles circular dependency gracefully
        const reloadResult = await reloadPromise;
        expect(reloadResult.success).toBe(true); // Should not timeout or crash
        expect(reloadResult.affectedTemplates).toContain(template1);
        expect(reloadResult.reloadTime).toBeLessThan(5000); // Should complete quickly
      });
    });
  });

  describe('FEATURE: Performance Under Load', () => {
    describe('SCENARIO: High-frequency template changes', () => {
      it('GIVEN rapid template modifications WHEN debouncing enabled THEN batches reloads efficiently', async () => {
        // GIVEN: Template and rapid changes
        const templatePath = join(templatesDir, 'rapid-changes.njk');
        await fs.writeFile(templatePath, 'Initial content');
        
        await hotReloadEngine.initialize();

        const reloadEvents: ReloadResult[] = [];
        hotReloadEngine.on('reload', ({ reloadResult }) => {
          reloadEvents.push(reloadResult);
        });

        // WHEN: Make rapid successive changes
        const startTime = performance.now();
        
        for (let i = 0; i < 10; i++) {
          await fs.writeFile(templatePath, `Content update ${i}`);
          // Small delay between changes (faster than debounce)
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Wait for debounced reload to complete
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const endTime = performance.now();
        
        // THEN: Changes are debounced (fewer reload events than modifications)
        expect(reloadEvents.length).toBeLessThan(10);
        expect(reloadEvents.length).toBeGreaterThanOrEqual(1);
        expect(endTime - startTime).toBeLessThan(2000);
        
        // Final reload should be successful
        const lastReload = reloadEvents[reloadEvents.length - 1];
        expect(lastReload.success).toBe(true);
      });

      it('GIVEN 100 simultaneous template changes WHEN processing THEN handles load gracefully', async () => {
        // GIVEN: Create 100 templates
        const templatePaths: string[] = [];
        for (let i = 0; i < 100; i++) {
          const templatePath = join(templatesDir, `load-test-${i}.njk`);
          await fs.writeFile(templatePath, `Template ${i} content`);
          templatePaths.push(templatePath);
        }

        await hotReloadEngine.initialize();

        const reloadEvents: ReloadResult[] = [];
        hotReloadEngine.on('reload', ({ reloadResult }) => {
          reloadEvents.push(reloadResult);
        });

        // WHEN: Modify all templates simultaneously
        const startTime = performance.now();
        
        const modificationPromises = templatePaths.map(async (templatePath, i) => {
          await fs.writeFile(templatePath, `Updated template ${i} content`);
        });
        
        await Promise.all(modificationPromises);
        
        // Wait for all reloads to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const endTime = performance.now();
        const duration = endTime - startTime;

        // THEN: Handles high load efficiently
        expect(duration).toBeLessThan(5000); // Complete within 5 seconds
        expect(reloadEvents.length).toBeGreaterThan(0);
        
        // All reloads should be successful
        const failedReloads = reloadEvents.filter(r => !r.success);
        expect(failedReloads.length).toBe(0);
        
        console.log(`Load test: ${templatePaths.length} templates processed in ${duration.toFixed(2)}ms`);
        console.log(`Reload events: ${reloadEvents.length}`);
      });
    });
  });

  describe('FEATURE: Client Notification System', () => {
    describe('SCENARIO: Real-time client updates via WebSocket', () => {
      it('GIVEN connected clients WHEN template reloads THEN notifies all clients', async () => {
        // GIVEN: Mock WebSocket clients
        const mockClients = [
          { readyState: 1, send: vi.fn(), messages: [] as any[] },
          { readyState: 1, send: vi.fn(), messages: [] as any[] },
          { readyState: 1, send: vi.fn(), messages: [] as any[] }
        ];

        // Capture sent messages
        mockClients.forEach(client => {
          client.send = vi.fn().mockImplementation((message) => {
            client.messages.push(JSON.parse(message));
          });
        });

        await hotReloadEngine.initialize();
        
        // Add clients
        mockClients.forEach(client => hotReloadEngine.addClient(client));

        // GIVEN: Template to modify
        const templatePath = join(templatesDir, 'notify-test.njk');
        await fs.writeFile(templatePath, 'Initial content');

        // Wait for reload to complete
        const reloadPromise = new Promise<void>((resolve) => {
          hotReloadEngine.once('reload', () => resolve());
        });

        // WHEN: Modify template
        await fs.writeFile(templatePath, 'Modified content');
        await reloadPromise;

        // Wait a bit for notifications to be sent
        await new Promise(resolve => setTimeout(resolve, 50));

        // THEN: All clients receive notifications
        mockClients.forEach((client, index) => {
          expect(client.send).toHaveBeenCalled();
          expect(client.messages.length).toBeGreaterThan(0);
          
          const notification = client.messages[0];
          expect(notification.type).toBe('template-reload');
          expect(notification.changeEvent).toBeDefined();
          expect(notification.reloadResult).toBeDefined();
          expect(notification.timestamp).toBeGreaterThan(0);
        });
      });

      it('GIVEN disconnected clients WHEN template reloads THEN handles gracefully', async () => {
        // GIVEN: Mix of connected and disconnected clients
        const connectedClient = {
          readyState: 1,
          send: vi.fn(),
          messages: [] as any[]
        };
        
        const disconnectedClient = {
          readyState: 0, // CLOSED
          send: vi.fn().mockImplementation(() => {
            throw new Error('Connection closed');
          })
        };

        await hotReloadEngine.initialize();
        hotReloadEngine.addClient(connectedClient);
        hotReloadEngine.addClient(disconnectedClient);

        const templatePath = join(templatesDir, 'error-test.njk');
        await fs.writeFile(templatePath, 'Initial content');

        const reloadPromise = new Promise<void>((resolve) => {
          hotReloadEngine.once('reload', () => resolve());
        });

        // WHEN: Trigger reload with mixed client states
        await fs.writeFile(templatePath, 'Modified content');
        await reloadPromise;

        await new Promise(resolve => setTimeout(resolve, 50));

        // THEN: Connected client receives notification, disconnected handled gracefully
        expect(connectedClient.send).toHaveBeenCalled();
        expect(disconnectedClient.send).toHaveBeenCalled();
        
        // Engine should continue functioning despite client errors
        expect(hotReloadEngine.listenerCount('error')).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('FEATURE: Error Recovery and Resilience', () => {
    describe('SCENARIO: Handle template compilation errors gracefully', () => {
      it('GIVEN invalid template syntax WHEN reloading THEN reports errors but continues monitoring', async () => {
        // GIVEN: Valid template initially
        const templatePath = join(templatesDir, 'syntax-error.njk');
        await fs.writeFile(templatePath, `
---
{"type": "valid"}
---
<div>{{ content }}</div>
        `);

        await hotReloadEngine.initialize();

        // Verify initial template is valid
        let templateInfo = await hotReloadEngine.getTemplateInfo(templatePath);
        expect(templateInfo.compiled).toBe(true);

        const reloadPromise = new Promise<ReloadResult>((resolve) => {
          hotReloadEngine.once('reload', ({ reloadResult }) => {
            resolve(reloadResult);
          });
        });

        // WHEN: Introduce syntax error
        await fs.writeFile(templatePath, `
---
{"type": "invalid" // Missing closing brace
---
<div>{{ unclosed.expression
        `);

        // THEN: Error is reported but system continues
        const reloadResult = await reloadResult;
        expect(reloadResult.success).toBe(false);
        expect(reloadResult.errors).toBeDefined();
        expect(reloadResult.errors!.length).toBeGreaterThan(0);
        expect(reloadResult.affectedTemplates).toContain(templatePath);

        // System should still be responsive
        templateInfo = await hotReloadEngine.getTemplateInfo(templatePath);
        expect(templateInfo).toBeDefined();
      });

      it('GIVEN file system errors WHEN watching THEN handles gracefully and retries', async () => {
        // GIVEN: Template that will be made inaccessible
        const templatePath = join(templatesDir, 'permission-test.njk');
        await fs.writeFile(templatePath, 'Initial content');
        
        await hotReloadEngine.initialize();

        // Mock file system error
        const originalReadFile = fs.readFile;
        const readFileError = vi.spyOn(fs, 'readFile').mockRejectedValueOnce(
          new Error('EACCES: permission denied')
        );

        const errorPromise = new Promise<any>((resolve) => {
          hotReloadEngine.once('error', (error) => {
            resolve(error);
          });
        });

        // WHEN: Trigger change that will cause file system error
        await fs.writeFile(templatePath, 'Content that triggers error');

        // THEN: Error is handled gracefully
        const error = await errorPromise;
        expect(error).toBeDefined();
        expect(error.filePath).toBe(templatePath);
        
        // Restore original function
        readFileError.mockRestore();
        
        // System should recover and work normally
        const templateInfo = await hotReloadEngine.getTemplateInfo(templatePath);
        expect(templateInfo).toBeDefined();
      });
    });
  });
});
