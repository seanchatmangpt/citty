import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { resolve, join } from 'path';
import { PipelineCoordinator } from '../pipeline/coordinator.js';
import { ConfigManager } from '../config/config-manager.js';
import { PipelineConfig, GenerationJob } from '../types.js';

export class GitHubIntegration extends EventEmitter {
  private coordinator: PipelineCoordinator;
  private configManager: ConfigManager;

  constructor() {
    super();
    this.coordinator = new PipelineCoordinator();
    this.configManager = new ConfigManager();
  }

  // GitHub Actions Integration
  async generateGitHubAction(
    config: PipelineConfig,
    options: {
      trigger?: 'push' | 'pull_request' | 'schedule' | 'workflow_dispatch';
      branches?: string[];
      schedule?: string;
      nodeVersion?: string;
    } = {}
  ): Promise<string> {
    const {
      trigger = 'push',
      branches = ['main', 'develop'],
      schedule = '0 2 * * *', // Daily at 2 AM
      nodeVersion = '18',
    } = options;

    const action = {
      name: 'Unjucks Pipeline',
      
      on: this.generateTriggerConfig(trigger, branches, schedule),
      
      jobs: {
        'generate-artifacts': {
          'runs-on': 'ubuntu-latest',
          
          steps: [
            {
              name: 'Checkout code',
              uses: 'actions/checkout@v4',
            },
            {
              name: 'Setup Node.js',
              uses: 'actions/setup-node@v4',
              with: {
                'node-version': nodeVersion,
                cache: 'npm',
              },
            },
            {
              name: 'Install dependencies',
              run: 'npm ci',
            },
            {
              name: 'Install Unjucks',
              run: 'npm install -g @citty-pro/untology-unjucks',
            },
            {
              name: 'Validate configuration',
              run: 'unjucks validate --config ./unjucks.config.yaml',
            },
            {
              name: 'Generate artifacts',
              run: `unjucks sync --config ./unjucks.config.yaml --workers ${config.hiveQueen?.workers || 4}`,
            },
            {
              name: 'Check for changes',
              id: 'changes',
              run: [
                'git add -A',
                'if git diff --staged --quiet; then',
                '  echo "changed=false" >> $GITHUB_OUTPUT',
                'else',
                '  echo "changed=true" >> $GITHUB_OUTPUT',
                'fi',
              ].join('\n'),
            },
            {
              name: 'Commit and push changes',
              if: "steps.changes.outputs.changed == 'true'",
              run: [
                'git config --local user.email "action@github.com"',
                'git config --local user.name "GitHub Action"',
                'git commit -m "chore: update generated artifacts [skip ci]"',
                'git push',
              ].join('\n'),
            },
          ],
        },
      },
    };

    // Add artifact upload for generated files
    if (config.output.directory !== './') {
      action.jobs['generate-artifacts'].steps.push({
        name: 'Upload generated artifacts',
        uses: 'actions/upload-artifact@v4',
        with: {
          name: 'generated-artifacts',
          path: config.output.directory,
          'retention-days': 30,
        },
      });
    }

    return this.yamlStringify(action);
  }

  private generateTriggerConfig(
    trigger: string,
    branches: string[],
    schedule: string
  ): any {
    const triggerConfig: any = {};

    if (trigger === 'push') {
      triggerConfig.push = {
        branches,
        paths: ['**/*.ttl', '**/*.n3', '**/*.rdf', 'templates/**/*'],
      };
    } else if (trigger === 'pull_request') {
      triggerConfig.pull_request = {
        branches,
        paths: ['**/*.ttl', '**/*.n3', '**/*.rdf', 'templates/**/*'],
      };
    } else if (trigger === 'schedule') {
      triggerConfig.schedule = [{ cron: schedule }];
    } else if (trigger === 'workflow_dispatch') {
      triggerConfig.workflow_dispatch = {
        inputs: {
          workers: {
            description: 'Number of parallel workers',
            required: false,
            default: '4',
          },
          strict: {
            description: 'Enable strict validation',
            required: false,
            type: 'boolean',
            default: false,
          },
        },
      };
    }

    return triggerConfig;
  }

