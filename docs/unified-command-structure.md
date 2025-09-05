# Unified Command Structure Proposal

## Overview

This document defines the comprehensive command structure for the unified Citty CLI that integrates CNS and Bytestar systems while providing intuitive, discoverable, and powerful command interfaces.

## Command Taxonomy

### Top-Level Command Structure

```
citty
├── cns/                    # CNS-specific commands
│   ├── ontology/          # Ontology processing and management
│   ├── consensus/         # Distributed consensus operations
│   ├── security/          # SIEM and governance
│   ├── performance/       # OpenTelemetry monitoring
│   └── validate/          # Validation and compliance
├── bytestar/              # Bytestar-specific commands
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
├── admin/                 # System administration
│   ├── bridge/           # Bridge management
│   ├── config/           # Configuration management
│   ├── health/           # System health monitoring
│   └── migration/        # Migration utilities
└── help/                  # Help and documentation system
    ├── commands/         # Command-specific help
    ├── tutorials/        # Interactive tutorials
    ├── examples/         # Command examples
    └── troubleshoot/     # Troubleshooting guides
```

## CNS Command Namespace

### Ontology Processing Commands

#### `citty cns ontology process`
**Description**: Process ontology files using CNS OWL/RDF engine with AOT compilation

**Usage**:
```bash
citty cns ontology process [options] <file|directory>

# Basic processing
citty cns ontology process data.owl

# Advanced processing with validation
citty cns ontology process --format turtle --validate --shapes validation.ttl data.ttl

# Batch processing with AOT compilation
citty cns ontology process --batch --aot-compile --parallel 4 ./ontologies/

# Output to specific format
citty cns ontology process --output-format json --minify data.owl
```

**Arguments**:
- `<file|directory>`: Input ontology file or directory for batch processing

**Options**:
- `--format <format>`: Input format (owl, turtle, rdf-xml, n-triples) [default: auto-detect]
- `--output-format <format>`: Output format (json, ttl, owl, zod-schema) [default: json]
- `--validate`: Enable SHACL validation
- `--shapes <file>`: SHACL shapes file for validation
- `--aot-compile`: Enable ahead-of-time compilation
- `--batch`: Process directory recursively
- `--parallel <n>`: Number of parallel workers [default: 1]
- `--minify`: Minimize output size
- `--cache`: Enable result caching
- `--timeout <ms>`: Processing timeout [default: 30000]

#### `citty cns ontology validate`
**Description**: Validate ontology data against SHACL shapes

**Usage**:
```bash
citty cns ontology validate [options] <data> <shapes>

# Basic validation
citty cns ontology validate data.ttl shapes.ttl

# Validation with detailed reporting
citty cns ontology validate --detailed --export-report validation-report.json data.ttl shapes.ttl

# Batch validation
citty cns ontology validate --batch ./data/ ./shapes/
```

#### `citty cns ontology transform`
**Description**: Transform ontologies between formats and apply canonical transformations

**Usage**:
```bash
citty cns ontology transform [options] <input> <output>

# Format conversion
citty cns ontology transform --from owl --to turtle ontology.owl ontology.ttl

# Canonical transformation
citty cns ontology transform --canonical --entropy-target 0.3 input.owl canonical.ttl
```

### Consensus Management Commands

#### `citty cns consensus start`
**Description**: Start and manage distributed consensus nodes

**Usage**:
```bash
citty cns consensus start [options]

# Start Byzantine consensus with 3 nodes
citty cns consensus start --protocol byzantine --nodes 3

# Start with custom configuration
citty cns consensus start --config cluster-config.yaml

# Bootstrap new cluster
citty cns consensus start --bootstrap --genesis genesis-block.json

# Join existing cluster
citty cns consensus start --join-cluster cluster-id --node-discovery dns
```

**Options**:
- `--protocol <protocol>`: Consensus protocol (byzantine, raft, pbft) [default: byzantine]
- `--nodes <n>`: Number of consensus nodes [default: 3]
- `--config <file>`: Configuration file
- `--bootstrap`: Bootstrap new cluster
- `--genesis <file>`: Genesis block configuration
- `--join-cluster <id>`: Join existing cluster
- `--node-discovery <method>`: Node discovery method (dns, static, gossip)
- `--bind-address <addr>`: Node bind address
- `--port <port>`: Node port [default: 8080]

#### `citty cns consensus status`
**Description**: Get consensus cluster status and health information

