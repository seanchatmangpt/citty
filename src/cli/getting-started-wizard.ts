/**
 * Getting Started Wizard
 * Interactive wizard for setting up Citty projects with best practices
 */

import { defineCommand } from 'citty';
import prompts from 'prompts';
import { consola } from 'consola';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { join } from 'pathe';
import { initTemplates, type TemplateId } from '../templates/init-templates';
import { colors } from 'consola/utils';

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  prompts: prompts.PromptObject[];
  validate?: (answers: any) => Promise<boolean | string> | boolean | string;
  skip?: (answers: any) => boolean;
}

export interface ProjectSetup {
  name: string;
  description: string;
  template: TemplateId;
  features: string[];
  packageManager: 'npm' | 'pnpm' | 'yarn';
  typescript: boolean;
  testing: boolean;
  git: boolean;
  directory: string;
}

/**
 * Getting Started Wizard Steps
 */
export const wizardSteps: WizardStep[] = [
  {
    id: 'project-info',
    title: 'Project Information',
    description: 'Tell us about your new CLI project',
    prompts: [
      {
        type: 'text',
        name: 'name',
        message: 'What\'s your project name?',
        initial: 'my-awesome-cli',
        validate: (value: string) => {
          if (!value) return 'Project name is required';
          if (!/^[a-z0-9-]+$/.test(value)) {
            return 'Project name must contain only lowercase letters, numbers, and hyphens';
          }
          return true;
        }
      },
      {
        type: 'text',
        name: 'description',
        message: 'Project description:',
        initial: 'An awesome CLI built with Citty'
      },
      {
        type: 'text',
        name: 'directory',
        message: 'Where should we create your project?',
        initial: (prev: string) => `./${prev}`,
        validate: (value: string) => {
          if (!value) return 'Directory is required';
          return true;
        }
      }
    ]
  },
  {
    id: 'template-selection',
    title: 'Template Selection',
    description: 'Choose a starter template that best fits your needs',
    prompts: [
      {
        type: 'select',
        name: 'template',
        message: 'Which template would you like to use?',
        choices: [
          {
            title: 'Basic CLI',
            description: 'Simple command-line interface with basic commands',
            value: 'basic-cli'
          },
          {
            title: 'REST API CLI',
            description: 'CLI for managing REST API servers with H3',
            value: 'rest-api'
          },
          {
            title: 'Plugin System',
            description: 'Extensible CLI with plugin architecture',
            value: 'plugin-system'
          }
        ]
      }
    ]
  },
  {
    id: 'features',
    title: 'Feature Selection',
    description: 'Select additional features for your project',
    prompts: [
      {
        type: 'multiselect',
        name: 'features',
        message: 'Which features would you like to include?',
        choices: [
          { title: 'TypeScript Support', value: 'typescript', selected: true },
          { title: 'Testing with Vitest', value: 'testing', selected: true },
          { title: 'Git Repository', value: 'git', selected: true },
          { title: 'GitHub Actions CI/CD', value: 'github-actions' },
          { title: 'ESLint Configuration', value: 'eslint' },
          { title: 'Prettier Configuration', value: 'prettier' },
          { title: 'Documentation with VitePress', value: 'docs' },
          { title: 'Docker Configuration', value: 'docker' },
          { title: 'UnJS Integration', value: 'unjs-integration' },
          { title: 'Debug Tools', value: 'debug-tools' }
        ]
      }
    ]
  },
  {
    id: 'package-manager',
    title: 'Package Manager',
    description: 'Choose your preferred package manager',
    prompts: [
      {
        type: 'select',
        name: 'packageManager',
        message: 'Which package manager do you prefer?',
        choices: [
          { title: 'pnpm (recommended)', value: 'pnpm' },
          { title: 'npm', value: 'npm' },
          { title: 'yarn', value: 'yarn' }
        ],
        initial: 0
      }
    ]
  }
];

/**
 * Interactive Setup Wizard
 */
export class SetupWizard {
  private answers: Partial<ProjectSetup> = {};
  