  // Pre-commit Hook Integration
  async generatePreCommitHook(config: PipelineConfig): Promise<string> {
    return `#!/bin/sh
# Unjucks pre-commit hook
# Validates ontologies and regenerates artifacts if needed

set -e

echo "Running Unjucks validation..."
unjucks validate --config ./unjucks.config.yaml

# Check if ontology or template files are being committed
ontology_files=$(git diff --cached --name-only | grep -E "\\.(ttl|n3|rdf|owl)$" || true)
template_files=$(git diff --cached --name-only | grep -E "templates/.*\\.(njk|html|js|ts)$" || true)

if [ -n "$ontology_files" ] || [ -n "$template_files" ]; then
    echo "Ontology or template files modified. Regenerating artifacts..."
    unjucks sync --config ./unjucks.config.yaml --workers ${config.hiveQueen?.workers || 4}
    
    # Add generated files to commit
    git add ${config.output.directory}
    
    echo "Artifacts regenerated and added to commit."
fi

echo "Pre-commit validation passed."
`;
  }

  // Jenkins Pipeline Integration
  async generateJenkinsfile(config: PipelineConfig): Promise<string> {
    return `pipeline {
    agent any
    
    environment {
        NODE_VERSION = '18'
        UNJUCKS_WORKERS = '${config.hiveQueen?.workers || 4}'
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Setup') {
            steps {
                sh 'nvm use $NODE_VERSION'
                sh 'npm ci'
                sh 'npm install -g @citty-pro/untology-unjucks'
            }
        }
        
        stage('Validate') {
            steps {
                sh 'unjucks validate --config ./unjucks.config.yaml'
            }
        }
        
        stage('Generate') {
            steps {
                sh 'unjucks sync --config ./unjucks.config.yaml --workers $UNJUCKS_WORKERS'
            }
            post {
                always {
                    archiveArtifacts artifacts: '${config.output.directory}/**/*', fingerprint: true
                }
            }
        }
        
        stage('Quality Check') {
            parallel {
                stage('Lint Generated Code') {
                    when {
                        anyOf {
                            changeset "**/*.ttl"
                            changeset "**/*.n3" 
                            changeset "templates/**/*"
                        }
                    }
                    steps {
                        sh 'find ${config.output.directory} -name "*.js" -o -name "*.ts" | xargs eslint || true'
                    }
                }
                
                stage('Test Generated Code') {
                    when {
                        anyOf {
                            changeset "**/*.ttl"
                            changeset "**/*.n3"
                            changeset "templates/**/*"
                        }
                    }
                    steps {
                        sh 'npm test || true'
                    }
                }
            }
        }
    }
    
    post {
        always {
            publishHTML([
                allowMissing: false,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: '${config.output.directory}',
                reportFiles: 'index.html',
                reportName: 'Generated Artifacts'
            ])
        }
        
        failure {
            emailext (
                subject: "Unjucks Pipeline Failed: \${env.JOB_NAME} - \${env.BUILD_NUMBER}",
                body: "The Unjucks pipeline has failed. Please check the build logs.",
                to: "\${env.CHANGE_AUTHOR_EMAIL}"
            )
        }
    }
}`;
  }

  // Dockerfile for containerized execution
  async generateDockerfile(config: PipelineConfig): Promise<string> {
    return `FROM node:18-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache git

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Install Unjucks globally
RUN npm install -g @citty-pro/untology-unjucks

# Copy configuration and source files
COPY unjucks.config.yaml ./
COPY ontologies/ ./ontologies/
COPY templates/ ./templates/

# Create output directory
RUN mkdir -p ${config.output.directory}

# Set environment variables
ENV UNJUCKS_WORKERS=${config.hiveQueen?.workers || 4}
ENV NODE_ENV=production

# Run pipeline
CMD ["unjucks", "sync", "--config", "./unjucks.config.yaml"]
`;
  }

  // Docker Compose for development
  async generateDockerCompose(config: PipelineConfig): Promise<string> {
    return `version: '3.8'

services:
  unjucks:
    build: .
    volumes:
      - ./ontologies:/app/ontologies:ro
      - ./templates:/app/templates:ro
      - ./${config.output.directory}:/app/${config.output.directory}
      - ./unjucks.config.yaml:/app/unjucks.config.yaml:ro
    environment:
      - UNJUCKS_WORKERS=${config.hiveQueen?.workers || 4}
      - NODE_ENV=development
    command: unjucks watch --config ./unjucks.config.yaml
    
  validator:
    build: .
    volumes:
      - ./ontologies:/app/ontologies:ro
      - ./templates:/app/templates:ro
      - ./unjucks.config.yaml:/app/unjucks.config.yaml:ro
    command: unjucks validate --config ./unjucks.config.yaml --strict
    profiles:
      - validation
`;
  }

