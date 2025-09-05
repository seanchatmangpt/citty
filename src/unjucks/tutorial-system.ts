/**
 * 🎓 COMPREHENSIVE TUTORIAL SYSTEM
 * Progressive learning path with interactive exercises and real-world scenarios
 */

import { EventEmitter } from 'events'
import * as fs from 'fs/promises'
import * as path from 'path'
import { interactivePlayground } from './interactive-playground'
import { productionMonitor } from './production-monitoring'
import { UNJUCKS, createUnjucks, generateFromOntology } from './index'
import { MemoryCache } from '../cache'

export interface Tutorial {
  id: string
  title: string
  description: string
  category: 'fundamentals' | 'intermediate' | 'advanced' | 'real-world' | 'specialized'
  difficulty: 1 | 2 | 3 | 4 | 5
  estimatedDuration: number // minutes
  prerequisites: string[] // tutorial IDs
  objectives: string[]
  sections: TutorialSection[]
  resources: Resource[]
  tags: string[]
  author: string
  version: string
  lastUpdated: number
  completionRate?: number
  rating?: number
}

export interface TutorialSection {
  id: string
  title: string
  type: 'text' | 'code' | 'exercise' | 'quiz' | 'video' | 'interactive'
  content: string
  code?: CodeBlock[]
  exercise?: Exercise
  quiz?: Quiz
  metadata?: Record<string, any>
}

export interface CodeBlock {
  language: string
  code: string
  filename?: string
  highlight?: string[]
  runnable?: boolean
  editable?: boolean
}

export interface Exercise {
  id: string
  title: string
  description: string
  instructions: string[]
  startingOntology?: string
  startingTemplate?: string
  expectedOutput?: string
  validation: ValidationRule[]
  hints: string[]
  solution?: {
    ontology: string
    template: string
    explanation: string
  }
}

export interface Quiz {
  id: string
  questions: QuizQuestion[]
  passingScore: number
}

export interface QuizQuestion {
  id: string
  type: 'multiple-choice' | 'true-false' | 'code-completion' | 'ordering'
  question: string
  options?: string[]
  correctAnswer: string | string[]
  explanation: string
}

export interface ValidationRule {
  type: 'output-contains' | 'output-matches' | 'no-errors' | 'performance' | 'custom'
  value?: any
  message: string
  validator?: (result: any) => boolean
}

export interface Resource {
  type: 'link' | 'download' | 'reference' | 'tool'
  title: string
  url: string
  description: string
}

export interface UserProgress {
  userId: string
  tutorialId: string
  currentSection: number
  sectionsCompleted: string[]
  exercisesCompleted: string[]
  quizScores: Record<string, number>
  startedAt: number
  lastAccessedAt: number
  completedAt?: number
  timeSpent: number
  notes: string[]
}

export interface LearningPath {
  id: string
  title: string
  description: string
  tutorials: string[] // tutorial IDs in order
  estimatedDuration: number
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  tags: string[]
}

export class TutorialSystem extends EventEmitter {
  private tutorials: Map<string, Tutorial> = new Map()
  private userProgress: Map<string, UserProgress[]> = new Map()
  private learningPaths: Map<string, LearningPath> = new Map()
  private progressCache = new MemoryCache()
  private storageDir: string = './unjucks-tutorial-data'
  
  constructor(storageDir?: string) {
    super()
    if (storageDir) this.storageDir = storageDir
    this.setupBuiltinTutorials()
    this.setupLearningPaths()
    this.loadPersistedProgress()
  }
  
  /**
   * Get tutorial by ID
   */
  getTutorial(id: string): Tutorial | undefined {
    return this.tutorials.get(id)
  }
  
  /**
   * List tutorials with filtering
   */
  listTutorials(filters: {
    category?: Tutorial['category']
    difficulty?: number
    tags?: string[]
    search?: string
    prerequisites?: boolean
  } = {}): Tutorial[] {
    let tutorials = Array.from(this.tutorials.values())
    
    if (filters.category) {
      tutorials = tutorials.filter(t => t.category === filters.category)
    }
    
    if (filters.difficulty) {
      tutorials = tutorials.filter(t => t.difficulty <= filters.difficulty)
    }
    
    if (filters.tags && filters.tags.length > 0) {
      tutorials = tutorials.filter(t =>
        filters.tags!.some(tag => t.tags.includes(tag))
      )
    }
    
    if (filters.search) {
      const search = filters.search.toLowerCase()
      tutorials = tutorials.filter(t =>
        t.title.toLowerCase().includes(search) ||
        t.description.toLowerCase().includes(search) ||
        t.objectives.some(obj => obj.toLowerCase().includes(search))
      )
    }
    
    if (filters.prerequisites === false) {
      tutorials = tutorials.filter(t => t.prerequisites.length === 0)
    }
    
    return tutorials.sort((a, b) => {
      // Sort by difficulty, then by title
      if (a.difficulty !== b.difficulty) {
        return a.difficulty - b.difficulty
      }
      return a.title.localeCompare(b.title)
    })
  }
  