**Usage**:
```bash
citty cns consensus status [options]

# Basic status
citty cns consensus status

# Detailed cluster information
citty cns consensus status --detailed --export-metrics

# Monitor specific node
citty cns consensus status --node-id node-123 --watch
```

#### `citty cns consensus submit`
**Description**: Submit transactions to consensus cluster

**Usage**:
```bash
citty cns consensus submit [options] <transaction>

# Submit JSON transaction
citty cns consensus submit transaction.json

# Submit with priority and metadata
citty cns consensus submit --priority high --metadata key=value tx.json
```

### Security and Governance Commands

#### `citty cns security audit`
**Description**: Perform security audits using CNS SIEM framework

**Usage**:
```bash
citty cns security audit [options] <target>

# Audit system configuration
citty cns security audit system

# Audit specific ontology for security issues
citty cns security audit --type ontology --deep-scan data.owl

# Generate compliance report
citty cns security audit --compliance SOC2 --export-report audit-report.pdf
```

#### `citty cns governance approve`
**Description**: Submit and manage governance approval workflows

**Usage**:
```bash
citty cns governance approve [options] <item>

# Submit ontology for approval
citty cns governance approve --type ontology --priority high ontology.ttl

# Check approval status
citty cns governance approve --status --request-id req-123
```

## Bytestar Command Namespace

### Neural Processing Commands

#### `citty bytestar neural train`
**Description**: Train neural models using Bytestar AI pipeline

**Usage**:
```bash
citty bytestar neural train [options] <config>

# Basic training
citty bytestar neural train --model transformer training-config.yaml

# Distributed training
citty bytestar neural train --distributed --nodes 4 --gpu config.yaml

# Resume training from checkpoint
citty bytestar neural train --resume checkpoint-epoch-50.pth config.yaml
```

**Arguments**:
- `<config>`: Training configuration file

**Options**:
- `--model <type>`: Model architecture (transformer, lstm, gnn, cnn) [default: transformer]
- `--data <file>`: Training dataset file
- `--epochs <n>`: Number of training epochs [default: 100]
- `--batch-size <n>`: Training batch size [default: 32]
- `--learning-rate <rate>`: Learning rate [default: 0.001]
- `--distributed`: Enable distributed training
- `--nodes <n>`: Number of training nodes [default: 1]
- `--gpu`: Use GPU acceleration
- `--resume <checkpoint>`: Resume from checkpoint
- `--save-interval <n>`: Checkpoint save interval [default: 10]
- `--early-stopping`: Enable early stopping
- `--validation-split <ratio>`: Validation split ratio [default: 0.2]

#### `citty bytestar neural infer`
**Description**: Run inference on trained models

**Usage**:
```bash
citty bytestar neural infer [options] <model> <input>

# Single inference
citty bytestar neural infer model-v1.pth input.json

# Batch inference
citty bytestar neural infer --batch --parallel 4 model.pth input-batch/

# Real-time inference server
citty bytestar neural infer --serve --port 8080 model.pth
```

#### `citty bytestar neural optimize`
**Description**: Optimize neural models for deployment

**Usage**:
```bash
citty bytestar neural optimize [options] <model>

# Quantization optimization
citty bytestar neural optimize --quantize int8 --target mobile model.pth

# Pruning optimization
citty bytestar neural optimize --prune 0.3 --fine-tune model.pth
```

### Fabric Management Commands

#### `citty bytestar fabric deploy`
**Description**: Deploy applications using ByteGen fabric

**Usage**:
```bash
citty bytestar fabric deploy [options] <manifest>

# Basic deployment
citty bytestar fabric deploy app-manifest.yaml

# Production deployment with monitoring
citty bytestar fabric deploy --env prod --monitor --rollback-on-failure manifest.yaml

# Blue-green deployment
citty bytestar fabric deploy --strategy blue-green --health-check /health manifest.yaml
```

**Arguments**:
- `<manifest>`: Deployment manifest file

**Options**:
- `--env <environment>`: Target environment (dev, staging, prod) [default: dev]
- `--strategy <strategy>`: Deployment strategy (rolling, blue-green, canary) [default: rolling]
- `--replicas <n>`: Number of replicas [default: 1]
- `--monitor`: Enable deployment monitoring
- `--rollback-on-failure`: Auto-rollback on failure
- `--health-check <endpoint>`: Health check endpoint
- `--timeout <seconds>`: Deployment timeout [default: 300]
- `--dry-run`: Simulate deployment without executing

