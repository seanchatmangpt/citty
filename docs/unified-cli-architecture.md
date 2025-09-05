# Unified CLI Architecture for CNS-Bytestar Integration

## Overview

This document defines the unified CLI architecture that preserves enterprise features from both CNS and Bytestar systems while providing a modern, extensible command interface through the Citty framework.

## CLI Architecture Design

### Command Hierarchy Structure

```
citty/
├── cns/                    # CNS system commands
│   ├── ontology/          # Ontology processing commands
│   ├── consensus/         # Distributed consensus commands
│   ├── security/          # SIEM and governance commands
│   ├── performance/       # OpenTelemetry monitoring
│   └── validate/          # Validation and compliance
├── bytestar/              # Bytestar system commands
│   ├── neural/           # Neural processing and AI
│   ├── fabric/           # ByteGen fabric management
│   ├── quantum/          # Post-quantum cryptography
│   ├── flow/             # ByteFlow orchestration
│   └── core/             # ByteCore operations
├── unified/               # Cross-system unified commands
│   ├── ontology/         # Unified ontology operations
│   ├── consensus/        # Cross-protocol consensus
│   ├── performance/      # Hybrid monitoring
│   ├── security/         # Combined security framework
│   └── transform/        # Cross-system transformations
└── admin/                 # System administration
    ├── bridge/           # Bridge management
    ├── config/           # Configuration management
    ├── health/           # System health monitoring
    └── migration/        # Migration utilities
```

## Command Interface Design

### Base Command Structure

```typescript
// src/commands/base-command.ts
export abstract class BaseCommand {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly examples: string[];
  
  protected pythonBridge: PythonBridge;
  protected erlangBridge: ErlangBridge;
  protected performanceMonitor: PerformanceMonitor;
  
  constructor() {
    this.pythonBridge = new PythonBridge();
    this.erlangBridge = new ErlangBridge();
    this.performanceMonitor = new PerformanceMonitor();
  }

  abstract execute(args: CommandArgs): Promise<CommandResult>;

  protected async measureExecution<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return await this.performanceMonitor.measureOperation(operation, fn, {
      maxDurationMs: 8000, // Doctrine of 8
      enableTracing: true,
      enableMetrics: true
    });
  }
}
```

### CNS Command Integration

#### Ontology Processing Commands

```typescript
// src/commands/cns/ontology-process.ts
export class CNSOntologyProcessCommand extends BaseCommand {
  readonly name = 'cns:ontology:process';
  readonly description = 'Process ontology files using CNS OWL/RDF engine';
  readonly examples = [
    'citty cns ontology process --file data.owl --format turtle',
    'citty cns ontology process --file schema.ttl --validate --output processed.json',
    'citty cns ontology process --directory ./ontologies --batch --aot-compile'
  ];

  async execute(args: OntologyProcessArgs): Promise<OntologyProcessResult> {
    return await this.measureExecution('cns_ontology_process', async () => {
      // Initialize CNS ontology engine
      await this.pythonBridge.initializeOntologyEngine();
      
      // Process based on file format
      const processor = args.format === 'owl' 
        ? 'owl_aot_compiler' 
        : 'rdf_processor';

      const result = await this.pythonBridge.callCNSFunction(
        processor, 
        'process_file', 
        [args.file, { 
          validate: args.validate,
          aotCompile: args.aotCompile,
          outputFormat: args.outputFormat 
        }]
      );

      // Post-process if validation requested
      if (args.validate) {
        const validation = await this.pythonBridge.callCNSFunction(
          'shacl_validator',
          'validate_ontology',
          [result.processed, args.shapes]
        );
        result.validation = validation;
      }

      return {
        success: true,
        processed: result.processed,
        validation: result.validation,
        performance: result.metrics
      };
    });
  }
}
```

#### Consensus Management Commands

