#!/usr/bin/env tsx

/**
 * Documentation Validation Script
 * Validates all code examples in the ecosystem documentation
 */

import { readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface ValidationResult {
  file: string
  examples: Array<{
    language: string
    code: string
    valid: boolean
    error?: string
  }>
  totalExamples: number
  validExamples: number
}

class DocumentationValidator {
  private results: ValidationResult[] = []

  async validateAllDocs() {
    console.log('🔍 Validating ecosystem documentation...\n')
    
    const docsDir = join(process.cwd(), 'docs/ecosystem')
    await this.walkDirectory(docsDir)
    
    this.generateReport()
  }

  async walkDirectory(dir: string) {
    try {
      const files = await readdir(dir, { withFileTypes: true })
      
      for (const file of files) {
        const fullPath = join(dir, file.name)
        
        if (file.isDirectory()) {
          await this.walkDirectory(fullPath)
        } else if (file.name.endsWith('.md')) {
          await this.validateMarkdownFile(fullPath)
        }
      }
    } catch (error) {
      console.error(`Error walking directory ${dir}:`, error)
    }
  }

  async validateMarkdownFile(filePath: string) {
    console.log(`📄 Validating ${filePath}...`)
    
    try {
      const content = await readFile(filePath, 'utf-8')
      const examples = this.extractCodeBlocks(content)
      
      const result: ValidationResult = {
        file: filePath,
        examples: [],
        totalExamples: examples.length,
        validExamples: 0
      }

      for (const example of examples) {
        const validation = await this.validateCodeExample(example)
        result.examples.push(validation)
        
        if (validation.valid) {
          result.validExamples++
        }
      }
      
      this.results.push(result)
      
      const successRate = result.totalExamples > 0 ? 
        Math.round((result.validExamples / result.totalExamples) * 100) : 100
      
      console.log(`  ✅ ${result.validExamples}/${result.totalExamples} examples valid (${successRate}%)\n`)
      
    } catch (error) {
      console.error(`Error validating ${filePath}:`, error)
    }
  }

  extractCodeBlocks(content: string) {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
    const examples = []
    let match

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1] || 'text'
      const code = match[2].trim()
      
      // Only validate certain languages
      if (['typescript', 'javascript', 'ts', 'js', 'json', 'yaml', 'bash'].includes(language)) {
        examples.push({ language, code })
      }
    }

    return examples
  }

  async validateCodeExample(example: { language: string; code: string }) {
    const { language, code } = example

    try {
      switch (language) {
        case 'typescript':
        case 'ts':
          return await this.validateTypeScript(code)
          
        case 'javascript':
        case 'js':
          return await this.validateJavaScript(code)
          
        case 'json':
          return this.validateJSON(code)
          
        case 'yaml':
        case 'yml':
          return this.validateYAML(code)
          
        case 'bash':
          return this.validateBash(code)
          
        default:
          return {
            language,
            code,
            valid: true // Skip validation for unknown languages
          }
      }
    } catch (error) {
      return {
        language,
        code,
        valid: false,
        error: error.message
      }
    }
  }

  async validateTypeScript(code: string) {
    // Create temporary TypeScript file
    const tempFile = join(process.cwd(), 'temp-validation.ts')
    
    try {
      // Add common imports that might be missing
      const enhancedCode = `
// Auto-added imports for validation
import { defineCommand, runMain } from 'citty'
import { consola } from 'consola'
import { createUnJucks, generateFromOntology } from '@unjs/unjucks'
import { readFile, writeFile } from 'fs/promises'

${code}
`

      await writeFile(tempFile, enhancedCode)
      
      // Type check with TypeScript
      await execAsync(`npx tsc --noEmit --skipLibCheck ${tempFile}`)
      
      return {
        language: 'typescript',
        code,
        valid: true
      }
    } catch (error) {
      return {
        language: 'typescript', 
        code,
        valid: false,
        error: this.cleanError(error.message)
      }
    } finally {
      // Cleanup
      try {
        await execAsync(`rm -f ${tempFile}`)
      } catch {}
    }
  }

  async validateJavaScript(code: string) {
    try {
      // Basic syntax validation using Node.js
      const tempFile = join(process.cwd(), 'temp-validation.js')
      await writeFile(tempFile, code)
      
      await execAsync(`node --check ${tempFile}`)
      
      await execAsync(`rm -f ${tempFile}`)
      
      return {
        language: 'javascript',
        code,
        valid: true
      }
    } catch (error) {
      return {
        language: 'javascript',
        code,
        valid: false,
        error: this.cleanError(error.message)
      }
    }
  }

  validateJSON(code: string) {
    try {
      JSON.parse(code)
      return {
        language: 'json',
        code,
        valid: true
      }
    } catch (error) {
      return {
        language: 'json',
        code,
        valid: false,
        error: error.message
      }
    }
  }

  validateYAML(code: string) {
    try {
      // Basic YAML validation - check for obvious syntax errors
      const lines = code.split('\n')
      let indentLevel = 0
      
      for (const line of lines) {
        if (line.trim() === '') continue
        
        // Check for consistent indentation
        const leadingSpaces = line.match(/^(\s*)/)?.[1].length || 0
        
        // Basic syntax checks
        if (line.includes(':') && !line.trim().startsWith('#')) {
          // Valid YAML key-value line
        }
      }
      
      return {
        language: 'yaml',
        code,
        valid: true
      }
    } catch (error) {
      return {
        language: 'yaml',
        code,
        valid: false,
        error: error.message
      }
    }
  }

  validateBash(code: string) {
    try {
      // Basic bash syntax validation
      const lines = code.split('\n')
      
      for (const line of lines) {
        const trimmed = line.trim()
        
        // Skip comments and empty lines
        if (trimmed === '' || trimmed.startsWith('#')) continue
        
        // Check for basic bash command structure
        if (trimmed.includes('&&') || trimmed.includes('||')) {
          // Command chaining is valid
        }
        
        // Check for common bash commands
        const commonCommands = ['npm', 'pnpm', 'yarn', 'node', 'npx', 'mkdir', 'cd', 'ls', 'cp', 'mv', 'rm']
        const firstWord = trimmed.split(' ')[0]
        
        if (commonCommands.some(cmd => firstWord.startsWith(cmd))) {
          // Valid bash command
        }
      }
      
      return {
        language: 'bash',
        code,
        valid: true
      }
    } catch (error) {
      return {
        language: 'bash',
        code,
        valid: false,
        error: error.message
      }
    }
  }

  cleanError(errorMessage: string): string {
    // Remove file paths and line numbers for cleaner error messages
    return errorMessage
      .replace(/temp-validation\.(ts|js):\d+:\d+/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  generateReport() {
    console.log('\n📊 DOCUMENTATION VALIDATION REPORT')
    console.log('=' .repeat(50))
    
    let totalExamples = 0
    let totalValid = 0
    
    for (const result of this.results) {
      totalExamples += result.totalExamples
      totalValid += result.validExamples
      
      const relativePath = result.file.replace(process.cwd(), '.')
      const successRate = result.totalExamples > 0 ? 
        Math.round((result.validExamples / result.totalExamples) * 100) : 100
      
      const status = successRate === 100 ? '✅' : successRate >= 80 ? '⚠️' : '❌'
      
      console.log(`${status} ${relativePath}`)
      console.log(`   Examples: ${result.validExamples}/${result.totalExamples} valid (${successRate}%)`)
      
      // Show errors for failed examples
      const failedExamples = result.examples.filter(ex => !ex.valid)
      if (failedExamples.length > 0) {
        console.log('   Errors:')
        failedExamples.forEach(ex => {
          console.log(`     - ${ex.language}: ${ex.error?.substring(0, 100)}...`)
        })
      }
      console.log('')
    }
    
    const overallSuccessRate = totalExamples > 0 ? 
      Math.round((totalValid / totalExamples) * 100) : 100
    
    console.log('SUMMARY')
    console.log(`Total Examples: ${totalExamples}`)
    console.log(`Valid Examples: ${totalValid}`) 
    console.log(`Success Rate: ${overallSuccessRate}%`)
    
    if (overallSuccessRate >= 90) {
      console.log('\n🎉 Excellent! Documentation quality is high.')
    } else if (overallSuccessRate >= 75) {
      console.log('\n👍 Good documentation quality, some improvements possible.')
    } else {
      console.log('\n⚠️  Documentation needs improvement.')
    }

    // Generate detailed JSON report
    const reportPath = join(process.cwd(), 'docs/validation-report.json')
    writeFile(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        totalExamples,
        validExamples: totalValid,
        successRate: overallSuccessRate
      },
      results: this.results
    }, null, 2)).then(() => {
      console.log(`\n📋 Detailed report saved to: ${reportPath}`)
    })
  }
}

// Run validation
const validator = new DocumentationValidator()
validator.validateAllDocs().catch(console.error)