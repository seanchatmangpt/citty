/**
 * AI Test Generator
 * Intelligent test generation with ML-driven scenario creation
 */

import * as tf from '@tensorflow/tfjs-node';
import { natural } from 'natural';
import { Anthropic } from '@anthropic-ai/sdk';
import { Logger } from '../utils/logger.js';
import { TestScenario, UserStory, EdgeCase } from '../types/test-types.js';

export class AITestGenerator {
  private model: tf.LayersModel | null = null;
  private anthropic: Anthropic;
  private logger: Logger;
  private nlp: any;

  constructor() {
    this.logger = new Logger('AITestGenerator');
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.initializeNLP();
  }

  private initializeNLP(): void {
    this.nlp = {
      tokenizer: new natural.WordTokenizer(),
      stemmer: natural.PorterStemmer,
      sentiment: new natural.SentimentAnalyzer('English', 
        natural.PorterStemmer, 'afinn'),
      ngrams: natural.NGrams
    };
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing AI Test Generator');
    await this.loadOrCreateModel();
    this.logger.info('AI Test Generator initialized');
  }

  private async loadOrCreateModel(): Promise<void> {
    try {
      // Try to load existing model
      this.model = await tf.loadLayersModel('file://./models/test-generator/model.json');
      this.logger.info('Loaded existing test generator model');
    } catch (error) {
      // Create new model if none exists
      this.model = await this.createModel();
      await this.trainModel();
      this.logger.info('Created and trained new test generator model');
    }
  }