```typescript
// src/commands/cns/consensus-start.ts
export class CNSConsensusStartCommand extends BaseCommand {
  readonly name = 'cns:consensus:start';
  readonly description = 'Start CNS distributed consensus node';
  readonly examples = [
    'citty cns consensus start --protocol byzantine --nodes 3',
    'citty cns consensus start --config cluster.yaml --join-existing',
    'citty cns consensus start --bootstrap --genesis-block genesis.json'
  ];

  async execute(args: ConsensusStartArgs): Promise<ConsensusStartResult> {
    return await this.measureExecution('cns_consensus_start', async () => {
      const nodeConfig = {
        protocol: args.protocol || 'byzantine',
        nodeCount: args.nodes || 3,
        joinExisting: args.joinExisting || false,
        bootstrap: args.bootstrap || false,
        genesisBlock: args.genesisBlock
      };

      // Start Erlang consensus node
      const nodeId = await this.erlangBridge.startConsensusNode(nodeConfig);
      
      // Configure consensus parameters
      await this.erlangBridge.call('byzantine_consensus_coordinator', 'configure', [{
        maxFaultyNodes: Math.floor((nodeConfig.nodeCount - 1) / 3),
        consensusTimeout: 30000,
        heartbeatInterval: 5000
      }]);

      // Wait for node to join cluster
      let clusterStatus;
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds timeout

      do {
        await new Promise(resolve => setTimeout(resolve, 1000));
        clusterStatus = await this.erlangBridge.getClusterStatus();
        attempts++;
      } while (!clusterStatus.nodes.includes(nodeId) && attempts < maxAttempts);

      return {
        success: clusterStatus.nodes.includes(nodeId),
        nodeId,
        clusterSize: clusterStatus.nodes.length,
        consensusHealth: clusterStatus.health
      };
    });
  }
}
```

### Bytestar Command Integration

#### Neural Processing Commands

```typescript
// src/commands/bytestar/neural-train.ts
export class BytestarNeuralTrainCommand extends BaseCommand {
  readonly name = 'bytestar:neural:train';
  readonly description = 'Train neural models using Bytestar AI pipeline';
  readonly examples = [
    'citty bytestar neural train --model transformer --data training.json',
    'citty bytestar neural train --architecture lstm --epochs 100 --batch-size 32',
    'citty bytestar neural train --config neural-config.yaml --distributed --nodes 4'
  ];

  async execute(args: NeuralTrainArgs): Promise<NeuralTrainResult> {
    return await this.measureExecution('bytestar_neural_train', async () => {
      // Initialize neural processing environment
      const neuralEngine = new BytestarNeuralEngine();
      
      const trainingConfig = {
        architecture: args.architecture || 'transformer',
        model: args.model,
        epochs: args.epochs || 50,
        batchSize: args.batchSize || 32,
        learningRate: args.learningRate || 0.001,
        distributed: args.distributed || false,
        nodeCount: args.nodes || 1
      };

      // Load training data
      const trainingData = await this.loadTrainingData(args.data);
      
      // Start training process
      const trainingSession = await neuralEngine.startTraining(
        trainingConfig,
        trainingData
      );

      // Monitor training progress
      return await this.monitorTrainingProgress(trainingSession);
    });
  }

  private async monitorTrainingProgress(session: TrainingSession): Promise<NeuralTrainResult> {
    let progress;
    do {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second intervals
      progress = await session.getProgress();
      
      console.log(`Training progress: ${progress.currentEpoch}/${progress.totalEpochs} ` +
                  `(${(progress.accuracy * 100).toFixed(2)}% accuracy)`);
                  
    } while (!progress.completed);

    return {
      success: progress.success,
      modelId: session.modelId,
      finalAccuracy: progress.accuracy,
      trainingTime: progress.duration,
      modelMetrics: progress.metrics
    };
  }
}
```

#### Fabric Management Commands

