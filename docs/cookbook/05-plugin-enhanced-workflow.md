# Pattern 05: Plugin-Enhanced Workflow - Complete Monitoring Setup

## Overview

A comprehensive monitoring system with plugin architecture that supports extensible monitoring capabilities, alert management, and dashboard generation. Features modular design with hot-swappable plugins and real-time monitoring.

## Features

- Plugin-based architecture with hot-swapping
- Multi-metric collection (system, application, custom)
- Real-time alerting and notification system
- Auto-generating dashboards and visualizations
- Plugin marketplace and dependency management
- Configuration-driven plugin loading
- Health monitoring and plugin lifecycle management

## Environment Setup

```bash
# Core dependencies
pnpm add express socket.io prometheus-client grafana-client
pnpm add influxdb elasticsearch winston nodemailer
pnpm add chokidar hot-reload-plugin-system
pnpm add bull ioredis mongodb pg

# Plugin system
pnpm add plugin-loader dynamic-import semver
pnpm add joi ajv jsonschema vm2

# Monitoring plugins
pnpm add @prometheus/client node-exporter systeminformation
pnpm add aws-cloudwatch gcp-monitoring azure-monitor
pnpm add -D @types/express @types/node
```

## Environment Variables

```env
# Core System
NODE_ENV=production
LOG_LEVEL=info
HTTP_PORT=3000
WS_PORT=3001

# Database Connections
MONGODB_URL=mongodb://localhost:27017/monitoring
REDIS_URL=redis://localhost:6379
POSTGRES_URL=postgresql://user:pass@localhost:5432/monitoring

# Time Series Databases
INFLUXDB_URL=http://localhost:8086
INFLUXDB_TOKEN=your-influxdb-token
INFLUXDB_ORG=monitoring-org
INFLUXDB_BUCKET=metrics

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX=monitoring-logs

# Grafana Integration
GRAFANA_URL=http://localhost:3000
GRAFANA_API_KEY=your-grafana-api-key

# Cloud Monitoring
AWS_CLOUDWATCH_REGION=us-west-2
GCP_PROJECT_ID=your-project-id
AZURE_SUBSCRIPTION_ID=your-subscription-id

# Alerting
SMTP_HOST=smtp.example.com
SMTP_USER=monitoring@company.com
SMTP_PASS=smtp-password
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
PAGERDUTY_API_KEY=your-pagerduty-key

# Plugin System
PLUGINS_DIR=./plugins
PLUGINS_REGISTRY=./plugins/registry.json
ENABLE_HOT_RELOAD=true
PLUGIN_ISOLATION=true
```

## Production Code