#### `citty bytestar fabric status`
**Description**: Check deployment status and health

**Usage**:
```bash
citty bytestar fabric status [options] [deployment]

# Check all deployments
citty bytestar fabric status

# Check specific deployment
citty bytestar fabric status my-app

# Watch deployment status
citty bytestar fabric status --watch --interval 5s my-app
```

### Quantum Security Commands

#### `citty bytestar quantum keygen`
**Description**: Generate post-quantum cryptographic keys

**Usage**:
```bash
citty bytestar quantum keygen [options] <algorithm>

# Generate Kyber1024 key pair
citty bytestar quantum keygen --output keypair kyber1024

# Generate Dilithium3 signing key
citty bytestar quantum keygen --type signing --export-public dilithium3
```

#### `citty bytestar quantum encrypt`
**Description**: Encrypt data using post-quantum algorithms

**Usage**:
```bash
citty bytestar quantum encrypt [options] <file>

# Encrypt with Kyber1024
citty bytestar quantum encrypt --algorithm kyber1024 --key public.key secret.txt

# Encrypt and sign
citty bytestar quantum encrypt --sign --signing-key private.key data.json
```

## Unified Command Namespace

### Cross-System Ontology Commands

#### `citty unified ontology transform`
**Description**: Transform ontologies between CNS and Bytestar formats

**Usage**:
```bash
citty unified ontology transform [options] <input> [output]

# CNS to Fuller Canon transformation
citty unified ontology transform --source cns --target fuller-canon data.ttl

# OWL to Zod schema generation
citty unified ontology transform --source owl --target zod-schema schema.owl schema.ts

# Batch transformation with validation
citty unified ontology transform --batch --validate --parallel 4 ./ontologies/
```

**Arguments**:
- `<input>`: Input ontology file or directory
- `[output]`: Output file or directory [default: stdout or input directory]

**Options**:
- `--source <format>`: Source format (cns, owl, turtle, fuller-canon)
- `--target <format>`: Target format (fuller-canon, zod-schema, typescript, json-schema)
- `--validate`: Validate transformation results
- `--entropy-target <ratio>`: Target entropy reduction ratio [default: 0.3]
- `--batch`: Process directory recursively
- `--parallel <n>`: Number of parallel workers [default: 1]
- `--preserve-semantics`: Ensure semantic equivalence
- `--optimize`: Apply optimization transformations

#### `citty unified ontology merge`
**Description**: Merge ontologies from different systems with conflict resolution

**Usage**:
```bash
citty unified ontology merge [options] <ontologies...>

# Merge CNS and Bytestar ontologies
citty unified ontology merge --strategy semantic-priority cns-schema.ttl bytestar-schema.ttl

# Merge with manual conflict resolution
citty unified ontology merge --interactive --export-conflicts conflicts.json schema1.owl schema2.ttl
```

### Cross-System Performance Commands

#### `citty unified performance monitor`
**Description**: Monitor performance across CNS and Bytestar systems

**Usage**:
```bash
citty unified performance monitor [options]

# Monitor with Doctrine of 8 constraints
citty unified performance monitor --constraints doctrine8 --duration 1h

# Real-time dashboard
citty unified performance monitor --dashboard --port 3000

# Export metrics
citty unified performance monitor --export prometheus --interval 30s
```

**Options**:
- `--constraints <type>`: Performance constraints (doctrine8, opentelemetry, fuller-canon)
- `--duration <duration>`: Monitoring duration (1m, 1h, 1d) [default: continuous]
- `--dashboard`: Launch web dashboard
- `--port <port>`: Dashboard port [default: 3000]
- `--export <format>`: Export format (prometheus, json, csv)
- `--interval <duration>`: Metrics collection interval [default: 10s]
- `--alerts`: Enable alerting
- `--threshold-file <file>`: Custom thresholds configuration

#### `citty unified performance benchmark`
**Description**: Run comprehensive performance benchmarks

**Usage**:
```bash
citty unified performance benchmark [options]

# Full system benchmark
citty unified performance benchmark --full --export-report benchmark-report.json

# Specific component benchmark
citty unified performance benchmark --component ontology-processing --iterations 1000

# Comparative benchmark
citty unified performance benchmark --compare --baseline baseline-results.json
```