```typescript
// src/commands/bytestar/fabric-deploy.ts
export class BytestarFabricDeployCommand extends BaseCommand {
  readonly name = 'bytestar:fabric:deploy';
  readonly description = 'Deploy applications using ByteGen fabric';
  readonly examples = [
    'citty bytestar fabric deploy --manifest app.yaml --environment prod',
    'citty bytestar fabric deploy --template quickstart --config override.json',
    'citty bytestar fabric deploy --docker-image app:latest --replicas 3'
  ];

  async execute(args: FabricDeployArgs): Promise<FabricDeployResult> {
    return await this.measureExecution('bytestar_fabric_deploy', async () => {
      const fabricManager = new ByteGenFabricManager();
      
      // Load deployment manifest
      const manifest = args.manifest 
        ? await this.loadManifest(args.manifest)
        : await this.generateManifest(args);

      // Validate manifest against ByteCore specifications
      const validation = await fabricManager.validateManifest(manifest);
      if (!validation.valid) {
        throw new Error(`Manifest validation failed: ${validation.errors.join(', ')}`);
      }

      // Execute deployment
      const deployment = await fabricManager.deploy({
        manifest,
        environment: args.environment,
        dryRun: args.dryRun || false,
        rollback: args.rollback || true
      });

      // Monitor deployment progress
      return await this.monitorDeployment(deployment);
    });
  }
}
```

### Unified Cross-System Commands

#### Unified Ontology Transform

```typescript
// src/commands/unified/ontology-transform.ts
export class UnifiedOntologyTransformCommand extends BaseCommand {
  readonly name = 'unified:ontology:transform';
  readonly description = 'Transform ontologies between CNS and Bytestar formats';
  readonly examples = [
    'citty unified ontology transform --source cns --target fuller-canon --file data.ttl',
    'citty unified ontology transform --source owl --target zod-schema --file schema.owl',
    'citty unified ontology transform --batch --directory ./ontologies --parallel 4'
  ];

  async execute(args: OntologyTransformArgs): Promise<OntologyTransformResult> {
    return await this.measureExecution('unified_ontology_transform', async () => {
      const unifiedEngine = new UnifiedOntologyEngine(
        this.pythonBridge,
        new BytestarCore()
      );

      // Determine transformation pipeline
      const pipeline = this.createTransformationPipeline(args.source, args.target);
      
      const results = [];
      const files = args.batch ? await this.getOntologyFiles(args.directory) : [args.file];

      // Process files in parallel if requested
      if (args.parallel && args.parallel > 1) {
        const chunks = this.chunkArray(files, args.parallel);
        const promises = chunks.map(chunk => 
          this.processFileChunk(chunk, pipeline, unifiedEngine)
        );
        const chunkResults = await Promise.all(promises);
        results.push(...chunkResults.flat());
      } else {
        for (const file of files) {
          const result = await this.processFile(file, pipeline, unifiedEngine);
          results.push(result);
        }
      }

      return {
        success: results.every(r => r.success),
        transformations: results,
        summary: this.createSummary(results)
      };
    });
  }

  private createTransformationPipeline(source: string, target: string): TransformationPipeline {
    const pipelines = {
      'cns->fuller-canon': [
        { step: 'parse-owl', engine: 'cns' },
        { step: 'extract-semantics', engine: 'cns' },
        { step: 'apply-fuller-canon', engine: 'bytestar' },
        { step: 'validate-entropy', engine: 'bytestar' }
      ],
      'owl->zod-schema': [
        { step: 'parse-owl', engine: 'cns' },
        { step: 'extract-classes', engine: 'cns' },
        { step: 'generate-typescript', engine: 'unified' },
        { step: 'create-zod-schema', engine: 'unified' }
      ]
    };

    return pipelines[`${source}->${target}`] || this.createCustomPipeline(source, target);
  }
}
```

### Performance Monitoring Integration