  async run(): Promise<ProjectSetup> {
    consola.start('Welcome to Citty CLI Setup Wizard!');
    console.log('\nLet\'s create your new CLI project step by step.\n');
    
    for (const step of wizardSteps) {
      await this.runStep(step);
    }
    
    return this.answers as ProjectSetup;
  }
  
  private async runStep(step: WizardStep) {
    // Check if step should be skipped
    if (step.skip && step.skip(this.answers)) {
      return;
    }
    
    console.log(`\n${colors.bold(colors.cyan(step.title))}`);
    if (step.description) {
      console.log(colors.dim(step.description));
    }
    console.log();
    
    const stepAnswers = await prompts(step.prompts, {
      onCancel: () => {
        consola.error('Setup cancelled');
        process.exit(1);
      }
    });
    
    // Validate step if validator exists
    if (step.validate) {
      const validation = await step.validate(stepAnswers);
      if (validation !== true) {
        consola.error(typeof validation === 'string' ? validation : 'Validation failed');
        return this.runStep(step); // Retry step
      }
    }
    
    // Merge answers
    Object.assign(this.answers, stepAnswers);
  }
}

/**
 * Project Generator
 */
export class ProjectGenerator {
  constructor(private setup: ProjectSetup) {}
  
  async generate(): Promise<void> {
    const { name, directory, template, features } = this.setup;
    
    consola.info(`Creating project: ${name}`);
    consola.info(`Template: ${template}`);
    consola.info(`Directory: ${directory}`);
    
    // Create project directory
    await mkdir(directory, { recursive: true });
    
    // Generate from template
    await this.generateFromTemplate();
    
    // Add selected features
    await this.addFeatures();
    
    // Initialize package manager
    await this.initializePackageManager();
    
    // Initialize git if selected
    if (features.includes('git')) {
      await this.initializeGit();
    }
    
    consola.success('Project created successfully!');
    this.showNextSteps();
  }
  
  private async generateFromTemplate(): Promise<void> {
    const template = initTemplates[this.setup.template];
    
    consola.start('Generating files from template...');
    
    for (const file of template.files) {
      const filePath = join(this.setup.directory, file.path);
      const fileDir = join(filePath, '..');
      
      // Create directory if it doesn't exist
      await mkdir(fileDir, { recursive: true });
      
      let content = file.content;
      
      // Process template variables
      if (file.template) {
        content = this.processTemplate(content);
      }
      
      await writeFile(filePath, content);
    }
    
    // Generate package.json with dependencies
    await this.generatePackageJson(template);
    
    consola.success('Template files generated');
  }
  
  private async generatePackageJson(template: any): Promise<void> {
    const packageJsonPath = join(this.setup.directory, 'package.json');
    
    // Check if package.json already exists from template
    let packageJson: any;
    try {
      const existing = await readFile(packageJsonPath, 'utf-8');
      packageJson = JSON.parse(this.processTemplate(existing));
    } catch {
      // Create new package.json
      packageJson = {
        name: this.setup.name,
        version: '0.1.0',
        description: this.setup.description,
        type: 'module',
        main: './dist/main.mjs',
        bin: {
          [this.setup.name]: './dist/main.mjs'
        },
        files: ['dist'],
        scripts: {},
        keywords: ['cli', 'citty'],
        author: '',
        license: 'MIT'
      };
    }
    
    // Add template dependencies
    packageJson.dependencies = {
      ...packageJson.dependencies,
      ...template.dependencies.reduce((acc: any, dep: string) => {
        acc[dep] = 'latest';
        return acc;
      }, {})
    };
    
    packageJson.devDependencies = {
      ...packageJson.devDependencies,
      ...template.devDependencies.reduce((acc: any, dep: string) => {
        acc[dep] = 'latest';
        return acc;
      }, {})
    };
    
    // Add template scripts
    packageJson.scripts = {
      ...packageJson.scripts,
      ...template.scripts
    };
    
    await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
  }
  
  private processTemplate(content: string): string {
    const variables = {
      projectName: this.setup.name,
      description: this.setup.description,
      binName: this.setup.name,
      ...this.setup
    };
    
    let processed = content;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processed = processed.replace(regex, String(value));
    }
    
