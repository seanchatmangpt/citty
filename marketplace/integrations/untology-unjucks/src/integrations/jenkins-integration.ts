import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { join } from 'path';
import { PipelineConfig, GenerationJob } from '../types.js';
import { PipelineCoordinator } from '../pipeline/coordinator.js';

export class JenkinsIntegration extends EventEmitter {
  private coordinator: PipelineCoordinator;

  constructor() {
    super();
    this.coordinator = new PipelineCoordinator();
  }

  // Generate Jenkins Declarative Pipeline
  async generateDeclarativePipeline(
    config: PipelineConfig,
    options: {
      nodeVersion?: string;
      agentLabel?: string;
      parallel?: boolean;
      notifications?: {
        email?: string[];
        slack?: string;
      };
    } = {}
  ): Promise<string> {
    const {
      nodeVersion = '18',
      agentLabel = 'any',
      parallel = true,
      notifications = {},
    } = options;

    const stages = this.generateStages(config, parallel);
    const postActions = this.generatePostActions(notifications);

    return `pipeline {
    agent ${agentLabel === 'any' ? 'any' : `{ label '${agentLabel}' }`}
    
    environment {
        NODE_VERSION = '${nodeVersion}'
        UNJUCKS_WORKERS = '${config.hiveQueen?.workers || 4}'
        UNJUCKS_OUTPUT_DIR = '${config.output.directory}'
    }
    
    tools {
        nodejs 'NodeJS-${nodeVersion}'
    }
    
    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
        timestamps()
    }
    
    parameters {
        choice(
            name: 'ENVIRONMENT',
            choices: ['development', 'staging', 'production'],
            description: 'Deployment environment'
        )
        booleanParam(
            name: 'FORCE_REGENERATION',
            defaultValue: false,
            description: 'Force regeneration even if no changes detected'
        )
        string(
            name: 'CUSTOM_WORKERS',
            defaultValue: '${config.hiveQueen?.workers || 4}',
            description: 'Number of parallel workers'
        )
    }
    
    ${stages}
    
    ${postActions}
}`;
  }

  private generateStages(config: PipelineConfig, parallel: boolean): string {
    const stages = [
      this.generateCheckoutStage(),
      this.generateSetupStage(),
      this.generateValidationStage(config),
    ];

    if (parallel) {
      stages.push(this.generateParallelGenerationStage(config));
    } else {
      stages.push(this.generateSequentialGenerationStage(config));
    }

    stages.push(
      this.generateQualityStage(config),
      this.generateArchiveStage(config)
    );

    return `stages {
${stages.join('\n        ')}
    }`;
  }

  private generateCheckoutStage(): string {
    return `stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()
                }
            }
        }`;
  }

  private generateSetupStage(): string {
    return `stage('Setup') {
            steps {
                sh 'npm ci --prefer-offline'
                sh 'npm install -g @citty-pro/untology-unjucks'
                
                // Create output directory
                sh 'mkdir -p $UNJUCKS_OUTPUT_DIR'
                
                // Verify installation
                sh 'unjucks --version'
            }
        }`;
  }

  private generateValidationStage(config: PipelineConfig): string {
    return `stage('Validate') {
            parallel {
                stage('Config Validation') {
                    steps {
                        sh 'unjucks validate --config ./unjucks.config.yaml${config.validation?.strict ? ' --strict' : ''}'
                    }
                }
                
                stage('Ontology Validation') {
                    steps {
                        script {
                            def ontologyFiles = sh(
                                script: 'find . -name "*.ttl" -o -name "*.n3" -o -name "*.rdf" | head -10',
                                returnStdout: true
                            ).trim().split('\n')
                            
                            for (file in ontologyFiles) {
                                if (file.trim()) {
                                    echo "Validating ontology: \${file}"
                                    // Add ontology-specific validation here
                                }
                            }
                        }
                    }
                }
                
                stage('Template Validation') {
                    steps {
                        sh 'find templates -name "*.njk" -exec echo "Validating template: {}" \\;'
                        // Add template-specific validation
                    }
                }
            }
        }`;
  }

