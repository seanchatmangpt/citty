#!/usr/bin/env node

import { defineCommand, runMain } from 'citty'
import { consola } from 'consola'
import { createUnJucks } from '@unjs/unjucks'
import { createSemanticContext } from '@unjs/unjucks/context'
import prompts from 'prompts'
import { writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'pathe'
import chalk from 'chalk'
import ora from 'ora'
import { glob } from 'fast-glob'

const main = defineCommand({
  meta: {
    name: 'cli-gen',
    version: '1.0.0',
    description: 'Generate CLI tools with UnJS integrations using UnJucks templates'
  },
  subCommands: {
    create: defineCommand({
      meta: {
        description: 'Create a new CLI project'
      },
      args: {
        name: {
          type: 'positional',
          description: 'Project name',
          required: false
        },
        template: {
          type: 'string',
          description: 'Template to use',
          default: 'basic'
        },
        'dry-run': {
          type: 'boolean',
          description: 'Preview files without creating them'
        }
      },
      async run({ args }) {
        await createProject(args)
      }
    }),
    
    templates: defineCommand({
      meta: {
        description: 'List available templates'
      },
      async run() {
        await listTemplates()
      }
    }),
    
    generate: defineCommand({
      meta: {
        description: 'Generate files from templates'
      },
      args: {
        template: {
          type: 'string',
          description: 'Template name',
          required: true
        },
        output: {
          type: 'string',
          description: 'Output directory',
          default: '.'
        }
      },
      async run({ args }) {
        await generateFromTemplate(args.template, args.output)
      }
    })
  }
})

async function createProject(args: any) {
  const spinner = ora('Initializing CLI generator').start()
  
  try {
    // Initialize UnJucks with CLI templates
    const unjucks = await createUnJucks({
      templates: {
        path: './templates',
        patterns: ['**/*.njk', '**/*.hbs']
      },
      context: {
        semantic: true,
        ontology: {
          cli: {
            name: 'CLIProject',
            properties: {
              name: { type: 'string', required: true },
              description: { type: 'string', required: true },
              author: { type: 'string', required: true },
              license: { type: 'string', default: 'MIT' },
              version: { type: 'string', default: '1.0.0' },
              framework: { type: 'string', enum: ['citty', 'commander', 'yargs'], default: 'citty' },
              features: { 
                type: 'array', 
                items: { 
                  type: 'string', 
                  enum: ['typescript', 'testing', 'linting', 'bundling', 'docs'] 
                }
              },
              integrations: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['consola', 'defu', 'pathe', 'scule', 'ofetch', 'unctx']
                }
              }
            }
          }
        }
      }
    })

    spinner.text = 'Gathering project information'
    
    // Get project details
    const responses = await prompts([
      {
        type: 'text',
        name: 'name',
        message: 'Project name:',
        initial: args.name || 'my-cli'
      },
      {
        type: 'text', 
        name: 'description',
        message: 'Project description:',
        initial: 'A CLI tool built with UnJS ecosystem'
      },
      {
        type: 'text',
        name: 'author',
        message: 'Author name:',
        initial: 'Your Name'
      },
      {
        type: 'select',
        name: 'framework',
        message: 'CLI framework:',
        choices: [
          { title: 'Citty (Recommended)', value: 'citty' },
          { title: 'Commander.js', value: 'commander' },
          { title: 'Yargs', value: 'yargs' }
        ]
      },
      {
        type: 'multiselect',
        name: 'features',
        message: 'Select features:',
        choices: [
          { title: 'TypeScript', value: 'typescript', selected: true },
          { title: 'Testing (Vitest)', value: 'testing', selected: true },
          { title: 'Linting (ESLint)', value: 'linting', selected: true },
          { title: 'Bundling (Unbuild)', value: 'bundling', selected: true },
          { title: 'Documentation', value: 'docs', selected: false }
        ]
      },
      {
        type: 'multiselect', 
        name: 'integrations',
        message: 'UnJS integrations:',
        choices: [
          { title: 'consola (logging)', value: 'consola', selected: true },
          { title: 'defu (config merging)', value: 'defu', selected: true },
          { title: 'pathe (path utilities)', value: 'pathe', selected: true },
          { title: 'scule (string utilities)', value: 'scule', selected: false },
          { title: 'ofetch (HTTP client)', value: 'ofetch', selected: false },
          { title: 'unctx (context)', value: 'unctx', selected: false }
        ]
      }
    ])

    if (!responses.name) {
      consola.info('Project creation cancelled')
      return
    }

    spinner.text = 'Creating semantic context'
    
    // Create semantic context
    const context = createSemanticContext({
      type: 'cli',
      data: responses,
      metadata: {
        template: args.template,
        timestamp: new Date().toISOString(),
        generator: 'cli-gen'
      }
    })

    spinner.text = 'Generating project files'
    
    // Generate files
    const files = [
      'package.json',
      'src/cli.ts', 
      'src/commands/index.ts',
      'README.md',
      'tsconfig.json'
    ]

    if (responses.features.includes('testing')) {
      files.push('test/cli.test.ts', 'vitest.config.ts')
    }
    
    if (responses.features.includes('linting')) {
      files.push('eslint.config.mjs')
    }
    
    if (responses.features.includes('bundling')) {
      files.push('build.config.ts')
    }

    if (args['dry-run']) {
      spinner.succeed('Dry run complete')
      consola.info('Would generate:', files)
      return
    }

    // Create project directory
    const projectDir = responses.name
    await mkdir(projectDir, { recursive: true })
    await mkdir(join(projectDir, 'src'), { recursive: true })
    await mkdir(join(projectDir, 'src/commands'), { recursive: true })
    
    if (responses.features.includes('testing')) {
      await mkdir(join(projectDir, 'test'), { recursive: true })
    }

    // Generate each file
    for (const file of files) {
      const templatePath = `${responses.framework}/${file}.njk`
      const content = await unjucks.render(templatePath, context)
      const outputPath = join(projectDir, file)
      
      await mkdir(dirname(outputPath), { recursive: true })
      await writeFile(outputPath, content)
    }

    spinner.succeed(`Project ${chalk.green(responses.name)} created successfully!`)
    
    consola.box([
      `${chalk.cyan('Next steps:')}`,
      ``,
      `  cd ${responses.name}`,
      `  pnpm install`,
      `  pnpm run dev`,
      ``,
      `${chalk.gray('Happy coding! 🚀')}`
    ])
    
  } catch (error) {
    spinner.fail('Project creation failed')
    consola.error(error)
    process.exit(1)
  }
}