## Administrative Command Namespace

### Bridge Management Commands

#### `citty admin bridge status`
**Description**: Check status of Python and Erlang bridges

**Usage**:
```bash
citty admin bridge status [options]

# Check all bridges
citty admin bridge status

# Detailed health information
citty admin bridge status --detailed --include-metrics

# Monitor bridge performance
citty admin bridge status --monitor --interval 30s
```

#### `citty admin bridge restart`
**Description**: Restart bridge connections

**Usage**:
```bash
citty admin bridge restart [options] [bridge]

# Restart all bridges
citty admin bridge restart

# Restart specific bridge
citty admin bridge restart python

# Graceful restart with drain
citty admin bridge restart --graceful --drain-timeout 30s erlang
```

### Configuration Management Commands

#### `citty admin config get`
**Description**: Get configuration values

**Usage**:
```bash
citty admin config get [key]

# Get all configuration
citty admin config get

# Get specific key
citty admin config get bridges.python.timeout

# Get with format
citty admin config get --format yaml bridges
```

#### `citty admin config set`
**Description**: Set configuration values

**Usage**:
```bash
citty admin config set [options] <key> <value>

# Set simple value
citty admin config set bridges.python.timeout 30000

# Set from file
citty admin config set --from-file config-update.yaml

# Set with validation
citty admin config set --validate --restart-required bridges.erlang.nodes 5
```

### Health Monitoring Commands

#### `citty admin health check`
**Description**: Comprehensive system health check

**Usage**:
```bash
citty admin health check [options]

# Basic health check
citty admin health check

# Deep health check with diagnostics
citty admin health check --deep --export-diagnostics health-report.json

# Continuous health monitoring
citty admin health check --continuous --alert-on-failure
```

## Help and Documentation System

### Interactive Help Commands

#### `citty help commands`
**Description**: Browse and search available commands

**Usage**:
```bash
citty help commands [options] [filter]

# List all commands
citty help commands

# Filter by namespace
citty help commands cns

# Search commands
citty help commands --search "ontology process"

# Interactive browser
citty help commands --interactive
```

#### `citty help tutorials`
**Description**: Access interactive tutorials

**Usage**:
```bash
citty help tutorials [options] [topic]

# List tutorials
citty help tutorials

# Start ontology processing tutorial
citty help tutorials ontology-basics

# Interactive tutorial mode
citty help tutorials --interactive getting-started
```

#### `citty help examples`
**Description**: Show command examples and use cases

**Usage**:
```bash
citty help examples [command]

# Examples for specific command
citty help examples "cns ontology process"

# Real-world use cases
citty help examples --use-cases --category enterprise

# Copy example to clipboard
citty help examples --copy "unified performance monitor"
```

## Command Composition and Chaining

### Pipeline Commands
```bash
# Process ontology and immediately validate
citty cns ontology process data.owl | citty cns ontology validate --shapes shapes.ttl

# Transform and deploy in pipeline
citty unified ontology transform --source owl --target fuller-canon schema.owl | 
  citty bytestar fabric deploy --stdin --template ontology-service

# Monitor during deployment
citty bytestar fabric deploy manifest.yaml & 
  citty unified performance monitor --duration 5m --constraints doctrine8
```

### Batch Operations
```bash
# Process multiple ontologies with different targets
citty unified ontology transform --batch --config batch-config.yaml ./ontologies/

# Train multiple models in parallel
citty bytestar neural train --parallel 3 --configs model-configs/*.yaml

# Health check across all systems
citty admin health check --all-systems --parallel --export-summary health-summary.json
```

## Command Aliases and Shortcuts

### Common Aliases
```bash
# Short forms for frequently used commands
citty ont proc = citty cns ontology process
citty cons start = citty cns consensus start
citty neural train = citty bytestar neural train
citty fab deploy = citty bytestar fabric deploy
citty perf mon = citty unified performance monitor
citty health = citty admin health check
```

### Context-Aware Commands
```bash
# Commands adapt based on current directory and configuration
citty process          # Auto-detect ontology files in current directory
citty deploy           # Use manifest.yaml in current directory
citty status           # Show status of current project's deployments
citty monitor          # Monitor current context with appropriate constraints
```

This unified command structure provides a comprehensive, intuitive, and powerful interface that preserves all enterprise capabilities from both CNS and Bytestar systems while offering modern CLI conveniences and discoverability.