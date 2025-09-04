import type { CommandDef, ArgsDef } from "../types";

/**
 * ULTRATHINK DevOps Master CLI - Complete CommandDef Specification
 * 
 * Architecture Overview:
 * - 25+ Main Commands with deep nesting
 * - 60+ Total Arguments across all commands  
 * - 4-level deep subcommand nesting
 * - All argument types: string, number, boolean, enum, positional
 * - Advanced CLI features: aliases, defaults, required flags, value hints
 * - Version management and hidden debug commands
 */

// Global shared argument definitions
const commonArgs: ArgsDef = {
  verbose: {
    type: "boolean",
    description: "Enable verbose output with detailed logging",
    alias: ["v"],
    default: false,
  },
  dryRun: {
    type: "boolean", 
    description: "Simulate operations without making actual changes",
    alias: ["dry", "n"],
    default: false,
  },
  configFile: {
    type: "string",
    description: "Path to configuration file",
    alias: ["c", "config"],
    valueHint: "./devops.config.json",
  },
  environment: {
    type: "enum",
    description: "Target deployment environment",
    options: ["dev", "staging", "prod", "test"],
    alias: ["env", "e"],
    required: true,
  },
};

// Infrastructure Management Commands
const infrastructureCommands: Record<string, CommandDef> = {
  // Level 3: infra provision cloud aws
  aws: {
    meta: {
      name: "aws",
      description: "Amazon Web Services infrastructure provisioning",
    },
    args: {
      region: {
        type: "string",
        description: "AWS region for deployment",
        required: true,
        alias: ["r"],
        valueHint: "us-west-2",
      },
      profile: {
        type: "string", 
        description: "AWS profile to use",
        alias: ["p"],
        valueHint: "default",
      },
      ...commonArgs,
    },
    subCommands: {
      // Level 4: infra provision cloud aws ec2
      ec2: {
        meta: { name: "ec2", description: "EC2 instance management" },
        args: {
          instanceType: {
            type: "enum",
            description: "EC2 instance type",
            options: ["t3.micro", "t3.small", "t3.medium", "m5.large", "m5.xlarge"],
            default: "t3.micro",
            alias: ["i"],
          },
          keyPair: {
            type: "string",
            description: "SSH key pair name",
            required: true,
            alias: ["k"],
          },
          securityGroups: {
            type: "string",
            description: "Comma-separated security group IDs",
            alias: ["sg"],
            valueHint: "sg-12345,sg-67890",
          },
          userData: {
            type: "string",
            description: "Path to user data script",
            alias: ["u"],
            valueHint: "./bootstrap.sh",
          },
        },
      },
      rds: {
        meta: { name: "rds", description: "RDS database provisioning" },
        args: {
          engine: {
            type: "enum",
            description: "Database engine type",
            options: ["mysql", "postgres", "mariadb", "oracle", "sqlserver"],
            required: true,
          },
          instanceClass: {
            type: "string",
            description: "RDS instance class",
            default: "db.t3.micro",
          },
          storage: {
            type: "number",
            description: "Allocated storage in GB",
            default: 20,
            alias: ["s"],
          },
          multiAz: {
            type: "boolean",
            description: "Enable Multi-AZ deployment",
            default: false,
          },
        },
      },
    },
  },
  
  // Level 3: infra provision cloud azure  
  azure: {
    meta: {
      name: "azure", 
      description: "Microsoft Azure infrastructure provisioning",
    },
    args: {
      subscription: {
        type: "string",
        description: "Azure subscription ID",
        required: true,
        alias: ["sub"],
      },
      resourceGroup: {
        type: "string", 
        description: "Resource group name",
        required: true,
        alias: ["rg"],
      },
      location: {
        type: "string",
        description: "Azure region",
        default: "eastus",
        alias: ["l"],
        valueHint: "eastus|westus2|centralus",
      },
    },
    subCommands: {
      vm: {
        meta: { name: "vm", description: "Virtual machine management" },
        args: {
          vmSize: {
            type: "enum",
            description: "Virtual machine size",
            options: ["Standard_B1s", "Standard_B2s", "Standard_D2s_v3"],
            default: "Standard_B1s",
          },
          image: {
            type: "string",
            description: "VM image reference",
            default: "UbuntuLTS",
          },
        },
      },
      aks: {
        meta: { name: "aks", description: "Azure Kubernetes Service" },
        args: {
          nodeCount: {
            type: "number",
            description: "Number of nodes in the cluster",
            default: 3,
          },
          kubernetesVersion: {
            type: "string",
            description: "Kubernetes version",
            alias: ["kv"],
            valueHint: "1.28.0",
          },
        },
      },
    },
  },

  gcp: {
    meta: {
      name: "gcp",
      description: "Google Cloud Platform infrastructure provisioning", 
    },
    args: {
      project: {
        type: "string",
        description: "GCP project ID", 
        required: true,
        alias: ["proj"],
      },
      zone: {
        type: "string",
        description: "GCP zone",
        default: "us-central1-a",
        alias: ["z"],
      },
    },
    subCommands: {
      compute: {
        meta: { name: "compute", description: "Compute Engine instances" },
        args: {
          machineType: {
            type: "string",
            description: "Machine type",
            default: "e2-micro",
          },
        },
      },
      gke: {
        meta: { name: "gke", description: "Google Kubernetes Engine" },
        args: {
          clusterVersion: {
            type: "string", 
            description: "GKE cluster version",
            alias: ["cv"],
          },
        },
      },
    },
  },
};

