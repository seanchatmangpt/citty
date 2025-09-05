import { describe, it, expect, beforeEach } from 'vitest';
import {
  // Base schemas
  MultiDimensionalEntitySchema,
  VectorEmbeddingSchema,
  DimensionalAttributeSchema,
  DimensionalUtils,
  
  // Entity schemas
  MarketplaceItemSchema,
  ItemSearchSchema,
  CreateMarketplaceItemSchema,
  
  // Relationship schemas
  MarketplaceRelationshipSchema,
  UserItemInteractionSchema,
  ItemSimilaritySchema,
  
  // Transaction schemas
  MultiPartyTransactionSchema,
  TransactionPartySchema,
  PaymentInfoSchema,
  
  // Trust schemas
  TrustScoreSchema,
  TrustMetricSchema,
  ReputationProfileSchema,
  
  // Workflow schemas
  MarketplaceWorkflowSchema,
  WorkflowTaskSchema,
  WorkflowExecutionSchema,
  
  // Scheduling schemas
  ResourceAvailabilitySchema,
  TimeSlotSchema,
  SchedulingSystemSchema,
  
  // Utilities
  ModelTransformationUtils,
  VectorEmbeddingUtils,
  DimensionalQueryUtils,
  DataValidationUtils,
  CacheUtils
} from '../marketplace/server/models/index.js';