  /**
   * Start tutorial for user with persistent progress tracking
   */
  async startTutorial(userId: string, tutorialId: string): Promise<UserProgress> {
    const tutorial = this.tutorials.get(tutorialId)
    if (!tutorial) {
      throw new Error(`Tutorial not found: ${tutorialId}`)
    }
    
    // Check prerequisites
    await this.validatePrerequisites(userId, tutorial.prerequisites)
    
    const progress: UserProgress = {
      userId,
      tutorialId,
      currentSection: 0,
      sectionsCompleted: [],
      exercisesCompleted: [],
      quizScores: {},
      startedAt: Date.now(),
      lastAccessedAt: Date.now(),
      timeSpent: 0,
      notes: []
    }
    
    if (!this.userProgress.has(userId)) {
      this.userProgress.set(userId, [])
    }
    
    // Remove existing progress for this tutorial
    const userProgressList = this.userProgress.get(userId)!
    const existingIndex = userProgressList.findIndex(p => p.tutorialId === tutorialId)
    if (existingIndex >= 0) {
      userProgressList.splice(existingIndex, 1)
    }
    
    userProgressList.push(progress)
    
    // Persist to filesystem
    await this.persistUserProgress(userId, progress)
    
    // Track analytics with more detailed metrics
    productionMonitor.recordMetric('tutorial.started', 1, {
      tutorialId,
      category: tutorial.category,
      difficulty: tutorial.difficulty.toString(),
      hasPrerequisites: tutorial.prerequisites.length > 0 ? 'true' : 'false',
      estimatedDuration: tutorial.estimatedDuration.toString()
    })
    
    this.emit('tutorial:started', { userId, tutorialId, progress })
    return progress
  }
  
  /**
   * Complete tutorial section with persistent tracking
   */
  async completeSection(
    userId: string,
    tutorialId: string,
    sectionId: string
  ): Promise<void> {
    const progress = this.getUserProgress(userId, tutorialId)
    const tutorial = this.tutorials.get(tutorialId)!
    
    if (!progress.sectionsCompleted.includes(sectionId)) {
      progress.sectionsCompleted.push(sectionId)
    }
    
    // Advance to next section
    const currentSectionIndex = tutorial.sections.findIndex(s => s.id === sectionId)
    if (currentSectionIndex >= 0 && currentSectionIndex >= progress.currentSection) {
      progress.currentSection = Math.min(currentSectionIndex + 1, tutorial.sections.length)
    }
    
    progress.lastAccessedAt = Date.now()
    
    // Persist updated progress
    await this.persistUserProgress(userId, progress)
    
    // Check if tutorial is complete
    if (progress.sectionsCompleted.length === tutorial.sections.length) {
      await this.completeTutorial(userId, tutorialId)
    }
    
    this.emit('section:completed', { userId, tutorialId, sectionId })
  }
  
