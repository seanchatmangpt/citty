/**
 * 🎓 COMPREHENSIVE TUTORIAL SYSTEM
 * Progressive learning path with interactive exercises and real-world scenarios
 */

import { EventEmitter } from 'events'
import * as fs from 'fs/promises'
import * as path from 'path'
import { interactivePlayground } from './interactive-playground'
import { productionMonitor } from './production-monitoring'

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
  
  constructor() {
    super()
    this.setupBuiltinTutorials()
    this.setupLearningPaths()
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
   * Start tutorial for user
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
    
    // Track analytics
    productionMonitor.recordMetric('tutorial.started', 1, {
      tutorialId,
      category: tutorial.category,
      difficulty: tutorial.difficulty.toString()
    })
    
    this.emit('tutorial:started', { userId, tutorialId, progress })
    return progress
  }
  
  /**
   * Complete tutorial section
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
    
    // Check if tutorial is complete
    if (progress.sectionsCompleted.length === tutorial.sections.length) {
      await this.completeTutorial(userId, tutorialId)
    }
    
    this.emit('section:completed', { userId, tutorialId, sectionId })
  }
  
  /**
   * Execute and validate exercise
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
    
    // Execute in playground
    const sessionId = await interactivePlayground.createSession(ontology, template)
    const result = await interactivePlayground.executePlayground(sessionId, ontology, template)
    
    // Validate results
    const validationResults = await this.validateExercise(exercise, result)
    const passedValidations = validationResults.filter(v => v.passed).length
    const score = Math.round((passedValidations / validationResults.length) * 100)
    
    const success = validationResults.every(v => v.passed)
    
    // Update progress if successful
    if (success) {
      const progress = this.getUserProgress(userId, tutorialId)
      if (!progress.exercisesCompleted.includes(exerciseId)) {
        progress.exercisesCompleted.push(exerciseId)
      }
      progress.lastAccessedAt = Date.now()
    }
    
    // Track analytics
    productionMonitor.recordMetric('tutorial.exercise.completed', 1, {
      tutorialId,
      exerciseId,
      success: success.toString(),
      score: score.toString()
    })
    
    const response = {
      success,
      output: result.output,
      errors: result.errors,
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
          const regex = new RegExp(rule.value)
          passed = regex.test(result.output)
          break
        
        case 'no-errors':
          passed = result.errors.length === 0
          break
        
        case 'custom':
          if (rule.validator) {
            passed = rule.validator(result)
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
    
    // Track analytics
    productionMonitor.recordMetric('tutorial.completed', 1, {
      tutorialId,
      category: tutorial.category,
      timeSpent: progress.timeSpent.toString()
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
  
  private setupBuiltinTutorials(): void {
    const tutorials: Tutorial[] = [
      {
        id: 'getting-started',
        title: 'Getting Started with UNJUCKS',
        description: 'Learn the basics of semantic template generation',
        category: 'fundamentals',
        difficulty: 1,
        estimatedDuration: 30,
        prerequisites: [],
        objectives: [
          'Understand what UNJUCKS is and why it exists',
          'Create your first ontology',
          'Write your first template',
          'Generate your first output'
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
            `
          },
          {
            id: 'first-ontology',
            title: 'Your First Ontology',
            type: 'exercise',
            content: 'Now let\'s create your first ontology that describes a simple greeting.',
            exercise: {
              id: 'hello-world-ontology',
              title: 'Create Hello World Ontology',
              description: 'Create an ontology that describes a greeting message',
              instructions: [
                'Define a namespace using @prefix',
                'Create a greeting entity with a label',
                'Use proper RDF syntax'
              ],
              startingOntology: `@prefix ex: <http://example.com/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

# Your ontology here`,
              expectedOutput: 'Hello, World!',
              validation: [
                {
                  type: 'output-contains',
                  value: 'Hello',
                  message: 'Output should contain "Hello"'
                },
                {
                  type: 'no-errors',
                  message: 'Template should compile without errors'
                }
              ],
              hints: [
                'Use rdfs:label to define the greeting text',
                'Don\'t forget the period at the end of RDF statements'
              ],
              solution: {
                ontology: `@prefix ex: <http://example.com/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:greeting rdfs:label "Hello, World!" .`,
                template: `{{ greeting }}`,
                explanation: 'The ontology defines a greeting entity with a label, which becomes available in the template context.'
              }
            }
          }
        ],
        resources: [
          {
            type: 'reference',
            title: 'RDF Primer',
            url: 'https://www.w3.org/TR/rdf-primer/',
            description: 'Introduction to RDF concepts'
          }
        ],
        tags: ['beginner', 'fundamentals', 'getting-started'],
        author: 'UNJUCKS Team',
        version: '1.0.0',
        lastUpdated: Date.now()
      }
      // More tutorials would be added here...
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
}

// Global tutorial system
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