```typescript
// src/commands/unified/performance-monitor.ts
export class UnifiedPerformanceMonitorCommand extends BaseCommand {
  readonly name = 'unified:performance:monitor';
  readonly description = 'Monitor performance across CNS and Bytestar systems';
  readonly examples = [
    'citty unified performance monitor --constraints doctrine8 --duration 1h',
    'citty unified performance monitor --systems all --export prometheus',
    'citty unified performance monitor --real-time --dashboard --port 3000'
  ];

  async execute(args: PerformanceMonitorArgs): Promise<PerformanceMonitorResult> {
    const monitor = new UnifiedPerformanceMonitor({
      openTelemetry: true,
      doctrine8: args.constraints?.includes('doctrine8'),
      fullerCanonMetrics: true,
      duration: args.duration,
      realTime: args.realTime
    });

    // Start monitoring
    await monitor.start();

    // Set up dashboard if requested
    if (args.dashboard) {
      const dashboard = new PerformanceDashboard(monitor);
      await dashboard.start(args.port || 3000);
      console.log(`Performance dashboard available at http://localhost:${args.port || 3000}`);
    }

    // Monitor for specified duration
    if (args.duration) {
      await new Promise(resolve => setTimeout(resolve, this.parseDuration(args.duration)));
      const report = await monitor.generateReport();
      await monitor.stop();
      return report;
    } else {
      // Continuous monitoring
      console.log('Monitoring started. Press Ctrl+C to stop.');
      return new Promise((resolve) => {
        process.on('SIGINT', async () => {
          const report = await monitor.generateReport();
          await monitor.stop();
          resolve(report);
        });
      });
    }
  }
}
```

## Command Registration and Discovery

### Dynamic Command Loading

```typescript
// src/core/command-registry.ts
export class CommandRegistry {
  private commands = new Map<string, typeof BaseCommand>();
  private bridges = new Map<string, any>();

  async loadCommands(): Promise<void> {
    // Load CNS commands
    const cnsCommands = await this.discoverCommands('./commands/cns/**/*.ts');
    for (const command of cnsCommands) {
      this.registerCommand(command);
    }

    // Load Bytestar commands
    const bytestarCommands = await this.discoverCommands('./commands/bytestar/**/*.ts');
    for (const command of bytestarCommands) {
      this.registerCommand(command);
    }

    // Load unified commands
    const unifiedCommands = await this.discoverCommands('./commands/unified/**/*.ts');
    for (const command of unifiedCommands) {
      this.registerCommand(command);
    }
  }

  private registerCommand(CommandClass: typeof BaseCommand): void {
    const instance = new CommandClass();
    this.commands.set(instance.name, CommandClass);
  }

  getCommand(name: string): typeof BaseCommand | undefined {
    return this.commands.get(name);
  }

  listCommands(filter?: string): string[] {
    const names = Array.from(this.commands.keys());
    return filter ? names.filter(name => name.includes(filter)) : names;
  }
}
```

### CLI Entry Point

```typescript
// src/cli.ts
import { defineCommand, runMain } from 'citty';
import { CommandRegistry } from './core/command-registry';

const registry = new CommandRegistry();

const main = defineCommand({
  meta: {
    name: 'citty-unified',
    version: '1.0.0',
    description: 'Unified CLI for CNS and Bytestar systems'
  },
  args: {
    command: {
      type: 'positional',
      description: 'Command to execute',
      required: true
    }
  },
  async run({ args }) {
    await registry.loadCommands();
    
    const CommandClass = registry.getCommand(args.command);
    if (!CommandClass) {
      console.error(`Unknown command: ${args.command}`);
      console.log('Available commands:');
      registry.listCommands().forEach(cmd => console.log(`  ${cmd}`));
      return;
    }

    const command = new CommandClass();
    try {
      const result = await command.execute(args);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(`Command failed: ${error.message}`);
      process.exit(1);
    }
  }
});

runMain(main);
```

This unified CLI architecture provides a comprehensive command interface that preserves all enterprise features from both CNS and Bytestar systems while offering modern extensibility and performance monitoring.