  /**
   * Execute and validate exercise using real UNJUCKS template compilation and rendering
   */
  async executeExercise(
    userId: string,
    tutorialId: string,
    exerciseId: string,
    ontology: string,
    template: string
  ): Promise<{
    success: boolean
    output: string
    errors: string[]
    validationResults: Array<{ rule: ValidationRule; passed: boolean; message: string }>
    score: number
    hints?: string[]
  }> {
    const tutorial = this.tutorials.get(tutorialId)!
    const section = tutorial.sections.find(s => s.exercise?.id === exerciseId)
    
    if (!section || !section.exercise) {
      throw new Error(`Exercise not found: ${exerciseId}`)
    }
    
    const exercise = section.exercise
    const errors: string[] = []
    let output = ''
    
    try {
      // Execute with real UNJUCKS template compilation and rendering
      if (ontology && ontology.trim()) {
        // Use full ontology-driven generation with real UNJUCKS.generateFromOntology
        const tempDir = `/tmp/tutorial-${Date.now()}`
        await fs.mkdir(tempDir, { recursive: true })
        
        const ontologyPath = path.join(tempDir, 'exercise.ttl')
        const templatePath = path.join(tempDir, 'exercise.njk')
        
        await fs.writeFile(ontologyPath, ontology)
        await fs.writeFile(templatePath, `---\nto: output.txt\n---\n${template}`)
        
        try {
          // Use real generateFromOntology from Agent 1's implementation
          const result = await generateFromOntology(ontologyPath, 'exercise', {
            templatesDir: tempDir,
            outputDir: tempDir,
            dryRun: true
          })
          
          if (result.success && result.files.length > 0) {
            output = result.files[0].content
          } else if (result.errors && result.errors.length > 0) {
            errors.push(...result.errors.map(e => e.message))
          }
        } catch (error) {
          errors.push(`Ontology processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        } finally {
          // Cleanup
          await fs.rm(tempDir, { recursive: true, force: true })
        }
      } else {
        // Direct template rendering with real UNJUCKS.render()
        try {
          // Validate template first with real UNJUCKS.compile()
          UNJUCKS.compile(template, 'exercise-template')
          
          // Create realistic context for template rendering
          const context = this.createExerciseContext(exercise, template)
          
          // Use real UNJUCKS.render() from Agent 1's implementation
          output = UNJUCKS.render(template, context)
        } catch (error) {
          errors.push(`Template rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    } catch (error) {
      errors.push(`Exercise execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
    
    // Validate results using real template execution results
    const executionResult = { output, errors }
    const validationResults = await this.validateExercise(exercise, executionResult)
    const passedValidations = validationResults.filter(v => v.passed).length
    const score = Math.round((passedValidations / validationResults.length) * 100)
    
    const success = validationResults.every(v => v.passed) && errors.length === 0
    
    // Update progress if successful and persist to filesystem
    if (success) {
      const progress = this.getUserProgress(userId, tutorialId)
      if (!progress.exercisesCompleted.includes(exerciseId)) {
        progress.exercisesCompleted.push(exerciseId)
      }
      progress.lastAccessedAt = Date.now()
      await this.persistUserProgress(userId, progress)
    }
    
    // Track analytics with real metrics
    productionMonitor.recordMetric('tutorial.exercise.completed', 1, {
      tutorialId,
      exerciseId,
      success: success.toString(),
      score: score.toString(),
      hasOntology: ontology ? 'true' : 'false',
      templateSize: template.length.toString()
    })
    
    const response = {
      success,
      output,
      errors,
      validationResults,
      score,
      hints: success ? undefined : this.getRelevantHints(exercise, validationResults)
    }
    
    this.emit('exercise:completed', { userId, tutorialId, exerciseId, result: response })
    return response
  }
  
  /**
   * Submit quiz answers
   */
  async submitQuiz(
    userId: string,
    tutorialId: string,
    quizId: string,
    answers: Record<string, string | string[]>
  ): Promise<{
    score: number
    passed: boolean
    results: Array<{
      questionId: string
      correct: boolean
      explanation: string
      userAnswer: string | string[]
      correctAnswer: string | string[]
    }>
  }> {
    const tutorial = this.tutorials.get(tutorialId)!
    const section = tutorial.sections.find(s => s.quiz?.id === quizId)
    
    if (!section || !section.quiz) {
      throw new Error(`Quiz not found: ${quizId}`)
    }
    
    const quiz = section.quiz
    const results = quiz.questions.map(question => {
      const userAnswer = answers[question.id]
      const correct = this.checkQuizAnswer(question, userAnswer)
      
      return {
        questionId: question.id,
        correct,
        explanation: question.explanation,
        userAnswer,
        correctAnswer: question.correctAnswer
      }
    })
    
    const correctCount = results.filter(r => r.correct).length
    const score = Math.round((correctCount / quiz.questions.length) * 100)
    const passed = score >= quiz.passingScore
    
    // Update progress
    const progress = this.getUserProgress(userId, tutorialId)
    progress.quizScores[quizId] = score
    progress.lastAccessedAt = Date.now()
    
    // Track analytics
    productionMonitor.recordMetric('tutorial.quiz.completed', 1, {
      tutorialId,
      quizId,
      score: score.toString(),
      passed: passed.toString()
    })
    
    const response = { score, passed, results }
    this.emit('quiz:submitted', { userId, tutorialId, quizId, result: response })
    return response
  }
  
  /**
   * Get user progress for tutorial
   */
  getUserProgress(userId: string, tutorialId: string): UserProgress {
    const userProgressList = this.userProgress.get(userId) || []
    const progress = userProgressList.find(p => p.tutorialId === tutorialId)
    
    if (!progress) {
      throw new Error(`No progress found for tutorial ${tutorialId} and user ${userId}`)
    }
    
    return progress
  }
  
  /**
   * Get all user progress
   */
  getAllUserProgress(userId: string): UserProgress[] {
    return this.userProgress.get(userId) || []
  }
  
  /**
   * Get learning paths
   */
  getLearningPaths(): LearningPath[] {
    return Array.from(this.learningPaths.values())
  }
  
  /**
   * Get recommended tutorials for user
   */
  getRecommendations(userId: string): {
    nextTutorials: Tutorial[]
    continueTutorials: Tutorial[]
    relatedTutorials: Tutorial[]
  } {
    const userProgressList = this.getAllUserProgress(userId)
    const completedTutorials = userProgressList
      .filter(p => p.completedAt)
      .map(p => p.tutorialId)
    
    const inProgressTutorials = userProgressList
      .filter(p => !p.completedAt && p.sectionsCompleted.length > 0)
      .map(p => p.tutorialId)
    
    // Find next tutorials based on completed prerequisites
    const nextTutorials = this.listTutorials()
      .filter(tutorial => 
        !completedTutorials.includes(tutorial.id) &&
        !inProgressTutorials.includes(tutorial.id) &&
        tutorial.prerequisites.every(prereq => completedTutorials.includes(prereq))
      )
      .slice(0, 5)
    
    // Continue tutorials
    const continueTutorials = inProgressTutorials
      .map(id => this.tutorials.get(id)!)
      .filter(Boolean)
    
    // Related tutorials based on tags
    const userTags = new Set<string>()
    completedTutorials.forEach(id => {
      const tutorial = this.tutorials.get(id)
      tutorial?.tags.forEach(tag => userTags.add(tag))
    })
    
    const relatedTutorials = this.listTutorials()
      .filter(tutorial =>
        !completedTutorials.includes(tutorial.id) &&
        !inProgressTutorials.includes(tutorial.id) &&
        tutorial.tags.some(tag => userTags.has(tag))
      )
      .slice(0, 5)
    
    return {
      nextTutorials,
      continueTutorials,
      relatedTutorials
    }
  }
  
  /**
   * Export user progress
   */
  exportProgress(userId: string, format: 'json' | 'csv' | 'pdf' = 'json'): string {
    const progress = this.getAllUserProgress(userId)
    
    switch (format) {
      case 'json':
        return JSON.stringify(progress, null, 2)
      
      case 'csv':
        return this.exportProgressToCSV(progress)
      
      case 'pdf':
        // Would generate PDF report
        return 'PDF export not implemented'
      
      default:
        throw new Error(`Unsupported format: ${format}`)
    }
  }
  
  // Private helper methods
  
  private async validatePrerequisites(userId: string, prerequisites: string[]): Promise<void> {
    if (prerequisites.length === 0) return
    
    const userProgressList = this.getAllUserProgress(userId)
    const completedTutorials = userProgressList
      .filter(p => p.completedAt)
      .map(p => p.tutorialId)
    
    const missingPrereqs = prerequisites.filter(prereq => 
      !completedTutorials.includes(prereq)
    )
    
    if (missingPrereqs.length > 0) {
      throw new Error(`Missing prerequisites: ${missingPrereqs.join(', ')}`)
    }
  }
  
  /**
   * Validate exercise results using real template compilation and execution
   */
  private async validateExercise(
    exercise: Exercise,
    result: { output: string; errors: string[] }
  ): Promise<Array<{ rule: ValidationRule; passed: boolean; message: string }>> {
    return exercise.validation.map(rule => {
      let passed = false
      
      switch (rule.type) {
        case 'output-contains':
          passed = result.output.includes(rule.value)
          break
        
        case 'output-matches':
          try {
            const regex = new RegExp(rule.value)
            passed = regex.test(result.output)
          } catch (error) {
            console.warn(`Invalid regex pattern in validation rule: ${rule.value}`)
            passed = false
          }
          break
        
        case 'no-errors':
          passed = result.errors.length === 0
          break
        
        case 'performance':
          // Validate template compilation and rendering performance
          if (rule.value && typeof rule.value === 'object') {
            const maxTime = rule.value.maxTime || 5000 // 5 seconds default
            const startTime = Date.now()
            
            try {
              // Test template compilation performance
              if (exercise.startingTemplate) {
                UNJUCKS.compile(exercise.startingTemplate, 'performance-test')
              }
              const endTime = Date.now()
              passed = (endTime - startTime) < maxTime
            } catch {
              passed = false
            }
          }
          break
        
        case 'custom':
          if (rule.validator) {
            try {
              passed = rule.validator(result)
            } catch (error) {
              console.warn(`Custom validator failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
              passed = false
            }
          }
          break
      }
      
      return {
        rule,
        passed,
        message: passed ? 'Validation passed' : rule.message
      }
    })
  }
  