  private generateParallelGenerationStage(config: PipelineConfig): string {
    return `stage('Generate Artifacts') {
            parallel {
                stage('Core Generation') {
                    steps {
                        sh '''
                            export UNJUCKS_WORKERS=\${params.CUSTOM_WORKERS}
                            unjucks sync --config ./unjucks.config.yaml
                        '''
                    }
                    post {
                        always {
                            publishHTML([
                                allowMissing: false,
                                alwaysLinkToLastBuild: true,
                                keepAll: true,
                                reportDir: '${config.output.directory}',
                                reportFiles: '**/*.html',
                                reportName: 'Generated Artifacts'
                            ])
                        }
                    }
                }
                
                stage('Metrics Collection') {
                    steps {
                        script {
                            sh 'echo "Collecting generation metrics..."'
                            // Add metrics collection logic
                        }
                    }
                }
            }
        }`;
  }

  private generateSequentialGenerationStage(config: PipelineConfig): string {
    return `stage('Generate Artifacts') {
            steps {
                sh '''
                    export UNJUCKS_WORKERS=\${params.CUSTOM_WORKERS}
                    unjucks sync --config ./unjucks.config.yaml
                '''
                
                // Collect metrics
                script {
                    def generatedFiles = sh(
                        script: "find ${config.output.directory} -type f | wc -l",
                        returnStdout: true
                    ).trim()
                    
                    currentBuild.displayName = "#\${env.BUILD_NUMBER} - \${generatedFiles} files"
                }
            }
        }`;
  }

  private generateQualityStage(config: PipelineConfig): string {
    return `stage('Quality Checks') {
            parallel {
                stage('Generated Code Lint') {
                    when {
                        anyOf {
                            changeset "**/*.ttl"
                            changeset "**/*.n3"
                            changeset "templates/**/*"
                            params.FORCE_REGENERATION
                        }
                    }
                    steps {
                        script {
                            def codeFiles = sh(
                                script: "find ${config.output.directory} -name '*.js' -o -name '*.ts' -o -name '*.py'",
                                returnStdout: true
                            ).trim()
                            
                            if (codeFiles) {
                                sh "echo '\${codeFiles}' | xargs eslint --format junit > eslint-results.xml || true"
                            }
                        }
                    }
                    post {
                        always {
                            junit allowEmptyResults: true, testResults: 'eslint-results.xml'
                        }
                    }
                }
                
                stage('Documentation Check') {
                    steps {
                        sh """
                            find ${config.output.directory} -name '*.md' -exec echo 'Checking: {}' \\;
                            # Add documentation validation logic
                        """
                    }
                }
                
                stage('Size Analysis') {
                    steps {
                        script {
                            def outputSize = sh(
                                script: "du -sh ${config.output.directory} | cut -f1",
                                returnStdout: true
                            ).trim()
                            
                            echo "Generated artifacts size: \${outputSize}"
                            
                            // Warn if output is very large
                            def sizeBytes = sh(
                                script: "du -s ${config.output.directory} | cut -f1",
                                returnStdout: true
                            ).trim() as Long
                            
                            if (sizeBytes > 100000) { // > 100MB
                                currentBuild.result = 'UNSTABLE'
                                echo "WARNING: Generated artifacts are very large (\${outputSize})"
                            }
                        }
                    }
                }
            }
        }`;
  }

  private generateArchiveStage(config: PipelineConfig): string {
    return `stage('Archive') {
            steps {
                archiveArtifacts(
                    artifacts: '${config.output.directory}/**/*',
                    allowEmptyArchive: false,
                    fingerprint: true
                )
                
                // Create deployment package
                sh """
                    tar -czf artifacts-\${env.BUILD_NUMBER}-\${env.GIT_COMMIT_SHORT}.tar.gz \\
                        ${config.output.directory}
                """
                
                archiveArtifacts(
                    artifacts: 'artifacts-*.tar.gz',
                    fingerprint: true
                )
            }
        }`;
  }