    return processed;
  }
  
  private async addFeatures(): Promise<void> {
    const { features, directory } = this.setup;
    
    if (features.includes('typescript')) {
      await this.addTypeScriptConfig();
    }
    
    if (features.includes('testing')) {
      await this.addTestingConfig();
    }
    
    if (features.includes('eslint')) {
      await this.addESLintConfig();
    }
    
    if (features.includes('prettier')) {
      await this.addPrettierConfig();
    }
    
    if (features.includes('github-actions')) {
      await this.addGitHubActions();
    }
    
    if (features.includes('docker')) {
      await this.addDockerConfig();
    }
  }
  
  private async addTypeScriptConfig(): Promise<void> {
    const tsconfigPath = join(this.setup.directory, 'tsconfig.json');
    const tsconfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        declaration: true,
        outDir: 'dist',
        allowImportingTsExtensions: true,
        noEmit: true
      },
      include: ['src/**/*'],
      exclude: ['dist', 'node_modules']
    };
    
    await writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2));
  }
  
  private async addTestingConfig(): Promise<void> {
    const vitestConfigPath = join(this.setup.directory, 'vitest.config.ts');
    const vitestConfig = `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node'
  }
});
`;
    
    await writeFile(vitestConfigPath, vitestConfig);
    
    // Add test directory
    const testDir = join(this.setup.directory, 'test');
    await mkdir(testDir, { recursive: true });
    
    const sampleTest = `import { describe, it, expect } from 'vitest';
import { main } from '../src/main';

describe('CLI', () => {
  it('should have main command', () => {
    expect(main).toBeDefined();
    expect(main.meta.name).toBe('${this.setup.name}');
  });
});
`;
    
    await writeFile(join(testDir, 'main.test.ts'), sampleTest);
  }
  
  private async addESLintConfig(): Promise<void> {
    const eslintConfigPath = join(this.setup.directory, 'eslint.config.mjs');
    const eslintConfig = `export default [
  {
    files: ['**/*.{js,mjs,ts}'],
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off'
    }
  }
];
`;
    
    await writeFile(eslintConfigPath, eslintConfig);
  }
  
  private async addPrettierConfig(): Promise<void> {
    const prettierConfigPath = join(this.setup.directory, '.prettierrc');
    const prettierConfig = {
      semi: true,
      singleQuote: true,
      tabWidth: 2,
      trailingComma: 'es5'
    };
    
    await writeFile(prettierConfigPath, JSON.stringify(prettierConfig, null, 2));
  }
  
  private async addGitHubActions(): Promise<void> {
    const workflowsDir = join(this.setup.directory, '.github/workflows');
    await mkdir(workflowsDir, { recursive: true });
    
    const ciWorkflow = `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18, 20]
    
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: latest
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node-version }}
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm run typecheck
      - run: pnpm run test
      - run: pnpm run build
`;
    
    await writeFile(join(workflowsDir, 'ci.yml'), ciWorkflow);
  }
  
  private async addDockerConfig(): Promise<void> {
    const dockerfilePath = join(this.setup.directory, 'Dockerfile');
    const dockerfile = `FROM node:18-alpine

WORKDIR /app

COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

EXPOSE 3000
CMD ["node", "dist/main.mjs"]
`;
    
    await writeFile(dockerfilePath, dockerfile);
    
    const dockerignorePath = join(this.setup.directory, '.dockerignore');
    const dockerignore = `node_modules
npm-debug.log
dist
.git
.github
README.md
.env
`;
    
    await writeFile(dockerignorePath, dockerignore);
  }
  
  private async initializePackageManager(): Promise<void> {
    try {
      const { execa } = await import('execa');
      
      consola.start('Installing dependencies...');
      
      await execa(this.setup.packageManager, ['install'], {
        cwd: this.setup.directory,
        stdio: 'inherit'
      });
      
      consola.success('Dependencies installed successfully!');
    } catch (error) {
      consola.warn('Failed to install dependencies automatically');
      consola.info(`Run '${this.setup.packageManager} install' in your project directory`);
    }
  }
  
  private async initializeGit(): Promise<void> {
    try {
      const { execa } = await import('execa');
      
      // Initialize git repository
      await execa('git', ['init'], { cwd: this.setup.directory });
      
      // Create .gitignore
      const gitignorePath = join(this.setup.directory, '.gitignore');
      const gitignore = `node_modules/
dist/
.env
.DS_Store
*.log
coverage/
.nyc_output/
`;
      
      await writeFile(gitignorePath, gitignore);
      
      // Initial commit
      await execa('git', ['add', '.'], { cwd: this.setup.directory });
      await execa('git', ['commit', '-m', 'Initial commit'], { cwd: this.setup.directory });
      
      consola.success('Git repository initialized');
    } catch (error) {
      consola.warn('Failed to initialize git repository');
    }
  }
  
  private showNextSteps(): void {
    const { name, directory, packageManager } = this.setup;
    
    console.log('\n' + colors.bold(colors.green('✨ Your CLI project is ready!')));
    console.log('\nNext steps:');
    console.log(`  1. cd ${directory}`);
    console.log(`  2. ${packageManager} run dev`);
    console.log(`  3. Edit src/main.ts to customize your CLI`);
    
    if (this.setup.features.includes('testing')) {
      console.log(`  4. ${packageManager} test`);
    }
    
    console.log('\nHelpful commands:');
    console.log(`  ${packageManager} run build  - Build for production`);
    console.log(`  ${packageManager} run test   - Run tests`);
    console.log(`  ${packageManager} run typecheck - Type checking`);
    
    console.log('\nLearn more:');
    console.log('  - Citty Documentation: https://citty.unjs.io');
    console.log('  - UnJS Ecosystem: https://unjs.io');
    console.log(`\n${colors.dim('Happy coding! 🚀')}`);
  }
}