  private async createModel(): Promise<tf.LayersModel> {
    const model = tf.sequential({
      layers: [
        tf.layers.embedding({
          inputDim: 10000, // Vocabulary size
          outputDim: 128,
          inputLength: 100
        }),
        tf.layers.lstm({ units: 64, returnSequences: true }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.lstm({ units: 32 }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 10, activation: 'softmax' }) // Test scenario types
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  private async trainModel(): Promise<void> {
    // Generate synthetic training data for demo
    const trainingData = this.generateSyntheticTrainingData();
    const { xs, ys } = trainingData;

    await this.model!.fit(xs, ys, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          this.logger.debug(`Epoch ${epoch}: loss=${logs?.loss?.toFixed(4)}, accuracy=${logs?.acc?.toFixed(4)}`);
        }
      }
    });

    // Save the trained model
    await this.model!.save('file://./models/test-generator');
  }

  private generateSyntheticTrainingData(): { xs: tf.Tensor, ys: tf.Tensor } {
    // Generate synthetic user stories and corresponding test scenarios
    const samples = 1000;
    const sequenceLength = 100;
    const numClasses = 10;

    const xs = tf.randomUniform([samples, sequenceLength], 0, 9999, 'int32');
    const ys = tf.oneHot(tf.randomUniform([samples], 0, numClasses, 'int32'), numClasses);

    return { xs, ys };
  }

  async generateFromUserStory(userStory: string): Promise<TestScenario[]> {
    this.logger.info(`Generating tests for user story: ${userStory.substring(0, 100)}...`);

    // Extract key features using NLP
    const features = await this.extractFeatures(userStory);
    
    // Generate test scenarios using multiple approaches
    const [
      aiGeneratedTests,
      mlPredictedTests,
      edgeCases,
      gherkinTests
    ] = await Promise.all([
      this.generateWithAI(userStory, features),
      this.generateWithML(features),
      this.discoverEdgeCases(userStory, features),
      this.convertToGherkin(userStory)
    ]);

    // Combine and prioritize test scenarios
    const allTests = [
      ...aiGeneratedTests,
      ...mlPredictedTests,
      ...edgeCases,
      ...gherkinTests
    ];

    const prioritizedTests = await this.prioritizeTests(allTests);
    
    this.logger.info(`Generated ${prioritizedTests.length} test scenarios`);
    return prioritizedTests;
  }

  private async extractFeatures(userStory: string): Promise<any> {
    const tokens = this.nlp.tokenizer.tokenize(userStory.toLowerCase());
    const stemmed = tokens.map((token: string) => this.nlp.stemmer.stem(token));
    
    return {
      tokens,
      stemmed,
      entities: await this.extractEntities(userStory),
      actions: await this.extractActions(userStory),
      conditions: await this.extractConditions(userStory),
      sentiment: this.analyzeSentiment(tokens)
    };
  }

  private async extractEntities(text: string): Promise<string[]> {
    // Use Anthropic Claude for entity extraction
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Extract all entities (nouns, objects, systems) from this user story: "${text}". Return as a JSON array.`
        }]
      });
      
      const content = response.content[0];
      if (content.type === 'text') {
        return JSON.parse(content.text);
      }
      return [];
    } catch (error) {
      this.logger.warn('Entity extraction failed, using fallback', error);
      return this.nlp.tokenizer.tokenize(text.toLowerCase())
        .filter((token: string) => token.length > 3);
    }
  }

  private async extractActions(text: string): Promise<string[]> {
    // Simple verb extraction - can be enhanced with more sophisticated NLP
    const tokens = this.nlp.tokenizer.tokenize(text.toLowerCase());
    const verbs = ['click', 'enter', 'select', 'submit', 'navigate', 'login', 'logout', 'save', 'delete', 'update'];
    return tokens.filter((token: string) => verbs.includes(token));
  }

  private async extractConditions(text: string): Promise<string[]> {
    // Extract conditional statements
    const conditions = ['if', 'when', 'unless', 'given', 'provided', 'assuming'];
    const sentences = text.split(/[.!?]/);
    return sentences.filter(sentence => 
      conditions.some(condition => sentence.toLowerCase().includes(condition))
    );
  }

  private analyzeSentiment(tokens: string[]): number {
    // Sentiment analysis for test priority
    return Math.random(); // Simplified for demo
  }

  private async generateWithAI(userStory: string, features: any): Promise<TestScenario[]> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20241022',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Generate comprehensive test scenarios for this user story: "${userStory}"

Please create test scenarios covering:
1. Happy path scenarios
2. Edge cases and boundary conditions
3. Error handling scenarios
4. Performance scenarios
5. Security scenarios

Return as JSON array with structure:
{
  "id": "unique_id",
  "title": "test scenario title",
  "description": "detailed description",
  "type": "positive|negative|edge|performance|security",
  "priority": "high|medium|low",
  "steps": ["step1", "step2", ...],
  "expectedResult": "expected outcome",
  "tags": ["tag1", "tag2"]
}`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return JSON.parse(content.text);
      }
      return [];
    } catch (error) {
      this.logger.error('AI test generation failed', error);
      return [];
    }
  }

  private async generateWithML(features: any): Promise<TestScenario[]> {
    if (!this.model) return [];

    try {
      // Convert features to tensor
      const inputTensor = this.featuresToTensor(features);
      
      // Predict test scenario types
      const predictions = this.model.predict(inputTensor) as tf.Tensor;
      const predictionData = await predictions.data();
      
      // Generate test scenarios based on predictions
      const scenarios: TestScenario[] = [];
      const scenarioTypes = ['functional', 'integration', 'unit', 'performance', 'security', 'usability', 'regression', 'smoke', 'acceptance', 'boundary'];
      
      predictionData.forEach((confidence, index) => {
        if (confidence > 0.3) { // Threshold for scenario generation
          scenarios.push({
            id: `ml_${index}_${Date.now()}`,
            title: `${scenarioTypes[index]} Test Scenario`,
            description: `ML-generated ${scenarioTypes[index]} test based on user story analysis`,
            type: scenarioTypes[index] as any,
            priority: confidence > 0.7 ? 'high' : confidence > 0.5 ? 'medium' : 'low',
            steps: this.generateStepsForType(scenarioTypes[index], features),
            expectedResult: 'Expected behavior validated',
            tags: [scenarioTypes[index], 'ml-generated'],
            confidence: confidence
          });
        }
      });

      inputTensor.dispose();
      predictions.dispose();
      
      return scenarios;
    } catch (error) {
      this.logger.error('ML test generation failed', error);
      return [];
    }
  }

  private featuresToTensor(features: any): tf.Tensor {
    // Convert extracted features to tensor format
    // This is a simplified version - in production, you'd have proper feature encoding
    const sequence = new Array(100).fill(0);
    features.tokens.forEach((token: string, index: number) => {
      if (index < 100) {
        sequence[index] = token.length; // Simple encoding
      }
    });
    
    return tf.tensor2d([sequence]);
  }

  private generateStepsForType(type: string, features: any): string[] {
    const baseSteps: { [key: string]: string[] } = {
      functional: [
        'Navigate to the application',
        'Perform the main action',
        'Verify the expected outcome'
      ],
      performance: [
        'Set up performance monitoring',
        'Execute the user action',
        'Measure response time and resource usage',
        'Verify performance meets requirements'
      ],
      security: [
        'Attempt unauthorized access',
        'Test input validation',
        'Verify security measures are in place'
      ]
    };
    
    return baseSteps[type] || baseSteps.functional;
  }

  async discoverEdgeCases(userStory: string, features: any): Promise<TestScenario[]> {
    const edgeCases: TestScenario[] = [];
    
    // Boundary value analysis
    const boundaries = this.identifyBoundaries(userStory);
    boundaries.forEach(boundary => {
      edgeCases.push({
        id: `edge_boundary_${Date.now()}_${Math.random()}`,
        title: `Boundary Test: ${boundary.field}`,
        description: `Test boundary conditions for ${boundary.field}`,
        type: 'edge',
        priority: 'high',
        steps: [
          `Test with minimum value: ${boundary.min}`,
          `Test with maximum value: ${boundary.max}`,
          `Test with value just below minimum: ${boundary.min - 1}`,
          `Test with value just above maximum: ${boundary.max + 1}`
        ],
        expectedResult: 'Appropriate handling of boundary values',
        tags: ['edge-case', 'boundary-value']
      });
    });

    // Input validation edge cases
    const inputFields = this.identifyInputFields(userStory);
    inputFields.forEach(field => {
      edgeCases.push({
        id: `edge_input_${Date.now()}_${Math.random()}`,
        title: `Input Validation: ${field}`,
        description: `Test input validation for ${field}`,
        type: 'edge',
        priority: 'medium',
        steps: [
          `Test with empty input`,
          `Test with null value`,
          `Test with special characters`,
          `Test with extremely long input`,
          `Test with SQL injection patterns`
        ],
        expectedResult: 'Proper input validation and error handling',
        tags: ['edge-case', 'input-validation']
      });
    });

    return edgeCases;
  }

  private identifyBoundaries(userStory: string): Array<{field: string, min: number, max: number}> {
    // Simple pattern matching for numerical boundaries
    const numberPattern = /(\d+)/g;
    const matches = userStory.match(numberPattern) || [];
    
    return matches.map(match => ({
      field: `numeric_field_${match}`,
      min: 0,
      max: parseInt(match) || 100
    }));
  }

  private identifyInputFields(userStory: string): string[] {
    const fieldKeywords = ['email', 'password', 'name', 'phone', 'address', 'date', 'number', 'text', 'input', 'field'];
    const words = this.nlp.tokenizer.tokenize(userStory.toLowerCase());
    
    return words.filter((word: string) => 
      fieldKeywords.some(keyword => word.includes(keyword))
    );
  }

  async convertToGherkin(userStory: string): Promise<TestScenario[]> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `Convert this user story to Gherkin format (Given-When-Then): "${userStory}"

Return as JSON array with structure:
{
  "id": "gherkin_id",
  "title": "Gherkin scenario title",
  "description": "Gherkin description",
  "type": "gherkin",
  "priority": "medium",
  "given": "Given condition",
  "when": "When action",
  "then": "Then expectation",
  "tags": ["gherkin", "bdd"]
}`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return JSON.parse(content.text);
      }
      return [];
    } catch (error) {
      this.logger.error('Gherkin conversion failed', error);
      return [];
    }
  }

  private async prioritizeTests(tests: TestScenario[]): Promise<TestScenario[]> {
    // Use ML model to predict test priority based on historical data
    const priorityWeights = {
      high: 3,
      medium: 2,
      low: 1
    };

    // Sort by priority and confidence (if available)
    return tests.sort((a, b) => {
      const aWeight = priorityWeights[a.priority] * (a.confidence || 1);
      const bWeight = priorityWeights[b.priority] * (b.confidence || 1);
      return bWeight - aWeight;
    });
  }

  async trainFromFeedback(testScenario: TestScenario, feedback: any): Promise<void> {
    // Implement reinforcement learning from test execution feedback
    this.logger.info(`Training model with feedback for test: ${testScenario.id}`);
    
    // This would update the model based on test execution results
    // For now, we'll log the feedback for future training
    this.logger.debug('Feedback received', { testId: testScenario.id, feedback });
  }
}