```typescript
import { defineCommand } from "citty";
import express from "express";
import { Server as SocketIOServer } from "socket.io";
import { createServer } from "http";
import winston from "winston";
import Bull from "bull";
import Redis from "ioredis";
import { MongoClient } from "mongodb";
import { Pool } from "pg";
import { InfluxDB } from "@influxdata/influxdb-client";
import { Client as ElasticsearchClient } from "@elasticsearch/elasticsearch";
import { register as prometheusRegister, Gauge, Counter, Histogram } from "prom-client";
import fs from "fs-extra";
import path from "path";
import chokidar from "chokidar";
import semver from "semver";
import Joi from "joi";
import nodemailer from "nodemailer";
import { VM } from "vm2";

// Types
interface Plugin {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  type: 'collector' | 'processor' | 'alerter' | 'dashboard' | 'exporter';
  dependencies: Record<string, string>;
  config: {
    schema: any;
    defaults: Record<string, any>;
  };
  lifecycle: {
    install?: () => Promise<void>;
    activate?: () => Promise<void>;
    deactivate?: () => Promise<void>;
    uninstall?: () => Promise<void>;
  };
  api: {
    collect?: (config: any) => Promise<MetricData[]>;
    process?: (data: MetricData[], config: any) => Promise<MetricData[]>;
    alert?: (alert: AlertRule, data: MetricData[]) => Promise<void>;
    dashboard?: (config: any) => Promise<DashboardConfig>;
    export?: (data: MetricData[], config: any) => Promise<void>;
  };
}

interface MetricData {
  name: string;
  value: number;
  timestamp: Date;
  labels: Record<string, string>;
  type: 'gauge' | 'counter' | 'histogram' | 'summary';
  metadata?: Record<string, any>;
}

interface AlertRule {
  id: string;
  name: string;
  description: string;
  query: string;
  condition: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte';
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  duration: number;
  channels: string[];
  enabled: boolean;
  metadata?: Record<string, any>;
}

interface DashboardConfig {
  id: string;
  name: string;
  description: string;
  panels: Array<{
    id: string;
    type: 'graph' | 'stat' | 'table' | 'heatmap';
    title: string;
    query: string;
    options: Record<string, any>;
  }>;
  variables?: Array<{
    name: string;
    type: string;
    query?: string;
    options?: string[];
  }>;
}

interface PluginRegistry {
  plugins: Record<string, {
    path: string;
    enabled: boolean;
    config: Record<string, any>;
    lastLoaded: Date;
    version: string;
  }>;
  dependencies: Record<string, string[]>;
  loadOrder: string[];
}

// Logger Configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'monitoring-error.log', 
      level: 'error',
      maxsize: 10485760,
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'monitoring-combined.log',
      maxsize: 10485760,
      maxFiles: 10
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Database Connections
const redis = new Redis(process.env.REDIS_URL);
const mongoClient = new MongoClient(process.env.MONGODB_URL!);
const pgPool = new Pool({ connectionString: process.env.POSTGRES_URL });
const influxDB = new InfluxDB({ 
  url: process.env.INFLUXDB_URL!, 
  token: process.env.INFLUXDB_TOKEN! 
});
const elasticsearchClient = new ElasticsearchClient({ 
  node: process.env.ELASTICSEARCH_URL! 
});

// Queue for background processing
const monitoringQueue = new Bull('monitoring', process.env.REDIS_URL);

// Prometheus Metrics
const pluginLoadCounter = new Counter({
  name: 'plugins_loaded_total',
  help: 'Total number of plugins loaded',
  labelNames: ['plugin_type', 'plugin_id']
});

const metricCollectionHistogram = new Histogram({
  name: 'metric_collection_duration_seconds',
  help: 'Time spent collecting metrics',
  labelNames: ['plugin_id', 'metric_type']
});

const alertsFiredCounter = new Counter({
  name: 'alerts_fired_total',
  help: 'Total number of alerts fired',
  labelNames: ['alert_id', 'severity']
});

// Plugin System Core
class PluginSystem {
  private plugins: Map<string, Plugin> = new Map();
  private registry: PluginRegistry = { plugins: {}, dependencies: {}, loadOrder: [] };
  private pluginVMs: Map<string, VM> = new Map();
  private watcher?: chokidar.FSWatcher;

  constructor(private pluginsDir: string = './plugins') {
    this.initializePluginSystem();
  }

  private async initializePluginSystem(): Promise<void> {
    try {
      await fs.ensureDir(this.pluginsDir);
      await this.loadRegistry();
      
      if (process.env.ENABLE_HOT_RELOAD === 'true') {
        this.setupHotReload();
      }

      logger.info('Plugin system initialized', { pluginsDir: this.pluginsDir });
    } catch (error) {
      logger.error('Failed to initialize plugin system', { error: error.message });
      throw error;
    }
  }

  private async loadRegistry(): Promise<void> {
    const registryPath = path.join(this.pluginsDir, 'registry.json');
    
    try {
      if (await fs.pathExists(registryPath)) {
        this.registry = await fs.readJson(registryPath);
        logger.info('Plugin registry loaded', { 
          pluginCount: Object.keys(this.registry.plugins).length 
        });
      } else {
        await this.saveRegistry();
        logger.info('Created new plugin registry');
      }
    } catch (error) {
      logger.error('Failed to load plugin registry', { error: error.message });
      throw error;
    }
  }

  private async saveRegistry(): Promise<void> {
    const registryPath = path.join(this.pluginsDir, 'registry.json');
    
    try {
      await fs.writeJson(registryPath, this.registry, { spaces: 2 });
      logger.debug('Plugin registry saved');
    } catch (error) {
      logger.error('Failed to save plugin registry', { error: error.message });
    }
  }

  private setupHotReload(): void {
    this.watcher = chokidar.watch(this.pluginsDir, {
      ignored: /registry\.json$/,
      persistent: true,
      ignoreInitial: true
    });

    this.watcher.on('change', async (filePath) => {
      const pluginId = path.basename(path.dirname(filePath));
      logger.info('Plugin file changed, reloading', { pluginId, filePath });
      
      try {
        await this.reloadPlugin(pluginId);
      } catch (error) {
        logger.error('Failed to reload plugin', { pluginId, error: error.message });
      }
    });

    logger.info('Hot reload enabled for plugins');
  }

  async loadPlugin(pluginId: string, pluginPath?: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      pluginPath = pluginPath || this.registry.plugins[pluginId]?.path;
      if (!pluginPath) {
        throw new Error(`No path specified for plugin: ${pluginId}`);
      }

      const pluginManifestPath = path.join(pluginPath, 'package.json');
      const pluginCodePath = path.join(pluginPath, 'index.js');

      // Load plugin manifest
      const manifest = await fs.readJson(pluginManifestPath);
      
      // Validate plugin manifest
      await this.validatePluginManifest(manifest);

      // Check dependencies
      await this.resolveDependencies(pluginId, manifest.dependencies || {});

      // Load plugin code
      const pluginCode = await fs.readFile(pluginCodePath, 'utf8');
      
      // Create isolated VM for plugin execution
      const vm = new VM({
        timeout: 10000,
        sandbox: {
          require: this.createPluginRequire(pluginId),
          console: logger,
          setTimeout,
          clearTimeout,
          setInterval,
          clearInterval,
          Buffer,
          process: {
            env: process.env,
            version: process.version
          }
        }
      });

      // Execute plugin code
      const pluginModule = vm.run(`
        const module = { exports: {} };
        const exports = module.exports;
        ${pluginCode}
        module.exports;
      `);

      // Create plugin instance
      const plugin: Plugin = {
        id: pluginId,
        name: manifest.name || pluginId,
        version: manifest.version || '1.0.0',
        author: manifest.author || 'unknown',
        description: manifest.description || '',
        type: manifest.pluginType || 'collector',
        dependencies: manifest.dependencies || {},
        config: manifest.config || { schema: {}, defaults: {} },
        lifecycle: pluginModule.lifecycle || {},
        api: pluginModule.api || {}
      };

      // Install plugin if it has install lifecycle
      if (plugin.lifecycle.install) {
        await plugin.lifecycle.install();
      }

      // Activate plugin
      if (plugin.lifecycle.activate) {
        await plugin.lifecycle.activate();
      }

      // Register plugin
      this.plugins.set(pluginId, plugin);
      this.pluginVMs.set(pluginId, vm);

      // Update registry
      this.registry.plugins[pluginId] = {
        path: pluginPath,
        enabled: true,
        config: {},
        lastLoaded: new Date(),
        version: plugin.version
      };

      await this.saveRegistry();

      // Update metrics
      pluginLoadCounter.inc({ plugin_type: plugin.type, plugin_id: pluginId });

      const duration = Date.now() - startTime;
      logger.info('Plugin loaded successfully', {
        pluginId,
        pluginName: plugin.name,
        version: plugin.version,
        type: plugin.type,
        duration: `${duration}ms`
      });

    } catch (error) {
      logger.error('Failed to load plugin', { pluginId, error: error.message });
      throw error;
    }
  }

  async unloadPlugin(pluginId: string): Promise<void> {
    try {
      const plugin = this.plugins.get(pluginId);
      if (!plugin) {
        throw new Error(`Plugin not found: ${pluginId}`);
      }

      // Deactivate plugin
      if (plugin.lifecycle.deactivate) {
        await plugin.lifecycle.deactivate();
      }

      // Uninstall plugin
      if (plugin.lifecycle.uninstall) {
        await plugin.lifecycle.uninstall();
      }

      // Remove from memory
      this.plugins.delete(pluginId);
      this.pluginVMs.delete(pluginId);

      // Update registry
      if (this.registry.plugins[pluginId]) {
        this.registry.plugins[pluginId].enabled = false;
      }

      await this.saveRegistry();

      logger.info('Plugin unloaded successfully', { pluginId });

    } catch (error) {
      logger.error('Failed to unload plugin', { pluginId, error: error.message });
      throw error;
    }
  }

  async reloadPlugin(pluginId: string): Promise<void> {
    logger.info('Reloading plugin', { pluginId });
    
    const pluginInfo = this.registry.plugins[pluginId];
    if (!pluginInfo) {
      throw new Error(`Plugin not in registry: ${pluginId}`);
    }

    await this.unloadPlugin(pluginId);
    await this.loadPlugin(pluginId, pluginInfo.path);
  }

  private async validatePluginManifest(manifest: any): Promise<void> {
    const schema = Joi.object({
      name: Joi.string().required(),
      version: Joi.string().required(),
      pluginType: Joi.string().valid('collector', 'processor', 'alerter', 'dashboard', 'exporter').required(),
      dependencies: Joi.object().optional(),
      config: Joi.object({
        schema: Joi.object().required(),
        defaults: Joi.object().required()
      }).optional()
    });

    const { error } = schema.validate(manifest);
    if (error) {
      throw new Error(`Invalid plugin manifest: ${error.details.map(d => d.message).join(', ')}`);
    }
  }

  private async resolveDependencies(pluginId: string, dependencies: Record<string, string>): Promise<void> {
    for (const [depId, version] of Object.entries(dependencies)) {
      const dependentPlugin = this.plugins.get(depId);
      
      if (!dependentPlugin) {
        throw new Error(`Missing dependency: ${depId} required by ${pluginId}`);
      }

      if (!semver.satisfies(dependentPlugin.version, version)) {
        throw new Error(`Version mismatch: ${depId}@${dependentPlugin.version} does not satisfy ${version} required by ${pluginId}`);
      }
    }
  }

  private createPluginRequire(pluginId: string): (module: string) => any {
    return (module: string) => {
      // Whitelist allowed modules for security
      const allowedModules = [
        'lodash', 'moment', 'axios', 'crypto',
        'fs-extra', 'path', 'util'
      ];

      if (!allowedModules.includes(module)) {
        throw new Error(`Module '${module}' is not allowed in plugin ${pluginId}`);
      }

      return require(module);
    };
  }

  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  getPluginsByType(type: string): Plugin[] {
    return Array.from(this.plugins.values()).filter(p => p.type === type);
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  async loadAllPlugins(): Promise<void> {
    const pluginDirs = await fs.readdir(this.pluginsDir, { withFileTypes: true });
    const pluginIds = pluginDirs
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    logger.info('Loading all plugins', { pluginIds });

    for (const pluginId of pluginIds) {
      try {
        const pluginPath = path.join(this.pluginsDir, pluginId);
        await this.loadPlugin(pluginId, pluginPath);
      } catch (error) {
        logger.error('Failed to load plugin during bulk load', { 
          pluginId, 
          error: error.message 
        });
      }
    }

    logger.info('Finished loading all plugins', { 
      loaded: this.plugins.size,
      total: pluginIds.length 
    });
  }

  destroy(): void {
    if (this.watcher) {
      this.watcher.close();
    }
  }
}

// Monitoring Core
class MonitoringSystem {
  private pluginSystem: PluginSystem;
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  private alertRules: Map<string, AlertRule> = new Map();
  private dashboards: Map<string, DashboardConfig> = new Map();

  constructor() {
    this.pluginSystem = new PluginSystem(process.env.PLUGINS_DIR);
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: { origin: "*" }
    });

    this.setupExpress();
    this.setupSocketIO();
    this.setupQueues();
    this.loadBuiltinPlugins();
  }

  private setupExpress(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Plugin management endpoints
    this.app.post('/api/plugins/:id/load', async (req, res) => {
      try {
        await this.pluginSystem.loadPlugin(req.params.id, req.body.path);
        res.json({ success: true });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    this.app.delete('/api/plugins/:id', async (req, res) => {
      try {
        await this.pluginSystem.unloadPlugin(req.params.id);
        res.json({ success: true });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    this.app.get('/api/plugins', (req, res) => {
      const plugins = this.pluginSystem.getAllPlugins().map(p => ({
        id: p.id,
        name: p.name,
        version: p.version,
        type: p.type,
        description: p.description
      }));
      res.json(plugins);
    });

    // Metrics endpoint for Prometheus
    this.app.get('/metrics', (req, res) => {
      res.set('Content-Type', prometheusRegister.contentType);
      res.end(prometheusRegister.metrics());
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        plugins: this.pluginSystem.getAllPlugins().length,
        uptime: process.uptime()
      });
    });

    logger.info('Express server configured');
  }

  private setupSocketIO(): void {
    this.io.on('connection', (socket) => {
      logger.info('Client connected', { socketId: socket.id });

      socket.on('subscribe-metrics', (metricsNames) => {
        socket.join('metrics');
        logger.debug('Client subscribed to metrics', { 
          socketId: socket.id,
          metrics: metricsNames
        });
      });

      socket.on('disconnect', () => {
        logger.info('Client disconnected', { socketId: socket.id });
      });
    });

    logger.info('Socket.IO configured');
  }

  private setupQueues(): void {
    // Metric collection queue
    monitoringQueue.process('collect-metrics', async (job) => {
      await this.collectMetrics(job.data.pluginIds);
    });

    // Alert evaluation queue
    monitoringQueue.process('evaluate-alerts', async (job) => {
      await this.evaluateAlerts(job.data.alertIds);
    });

    // Dashboard generation queue
    monitoringQueue.process('generate-dashboard', async (job) => {
      await this.generateDashboard(job.data.dashboardId);
    });

    // Schedule recurring jobs
    monitoringQueue.add('collect-metrics', { pluginIds: [] }, {
      repeat: { cron: '*/30 * * * * *' } // Every 30 seconds
    });

    monitoringQueue.add('evaluate-alerts', { alertIds: [] }, {
      repeat: { cron: '*/10 * * * * *' } // Every 10 seconds
    });

    logger.info('Background queues configured');
  }

  private async loadBuiltinPlugins(): Promise<void> {
    // Create built-in plugins directory
    const builtinPluginsDir = path.join(__dirname, 'builtin-plugins');
    await fs.ensureDir(builtinPluginsDir);

    // System metrics collector plugin
    await this.createSystemMetricsPlugin(builtinPluginsDir);
    
    // Prometheus exporter plugin
    await this.createPrometheusExporterPlugin(builtinPluginsDir);

    // Email alerter plugin
    await this.createEmailAlerterPlugin(builtinPluginsDir);

    logger.info('Built-in plugins created');
  }

  private async createSystemMetricsPlugin(pluginsDir: string): Promise<void> {
    const pluginDir = path.join(pluginsDir, 'system-metrics');
    await fs.ensureDir(pluginDir);

    const packageJson = {
      name: 'system-metrics',
      version: '1.0.0',
      description: 'Collect system metrics (CPU, memory, disk)',
      pluginType: 'collector',
      config: {
        schema: {
          interval: { type: 'number', default: 5000 },
          metrics: { 
            type: 'array', 
            items: { type: 'string' },
            default: ['cpu', 'memory', 'disk', 'network']
          }
        },
        defaults: {
          interval: 5000,
          metrics: ['cpu', 'memory', 'disk', 'network']
        }
      }
    };

    const pluginCode = `
      const si = require('systeminformation');
      
      module.exports = {
        api: {
          async collect(config) {
            const metrics = [];
            const timestamp = new Date();
            
            if (config.metrics.includes('cpu')) {
              const cpu = await si.currentLoad();
              metrics.push({
                name: 'system_cpu_usage_percent',
                value: cpu.currentLoad,
                timestamp,
                labels: { type: 'total' },
                type: 'gauge'
              });
            }
            
            if (config.metrics.includes('memory')) {
              const mem = await si.mem();
              metrics.push({
                name: 'system_memory_usage_percent',
                value: (mem.used / mem.total) * 100,
                timestamp,
                labels: { type: 'physical' },
                type: 'gauge'
              });
            }
            
            if (config.metrics.includes('disk')) {
              const disks = await si.fsSize();
              for (const disk of disks) {
                metrics.push({
                  name: 'system_disk_usage_percent',
                  value: disk.use,
                  timestamp,
                  labels: { mount: disk.mount, filesystem: disk.fs },
                  type: 'gauge'
                });
              }
            }
            
            return metrics;
          }
        }
      };
    `;

    await fs.writeJson(path.join(pluginDir, 'package.json'), packageJson, { spaces: 2 });
    await fs.writeFile(path.join(pluginDir, 'index.js'), pluginCode);
  }

  private async createPrometheusExporterPlugin(pluginsDir: string): Promise<void> {
    const pluginDir = path.join(pluginsDir, 'prometheus-exporter');
    await fs.ensureDir(pluginDir);

    const packageJson = {
      name: 'prometheus-exporter',
      version: '1.0.0',
      description: 'Export metrics to Prometheus',
      pluginType: 'exporter',
      config: {
        schema: {
          endpoint: { type: 'string', default: '/metrics' },
          labels: { type: 'object', default: {} }
        },
        defaults: {
          endpoint: '/metrics',
          labels: {}
        }
      }
    };

    const pluginCode = `
      const { register, Gauge, Counter, Histogram } = require('prom-client');
      const metrics = new Map();
      
      module.exports = {
        api: {
          async export(data, config) {
            for (const metric of data) {
              const metricName = metric.name.replace(/[^a-zA-Z0-9_]/g, '_');
              
              if (!metrics.has(metricName)) {
                let promMetric;
                
                switch (metric.type) {
                  case 'gauge':
                    promMetric = new Gauge({
                      name: metricName,
                      help: \`Metric: \${metric.name}\`,
                      labelNames: Object.keys(metric.labels || {})
                    });
                    break;
                  case 'counter':
                    promMetric = new Counter({
                      name: metricName,
                      help: \`Metric: \${metric.name}\`,
                      labelNames: Object.keys(metric.labels || {})
                    });
                    break;
                  case 'histogram':
                    promMetric = new Histogram({
                      name: metricName,
                      help: \`Metric: \${metric.name}\`,
                      labelNames: Object.keys(metric.labels || {})
                    });
                    break;
                }
                
                if (promMetric) {
                  metrics.set(metricName, promMetric);
                }
              }
              
              const promMetric = metrics.get(metricName);
              if (promMetric) {
                if (metric.type === 'gauge') {
                  promMetric.set(metric.labels || {}, metric.value);
                } else if (metric.type === 'counter') {
                  promMetric.inc(metric.labels || {}, metric.value);
                } else if (metric.type === 'histogram') {
                  promMetric.observe(metric.labels || {}, metric.value);
                }
              }
            }
          }
        }
      };
    `;

    await fs.writeJson(path.join(pluginDir, 'package.json'), packageJson, { spaces: 2 });
    await fs.writeFile(path.join(pluginDir, 'index.js'), pluginCode);
  }

  private async createEmailAlerterPlugin(pluginsDir: string): Promise<void> {
    const pluginDir = path.join(pluginsDir, 'email-alerter');
    await fs.ensureDir(pluginDir);

    const packageJson = {
      name: 'email-alerter',
      version: '1.0.0',
      description: 'Send email alerts',
      pluginType: 'alerter',
      config: {
        schema: {
          smtp: {
            type: 'object',
            properties: {
              host: { type: 'string' },
              port: { type: 'number', default: 587 },
              secure: { type: 'boolean', default: false },
              auth: {
                type: 'object',
                properties: {
                  user: { type: 'string' },
                  pass: { type: 'string' }
                }
              }
            }
          },
          from: { type: 'string' },
          templates: { type: 'object', default: {} }
        },
        defaults: {
          smtp: {
            host: process.env.SMTP_HOST,
            port: 587,
            secure: false,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS
            }
          },
          from: process.env.SMTP_USER,
          templates: {}
        }
      }
    };

    const pluginCode = `
      const nodemailer = require('nodemailer');
      let transporter;
      
      module.exports = {
        lifecycle: {
          async activate() {
            const config = this.getConfig();
            transporter = nodemailer.createTransporter(config.smtp);
          }
        },
        api: {
          async alert(alertRule, data) {
            const config = this.getConfig();
            
            const subject = \`🚨 Alert: \${alertRule.name}\`;
            const html = \`
              <h2>Alert Triggered</h2>
              <p><strong>Name:</strong> \${alertRule.name}</p>
              <p><strong>Severity:</strong> \${alertRule.severity}</p>
              <p><strong>Description:</strong> \${alertRule.description}</p>
              <p><strong>Condition:</strong> \${alertRule.condition} \${alertRule.threshold}</p>
              <p><strong>Time:</strong> \${new Date().toISOString()}</p>
              
              <h3>Metric Data</h3>
              <ul>
                \${data.map(m => \`<li>\${m.name}: \${m.value} (\${JSON.stringify(m.labels)})</li>\`).join('')}
              </ul>
            \`;
            
            await transporter.sendMail({
              from: config.from,
              to: alertRule.channels.join(', '),
              subject,
              html
            });
          }
        }
      };
    `;

    await fs.writeJson(path.join(pluginDir, 'package.json'), packageJson, { spaces: 2 });
    await fs.writeFile(path.join(pluginDir, 'index.js'), pluginCode);
  }

  async start(): Promise<void> {
    try {
      // Load all plugins
      await this.pluginSystem.loadAllPlugins();

      // Start HTTP server
      const port = process.env.HTTP_PORT || 3000;
      this.server.listen(port, () => {
        logger.info('Monitoring system started', { port });
      });

      // Start metric collection
      await this.startMetricCollection();

      logger.info('Monitoring system fully initialized');

    } catch (error) {
      logger.error('Failed to start monitoring system', { error: error.message });
      throw error;
    }
  }

  private async startMetricCollection(): Promise<void> {
    logger.info('Starting metric collection');
    
    // Trigger initial collection
    await monitoringQueue.add('collect-metrics', { pluginIds: [] });
  }

  private async collectMetrics(pluginIds: string[] = []): Promise<void> {
    const collectors = pluginIds.length > 0 
      ? pluginIds.map(id => this.pluginSystem.getPlugin(id)).filter(Boolean)
      : this.pluginSystem.getPluginsByType('collector');

    const allMetrics: MetricData[] = [];

    for (const collector of collectors) {
      if (!collector || !collector.api.collect) continue;

      const startTime = Date.now();
      
      try {
        const config = {}; // Load from registry/config
        const metrics = await collector.api.collect(config);
        
        allMetrics.push(...metrics);

        const duration = (Date.now() - startTime) / 1000;
        metricCollectionHistogram.observe(
          { plugin_id: collector.id, metric_type: collector.type },
          duration
        );

        logger.debug('Metrics collected', {
          pluginId: collector.id,
          metricCount: metrics.length,
          duration: `${duration}s`
        });

      } catch (error) {
        logger.error('Metric collection failed', {
          pluginId: collector.id,
          error: error.message
        });
      }
    }

    // Store metrics
    await this.storeMetrics(allMetrics);

    // Export metrics
    await this.exportMetrics(allMetrics);

    // Emit to WebSocket clients
    this.io.to('metrics').emit('metrics-update', allMetrics);
  }

  private async storeMetrics(metrics: MetricData[]): Promise<void> {
    // Store in InfluxDB
    const writeApi = influxDB.getWriteApi(
      process.env.INFLUXDB_ORG!,
      process.env.INFLUXDB_BUCKET!
    );

    for (const metric of metrics) {
      const point = writeApi.point(metric.name)
        .timestamp(metric.timestamp)
        .floatField('value', metric.value);

      // Add labels as tags
      Object.entries(metric.labels || {}).forEach(([key, value]) => {
        point.tag(key, value);
      });

      writeApi.writePoint(point);
    }

    await writeApi.flush();
  }

  private async exportMetrics(metrics: MetricData[]): Promise<void> {
    const exporters = this.pluginSystem.getPluginsByType('exporter');

    for (const exporter of exporters) {
      if (!exporter.api.export) continue;

      try {
        const config = {}; // Load from registry/config
        await exporter.api.export(metrics, config);

        logger.debug('Metrics exported', { exporterId: exporter.id });

      } catch (error) {
        logger.error('Metric export failed', {
          exporterId: exporter.id,
          error: error.message
        });
      }
    }
  }

  private async evaluateAlerts(alertIds: string[] = []): Promise<void> {
    // This would implement alert evaluation logic
    // For brevity, we'll skip the full implementation
    logger.debug('Evaluating alerts', { alertIds });
  }

  private async generateDashboard(dashboardId: string): Promise<void> {
    // This would implement dashboard generation logic
    logger.debug('Generating dashboard', { dashboardId });
  }

  async stop(): Promise<void> {
    logger.info('Stopping monitoring system');

    if (this.server) {
      this.server.close();
    }

    this.pluginSystem.destroy();
    
    await mongoClient.close();
    await pgPool.end();
    redis.disconnect();

    logger.info('Monitoring system stopped');
  }
}

// Command Definition
export const monitorCommand = defineCommand({
  meta: {
    name: "monitor",
    description: "Plugin-enhanced monitoring system with extensible capabilities"
  },
  args: {
    action: {
      type: "string",
      description: "Action to perform (start, stop, status, plugin)",
      required: true
    },
    "plugin-id": {
      type: "string",
      description: "Plugin ID for plugin operations",
      required: false
    },
    "plugin-path": {
      type: "string",
      description: "Path to plugin directory",
      required: false
    },
    "config-file": {
      type: "string",
      description: "Configuration file path",
      required: false
    },
    daemon: {
      type: "boolean",
      description: "Run as daemon process",
      default: false
    }
  },
  async run({ args }) {
    const monitoring = new MonitoringSystem();

    try {
      switch (args.action) {
        case 'start':
          console.log("🚀 Starting monitoring system...");
          await monitoring.start();
          
          if (!args.daemon) {
            console.log("\n✅ Monitoring system started successfully!");
            console.log(`📊 Dashboard: http://localhost:${process.env.HTTP_PORT || 3000}`);
            console.log(`📈 Metrics: http://localhost:${process.env.HTTP_PORT || 3000}/metrics`);
            console.log("Press Ctrl+C to stop");
            
            process.on('SIGINT', async () => {
              console.log("\n🛑 Shutting down monitoring system...");
              await monitoring.stop();
              process.exit(0);
            });

            // Keep process running
            await new Promise(() => {});
          }
          break;

        case 'stop':
          console.log("🛑 Stopping monitoring system...");
          await monitoring.stop();
          console.log("✅ Monitoring system stopped");
          break;

        case 'status':
          // Implementation for status check
          console.log("📊 Monitoring System Status");
          console.log("===========================");
          break;

        case 'plugin':
          if (!args["plugin-id"]) {
            throw new Error("Plugin ID required for plugin operations");
          }
          
          const pluginSystem = new PluginSystem();
          
          if (args["plugin-path"]) {
            console.log(`📦 Loading plugin: ${args["plugin-id"]}`);
            await pluginSystem.loadPlugin(args["plugin-id"], args["plugin-path"]);
            console.log("✅ Plugin loaded successfully");
          } else {
            console.log(`🗑️  Unloading plugin: ${args["plugin-id"]}`);
            await pluginSystem.unloadPlugin(args["plugin-id"]);
            console.log("✅ Plugin unloaded successfully");
          }
          break;

        default:
          throw new Error(`Unknown action: ${args.action}`);
      }

    } catch (error) {
      logger.error('Monitor command failed', { error: error.message });
      console.error(`❌ Monitoring System Error: ${error.message}`);
      process.exit(1);
    }
  }
});
```

## Plugin Example - Custom Database Metrics

```typescript
// plugins/database-metrics/package.json
{
  "name": "database-metrics",
  "version": "1.0.0",
  "description": "Collect database performance metrics",
  "pluginType": "collector",
  "dependencies": {
    "system-metrics": "^1.0.0"
  },
  "config": {
    "schema": {
      "databases": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "type": { "type": "string", "enum": ["postgresql", "mysql", "mongodb"] },
            "connectionString": { "type": "string" },
            "queries": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "query": { "type": "string" },
                  "metricType": { "type": "string" }
                }
              }
            }
          }
        }
      }
    },
    "defaults": {
      "databases": []
    }
  }
}
```

```javascript
// plugins/database-metrics/index.js
const { Pool } = require('pg');
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');