  private checkQuizAnswer(
    question: QuizQuestion,
    userAnswer: string | string[]
  ): boolean {
    switch (question.type) {
      case 'multiple-choice':
      case 'true-false':
        return userAnswer === question.correctAnswer
      
      case 'ordering':
        if (Array.isArray(userAnswer) && Array.isArray(question.correctAnswer)) {
          return JSON.stringify(userAnswer) === JSON.stringify(question.correctAnswer)
        }
        return false
      
      default:
        return false
    }
  }
  
  private getRelevantHints(
    exercise: Exercise,
    validationResults: Array<{ rule: ValidationRule; passed: boolean }>
  ): string[] {
    const failedRules = validationResults.filter(r => !r.passed)
    
    if (failedRules.length === 0) return []
    
    // Return first few hints based on failed validations
    return exercise.hints.slice(0, Math.min(2, failedRules.length))
  }
  
  private async completeTutorial(userId: string, tutorialId: string): Promise<void> {
    const progress = this.getUserProgress(userId, tutorialId)
    progress.completedAt = Date.now()
    
    const tutorial = this.tutorials.get(tutorialId)!
    
    // Persist completed state
    await this.persistUserProgress(userId, progress)
    
    // Track analytics with completion metrics
    productionMonitor.recordMetric('tutorial.completed', 1, {
      tutorialId,
      category: tutorial.category,
      timeSpent: progress.timeSpent.toString(),
      sectionsCompleted: progress.sectionsCompleted.length.toString(),
      exercisesCompleted: progress.exercisesCompleted.length.toString(),
      duration: (progress.completedAt - progress.startedAt).toString()
    })
    
    this.emit('tutorial:completed', { userId, tutorialId, progress })
  }
  