async function listTemplates() {
  const templates = await glob('templates/**/*.njk')
  
  consola.info('Available templates:')
  
  const grouped = templates.reduce((acc, template) => {
    const parts = template.split('/')
    const category = parts[1] || 'general'
    if (!acc[category]) acc[category] = []
    acc[category].push(parts.slice(2).join('/').replace('.njk', ''))
    return acc
  }, {} as Record<string, string[]>)

  for (const [category, files] of Object.entries(grouped)) {
    consola.log(`\n${chalk.yellow(category)}:`)
    files.forEach(file => consola.log(`  ${chalk.gray('•')} ${file}`))
  }
}

async function generateFromTemplate(template: string, output: string) {
  const spinner = ora(`Generating from template: ${template}`).start()
  
  try {
    const unjucks = await createUnJucks({
      templates: { path: './templates' }
    })

    const context = createSemanticContext({
      type: 'generation',
      metadata: {
        template,
        output,
        timestamp: new Date().toISOString()
      }
    })

    const content = await unjucks.render(`${template}.njk`, context)
    await writeFile(join(output, template), content)
    
    spinner.succeed(`Generated: ${template}`)
    
  } catch (error) {
    spinner.fail('Generation failed')
    consola.error(error)
    process.exit(1)
  }
}

runMain(main)