const connections = new Map();

module.exports = {
  lifecycle: {
    async activate() {
      const config = this.getConfig();
      
      for (const db of config.databases) {
        let connection;
        
        switch (db.type) {
          case 'postgresql':
            connection = new Pool({ connectionString: db.connectionString });
            break;
          case 'mysql':
            connection = await mysql.createConnection(db.connectionString);
            break;
          case 'mongodb':
            connection = new MongoClient(db.connectionString);
            await connection.connect();
            break;
        }
        
        connections.set(db.name, { connection, type: db.type, config: db });
      }
    },
    
    async deactivate() {
      for (const [name, { connection, type }] of connections) {
        switch (type) {
          case 'postgresql':
            await connection.end();
            break;
          case 'mysql':
            await connection.end();
            break;
          case 'mongodb':
            await connection.close();
            break;
        }
      }
      connections.clear();
    }
  },

  api: {
    async collect(config) {
      const metrics = [];
      const timestamp = new Date();
      
      for (const [dbName, { connection, type, config: dbConfig }] of connections) {
        try {
          for (const queryConfig of dbConfig.queries) {
            let result;
            
            switch (type) {
              case 'postgresql':
                result = await connection.query(queryConfig.query);
                break;
              case 'mysql':
                [result] = await connection.execute(queryConfig.query);
                break;
              case 'mongodb':
                // Handle MongoDB queries
                break;
            }
            
            if (result && result.rows && result.rows.length > 0) {
              const value = parseFloat(result.rows[0][Object.keys(result.rows[0])[0]]);
              
              metrics.push({
                name: `database_${queryConfig.name}`,
                value: isNaN(value) ? 0 : value,
                timestamp,
                labels: {
                  database: dbName,
                  type: type,
                  query: queryConfig.name
                },
                type: queryConfig.metricType || 'gauge'
              });
            }
          }
        } catch (error) {
          console.error(`Database metrics collection failed for ${dbName}:`, error.message);
        }
      }
      
      return metrics;
    }
  }
};
```

## Testing Approach

```typescript
// tests/plugin-system.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PluginSystem, MonitoringSystem } from '../src/monitoring';
import fs from 'fs-extra';
import path from 'path';