  private generatePostActions(notifications: any): string {
    const emailNotifications = notifications.email
      ? `emailext (
                subject: "Unjucks Pipeline: \${env.JOB_NAME} - \${env.BUILD_NUMBER}",
                body: """
                Build: \${env.BUILD_URL}
                Result: \${currentBuild.result}
                Duration: \${currentBuild.durationString}
                Changes: \${env.CHANGE_LOG}
                """,
                to: "${notifications.email.join(',')}"
            )`
      : '';

    const slackNotifications = notifications.slack
      ? `slackSend(
                channel: '${notifications.slack}',
                message: "Unjucks Pipeline \${currentBuild.result}: \${env.JOB_NAME} #\${env.BUILD_NUMBER} - \${env.BUILD_URL}"
            )`
      : '';

    return `post {
        always {
            cleanWs()
        }
        
        success {
            echo 'Pipeline completed successfully!'
            ${slackNotifications}
        }
        
        failure {
            echo 'Pipeline failed!'
            ${emailNotifications}
            ${slackNotifications}
        }
        
        unstable {
            echo 'Pipeline completed with warnings'
            ${notifications.email ? emailNotifications : ''}
        }
    }`;
  }

  // Generate Jenkins Shared Library
  async generateSharedLibrary(): Promise<{ [filename: string]: string }> {
    return {
      'vars/unjucksPipeline.groovy': `def call(Map config) {
    pipeline {
        agent any
        
        environment {
            UNJUCKS_CONFIG = config.configFile ?: './unjucks.config.yaml'
            UNJUCKS_WORKERS = config.workers ?: '4'
        }
        
        stages {
            stage('Validate') {
                steps {
                    unjucksValidate(config)
                }
            }
            
            stage('Generate') {
                steps {
                    unjucksGenerate(config)
                }
            }
            
            stage('Test') {
                when {
                    expression { config.runTests ?: false }
                }
                steps {
                    unjucksTest(config)
                }
            }
            
            stage('Deploy') {
                when {
                    branch 'main'
                }
                steps {
                    unjucksDeploy(config)
                }
            }
        }
        
        post {
            always {
                unjucksCleanup()
            }
        }
    }
}`,

      'vars/unjucksValidate.groovy': `def call(Map config) {
    sh """
        npm install -g @citty-pro/untology-unjucks
        unjucks validate --config \${env.UNJUCKS_CONFIG} ${
          config.strict ? '--strict' : ''
        }
    """
}`,

      'vars/unjucksGenerate.groovy': `def call(Map config) {
    sh """
        unjucks sync --config \${env.UNJUCKS_CONFIG} --workers \${env.UNJUCKS_WORKERS}
    """
    
    if (config.archiveArtifacts) {
        archiveArtifacts(
            artifacts: config.outputDir + '/**/*',
            allowEmptyArchive: false,
            fingerprint: true
        )
    }
}`,

      'vars/unjucksTest.groovy': `def call(Map config) {
    if (config.testCommand) {
        sh config.testCommand
    } else {
        echo 'No test command specified'
    }
}`,

      'vars/unjucksDeploy.groovy': `def call(Map config) {
    if (config.deployScript) {
        sh config.deployScript
    } else if (config.deployCommand) {
        sh config.deployCommand
    } else {
        echo 'No deployment configuration specified'
    }
}`,

      'vars/unjucksCleanup.groovy': `def call() {
    sh '''
        # Clean up temporary files
        rm -f *.log
        rm -rf .unjucks-cache
    '''
}`,
    };
  }

  // Generate Blue Ocean compatible pipeline
  async generateBlueOceanPipeline(config: PipelineConfig): Promise<string> {
    return `{
  "pipeline": {
    "agent": {
      "type": "any"
    },
    "environment": {
      "NODE_VERSION": "18",
      "UNJUCKS_WORKERS": "${config.hiveQueen?.workers || 4}"
    },
    "stages": [
      {
        "name": "Checkout",
        "steps": [
          {
            "type": "checkout",
            "scm": "git"
          }
        ]
      },
      {
        "name": "Setup",
        "steps": [
          {
            "type": "sh",
            "command": "npm ci"
          },
          {
            "type": "sh",
            "command": "npm install -g @citty-pro/untology-unjucks"
          }
        ]
      },
      {
        "name": "Validate",
        "steps": [
          {
            "type": "sh",
            "command": "unjucks validate --config ./unjucks.config.yaml${config.validation?.strict ? ' --strict' : ''}"
          }
        ]
      },
      {
        "name": "Generate",
        "steps": [
          {
            "type": "sh",
            "command": "unjucks sync --config ./unjucks.config.yaml --workers $UNJUCKS_WORKERS"
          }
        ]
      },
      {
        "name": "Archive",
        "steps": [
          {
            "type": "archiveArtifacts",
            "artifacts": "${config.output.directory}/**/*",
            "fingerprint": true
          }
        ]
      }
    ],
    "post": {
      "always": [
        {
          "type": "cleanWs"
        }
      ]
    }
  }
}`;
  }