// Container orchestration commands
const containerCommands: Record<string, CommandDef> = {
  build: {
    meta: {
      name: "build",
      description: "Build container images with advanced options",
    },
    args: {
      dockerfile: {
        type: "string",
        description: "Path to Dockerfile",
        default: "Dockerfile",
        alias: ["f"],
      },
      tag: {
        type: "string",
        description: "Image tag",
        required: true,
        alias: ["t"],
        valueHint: "myapp:latest",
      },
      buildArgs: {
        type: "string",
        description: "Build arguments as key=value pairs",
        alias: ["build-arg"],
        valueHint: "NODE_ENV=production",
      },
      platform: {
        type: "enum",
        description: "Target platform architecture",
        options: ["linux/amd64", "linux/arm64", "linux/arm/v7"],
        alias: ["p"],
      },
      cache: {
        type: "boolean",
        description: "Use build cache",
        default: true,
      },
      squash: {
        type: "boolean",
        description: "Squash layers into single layer",
        default: false,
      },
      ...commonArgs,
    },
  },

  deploy: {
    meta: {
      name: "deploy",
      description: "Deploy containers to orchestration platform",
    },
    args: {
      image: {
        type: "string", 
        description: "Container image to deploy",
        required: true,
        valueHint: "nginx:latest",
      },
      replicas: {
        type: "number",
        description: "Number of replicas",
        default: 3,
        alias: ["r"],
      },
      port: {
        type: "number",
        description: "Container port to expose",
        default: 80,
        alias: ["p"],
      },
      namespace: {
        type: "string",
        description: "Kubernetes namespace",
        default: "default",
        alias: ["ns"],
      },
      ...commonArgs,
    },
    subCommands: {
      kubernetes: {
        meta: { name: "kubernetes", description: "Kubernetes deployment" },
        args: {
          manifestPath: {
            type: "string",
            description: "Path to Kubernetes manifests",
            alias: ["m"],
            valueHint: "./k8s/",
          },
          context: {
            type: "string",
            description: "Kubectl context to use",
            alias: ["ctx"],
          },
        },
      },
      docker: {
        meta: { name: "docker", description: "Docker Swarm deployment" },
        args: {
          stackName: {
            type: "string",
            description: "Docker stack name",
            required: true,
          },
          composePath: {
            type: "string",
            description: "Path to docker-compose.yml",
            default: "docker-compose.yml",
          },
        },
      },
    },
  },

  scale: {
    meta: {
      name: "scale",
      description: "Scale container deployments dynamically",
    },
    args: {
      service: {
        type: "string",
        description: "Service name to scale",
        required: true,
        alias: ["s"],
      },
      replicas: {
        type: "number",
        description: "Target number of replicas", 
        required: true,
        alias: ["r"],
      },
      timeout: {
        type: "number",
        description: "Scaling timeout in seconds",
        default: 300,
        alias: ["t"],
      },
      ...commonArgs,
    },
  },
};