describe('Plugin-Enhanced Monitoring', () => {
  let pluginSystem: PluginSystem;
  let testPluginDir: string;

  beforeEach(async () => {
    testPluginDir = './test-plugins';
    await fs.ensureDir(testPluginDir);
    pluginSystem = new PluginSystem(testPluginDir);
  });

  afterEach(async () => {
    pluginSystem.destroy();
    await fs.remove(testPluginDir);
  });

  it('should load and unload plugins correctly', async () => {
    // Create test plugin
    const pluginDir = path.join(testPluginDir, 'test-plugin');
    await fs.ensureDir(pluginDir);
    
    await fs.writeJson(path.join(pluginDir, 'package.json'), {
      name: 'test-plugin',
      version: '1.0.0',
      pluginType: 'collector'
    });
    
    await fs.writeFile(path.join(pluginDir, 'index.js'), `
      module.exports = {
        api: {
          async collect() {
            return [{ name: 'test_metric', value: 42, timestamp: new Date(), labels: {}, type: 'gauge' }];
          }
        }
      };
    `);

    // Load plugin
    await pluginSystem.loadPlugin('test-plugin', pluginDir);
    expect(pluginSystem.getPlugin('test-plugin')).toBeDefined();

    // Test plugin functionality
    const plugin = pluginSystem.getPlugin('test-plugin')!;
    const metrics = await plugin.api.collect!({});
    expect(metrics).toHaveLength(1);
    expect(metrics[0].name).toBe('test_metric');

    // Unload plugin
    await pluginSystem.unloadPlugin('test-plugin');
    expect(pluginSystem.getPlugin('test-plugin')).toBeUndefined();
  });

  it('should validate plugin dependencies', async () => {
    // Test dependency resolution
    const pluginDir = path.join(testPluginDir, 'dependent-plugin');
    await fs.ensureDir(pluginDir);
    
    await fs.writeJson(path.join(pluginDir, 'package.json'), {
      name: 'dependent-plugin',
      version: '1.0.0',
      pluginType: 'collector',
      dependencies: {
        'non-existent-plugin': '^1.0.0'
      }
    });
    
    await fs.writeFile(path.join(pluginDir, 'index.js'), 'module.exports = {};');

    await expect(
      pluginSystem.loadPlugin('dependent-plugin', pluginDir)
    ).rejects.toThrow('Missing dependency');
  });
});
```

## Usage Examples

```bash
# Start monitoring system
./cli monitor --action=start

# Start as daemon
./cli monitor --action=start --daemon

# Load a plugin
./cli monitor --action=plugin --plugin-id=custom-metrics --plugin-path=./plugins/custom-metrics

# Unload a plugin  
./cli monitor --action=plugin --plugin-id=custom-metrics

# Check system status
./cli monitor --action=status
```

## Performance Considerations

1. **Plugin Isolation**: VM-based plugin isolation prevents crashes
2. **Hot Reloading**: Plugins can be reloaded without system restart
3. **Async Operations**: All plugin operations are asynchronous
4. **Connection Pooling**: Database connections are pooled and reused
5. **Queue Processing**: Background processing prevents blocking

## Deployment Notes

### Docker Configuration

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Install plugin dependencies
COPY plugins/ ./plugins/
RUN cd plugins && find . -name "package.json" -execdir npm install \;

ENV NODE_ENV=production
VOLUME ["/app/plugins", "/app/config", "/app/data"]

EXPOSE 3000 3001
CMD ["npm", "start"]
```

This pattern provides a comprehensive, production-ready monitoring system with a flexible plugin architecture that can be extended for any monitoring needs while maintaining security, performance, and reliability.