  // Setup methods for easy integration
  async setupGitHubIntegration(
    projectPath: string,
    config: PipelineConfig,
    options: {
      includeAction?: boolean;
      includePreCommit?: boolean;
      actionTrigger?: 'push' | 'pull_request' | 'schedule' | 'workflow_dispatch';
    } = {}
  ): Promise<void> {
    const {
      includeAction = true,
      includePreCommit = true,
      actionTrigger = 'push',
    } = options;

    if (includeAction) {
      const workflowsDir = join(projectPath, '.github', 'workflows');
      await fs.mkdir(workflowsDir, { recursive: true });
      
      const actionContent = await this.generateGitHubAction(config, {
        trigger: actionTrigger,
      });
      
      await fs.writeFile(
        join(workflowsDir, 'unjucks-pipeline.yml'),
        actionContent,
        'utf-8'
      );
    }

    if (includePreCommit) {
      const hooksDir = join(projectPath, '.git', 'hooks');
      const hookContent = await this.generatePreCommitHook(config);
      const hookPath = join(hooksDir, 'pre-commit');
      
      await fs.writeFile(hookPath, hookContent, 'utf-8');
      await fs.chmod(hookPath, '755'); // Make executable
    }
  }

  async setupJenkinsIntegration(
    projectPath: string,
    config: PipelineConfig
  ): Promise<void> {
    const jenkinsfile = await this.generateJenkinsfile(config);
    await fs.writeFile(
      join(projectPath, 'Jenkinsfile'),
      jenkinsfile,
      'utf-8'
    );
  }

  async setupDockerIntegration(
    projectPath: string,
    config: PipelineConfig,
    options: {
      includeCompose?: boolean;
    } = {}
  ): Promise<void> {
    const dockerfile = await this.generateDockerfile(config);
    await fs.writeFile(
      join(projectPath, 'Dockerfile'),
      dockerfile,
      'utf-8'
    );

    if (options.includeCompose) {
      const compose = await this.generateDockerCompose(config);
      await fs.writeFile(
        join(projectPath, 'docker-compose.yml'),
        compose,
        'utf-8'
      );
    }
  }

  // Webhook handler for GitHub events
  async handleWebhook(
    payload: any,
    config: PipelineConfig
  ): Promise<GenerationJob | null> {
    const { action, pull_request, repository } = payload;

    // Handle pull request events
    if (pull_request && ['opened', 'synchronize', 'reopened'].includes(action)) {
      // Check if ontology or template files were changed
      const changedFiles = payload.pull_request.changed_files || [];
      const relevantChanges = changedFiles.some((file: string) =>
        file.match(/\.(ttl|n3|rdf|owl|njk|html)$/)
      );

      if (relevantChanges) {
        this.emit('webhook:trigger', {
          type: 'pull_request',
          number: pull_request.number,
          repository: repository.full_name,
        });

        return await this.coordinator.executeJob(config);
      }
    }

    // Handle push events
    if (payload.ref && payload.commits) {
      const changedFiles = payload.commits.flatMap((commit: any) =>
        [...commit.added, ...commit.modified]
      );

      const relevantChanges = changedFiles.some((file: string) =>
        file.match(/\.(ttl|n3|rdf|owl|njk|html)$/)
      );

      if (relevantChanges) {
        this.emit('webhook:trigger', {
          type: 'push',
          ref: payload.ref,
          repository: repository.full_name,
        });

        return await this.coordinator.executeJob(config);
      }
    }

    return null;
  }

  private yamlStringify(obj: any): string {
    // Simple YAML stringifier - in production, use a proper YAML library
    return JSON.stringify(obj, null, 2)
      .replace(/"/g, '')
      .replace(/,$/gm, '')
      .replace(/^(\s*)-\s*/gm, '$1- ');
  }
}