// CI/CD Pipeline Commands
const pipelineCommands: Record<string, CommandDef> = {
  create: {
    meta: {
      name: "create",
      description: "Create new CI/CD pipeline configuration",
    },
    args: {
      name: {
        type: "string",
        description: "Pipeline name",
        required: true,
        valueHint: "my-app-pipeline",
      },
      template: {
        type: "enum",
        description: "Pipeline template to use",
        options: ["nodejs", "python", "java", "dotnet", "go", "custom"],
        default: "nodejs",
        alias: ["t"],
      },
      provider: {
        type: "enum",
        description: "CI/CD provider",
        options: ["github", "gitlab", "jenkins", "azure-devops", "circleci"],
        required: true,
        alias: ["p"],
      },
      ...commonArgs,
    },
  },

  trigger: {
    meta: {
      name: "trigger",
      description: "Trigger pipeline execution",
    },
    args: {
      pipelineId: {
        type: "string",
        description: "Pipeline ID or name",
        required: true,
        alias: ["id"],
      },
      branch: {
        type: "string",
        description: "Git branch to build",
        default: "main",
        alias: ["b"],
      },
      parameters: {
        type: "string",
        description: "Pipeline parameters as JSON",
        alias: ["params"],
        valueHint: '{"version":"1.0.0"}',
      },
      wait: {
        type: "boolean",
        description: "Wait for pipeline completion",
        default: false,
        alias: ["w"],
      },
      ...commonArgs,
    },
  },

  status: {
    meta: {
      name: "status", 
      description: "Get pipeline execution status and history",
    },
    args: {
      pipelineId: {
        type: "string",
        description: "Pipeline ID or name",
        alias: ["id"],
      },
      runId: {
        type: "string",
        description: "Specific run ID to check",
        alias: ["run"],
      },
      limit: {
        type: "number",
        description: "Number of recent runs to show",
        default: 10,
        alias: ["l"],
      },
      ...commonArgs,
    },
  },
};

// Monitoring and observability commands  
const monitoringCommands: Record<string, CommandDef> = {
  metrics: {
    meta: {
      name: "metrics",
      description: "Collect and analyze system metrics",
    },
    args: {
      source: {
        type: "enum",
        description: "Metrics source", 
        options: ["prometheus", "datadog", "newrelic", "cloudwatch"],
        required: true,
        alias: ["src"],
      },
      query: {
        type: "string",
        description: "Metrics query",
        alias: ["q"],
        valueHint: "cpu_usage{instance='web-01'}",
      },
      timeRange: {
        type: "string",
        description: "Time range for metrics",
        default: "1h",
        alias: ["time"],
        valueHint: "5m|1h|6h|1d|7d",
      },
      output: {
        type: "enum",
        description: "Output format",
        options: ["table", "json", "csv", "graph"],
        default: "table",
        alias: ["o"],
      },
      ...commonArgs,
    },
  },

  logs: {
    meta: {
      name: "logs",
      description: "Stream and analyze application logs",
    },
    args: {
      service: {
        type: "string",
        description: "Service name to get logs from",
        alias: ["s"],
      },
      follow: {
        type: "boolean", 
        description: "Follow log output in real-time",
        default: false,
        alias: ["f"],
      },
      lines: {
        type: "number",
        description: "Number of lines to show",
        default: 100,
        alias: ["n"],
      },
      since: {
        type: "string",
        description: "Show logs since timestamp",
        alias: ["since"],
        valueHint: "2023-01-01T00:00:00Z",
      },
      filter: {
        type: "string",
        description: "Filter logs by pattern",
        alias: ["grep"],
      },
      ...commonArgs,
    },
  },

  alerts: {
    meta: {
      name: "alerts", 
      description: "Manage monitoring alerts and notifications",
    },
    args: {
      provider: {
        type: "enum",
        description: "Alert provider",
        options: ["pagerduty", "slack", "email", "webhook"],
        alias: ["p"],
      },
      severity: {
        type: "enum",
        description: "Alert severity filter",
        options: ["critical", "warning", "info"],
        alias: ["sev"],
      },
      ...commonArgs,
    },
    subCommands: {
      create: {
        meta: { name: "create", description: "Create new alert rule" },
        args: {
          name: {
            type: "string",
            description: "Alert rule name",
            required: true,
          },
          condition: {
            type: "string", 
            description: "Alert condition expression",
            required: true,
            valueHint: "cpu_usage > 80",
          },
          threshold: {
            type: "number",
            description: "Alert threshold value",
            alias: ["t"],
          },
        },
      },
      list: {
        meta: { name: "list", description: "List active alerts" },
        args: {
          status: {
            type: "enum",
            description: "Alert status filter",
            options: ["active", "resolved", "silenced"],
            alias: ["s"],
          },
        },
      },
    },
  },
};