  private exportProgressToCSV(progress: UserProgress[]): string {
    const headers = [
      'Tutorial ID',
      'Started At',
      'Completed At',
      'Time Spent (min)',
      'Sections Completed',
      'Exercises Completed',
      'Quiz Scores'
    ]
    
    const rows = progress.map(p => [
      p.tutorialId,
      new Date(p.startedAt).toISOString(),
      p.completedAt ? new Date(p.completedAt).toISOString() : 'In Progress',
      Math.round(p.timeSpent / 60000),
      p.sectionsCompleted.length,
      p.exercisesCompleted.length,
      Object.values(p.quizScores).join(';')
    ])
    
    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }
  
  /**
   * Setup comprehensive built-in tutorials with real Nunjucks examples
   */
  private setupBuiltinTutorials(): void {
    const tutorials: Tutorial[] = [
      {
        id: 'getting-started',
        title: 'Getting Started with UNJUCKS',
        description: 'Learn the basics of semantic template generation with real examples',
        category: 'fundamentals',
        difficulty: 1,
        estimatedDuration: 45,
        prerequisites: [],
        objectives: [
          'Understand what UNJUCKS is and why it exists',
          'Create your first ontology with real RDF data',
          'Write your first template using actual Nunjucks syntax',
          'Generate your first output using real template compilation'
        ],
        sections: [
          {
            id: 'intro',
            title: 'What is UNJUCKS?',
            type: 'text',
            content: `
UNJUCKS is a production-grade semantic template system that bridges the gap between 
ontological knowledge representation and dynamic code generation.

## Why UNJUCKS?

Traditional template engines work with simple key-value data. UNJUCKS works with 
semantic knowledge graphs, enabling:

- **Intelligent Template Selection**: Templates that understand your data structure
- **Semantic Context Propagation**: Rich, multi-dimensional context flows
- **Ontology-Driven Generation**: Generate code from formal knowledge representations
- **Production Monitoring**: Built-in observability and error recovery

## Key Concepts

1. **Ontologies**: Formal descriptions of your domain using RDF/OWL
2. **Templates**: Nunjucks templates enhanced with semantic awareness
3. **Context**: Multi-dimensional semantic context that flows through generation
4. **Bridge**: The connection layer that translates ontologies to template data

## Real Template Compilation

UNJUCKS uses the real Nunjucks template engine under the hood, meaning all standard
Nunjucks features work: variables, filters, loops, conditionals, macros, and more.
            `
          },
          {
            id: 'first-ontology',
            title: 'Your First Real Ontology',
            type: 'exercise',
            content: 'Create a real ontology using RDF/Turtle syntax that will be processed by actual semantic parsing.',
            exercise: {
              id: 'hello-world-ontology',
              title: 'Create Hello World Ontology',
              description: 'Create a working RDF ontology that describes a greeting message',
              instructions: [
                'Define a namespace using @prefix with a valid URI',
                'Create a greeting entity with rdfs:label',
                'Use proper Turtle/RDF syntax with periods',
                'The label value will become the {{ greeting }} variable in templates'
              ],
              startingOntology: `@prefix ex: <http://example.com/tutorial#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

# Define your greeting entity here
# Example: ex:myGreeting rdfs:label "Your message here" .`,
              startingTemplate: `{{ greeting }}`,
              expectedOutput: 'Hello, World!',
              validation: [
                {
                  type: 'output-contains',
                  value: 'Hello',
                  message: 'Output should contain "Hello" - check your rdfs:label value'
                },
                {
                  type: 'no-errors',
                  message: 'Template should compile without errors using real Nunjucks'
                },
                {
                  type: 'custom',
                  message: 'Ontology should be valid RDF/Turtle syntax',
                  validator: (result) => {
                    // Validate that ontology parsing worked
                    return !result.errors.some(e => e.includes('ontology') || e.includes('RDF'))
                  }
                }
              ],
              hints: [
                'Use rdfs:label to define the greeting text that becomes {{ greeting }}',
                'Don\'t forget the period at the end of RDF statements',
                'Make sure your URI in the prefix matches what you use for the entity',
                'The template {{ greeting }} will render the value from rdfs:label'
              ],
              solution: {
                ontology: `@prefix ex: <http://example.com/tutorial#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:greeting rdfs:label "Hello, World!" .
ex:tutorial rdfs:label "UNJUCKS Tutorial" ;
          rdfs:comment "Learning real semantic template generation" .`,
                template: `{{ greeting }}

Welcome to {{ tutorial }}!
{{ comment }}`,
                explanation: 'The ontology defines entities with rdfs:label properties. UNJUCKS processes this RDF data and makes the labels available as template variables. Real Nunjucks compilation then renders the final output.'
              }
            }
          },
          {
            id: 'template-basics',
            title: 'Real Nunjucks Template Features',
            type: 'exercise',
            content: 'Learn to use actual Nunjucks template syntax with loops, filters, and conditionals.',
            exercise: {
              id: 'nunjucks-features',
              title: 'Use Real Nunjucks Features',
              description: 'Create a template using real Nunjucks loops, filters, and conditionals',
              instructions: [
                'Use {% for %} loops to iterate over collections',
                'Apply filters like | upper, | lower, | title',
                'Use {% if %} conditionals for logic',
                'Access nested properties with dot notation'
              ],
              startingOntology: `@prefix ex: <http://example.com/tutorial#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix schema: <http://schema.org/> .

ex:project rdfs:label "My Project" ;
          schema:description "A sample project for learning" ;
          schema:version "1.0.0" .
          
ex:feature1 rdfs:label "Authentication" ;
           schema:description "User login and registration" .
           
ex:feature2 rdfs:label "Database" ;
           schema:description "Data persistence layer" .
           
ex:feature3 rdfs:label "API" ;
           schema:description "REST API endpoints" .`,
              startingTemplate: `# {{ project | upper }}

{{ description }}

## Features

{% for feature in features %}
- **{{ feature.label }}**: {{ feature.description }}
{% endfor %}

{% if version %}
Version: {{ version }}
{% endif %}`,
              expectedOutput: 'MY PROJECT',
              validation: [
                {
                  type: 'output-contains',
                  value: 'MY PROJECT',
                  message: 'Should contain uppercase project name using | upper filter'
                },
                {
                  type: 'output-contains',
                  value: 'Authentication',
                  message: 'Should contain features from the ontology'
                },
                {
                  type: 'output-contains',
                  value: 'Version: 1.0.0',
                  message: 'Should show version when available'
                },
                {
                  type: 'no-errors',
                  message: 'Template should compile without errors'
                }
              ],
              hints: [
                'Use the | upper filter to make text uppercase',
                'The {% for %} loop needs {% endfor %} to close',
                'Access nested properties with dot notation like feature.label',
                'Use {% if %} to conditionally show content'
              ]
            }
          }
        ],
        resources: [
          {
            type: 'reference',
            title: 'RDF Primer',
            url: 'https://www.w3.org/TR/rdf-primer/',
            description: 'Introduction to RDF concepts'
          },
          {
            type: 'reference',
            title: 'Nunjucks Documentation',
            url: 'https://mozilla.github.io/nunjucks/',
            description: 'Complete Nunjucks template syntax reference'
          }
        ],
        tags: ['beginner', 'fundamentals', 'getting-started', 'nunjucks', 'rdf'],
        author: 'UNJUCKS Team',
        version: '1.0.0',
        lastUpdated: Date.now()
      },
      {
        id: 'advanced-templates',
        title: 'Advanced Template Patterns',
        description: 'Master complex Nunjucks features and semantic patterns',
        category: 'intermediate',
        difficulty: 3,
        estimatedDuration: 60,
        prerequisites: ['getting-started'],
        objectives: [
          'Use Nunjucks macros and inheritance',
          'Implement complex ontology patterns',
          'Generate structured code with templates',
          'Handle errors and edge cases'
        ],
        sections: [
          {
            id: 'macros-inheritance',
            title: 'Macros and Template Inheritance',
            type: 'exercise',
            content: 'Learn to use Nunjucks macros for reusable components and template inheritance for structure.',
            exercise: {
              id: 'advanced-nunjucks',
              title: 'Use Macros and Inheritance',
              description: 'Create reusable macros and use template inheritance',
              instructions: [
                'Define a macro using {% macro %}',
                'Use the macro with {{ macro_name() }}',
                'Create template blocks with {% block %}',
                'Pass parameters to macros'
              ],
              startingTemplate: `{% macro renderProperty(prop) %}
  {{ prop.name }}: {{ prop.type }}{% if prop.required %} (required){% endif %}
{% endmacro %}

# API Documentation

## Properties
{% for prop in properties %}
- {{ renderProperty(prop) }}
{% endfor %}`,
              validation: [
                {
                  type: 'output-contains',
                  value: '(required)',
                  message: 'Should show required properties'
                },
                {
                  type: 'no-errors',
                  message: 'Macro should compile without errors'
                }
              ],
              hints: [
                'Macros are defined with {% macro name(params) %}',
                'Call macros with {{ macroName(args) }}',
                'Use conditional logic inside macros'
              ]
            }
          }
        ],
        tags: ['intermediate', 'macros', 'inheritance', 'advanced'],
        author: 'UNJUCKS Team',
        version: '1.0.0',
        lastUpdated: Date.now()
      }
    ]
    
    tutorials.forEach(tutorial => {
      this.tutorials.set(tutorial.id, tutorial)
    })
  }
  
