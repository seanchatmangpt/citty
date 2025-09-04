# DevOps Master CLI - Complete Command Hierarchy

## Command Structure Overview

The DevOps Master CLI follows a hierarchical command structure with 20+ primary commands organized by domain expertise:

```
devops-master [global-options] <domain> <action> [action-options] [arguments]
```

## Global Options (Available for all commands)

```typescript
interface GlobalOptions {
  profile?: string;           // Configuration profile to use
  config?: string;           // Custom config file path
  verbose?: boolean;         // Detailed output
  quiet?: boolean;          // Suppress non-error output
  dry_run?: boolean;        // Show what would be done without executing
  output?: 'json' | 'yaml' | 'table' | 'raw'; // Output format
  log_level?: 'debug' | 'info' | 'warn' | 'error';
  no_color?: boolean;       // Disable colored output
  timeout?: number;         // Operation timeout in seconds
}
```

## Domain Commands

### 1. Cloud Management (`devops-master cloud`)

#### 1.1 Cloud Deploy (`devops-master cloud deploy`)
```typescript
interface CloudDeployArgs {
  provider: 'aws' | 'gcp' | 'azure' | 'digitalocean';
  template: string;          // Infrastructure template file
  region: string;           // Target region
  environment?: string;     // Environment name (dev/staging/prod)
  parameters?: Record<string, any>; // Template parameters
  tags?: Record<string, string>;    // Resource tags
  auto_approve?: boolean;   // Skip confirmation prompts
  backup_before_deploy?: boolean;
}
```

#### 1.2 Cloud Destroy (`devops-master cloud destroy`)
```typescript
interface CloudDestroyArgs {
  provider: 'aws' | 'gcp' | 'azure' | 'digitalocean';
  resource_group?: string;  // Specific resource group
  region?: string;
  force?: boolean;          // Force destruction without confirmation
  preserve_data?: boolean;  // Keep persistent volumes/databases
  backup_before_destroy?: boolean;
}
```

#### 1.3 Cloud Status (`devops-master cloud status`)
```typescript
interface CloudStatusArgs {
  provider?: 'aws' | 'gcp' | 'azure' | 'digitalocean';
  resource_type?: 'compute' | 'storage' | 'network' | 'database' | 'all';
  region?: string;
  watch?: boolean;          // Continuous monitoring
  refresh_interval?: number; // Seconds between updates
}
```

### 2. Container Management (`devops-master containers`)

#### 2.1 Docker Operations (`devops-master containers docker`)

##### 2.1.1 Docker Build (`devops-master containers docker build`)
```typescript
interface DockerBuildArgs {
  context: string;          // Build context path
  dockerfile?: string;      // Custom Dockerfile path
  tag: string;             // Image tag
  platform?: string;       // Target platform
  build_args?: Record<string, string>;
  target?: string;         // Multi-stage build target
  cache_from?: string[];   // Cache source images
  no_cache?: boolean;
  squash?: boolean;
  progress?: 'auto' | 'plain' | 'tty';
}
```

##### 2.1.2 Docker Push (`devops-master containers docker push`)
```typescript
interface DockerPushArgs {
  image: string;           // Image name:tag
  registry?: string;       // Registry URL
  all_tags?: boolean;      // Push all tags
  disable_content_trust?: boolean;
}
```

#### 2.2 Kubernetes Operations (`devops-master containers kubernetes`)

##### 2.2.1 Kubernetes Apply (`devops-master containers kubernetes apply`)
```typescript
interface KubernetesApplyArgs {
  filename?: string;       // YAML/JSON file
  directory?: string;      // Directory of files
  url?: string;           // Remote resource URL
  context?: string;       // Kubernetes context
  namespace?: string;     // Target namespace
  dry_run?: 'client' | 'server';
  validate?: boolean;
  wait?: boolean;         // Wait for resources to be ready
  timeout?: number;       // Wait timeout
  prune?: boolean;        // Prune resources
}
```

##### 2.2.2 Kubernetes Scale (`devops-master containers kubernetes scale`)
```typescript
interface KubernetesScaleArgs {
  resource: string;        // Resource type/name (deployment/web)
  replicas: number;       // Target replica count
  context?: string;
  namespace?: string;
  timeout?: number;
  current_replicas?: number; // For safety check
}
```

#### 2.3 Helm Operations (`devops-master containers helm`)

##### 2.3.1 Helm Install (`devops-master containers helm install`)
```typescript
interface HelmInstallArgs {
  name: string;           // Release name
  chart: string;          // Chart reference
  values?: string[];      // Values files
  set?: string[];         // Set values on command line
  set_string?: string[];  // Set STRING values
  version?: string;       // Chart version
  namespace?: string;
  create_namespace?: boolean;
  wait?: boolean;
  timeout?: number;
  dependency_update?: boolean;
}
```

### 3. CI/CD Pipeline Management (`devops-master pipelines`)