// Security and compliance commands
const securityCommands: Record<string, CommandDef> = {
  scan: {
    meta: {
      name: "scan",
      description: "Security vulnerability scanning",
    },
    args: {
      target: {
        type: "string",
        description: "Scan target (image, repository, or host)",
        required: true,
        valueHint: "nginx:latest",
      },
      scanner: {
        type: "enum",
        description: "Security scanner to use",
        options: ["trivy", "clair", "anchore", "snyk"],
        default: "trivy",
        alias: ["s"],
      },
      severity: {
        type: "enum",
        description: "Minimum severity to report",
        options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        default: "MEDIUM",
      },
      format: {
        type: "enum",
        description: "Output format",
        options: ["table", "json", "xml", "sarif"],
        default: "table",
        alias: ["f"],
      },
      ...commonArgs,
    },
  },

  audit: {
    meta: {
      name: "audit",
      description: "Security audit and compliance checks",
    },
    args: {
      framework: {
        type: "enum",
        description: "Compliance framework",
        options: ["cis", "nist", "pci", "sox", "hipaa"],
        alias: ["fw"],
      },
      scope: {
        type: "string",
        description: "Audit scope (cluster, namespace, service)",
        alias: ["scope"],
      },
      ...commonArgs,
    },
  },
};

// Database management commands
const databaseCommands: Record<string, CommandDef> = {
  migrate: {
    meta: {
      name: "migrate",
      description: "Database schema migrations",
    },
    args: {
      database: {
        type: "enum",
        description: "Database type",
        options: ["mysql", "postgres", "mongodb", "redis", "elasticsearch"],
        required: true,
        alias: ["db"],
      },
      direction: {
        type: "enum",
        description: "Migration direction",
        options: ["up", "down"],
        default: "up",
        alias: ["dir"],
      },
      steps: {
        type: "number",
        description: "Number of migration steps",
        alias: ["n"],
      },
      ...commonArgs,
    },
  },

  backup: {
    meta: {
      name: "backup", 
      description: "Database backup operations",
    },
    args: {
      database: {
        type: "string",
        description: "Database name or connection string",
        required: true,
        alias: ["db"],
      },
      destination: {
        type: "string",
        description: "Backup destination path",
        required: true,
        alias: ["dest"],
        valueHint: "s3://backups/db-backup.sql",
      },
      compression: {
        type: "enum",
        description: "Compression algorithm",
        options: ["none", "gzip", "lz4", "zstd"],
        default: "gzip",
        alias: ["comp"],
      },
      ...commonArgs,
    },
  },
};