describe('N-Dimensional Marketplace Models', () => {
  
  describe('Base Dimensional Schema', () => {
    it('should validate vector embedding schema', () => {
      const validEmbedding = {
        dimensions: 768,
        values: Array.from({ length: 768 }, () => Math.random()),
        model: 'text-embedding-v1',
        metadata: { source: 'test' }
      };
      
      const result = VectorEmbeddingSchema.safeParse(validEmbedding);
      expect(result.success).toBe(true);
    });
    
    it('should reject invalid vector embeddings', () => {
      const invalidEmbedding = {
        dimensions: 768,
        values: [], // Empty values array
        model: 'test'
      };
      
      const result = VectorEmbeddingSchema.safeParse(invalidEmbedding);
      expect(result.success).toBe(false);
    });
    
    it('should validate multi-dimensional entity', () => {
      const entity = {
        id: 'test-entity-1',
        type: 'marketplace_item',
        dimensions: [
          {
            type: 'category',
            name: 'primary_category',
            value: 'electronics',
            weight: 1.0
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };
      
      const result = MultiDimensionalEntitySchema.safeParse(entity);
      expect(result.success).toBe(true);
    });
    
    it('should calculate dimensional scores correctly', () => {
      const dimensions = [
        { type: 'quality', name: 'overall', value: 0.8, weight: 0.5 },
        { type: 'trust', name: 'seller_trust', value: 0.9, weight: 0.3 },
        { type: 'social', name: 'popularity', value: 0.7, weight: 0.2 }
      ];
      
      const score = DimensionalUtils.calculateDimensionalScore(dimensions);
      expect(score).toBeCloseTo(0.81, 2);
    });
    
    it('should calculate vector similarity correctly', () => {
      const vector1 = [1, 0, 0];
      const vector2 = [0, 1, 0];
      const vector3 = [1, 0, 0];
      
      const similarity1 = DimensionalUtils.cosineSimilarity(vector1, vector2);
      const similarity2 = DimensionalUtils.cosineSimilarity(vector1, vector3);
      
      expect(similarity1).toBeCloseTo(0, 1);
      expect(similarity2).toBeCloseTo(1, 1);
    });
  });
  
  describe('Marketplace Item Schema', () => {
    it('should validate complete marketplace item', () => {
      const item = {
        id: 'item-1',
        type: 'marketplace_item',
        dimensions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        title: 'Premium Wireless Headphones',
        description: 'High-quality wireless headphones with noise cancellation',
        itemType: 'physical_product',
        status: 'active',
        sellerId: 'seller-123',
        basePrice: 199.99,
        currency: 'USD',
        inventory: {
          tracked: true,
          quantity: 50,
          reserved: 5,
          available: 45
        },
        shippingInfo: {
          required: true,
          weight: 0.5,
          options: [
            {
              method: 'standard',
              cost: 9.99,
              estimatedDays: { min: 3, max: 7 }
            }
          ]
        }
      };
      
      const result = MarketplaceItemSchema.safeParse(item);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Premium Wireless Headphones');
        expect(result.data.basePrice).toBe(199.99);
      }
    });
    
    it('should validate item search parameters', () => {
      const search = {
        query: 'wireless headphones',
        filters: {
          priceRange: { min: 50, max: 300 },
          categories: ['electronics', 'audio'],
          itemType: ['physical_product']
        },
        sort: { field: 'price_asc' },
        pagination: { page: 1, limit: 20 }
      };
      
      const result = ItemSearchSchema.safeParse(search);
      expect(result.success).toBe(true);
    });
    
    it('should validate create item DTO', () => {
      const createItem = {
        type: 'marketplace_item',
        dimensions: [],
        title: 'New Product',
        description: 'A new product for testing',
        itemType: 'digital_product',
        sellerId: 'seller-456',
        basePrice: 29.99,
        digitalAssetInfo: {
          downloadable: true,
          fileTypes: ['pdf'],
          downloadLimit: 5
        }
      };
      
      const result = CreateMarketplaceItemSchema.safeParse(createItem);
      expect(result.success).toBe(true);
    });
  });
  
  describe('Relationship Models', () => {
    it('should validate marketplace relationship', () => {
      const relationship = {
        id: 'rel-1',
        sourceId: 'item-1',
        targetId: 'item-2',
        relationshipType: 'similar_to',
        strength: 0.85,
        bidirectional: true,
        context: {
          source: 'ml_model',
          confidence: 0.9,
          evidence: []
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = MarketplaceRelationshipSchema.safeParse(relationship);
      expect(result.success).toBe(true);
    });
    
    it('should validate user-item interaction', () => {
      const interaction = {
        id: 'int-1',
        sourceId: 'user-123',
        targetId: 'item-456',
        relationshipType: 'purchased_together',
        context: {
          source: 'user_behavior',
          confidence: 1.0
        },
        userId: 'user-123',
        itemId: 'item-456',
        interactionType: 'purchase',
        session: {
          id: 'session-789',
          timestamp: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = UserItemInteractionSchema.safeParse(interaction);
      expect(result.success).toBe(true);
    });
  });
  
  describe('Multi-Party Transaction Models', () => {
    it('should validate multi-party transaction', () => {
      const transaction = {
        id: 'txn-1',
        type: 'marketplace_transaction',
        dimensions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        transactionNumber: 'TXN-001',
        type: 'purchase',
        status: 'pending',
        parties: [
          {
            id: 'party-buyer',
            type: 'user',
            role: 'buyer',
            identity: {
              userId: 'user-123',
              name: 'John Doe',
              email: 'john@example.com'
            },
            joinedAt: new Date()
          },
          {
            id: 'party-seller',
            type: 'user',
            role: 'seller',
            identity: {
              userId: 'seller-456',
              name: 'Jane Smith',
              email: 'jane@example.com'
            },
            joinedAt: new Date()
          }
        ],
        items: [
          {
            id: 'item-1',
            itemId: 'product-123',
            type: 'product',
            name: 'Test Product',
            quantity: 1,
            unitPrice: 99.99,
            totalPrice: 99.99
          }
        ],
        payment: {
          id: 'payment-1',
          method: 'credit_card',
          provider: 'stripe',
          subtotal: 99.99,
          taxes: 8.00,
          fees: 2.99,
          shipping: 9.99,
          discounts: 0,
          total: 120.97,
          currency: 'USD',
          status: 'pending'
        },
        workflow: {
          stages: [],
          completedStages: []
        }
      };
      
      const result = MultiPartyTransactionSchema.safeParse(transaction);
      expect(result.success).toBe(true);
    });
    
    it('should validate transaction party', () => {
      const party = {
        id: 'party-1',
        type: 'user',
        role: 'buyer',
        identity: {
          userId: 'user-123',
          name: 'Test User',
          email: 'test@example.com',
          verified: true,
          verificationLevel: 'basic'
        },
        joinedAt: new Date()
      };
      
      const result = TransactionPartySchema.safeParse(party);
      expect(result.success).toBe(true);
    });
  });
  
  describe('Trust Score Models', () => {
    it('should validate trust score', () => {
      const trustScore = {
        id: 'trust-1',
        type: 'trust_score',
        dimensions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        entityId: 'user-123',
        entityType: 'user',
        overallScore: 0.85,
        components: [
          {
            component: 'transaction_history',
            score: 0.9,
            weight: 0.4,
            confidence: 0.95,
            sources: [
              {
                type: 'transaction',
                id: 'txn-1',
                timestamp: new Date(),
                weight: 1.0,
                reliability: 0.9
              }
            ],
            temporal: {
              decayRate: 0.1,
              halfLife: 365,
              lastUpdate: new Date(),
              trendDirection: 'stable'
            },
            statistics: {
              mean: 0.9,
              variance: 0.01,
              sampleSize: 10
            }
          }
        ],
        calculation: {
          method: 'weighted_average',
          version: '1.0',
          lastCalculated: new Date()
        }
      };
      
      const result = TrustScoreSchema.safeParse(trustScore);
      expect(result.success).toBe(true);
    });
    
    it('should validate reputation profile', () => {
      const profile = {
        id: 'profile-1',
        entityId: 'user-123',
        entityType: 'user',
        overall: {
          score: 0.85,
          rank: 1250,
          percentile: 78.5,
          level: 'gold'
        },
        statistics: {
          totalTransactions: 45,
          successfulTransactions: 43,
          disputedTransactions: 1,
          averageRating: 4.7,
          totalReviews: 38,
          responseRate: 0.95,
          completionRate: 0.98
        },
        lastUpdated: new Date()
      };
      
      const result = ReputationProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
    });
  });
  
  describe('Workflow Models', () => {
    it('should validate marketplace workflow', () => {
      const workflow = {
        id: 'workflow-1',
        type: 'marketplace_workflow',
        dimensions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        name: 'Order Fulfillment Workflow',
        description: 'Standard order processing workflow',
        type: 'order_fulfillment',
        definition: {
          tasks: [
            {
              id: 'task-1',
              name: 'Payment Processing',
              type: 'automated',
              status: 'pending',
              createdAt: new Date(),
              updatedAt: new Date()
            }
          ],
          transitions: [],
          startTasks: ['task-1'],
          endTasks: ['task-1'],
          variables: []
        },
        permissions: {
          owner: 'admin-123'
        }
      };
      
      const result = MarketplaceWorkflowSchema.safeParse(workflow);
      expect(result.success).toBe(true);
    });
    
    it('should validate workflow execution', () => {
      const execution = {
        id: 'exec-1',
        workflowId: 'workflow-1',
        workflowVersion: 1,
        status: 'running',
        startedAt: new Date(),
        initiatedBy: 'user-123'
      };
      
      const result = WorkflowExecutionSchema.safeParse(execution);
      expect(result.success).toBe(true);
    });
  });
  
  describe('Scheduling and Availability Models', () => {
    it('should validate resource availability', () => {
      const resource = {
        id: 'resource-1',
        resourceId: 'service-room-1',
        resourceType: 'location',
        resourceName: 'Conference Room A',
        capacity: {
          total: 12,
          unit: 'people',
          concurrent: false,
          sharable: false
        },
        operatingHours: [
          {
            dayOfWeek: 'monday',
            openTime: '09:00',
            closeTime: '17:00',
            closed: false,
            breaks: []
          }
        ],
        bookingRules: {
          minBookingDuration: 30,
          slotDuration: 60,
          bufferTime: 15,
          advanceBookingWindow: {
            min: 60,
            max: 10080
          },
          cancellationPolicy: {
            allowCancellation: true,
            cancellationDeadline: 1440,
            refundPercentage: 100
          },
          reschedulePolicy: {
            allowReschedule: true,
            rescheduleDeadline: 1440,
            rescheduleLimit: 3,
            feeApplies: false
          }
        },
        status: 'active',
        createdBy: 'admin-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };
      
      const result = ResourceAvailabilitySchema.safeParse(resource);
      expect(result.success).toBe(true);
    });
    
    it('should validate time slot', () => {
      const timeSlot = {
        id: 'slot-1',
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000), // 1 hour later
        duration: 60,
        status: 'available',
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = TimeSlotSchema.safeParse(timeSlot);
      expect(result.success).toBe(true);
    });
    
    it('should validate scheduling system', () => {
      const system = {
        id: 'system-1',
        type: 'scheduling_system',
        dimensions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        name: 'Main Scheduling System',
        type: 'service_booking',
        configuration: {
          timezone: {
            timezone: 'America/New_York',
            offset: -300,
            dstActive: true,
            dstOffset: -60
          },
          workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          defaultSlotDuration: 60,
          bookingWindow: {
            maxAdvanceDays: 30,
            minAdvanceHours: 2
          },
          conflictResolution: {
            autoResolve: false,
            notifyOnConflict: true,
            allowOverbooking: false,
            overbookingThreshold: 1.0
          },
          notifications: {
            enabled: true,
            reminderPeriods: [1440, 60],
            confirmationRequired: true,
            autoCancel: {
              enabled: false,
              noShowThreshold: 15
            }
          },
          integrations: {
            calendar: false,
            payments: false,
            crm: false,
            analytics: true
          }
        },
        permissions: {
          managers: ['admin-123']
        },
        auditSettings: {
          logBookings: true,
          logChanges: true,
          logAccess: false,
          retentionDays: 365
        }
      };
      
      const result = SchedulingSystemSchema.safeParse(system);
      expect(result.success).toBe(true);
    });
  });
  
  describe('Model Utilities', () => {
    beforeEach(() => {
      CacheUtils.clear();
    });
    
    it('should transform model for response', () => {
      const data = {
        id: '123',
        name: 'Test Item',
        password: 'secret123',
        apiKey: 'key-123',
        description: '  Test description  '
      };
      
      const transformed = ModelTransformationUtils.transformForResponse(data, {
        target: 'response',
        options: {
          includePrivateFields: false,
          normalizeValues: true
        }
      });
      
      expect(transformed.password).toBeUndefined();
      expect(transformed.apiKey).toBeUndefined();
      expect(transformed.description).toBe('Test description');
      expect(transformed.name).toBe('Test Item');
    });
    
    it('should validate email addresses', () => {
      expect(DataValidationUtils.isValidEmail('test@example.com')).toBe(true);
      expect(DataValidationUtils.isValidEmail('invalid-email')).toBe(false);
      expect(DataValidationUtils.isValidEmail('test@')).toBe(false);
    });
    
    it('should validate phone numbers', () => {
      expect(DataValidationUtils.isValidPhoneNumber('+1234567890')).toBe(true);
      expect(DataValidationUtils.isValidPhoneNumber('(555) 123-4567')).toBe(true);
      expect(DataValidationUtils.isValidPhoneNumber('123')).toBe(false);
    });
    
    it('should validate URLs', () => {
      expect(DataValidationUtils.isValidUrl('https://example.com')).toBe(true);
      expect(DataValidationUtils.isValidUrl('http://test.org/path')).toBe(true);
      expect(DataValidationUtils.isValidUrl('invalid-url')).toBe(false);
    });
    
    it('should validate coordinates', () => {
      expect(DataValidationUtils.isValidCoordinate(40.7128, -74.0060)).toBe(true);
      expect(DataValidationUtils.isValidCoordinate(91, 0)).toBe(false); // Invalid latitude
      expect(DataValidationUtils.isValidCoordinate(0, 181)).toBe(false); // Invalid longitude
    });
    
    it('should handle cache operations', () => {
      const key = 'test-key';
      const value = { data: 'test-data' };
      
      // Set cache value
      CacheUtils.set(key, value, 1000);
      
      // Get cache value
      const cached = CacheUtils.get(key);
      expect(cached).toEqual(value);
      
      // Get non-existent key
      const notCached = CacheUtils.get('non-existent');
      expect(notCached).toBeNull();
      
      // Check cache stats
      const stats = CacheUtils.getStats();
      expect(stats.size).toBe(1);
    });
    
    it('should build dimensional queries', () => {
      const filters = {
        location: { x: 40.7128, y: -74.0060, system: 'geographic' },
        radius: 10,
        dateFrom: new Date('2023-01-01'),
        dateTo: new Date('2023-12-31'),
        embedding: Array.from({ length: 768 }, () => Math.random()),
        threshold: 0.8,
        limit: 25
      };
      
      const query = DimensionalQueryUtils.buildQuery(filters);
      
      expect(query.spatialQuery).toBeDefined();
      expect(query.spatialQuery?.radius).toBe(10);
      expect(query.temporalQuery).toBeDefined();
      expect(query.vectorQuery).toBeDefined();
      expect(query.vectorQuery?.threshold).toBe(0.8);
      expect(query.limit).toBe(25);
    });
    
    it('should validate dimensional queries', () => {
      const validQuery = {
        spatialQuery: {
          center: { x: 40.7128, y: -74.0060, system: 'geographic' as const },
          radius: 5,
          unit: 'km' as const
        },
        limit: 50,
        offset: 0
      };
      
      const result = DimensionalQueryUtils.validateQuery(validQuery);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      
      const invalidQuery = {
        spatialQuery: {
          center: { x: 0, y: 0, system: 'geographic' as const },
          radius: -5, // Invalid negative radius
          unit: 'km' as const
        },
        limit: 50,
        offset: 0
      };
      
      const invalidResult = DimensionalQueryUtils.validateQuery(invalidQuery);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });
  });
  
  describe('Vector Embedding Operations', () => {
    it('should find similar vectors', () => {
      const queryVector = [1, 0, 0];
      const candidates = [
        { id: '1', vector: [1, 0, 0] }, // Identical
        { id: '2', vector: [0.9, 0.1, 0] }, // Similar
        { id: '3', vector: [0, 1, 0] }, // Orthogonal
        { id: '4', vector: [-1, 0, 0] } // Opposite
      ];
      
      const similar = VectorEmbeddingUtils.findSimilarVectors(
        queryVector,
        candidates,
        0.5,
        10
      );
      
      expect(similar).toHaveLength(2); // Should find 2 similar vectors
      expect(similar[0].id).toBe('1'); // Most similar should be first
      expect(similar[0].similarity).toBeCloseTo(1, 2);
    });
    
    it('should combine multiple embeddings', () => {
      const embeddings = [
        {
          dimensions: 3,
          values: [1, 0, 0]
        },
        {
          dimensions: 3,
          values: [0, 1, 0]
        }
      ];
      
      const combined = VectorEmbeddingUtils.combineEmbeddings(embeddings);
      
      expect(combined.dimensions).toBe(3);
      expect(combined.values).toHaveLength(3);
      expect(combined.model).toBe('combined');
      expect(combined.metadata?.sourceCount).toBe(2);
    });
  });
});

describe('Integration Tests', () => {
  it('should create complete marketplace scenario', () => {
    // Create marketplace item
    const item = {
      type: 'marketplace_item',
      dimensions: [
        {
          type: 'category',
          name: 'electronics',
          value: 'smartphone',
          weight: 1.0
        },
        {
          type: 'quality',
          name: 'overall_quality',
          value: 0.9,
          weight: 0.8
        }
      ],
      title: 'Premium Smartphone',
      description: 'Latest smartphone with advanced features',
      itemType: 'physical_product',
      sellerId: 'seller-premium',
      basePrice: 899.99,
      currency: 'USD',
      inventory: {
        tracked: true,
        quantity: 100,
        reserved: 10,
        available: 90
      },
      shippingInfo: {
        required: true,
        weight: 0.2,
        options: [
          {
            method: 'express',
            cost: 15.99,
            estimatedDays: { min: 1, max: 2 }
          }
        ]
      }
    };
    
    const itemResult = CreateMarketplaceItemSchema.safeParse(item);
    expect(itemResult.success).toBe(true);
    
    // Calculate dimensional score
    if (itemResult.success) {
      const score = DimensionalUtils.calculateDimensionalScore(itemResult.data.dimensions);
      expect(score).toBeGreaterThan(0.8);
    }
  });
  
  it('should validate complete transaction workflow', () => {
    const transaction = {
      type: 'marketplace_transaction',
      dimensions: [],
      transactionNumber: 'TXN-PREMIUM-001',
      type: 'purchase',
      status: 'processing',
      parties: [
        {
          id: 'buyer-party',
          type: 'user',
          role: 'buyer',
          identity: {
            userId: 'buyer-123',
            name: 'John Customer',
            email: 'john.customer@email.com',
            verified: true,
            verificationLevel: 'enhanced'
          },
          joinedAt: new Date()
        },
        {
          id: 'seller-party',
          type: 'business',
          role: 'seller',
          identity: {
            businessId: 'premium-electronics',
            name: 'Premium Electronics Store',
            email: 'sales@premium-electronics.com',
            verified: true,
            verificationLevel: 'premium'
          },
          joinedAt: new Date()
        }
      ],
      items: [
        {
          id: 'txn-item-1',
          itemId: 'smartphone-premium-001',
          type: 'product',
          name: 'Premium Smartphone',
          quantity: 1,
          unitPrice: 899.99,
          totalPrice: 899.99,
          fulfillment: {
            method: 'shipping',
            provider: 'fedex',
            status: 'pending'
          }
        }
      ],
      payment: {
        id: 'payment-premium-001',
        method: 'credit_card',
        provider: 'stripe',
        subtotal: 899.99,
        taxes: 72.00,
        fees: 26.99,
        shipping: 15.99,
        discounts: 0,
        total: 1014.97,
        currency: 'USD',
        status: 'authorized'
      },
      workflow: {
        stages: [
          {
            id: 'stage-payment',
            name: 'Payment Processing',
            order: 1,
            status: 'completed',
            startedAt: new Date(),
            completedAt: new Date()
          },
          {
            id: 'stage-fulfillment',
            name: 'Order Fulfillment',
            order: 2,
            status: 'in_progress',
            startedAt: new Date()
          }
        ],
        currentStage: 'stage-fulfillment',
        completedStages: ['stage-payment']
      }
    };
    
    const result = MultiPartyTransactionSchema.safeParse(transaction);
    expect(result.success).toBe(true);
    
    if (result.success) {
      expect(result.data.payment.total).toBe(1014.97);
      expect(result.data.parties).toHaveLength(2);
      expect(result.data.workflow.completedStages).toContain('stage-payment');
    }
  });
});