#### 3.1 Pipeline Create (`devops-master pipelines create`)
```typescript
interface PipelineCreateArgs {
  name: string;
  template: 'basic' | 'nodejs' | 'python' | 'docker' | 'kubernetes';
  provider: 'github' | 'gitlab' | 'jenkins' | 'azure-devops';
  repository: string;     // Repository URL
  branch?: string;        // Default branch
  triggers?: Array<'push' | 'pull_request' | 'schedule' | 'manual'>;
  environment?: Record<string, string>; // Environment variables
  secrets?: string[];     // Required secret names
  stages: PipelineStage[];
}

interface PipelineStage {
  name: string;
  jobs: PipelineJob[];
  depends_on?: string[];  // Previous stage dependencies
  condition?: string;     // Execution condition
}

interface PipelineJob {
  name: string;
  image?: string;         // Container image for job
  script: string[];       // Commands to execute
  artifacts?: {
    paths: string[];
    expire_in?: string;
  };
  cache?: {
    key: string;
    paths: string[];
  };
}
```

#### 3.2 Pipeline Deploy (`devops-master pipelines deploy`)
```typescript
interface PipelineDeployArgs {
  pipeline: string;       // Pipeline name/ID
  environment: string;    // Target environment
  version?: string;       // Specific version to deploy
  parameters?: Record<string, any>;
  approval_required?: boolean;
  rollback_on_failure?: boolean;
  health_check_url?: string;
  health_check_timeout?: number;
}
```

### 4. Infrastructure as Code (`devops-master infrastructure`)

#### 4.1 Terraform Operations (`devops-master infrastructure terraform`)

##### 4.1.1 Terraform Plan (`devops-master infrastructure terraform plan`)
```typescript
interface TerraformPlanArgs {
  directory: string;      // Terraform configuration directory
  var_file?: string[];    // Variable files
  var?: Record<string, string>; // Variables
  target?: string[];      // Resource targets
  destroy?: boolean;      // Create destroy plan
  out?: string;          // Save plan to file
  refresh?: boolean;      // Refresh state before planning
  parallelism?: number;   // Parallel operations
}
```

##### 4.1.2 Terraform Apply (`devops-master infrastructure terraform apply`)
```typescript
interface TerraformApplyArgs {
  directory?: string;
  plan?: string;          // Apply saved plan
  var_file?: string[];
  var?: Record<string, string>;
  target?: string[];
  auto_approve?: boolean;
  backup?: string;        // State backup file
  lock?: boolean;         // State locking
  parallelism?: number;
}
```

### 5. Security & Compliance (`devops-master security`)

#### 5.1 Security Scan (`devops-master security scan`)
```typescript
interface SecurityScanArgs {
  type: 'vulnerability' | 'secrets' | 'compliance' | 'dependencies' | 'all';
  target: string;         // File, directory, or URL
  format?: 'json' | 'yaml' | 'sarif' | 'table';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  exclude?: string[];     // Exclude patterns
  include_dev?: boolean;  // Include development dependencies
  report_path?: string;   // Save report to file
  fail_on?: 'error' | 'warning' | 'info'; // Exit code conditions
}
```

#### 5.2 Policy Enforcement (`devops-master security policies`)
```typescript
interface PolicyEnforcementArgs {
  policy_set: string;     // Policy set name or file
  target: string;         // Target resources
  action: 'validate' | 'enforce' | 'remediate';
  framework?: 'cis' | 'nist' | 'iso27001' | 'custom';
  exceptions?: string[];  // Exception rules
  remediation_mode?: 'automatic' | 'manual' | 'advisory';
}
```

### 6. Monitoring & Observability (`devops-master monitoring`)

#### 6.1 Metrics Setup (`devops-master monitoring metrics`)
```typescript
interface MetricsSetupArgs {
  provider: 'prometheus' | 'datadog' | 'newrelic' | 'grafana';
  targets: string[];      // Service/application targets
  metrics: string[];      // Specific metrics to collect
  interval?: number;      // Collection interval (seconds)
  retention?: string;     // Data retention period
  alerting?: {
    rules: AlertRule[];
    notifications: NotificationChannel[];
  };
}

interface AlertRule {
  name: string;
  condition: string;      // PromQL or similar expression
  for: string;           // Duration before alerting
  severity: 'info' | 'warning' | 'critical';
}
```

#### 6.2 Log Management (`devops-master monitoring logs`)
```typescript
interface LogManagementArgs {
  action: 'setup' | 'query' | 'stream' | 'archive';
  source?: string[];      // Log sources
  query?: string;         // Search query
  from?: string;         // Start time
  to?: string;           // End time
  follow?: boolean;       // Stream new logs
  format?: 'json' | 'raw' | 'structured';
  level?: 'debug' | 'info' | 'warn' | 'error';
}
```

### 7. Database Operations (`devops-master database`)

#### 7.1 Database Migration (`devops-master database migrate`)
```typescript
interface DatabaseMigrationArgs {
  database_type: 'postgresql' | 'mysql' | 'mongodb' | 'redis';
  connection_string?: string;
  migration_dir: string;  // Directory with migration files
  target_version?: string; // Specific version to migrate to
  dry_run?: boolean;
  backup_before?: boolean;
  rollback_on_error?: boolean;
  timeout?: number;
}
```

#### 7.2 Database Backup (`devops-master database backup`)
```typescript
interface DatabaseBackupArgs {
  database_type: 'postgresql' | 'mysql' | 'mongodb' | 'redis';
  connection_string?: string;
  output_path: string;    // Backup file path
  format?: 'sql' | 'binary' | 'archive';
  compression?: 'none' | 'gzip' | 'bzip2';
  tables?: string[];      // Specific tables to backup
  schema_only?: boolean;  // Backup structure only
  data_only?: boolean;    // Backup data only
}
```

*Additional domains and commands continue...*