  // Setup Jenkins integration files
  async setupJenkinsIntegration(
    projectPath: string,
    config: PipelineConfig,
    options: {
      pipelineType?: 'declarative' | 'scripted' | 'shared-library';
      parallel?: boolean;
      notifications?: {
        email?: string[];
        slack?: string;
      };
    } = {}
  ): Promise<void> {
    const {
      pipelineType = 'declarative',
      parallel = true,
      notifications = {},
    } = options;

    if (pipelineType === 'declarative') {
      const pipeline = await this.generateDeclarativePipeline(config, {
        parallel,
        notifications,
      });
      
      await fs.writeFile(
        join(projectPath, 'Jenkinsfile'),
        pipeline,
        'utf-8'
      );
    } else if (pipelineType === 'shared-library') {
      const library = await this.generateSharedLibrary();
      
      for (const [filename, content] of Object.entries(library)) {
        const filePath = join(projectPath, 'jenkins-shared-library', filename);
        await fs.mkdir(join(projectPath, 'jenkins-shared-library', 'vars'), { recursive: true });
        await fs.writeFile(filePath, content, 'utf-8');
      }

      // Generate example usage
      const exampleJenkinsfile = `@Library('unjucks-shared-library') _

unjucksPipeline([
    configFile: './unjucks.config.yaml',
    workers: ${config.hiveQueen?.workers || 4},
    strict: ${config.validation?.strict || false},
    runTests: true,
    archiveArtifacts: true,
    outputDir: '${config.output.directory}',
    deployScript: './deploy.sh'
])`;

      await fs.writeFile(
        join(projectPath, 'Jenkinsfile.example'),
        exampleJenkinsfile,
        'utf-8'
      );
    }

    // Generate Jenkins configuration as code (JCasC)
    const jcasc = this.generateJenkinsAsCode(config);
    await fs.writeFile(
      join(projectPath, 'jenkins.yaml'),
      jcasc,
      'utf-8'
    );
  }

  private generateJenkinsAsCode(config: PipelineConfig): string {
    return `jenkins:
  systemMessage: "Unjucks Pipeline Jenkins Controller"
  
  globalNodeProperties:
    - envVars:
        env:
          - key: "UNJUCKS_DEFAULT_WORKERS"
            value: "${config.hiveQueen?.workers || 4}"
          - key: "UNJUCKS_OUTPUT_DIR"
            value: "${config.output.directory}"

jobs:
  - script: |
      multibranchPipelineJob('unjucks-pipeline') {
          displayName('Unjucks Pipeline')
          description('Automated ontology to template generation pipeline')
          
          branchSources {
              git {
                  remote('https://github.com/your-org/your-repo.git')
                  credentialsId('github-credentials')
              }
          }
          
          factory {
              workflowBranchProjectFactory {
                  scriptPath('Jenkinsfile')
              }
          }
          
          triggers {
              cron('@daily')
          }
      }

credentials:
  system:
    domainCredentials:
      - credentials:
          - usernamePassword:
              scope: GLOBAL
              id: "github-credentials"
              username: "\${GITHUB_USERNAME}"
              password: "\${GITHUB_TOKEN}"
              description: "GitHub credentials for repository access"

tool:
  nodejs:
    installations:
      - name: "NodeJS-18"
        properties:
          - installSource:
              installers:
                - nodeJSInstaller:
                    id: "18.17.0"
                    npmPackagesRefreshHours: 72`;
  }

  // Handle Jenkins webhook events
  async handleWebhook(payload: any, config: PipelineConfig): Promise<GenerationJob | null> {
    // Jenkins webhook payload structure varies by trigger
    // This is a simplified example
    
    if (payload.build && payload.build.phase === 'STARTED') {
      this.emit('webhook:build-started', payload);
      
      // Trigger pipeline execution
      return await this.coordinator.executeJob(config);
    }

    if (payload.build && payload.build.phase === 'COMPLETED') {
      this.emit('webhook:build-completed', payload);
    }

    return null;
  }
}