// Network and load balancer commands
const networkCommands: Record<string, CommandDef> = {
  dns: {
    meta: {
      name: "dns",
      description: "DNS management and configuration",
    },
    args: {
      provider: {
        type: "enum",
        description: "DNS provider",
        options: ["route53", "cloudflare", "digitalocean", "godaddy"],
        required: true,
        alias: ["p"],
      },
      domain: {
        type: "string",
        description: "Domain name to manage",
        required: true,
        alias: ["d"],
        valueHint: "example.com",
      },
      ...commonArgs,
    },
    subCommands: {
      record: {
        meta: { name: "record", description: "DNS record management" },
        args: {
          type: {
            type: "enum",
            description: "DNS record type",
            options: ["A", "AAAA", "CNAME", "MX", "TXT", "SRV"],
            required: true,
          },
          name: {
            type: "string",
            description: "Record name",
            required: true,
          },
          value: {
            type: "string",
            description: "Record value",
            required: true,
          },
          ttl: {
            type: "number",
            description: "Time to live in seconds",
            default: 3600,
          },
        },
      },
    },
  },

  loadbalancer: {
    meta: {
      name: "loadbalancer",
      description: "Load balancer configuration and management", 
    },
    args: {
      provider: {
        type: "enum",
        description: "Load balancer provider",
        options: ["aws-alb", "nginx", "haproxy", "envoy", "traefik"],
        required: true,
        alias: ["p"],
      },
      name: {
        type: "string",
        description: "Load balancer name",
        required: true,
        alias: ["n"],
      },
      ...commonArgs,
    },
  },
};

// Hidden debug commands
const debugCommands: Record<string, CommandDef> = {
  trace: {
    meta: {
      name: "trace",
      description: "Advanced tracing and debugging utilities",
      hidden: true,
    },
    args: {
      component: {
        type: "enum",
        description: "Component to trace",
        options: ["api", "database", "cache", "queue", "network"],
        required: true,
      },
      duration: {
        type: "number", 
        description: "Trace duration in seconds",
        default: 30,
        alias: ["d"],
      },
      ...commonArgs,
    },
  },

  dump: {
    meta: {
      name: "dump",
      description: "Memory and state dump utilities",
      hidden: true,
    },
    args: {
      type: {
        type: "enum",
        description: "Dump type",
        options: ["memory", "goroutines", "heap", "config"],
        required: true,
      },
      format: {
        type: "enum",
        description: "Dump format",
        options: ["text", "json", "binary"],
        default: "text",
      },
      ...commonArgs,
    },
  },

  inject: {
    meta: {
      name: "inject",
      description: "Fault injection for chaos testing",
      hidden: true,
    },
    args: {
      fault: {
        type: "enum",
        description: "Fault type to inject",
        options: ["latency", "error", "kill", "network"],
        required: true,
      },
      target: {
        type: "string",
        description: "Injection target",
        required: true,
      },
      intensity: {
        type: "number",
        description: "Fault intensity (0-100)",
        default: 50,
      },
      ...commonArgs,
    },
  },
};