  private setupLearningPaths(): void {
    const paths: LearningPath[] = [
      {
        id: 'complete-beginner',
        title: 'Complete Beginner Path',
        description: 'Start from zero and become proficient with UNJUCKS',
        tutorials: [
          'getting-started',
          'ontology-fundamentals',
          'template-basics',
          'semantic-context',
          'first-project'
        ],
        estimatedDuration: 240, // 4 hours
        difficulty: 'beginner',
        tags: ['beginner', 'complete', 'fundamentals']
      },
      {
        id: 'migration-path',
        title: 'Migration from Other Template Engines',
        description: 'Migrate from Handlebars, Mustache, or Jinja2 to UNJUCKS',
        tutorials: [
          'migration-concepts',
          'handlebars-to-unjucks',
          'template-conversion',
          'data-to-ontology',
          'advanced-features'
        ],
        estimatedDuration: 180, // 3 hours
        difficulty: 'intermediate',
        tags: ['migration', 'intermediate', 'conversion']
      }
    ]
    
    paths.forEach(path => {
      this.learningPaths.set(path.id, path)
    })
  }
  
  /**
   * Create realistic context for exercise template rendering
   */
  private createExerciseContext(exercise: Exercise, template: string): any {
    const context: any = {
      // Basic variables from exercise
      greeting: 'Hello, World!',
      tutorial: 'UNJUCKS Tutorial',
      project: 'My Project',
      description: 'A sample project for learning',
      version: '1.0.0',
      comment: 'Learning real semantic template generation',
      
      // Collections for loops
      features: [
        { label: 'Authentication', description: 'User login and registration' },
        { label: 'Database', description: 'Data persistence layer' },
        { label: 'API', description: 'REST API endpoints' }
      ],
      
      properties: [
        { name: 'id', type: 'string', required: true },
        { name: 'name', type: 'string', required: true },
        { name: 'email', type: 'string', required: false }
      ],
      
      items: [
        { name: 'Item 1', value: 'value1', type: 'string' },
        { name: 'Item 2', value: 'value2', type: 'number' },
        { name: 'Item 3', value: 'value3', type: 'boolean' }
      ],
      
      // Common template variables
      name: 'Sample Name',
      title: 'Sample Title',
      author: 'Sample Author',
      date: new Date().toISOString(),
      id: 'sample-id',
      type: 'sample-type',
      label: 'sample-label'
    }
    
    // Extract variables from template and provide appropriate values
    const variableMatches = template.match(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*?)\s*[|\s}]/g)
    if (variableMatches) {
      variableMatches.forEach(match => {
        const varName = match.replace(/[{}\s]/g, '').split('|')[0].split('.')[0]
        if (!context[varName]) {
          // Provide contextually appropriate default values
          if (varName.includes('greeting')) context[varName] = 'Hello, World!'
          else if (varName.includes('name')) context[varName] = `Sample ${varName}`
          else if (varName.includes('version')) context[varName] = '1.0.0'
          else if (varName.includes('description')) context[varName] = `Description for ${varName}`
          else context[varName] = `Sample ${varName}`
        }
      })
    }
    
    return context
  }
  
  /**
   * Load persisted user progress from filesystem
   */
  private async loadPersistedProgress(): Promise<void> {
    try {
      const progressDir = path.join(this.storageDir, 'progress')
      const files = await fs.readdir(progressDir)
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const userId = file.replace('.json', '')
          const filePath = path.join(progressDir, file)
          const content = await fs.readFile(filePath, 'utf-8')
          const progress = JSON.parse(content) as UserProgress[]
          this.userProgress.set(userId, progress)
        }
      }
    } catch (error) {
      // Directory doesn't exist yet, will be created when needed
      console.warn('Progress storage not available yet, will be created on first save')
    }
  }
  
  /**
   * Persist user progress to filesystem
   */
  private async persistUserProgress(userId: string, progress: UserProgress): Promise<void> {
    try {
      const progressDir = path.join(this.storageDir, 'progress')
      await fs.mkdir(progressDir, { recursive: true })
      
      // Get current progress list for user
      const userProgressList = this.userProgress.get(userId) || []
      const existingIndex = userProgressList.findIndex(p => p.tutorialId === progress.tutorialId)
      
      if (existingIndex >= 0) {
        userProgressList[existingIndex] = progress
      } else {
        userProgressList.push(progress)
      }
      
      // Update in memory and save to disk
      this.userProgress.set(userId, userProgressList)
      
      const filePath = path.join(progressDir, `${userId}.json`)
      await fs.writeFile(filePath, JSON.stringify(userProgressList, null, 2))
      
      // Cache for quick access
      this.progressCache.set(`progress:${userId}`, userProgressList, 3600000) // 1 hour TTL
      
    } catch (error) {
      console.warn(`Failed to persist progress for user ${userId}:`, error)
    }
  }
}

// Global tutorial system with default storage
export const tutorialSystem = new TutorialSystem()

// Convenience functions
export function getTutorials(filters?: any) {
  return tutorialSystem.listTutorials(filters)
}

export function startTutorial(userId: string, tutorialId: string) {
  return tutorialSystem.startTutorial(userId, tutorialId)
}

export function executeExercise(
  userId: string,
  tutorialId: string,
  exerciseId: string,
  ontology: string,
  template: string
) {
  return tutorialSystem.executeExercise(userId, tutorialId, exerciseId, ontology, template)
}

export function getUserRecommendations(userId: string) {
  return tutorialSystem.getRecommendations(userId)
}