/**
 * CLI Init Command
 */
export const initCommand = defineCommand({
  meta: {
    name: 'init',
    description: 'Initialize a new Citty CLI project'
  },
  args: {
    template: {
      type: 'string',
      description: 'Template to use (basic-cli, rest-api, plugin-system)'
    },
    name: {
      type: 'string',
      description: 'Project name'
    },
    directory: {
      type: 'string',
      description: 'Project directory'
    },
    'skip-wizard': {
      type: 'boolean',
      description: 'Skip interactive wizard'
    },
    'package-manager': {
      type: 'string',
      description: 'Package manager to use (npm, pnpm, yarn)'
    }
  },
  async run({ args }) {
    let setup: ProjectSetup;
    
    if (args['skip-wizard'] && args.template && args.name) {
      // Quick setup without wizard
      setup = {
        name: args.name,
        description: `A CLI project built with Citty`,
        template: args.template as TemplateId,
        features: ['typescript', 'testing', 'git'],
        packageManager: (args['package-manager'] as any) || 'pnpm',
        typescript: true,
        testing: true,
        git: true,
        directory: args.directory || `./${args.name}`
      };
    } else {
      // Run interactive wizard
      const wizard = new SetupWizard();
      setup = await wizard.run();
    }
    
    // Generate project
    const generator = new ProjectGenerator(setup);
    await generator.generate();
  }
});

/**
 * Quick Start Command
 */
export const quickStartCommand = defineCommand({
  meta: {
    name: 'create',
    description: 'Quickly create a new Citty CLI project'
  },
  args: {
    name: {
      type: 'positional',
      description: 'Project name',
      required: true
    },
    template: {
      type: 'string',
      description: 'Template to use',
      default: 'basic-cli'
    }
  },
  async run({ args }) {
    const setup: ProjectSetup = {
      name: args.name,
      description: `${args.name} - A CLI built with Citty`,
      template: args.template as TemplateId,
      features: ['typescript', 'testing', 'git'],
      packageManager: 'pnpm',
      typescript: true,
      testing: true,
      git: true,
      directory: `./${args.name}`
    };
    
    const generator = new ProjectGenerator(setup);
    await generator.generate();
  }
});