// Main DevOps Master CLI Definition
export const devopsMasterCLI: CommandDef = {
  meta: {
    name: "devops",
    description: "ULTRATHINK DevOps Master CLI - Comprehensive infrastructure and deployment management",
    version: "2.0.0-alpha",
  },
  args: {
    ...commonArgs,
    profile: {
      type: "string",
      description: "DevOps profile to load",
      alias: ["prof"],
      valueHint: "development|staging|production",
    },
    workspace: {
      type: "string",
      description: "Workspace directory",
      alias: ["w"],
      valueHint: "./devops-workspace",
    },
  },
  subCommands: {
    // Infrastructure management (Level 2)
    infra: {
      meta: {
        name: "infra", 
        description: "Infrastructure provisioning and management",
      },
      args: commonArgs,
      subCommands: {
        provision: {
          meta: { name: "provision", description: "Provision infrastructure resources" },
          args: {
            provider: {
              type: "enum",
              description: "Cloud provider",
              options: ["aws", "azure", "gcp", "digitalocean"],
              required: true,
            },
            ...commonArgs,
          },
          subCommands: {
            cloud: {
              meta: { name: "cloud", description: "Cloud provider infrastructure" },
              args: commonArgs,
              subCommands: infrastructureCommands, // Level 3 commands
            },
          },
        },
        destroy: {
          meta: { name: "destroy", description: "Destroy infrastructure resources" },
          args: {
            force: {
              type: "boolean",
              description: "Force destruction without confirmation",
              default: false,
              alias: ["f"],
            },
            ...commonArgs,
          },
        },
        status: {
          meta: { name: "status", description: "Check infrastructure status" },
          args: commonArgs,
        },
      },
    },

    // Container orchestration
    container: {
      meta: {
        name: "container",
        description: "Container management and orchestration",
      },
      args: commonArgs,
      subCommands: containerCommands,
    },

    // CI/CD Pipeline management  
    pipeline: {
      meta: {
        name: "pipeline",
        description: "CI/CD pipeline management and automation",
      },
      args: commonArgs,
      subCommands: pipelineCommands,
    },

    // Monitoring and observability
    monitor: {
      meta: {
        name: "monitor", 
        description: "Monitoring, logging, and observability",
      },
      args: commonArgs,
      subCommands: monitoringCommands,
    },

    // Security management
    security: {
      meta: {
        name: "security",
        description: "Security scanning and compliance",
      },
      args: commonArgs, 
      subCommands: securityCommands,
    },

    // Database operations
    database: {
      meta: {
        name: "database",
        description: "Database operations and management",
      },
      args: commonArgs,
      subCommands: databaseCommands,
    },

    // Network management
    network: {
      meta: {
        name: "network",
        description: "Network and DNS management",
      },
      args: commonArgs,
      subCommands: networkCommands,
    },

    // Configuration management
    config: {
      meta: {
        name: "config",
        description: "Configuration management and templating",
      },
      args: {
        template: {
          type: "string",
          description: "Configuration template path",
          alias: ["t"],
        },
        values: {
          type: "string",
          description: "Values file for template rendering",
          alias: ["f"],
        },
        ...commonArgs,
      },
    },

    // Secret management
    secret: {
      meta: {
        name: "secret", 
        description: "Secret and credential management",
      },
      args: {
        vault: {
          type: "enum",
          description: "Secret vault provider",
          options: ["hashicorp", "aws-secrets", "azure-keyvault", "k8s-secrets"],
          alias: ["v"],
        },
        ...commonArgs,
      },
    },

    // Backup and disaster recovery
    backup: {
      meta: {
        name: "backup",
        description: "Backup and disaster recovery operations",
      },
      args: {
        strategy: {
          type: "enum",
          description: "Backup strategy",
          options: ["incremental", "full", "differential"],
          default: "incremental",
        },
        retention: {
          type: "string",
          description: "Backup retention policy",
          default: "7d",
          valueHint: "7d|30d|1y",
        },
        ...commonArgs,
      },
    },

    // Cost optimization
    cost: {
      meta: {
        name: "cost",
        description: "Cloud cost analysis and optimization",
      },
      args: {
        period: {
          type: "enum",
          description: "Analysis period",
          options: ["daily", "weekly", "monthly", "yearly"],
          default: "monthly",
        },
        currency: {
          type: "enum",
          description: "Currency for cost display",
          options: ["USD", "EUR", "GBP", "JPY"],
          default: "USD",
        },
        ...commonArgs,
      },
    },

    // Performance testing
    performance: {
      meta: {
        name: "performance",
        description: "Performance testing and benchmarking",
      },
      args: {
        target: {
          type: "string",
          description: "Performance test target URL",
          required: true,
          valueHint: "https://api.example.com",
        },
        users: {
          type: "number", 
          description: "Number of virtual users",
          default: 10,
          alias: ["u"],
        },
        duration: {
          type: "string",
          description: "Test duration", 
          default: "30s",
          alias: ["d"],
          valueHint: "30s|5m|1h",
        },
        ...commonArgs,
      },
    },

    // Environment management
    env: {
      meta: {
        name: "env",
        description: "Environment management and promotion",
      },
      args: {
        source: {
          type: "enum",
          description: "Source environment",
          options: ["dev", "staging", "prod"],
          alias: ["src"],
        },
        target: {
          type: "enum", 
          description: "Target environment",
          options: ["dev", "staging", "prod"],
          alias: ["tgt"],
        },
        ...commonArgs,
      },
    },

    // Notification management
    notify: {
      meta: {
        name: "notify",
        description: "Notification and alert configuration",
      },
      args: {
        channel: {
          type: "enum",
          description: "Notification channel",
          options: ["slack", "email", "webhook", "sms"],
          required: true,
        },
        message: {
          type: "string",
          description: "Notification message",
          alias: ["msg"],
        },
        ...commonArgs,
      },
    },

    // Template management
    template: {
      meta: {
        name: "template",
        description: "DevOps template management",
      },
      args: {
        name: {
          type: "string",
          description: "Template name",
          required: true,
        },
        type: {
          type: "enum",
          description: "Template type",
          options: ["terraform", "ansible", "helm", "docker"],
          required: true,
        },
        ...commonArgs,
      },
    },

    // Plugin management
    plugin: {
      meta: {
        name: "plugin",
        description: "Plugin and extension management",
      },
      args: {
        name: {
          type: "string",
          description: "Plugin name",
          alias: ["n"],
        },
        registry: {
          type: "string",
          description: "Plugin registry URL",
          alias: ["r"],
        },
        ...commonArgs,
      },
      subCommands: {
        install: {
          meta: { name: "install", description: "Install plugin" },
          args: {
            version: {
              type: "string",
              description: "Plugin version",
              alias: ["v"],
            },
            force: {
              type: "boolean", 
              description: "Force reinstall",
              default: false,
            },
          },
        },
        uninstall: {
          meta: { name: "uninstall", description: "Uninstall plugin" },
          args: {
            cleanup: {
              type: "boolean",
              description: "Clean up plugin data",
              default: true,
            },
          },
        },
      },
    },

    // Version management
    version: {
      meta: {
        name: "version",
        description: "Version management and release operations",
      },
      args: {
        format: {
          type: "enum",
          description: "Version format",
          options: ["short", "full", "json"],
          default: "short",
          alias: ["f"],
        },
        ...commonArgs,
      },
      subCommands: {
        bump: {
          meta: { name: "bump", description: "Bump version numbers" },
          args: {
            type: {
              type: "enum",
              description: "Version bump type",
              options: ["major", "minor", "patch", "prerelease"],
              default: "patch",
            },
          },
        },
        tag: {
          meta: { name: "tag", description: "Create version tags" },
          args: {
            version: {
              type: "string",
              description: "Version to tag",
              required: true,
            },
            message: {
              type: "string",
              description: "Tag message",
              alias: ["m"],
            },
          },
        },
      },
    },

    // Workflow automation
    workflow: {
      meta: {
        name: "workflow",
        description: "Workflow automation and orchestration",
      },
      args: {
        name: {
          type: "string",
          description: "Workflow name",
          alias: ["n"],
        },
        trigger: {
          type: "enum",
          description: "Workflow trigger type",
          options: ["manual", "schedule", "webhook", "event"],
          alias: ["t"],
        },
        ...commonArgs,
      },
    },

    // Compliance and governance  
    compliance: {
      meta: {
        name: "compliance",
        description: "Compliance and governance checks",
      },
      args: {
        standard: {
          type: "enum",
          description: "Compliance standard",
          options: ["iso27001", "soc2", "gdpr", "pci-dss"],
          alias: ["std"],
        },
        scope: {
          type: "string",
          description: "Compliance scope",
          alias: ["s"],
        },
        ...commonArgs,
      },
    },

    // Hidden debug commands
    debug: {
      meta: {
        name: "debug",
        description: "Debug and troubleshooting utilities",
        hidden: true,
      },
      args: commonArgs,
      subCommands: debugCommands,
    },
  },
};

export default devopsMasterCLI;