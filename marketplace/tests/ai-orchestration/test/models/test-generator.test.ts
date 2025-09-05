/**
 * AI Test Generator Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AITestGenerator } from '../../src/models/test-generator.js';
import { createMockUserStory, mockTensorFlow, mockAnthropic, TestHelper } from '../setup.js';

// Mock dependencies
vi.mock('@tensorflow/tfjs-node', () => mockTensorFlow);
vi.mock('@anthropic-ai/sdk', () => ({
  Anthropic: vi.fn(() => mockAnthropic)
}));
vi.mock('natural', () => ({
  WordTokenizer: vi.fn(() => ({ tokenize: (text: string) => text.split(' ') })),
  PorterStemmer: { stem: (word: string) => word.toLowerCase() },
  SentimentAnalyzer: vi.fn(),
  NGrams: {}
}));

describe('AITestGenerator', () => {
  let testGenerator: AITestGenerator;

  beforeEach(() => {
    testGenerator = new AITestGenerator();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(testGenerator.initialize()).resolves.not.toThrow();
    });

    it('should set up NLP components', () => {
      expect(testGenerator['nlp']).toBeDefined();
      expect(testGenerator['nlp'].tokenizer).toBeDefined();
    });
  });

  describe('generateFromUserStory', () => {
    it('should generate test scenarios from user story', async () => {
      const userStory = 'As a user, I want to log in to access my account';
      
      const scenarios = await testGenerator.generateFromUserStory(userStory);
      
      expect(scenarios).toBeInstanceOf(Array);
      expect(scenarios.length).toBeGreaterThan(0);
      
      const scenario = scenarios[0];
      expect(scenario).toHaveProperty('id');
      expect(scenario).toHaveProperty('title');
      expect(scenario).toHaveProperty('description');
      expect(scenario).toHaveProperty('type');
      expect(scenario).toHaveProperty('priority');
      expect(scenario).toHaveProperty('steps');
      expect(scenario).toHaveProperty('expectedResult');
      expect(scenario).toHaveProperty('tags');
    });

    it('should handle empty user story', async () => {
      const scenarios = await testGenerator.generateFromUserStory('');
      expect(scenarios).toBeInstanceOf(Array);
    });

    it('should generate different scenarios for different story types', async () => {
      const loginStory = 'As a user, I want to log in to access my account';
      const paymentStory = 'As a customer, I want to make a payment for my order';
      
      const loginScenarios = await testGenerator.generateFromUserStory(loginStory);
      const paymentScenarios = await testGenerator.generateFromUserStory(paymentStory);
      
      expect(loginScenarios).not.toEqual(paymentScenarios);
    });
  });

  describe('feature extraction', () => {
    it('should extract features from user story', async () => {
      const userStory = 'As a user, I want to log in with email and password';
      
      const features = await testGenerator['extractFeatures'](userStory);
      
      expect(features).toHaveProperty('tokens');
      expect(features).toHaveProperty('stemmed');
      expect(features).toHaveProperty('entities');
      expect(features).toHaveProperty('actions');
      expect(features).toHaveProperty('conditions');
      expect(features.tokens).toBeInstanceOf(Array);
    });

    it('should identify common entities', async () => {
      const userStory = 'User wants to login with email and password to access dashboard';
      
      const entities = await testGenerator['extractEntities'](userStory);
      
      expect(entities).toBeInstanceOf(Array);
      // Should identify entities like 'email', 'password', 'dashboard'
    });

    it('should extract actions from story', async () => {
      const userStory = 'User wants to click login button and navigate to dashboard';
      
      const actions = await testGenerator['extractActions'](userStory);
      
      expect(actions).toBeInstanceOf(Array);
      expect(actions).toContain('login');
    });
  });

  describe('edge case discovery', () => {
    it('should discover edge cases', async () => {
      const userStory = 'As a user, I want to enter my age to register';
      const features = { tokens: ['age', 'register'], entities: ['age'], actions: ['enter'] };
      
      const edgeCases = await testGenerator.discoverEdgeCases(userStory, features);
      
      expect(edgeCases).toBeInstanceOf(Array);
      
      if (edgeCases.length > 0) {
        const edgeCase = edgeCases[0];
        expect(edgeCase).toHaveProperty('type', 'edge');
        expect(edgeCase).toHaveProperty('steps');
        expect(edgeCase).toHaveProperty('tags');
        expect(edgeCase.tags).toContain('edge-case');
      }
    });

    it('should identify boundary values', async () => {
      const userStory = 'User can enter age between 18 and 65';
      
      const boundaries = testGenerator['identifyBoundaries'](userStory);
      
      expect(boundaries).toBeInstanceOf(Array);
      if (boundaries.length > 0) {
        expect(boundaries[0]).toHaveProperty('field');
        expect(boundaries[0]).toHaveProperty('min');
        expect(boundaries[0]).toHaveProperty('max');
      }
    });

    it('should identify input fields', async () => {
      const userStory = 'User enters email, password, and phone number';
      
      const fields = testGenerator['identifyInputFields'](userStory);
      
      expect(fields).toBeInstanceOf(Array);
      expect(fields.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Gherkin conversion', () => {
    it('should convert user story to Gherkin format', async () => {
      const userStory = 'As a user, I want to log in to access my account';
      
      const gherkinScenarios = await testGenerator.convertToGherkin(userStory);
      
      expect(gherkinScenarios).toBeInstanceOf(Array);
      
      if (gherkinScenarios.length > 0) {
        const scenario = gherkinScenarios[0];
        expect(scenario).toHaveProperty('type', 'gherkin');
        expect(scenario.tags).toContain('bdd');
      }
    });
  });

  describe('test prioritization', () => {
    it('should prioritize tests correctly', async () => {
      const tests = [
        { id: '1', priority: 'low', confidence: 0.5 },
        { id: '2', priority: 'high', confidence: 0.9 },
        { id: '3', priority: 'medium', confidence: 0.7 }
      ];
      
      const prioritized = await testGenerator['prioritizeTests'](tests as any);
      
      expect(prioritized).toBeInstanceOf(Array);
      expect(prioritized.length).toBe(3);
      
      // High priority with high confidence should be first
      expect(prioritized[0].id).toBe('2');
    });
  });

  describe('ML model integration', () => {
    it('should use ML model for test generation when available', async () => {
      // Ensure model is loaded
      await testGenerator.initialize();
      
      const features = { tokens: ['login', 'user'], stemmed: ['login', 'user'] };
      
      const mlScenarios = await testGenerator['generateWithML'](features);
      
      expect(mlScenarios).toBeInstanceOf(Array);
      
      if (mlScenarios.length > 0) {
        const scenario = mlScenarios[0];
        expect(scenario).toHaveProperty('id');
        expect(scenario).toHaveProperty('confidence');
        expect(scenario.tags).toContain('ml-generated');
      }
    });

    it('should convert features to tensor format', async () => {
      const features = {
        tokens: ['user', 'login', 'password'],
        stemmed: ['user', 'login', 'password']
      };
      
      const tensor = testGenerator['featuresToTensor'](features);
      
      expect(tensor).toBeDefined();
      expect(tensor.shape).toEqual([1, 100]); // 1 batch, 100 features
    });
  });

  describe('training feedback', () => {
    it('should accept training feedback', async () => {
      const testScenario = createMockUserStory();
      const feedback = { success: true, executionTime: 1000 };
      
      await expect(
        testGenerator.trainFromFeedback(testScenario as any, feedback)
      ).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle AI service failures gracefully', async () => {
      // Mock AI service failure
      const mockFailingAnthropic = {
        messages: {
          create: async () => {
            throw new Error('API Error');
          }
        }
      };
      
      // Temporarily replace the service
      testGenerator['anthropic'] = mockFailingAnthropic as any;
      
      const scenarios = await testGenerator.generateFromUserStory('Test story');
      
      // Should still return array, even if AI generation fails
      expect(scenarios).toBeInstanceOf(Array);
    });

    it('should handle malformed AI responses', async () => {
      // Mock malformed response
      const mockMalformedAnthropic = {
        messages: {
          create: async () => ({
            content: [{
              type: 'text',
              text: 'Invalid JSON response'
            }]
          })
        }
      };
      
      testGenerator['anthropic'] = mockMalformedAnthropic as any;
      
      const scenarios = await testGenerator.generateFromUserStory('Test story');
      
      expect(scenarios).toBeInstanceOf(Array);
    });
  });

  describe('performance', () => {
    it('should generate tests within reasonable time', async () => {
      const start = Date.now();
      
      const scenarios = await testGenerator.generateFromUserStory(
        'As a user, I want to complete a complex multi-step checkout process'
      );
      
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(scenarios.length).toBeGreaterThan(0);
    });

    it('should handle concurrent generation requests', async () => {
      const requests = Array(5).fill(null).map(() =>
        testGenerator.generateFromUserStory('As a user, I want to test concurrent generation')
      );
      
      const results = await Promise.all(requests);
      
      expect(results).toHaveLength(5);
      results.forEach(scenarios => {
        expect(scenarios).toBeInstanceOf(Array);
      });
    });
  });
});