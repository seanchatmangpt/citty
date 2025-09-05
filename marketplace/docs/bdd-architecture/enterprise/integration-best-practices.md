# Enterprise Integration Best Practices

## Overview

This guide provides comprehensive best practices for integrating HIVE QUEEN BDD architecture with existing enterprise systems, covering API integration, event-driven architectures, data synchronization, and compliance requirements.

## Integration Architecture Patterns

### 1. API-First Integration Strategy

#### RESTful API Design Standards
```typescript
// Enterprise API design patterns
interface EnterpriseAPIStandards {
  versioning: 'header' | 'url' | 'query';
  authentication: 'oauth2' | 'jwt' | 'mutual-tls';
  rateLimit: {
    strategy: 'token-bucket' | 'sliding-window' | 'fixed-window';
    limits: {
      perSecond: number;
      perMinute: number;
      perHour: number;
    };
  };
  monitoring: {
    metrics: boolean;
    tracing: boolean;
    logging: boolean;
    healthChecks: boolean;
  };
}

// Standardized API client implementation
class EnterpriseAPIClient {
  private baseUrl: string;
  private authProvider: AuthProvider;
  private rateLimiter: RateLimiter;
  private circuitBreaker: CircuitBreaker;
  private retryPolicy: RetryPolicy;
  
  constructor(config: APIClientConfig) {
    this.baseUrl = config.baseUrl;
    this.authProvider = new AuthProvider(config.auth);
    this.rateLimiter = new RateLimiter(config.rateLimit);
    this.circuitBreaker = new CircuitBreaker(config.circuitBreaker);
    this.retryPolicy = new RetryPolicy(config.retry);
  }
  
  async makeRequest<T>(request: APIRequest): Promise<APIResponse<T>> {
    // Apply rate limiting
    await this.rateLimiter.acquirePermit();
    
    // Execute with circuit breaker protection
    return this.circuitBreaker.execute(async () => {
      return this.retryPolicy.execute(async () => {
        const authenticatedRequest = await this.authProvider.addAuth(request);
        const response = await this.httpClient.request(authenticatedRequest);
        
        // Log API call for monitoring
        await this.logAPICall(request, response);
        
        return response;
      });
    });
  }
  
  private async logAPICall(request: APIRequest, response: APIResponse): Promise<void> {
    await apiMetrics.record({
      endpoint: request.endpoint,
      method: request.method,
      statusCode: response.status,
      duration: response.duration,
      timestamp: new Date()
    });
  }
}

// HIVE QUEEN workflow with enterprise API integration
const enterpriseWorkflow = cittyPro.defineWorkflow({
  id: 'enterprise-api-integration',
  steps: [
    {
      id: 'fetchCustomerData',
      use: cittyPro.defineTask({
        id: 'fetch-customer',
        run: async (customerId: string, ctx) => {
          const crmClient = new EnterpriseAPIClient({
            baseUrl: 'https://api.crm.enterprise.com/v2',
            auth: {
              type: 'oauth2',
              clientId: process.env.CRM_CLIENT_ID,
              clientSecret: process.env.CRM_CLIENT_SECRET
            },
            rateLimit: {
              perSecond: 10,
              perMinute: 500,
              perHour: 10000
            }
          });
          
          return await crmClient.makeRequest({
            endpoint: `/customers/${customerId}`,
            method: 'GET'
          });
        }
      })
    },
    {
      id: 'updateFinancialRecord',
      use: cittyPro.defineTask({
        id: 'update-financial',
        run: async ({ customer, transaction }, ctx) => {
          const erpClient = new EnterpriseAPIClient({
            baseUrl: 'https://api.erp.enterprise.com/v3',
            auth: {
              type: 'mutual-tls',
              certPath: '/etc/ssl/certs/client.crt',
              keyPath: '/etc/ssl/private/client.key'
            }
          });
          
          return await erpClient.makeRequest({
            endpoint: '/financial/records',
            method: 'POST',
            body: {
              customerId: customer.id,
              transaction,
              timestamp: new Date()
            }
          });
        }
      }),
      select: (state) => ({
        customer: state.fetchCustomerData,
        transaction: state.transactionData
      })
    }
  ]
});
```

#### GraphQL Integration for Complex Queries
```typescript
// GraphQL client for complex enterprise data queries
class EnterpriseGraphQLClient {
  private client: GraphQLClient;
  private schema: GraphQLSchema;
  
  constructor(config: GraphQLConfig) {
    this.client = new GraphQLClient(config.endpoint, {
      headers: {
        Authorization: `Bearer ${config.token}`,
        'X-Enterprise-TenantId': config.tenantId
      }
    });
    this.schema = buildSchema(config.schemaSDL);
  }
  
  async executeQuery<T>(query: string, variables?: any): Promise<T> {
    // Validate query against schema
    const errors = validate(this.schema, parse(query));
    if (errors.length > 0) {
      throw new GraphQLValidationError(errors);
    }
    
    try {
      const result = await this.client.request<T>(query, variables);
      
      // Log GraphQL operation
      await this.logGraphQLOperation(query, variables, result);
      
      return result;
    } catch (error) {
      // Handle GraphQL errors
      await this.handleGraphQLError(error, query, variables);
      throw error;
    }
  }
}

// Complex enterprise data aggregation workflow
const dataAggregationWorkflow = cittyPro.defineWorkflow({
  id: 'enterprise-data-aggregation',
  steps: [
    {
      id: 'fetchEnterpriseData',
      use: cittyPro.defineTask({
        id: 'graphql-aggregation',
        run: async (query: string, ctx) => {
          const graphqlClient = new EnterpriseGraphQLClient({
            endpoint: 'https://graphql.enterprise.com/api',
            token: await getServiceToken(),
            tenantId: ctx.tenantId
          });
          
          const enterpriseQuery = `
            query GetEnterpriseData($filters: EnterpriseFilters!) {
              customers(filters: $filters) {
                id
                name
                industry
                contracts {
                  id
                  value
                  status
                }
                interactions {
                  type
                  date
                  outcome
                }
              }
              financial {
                revenue(period: $filters.period)
                expenses(period: $filters.period)
                profit(period: $filters.period)
              }
              operations {
                projects {
                  id
                  status
                  resources
                  timeline
                }
                capacity
                utilization
              }
            }
          `;
          
          return await graphqlClient.executeQuery(enterpriseQuery, {
            filters: {
              industry: query.industry,
              period: query.period,
              minContractValue: query.minValue
            }
          });
        }
      })
    }
  ]
});
```

### 2. Event-Driven Integration

#### Enterprise Event Bus Implementation
```typescript
// Enterprise event bus for system-wide integration
class EnterpriseEventBus {
  private publishers = new Map<string, EventPublisher>();
  private subscribers = new Map<string, EventSubscriber[]>();
  private eventStore: EventStore;
  private deadLetterQueue: DeadLetterQueue;
  
  constructor(config: EventBusConfig) {
    this.eventStore = new EventStore(config.storage);
    this.deadLetterQueue = new DeadLetterQueue(config.dlq);
    this.setupPublishers(config.publishers);
  }
  
  async publishEvent(event: EnterpriseEvent): Promise<void> {
    // Validate event schema
    await this.validateEvent(event);
    
    // Store event for audit and replay
    await this.eventStore.store(event);
    
    // Add enterprise metadata
    const enrichedEvent = {
      ...event,
      metadata: {
        ...event.metadata,
        tenantId: event.tenantId,
        timestamp: new Date(),
        version: '1.0',
        source: 'hive-queen-bdd',
        correlationId: event.correlationId || crypto.randomUUID(),
        causationId: event.causationId
      }
    };
    
    // Publish to appropriate publishers
    const relevantPublishers = this.getPublishersForEvent(enrichedEvent);
    
    await Promise.allSettled(
      relevantPublishers.map(publisher => 
        publisher.publish(enrichedEvent)
      )
    );
    
    // Log event publication
    await this.logEventPublication(enrichedEvent);
  }
  
  async subscribeToEvents(
    eventTypes: string[],
    handler: EventHandler,
    options: SubscriptionOptions = {}
  ): Promise<Subscription> {
    const subscriber = new EventSubscriber({
      eventTypes,
      handler: this.wrapHandler(handler, options),
      options
    });
    
    for (const eventType of eventTypes) {
      if (!this.subscribers.has(eventType)) {
        this.subscribers.set(eventType, []);
      }
      this.subscribers.get(eventType)!.push(subscriber);
    }
    
    return subscriber.start();
  }
  
  private wrapHandler(
    handler: EventHandler,
    options: SubscriptionOptions
  ): EventHandler {
    return async (event: EnterpriseEvent) => {
      const startTime = performance.now();
      
      try {
        // Pre-processing hooks
        await this.runPreProcessingHooks(event, options);
        
        // Execute handler with timeout
        const result = await Promise.race([
          handler(event),
          this.timeoutPromise(options.timeout || 30000)
        ]);
        
        // Post-processing hooks
        await this.runPostProcessingHooks(event, result, options);
        
        // Record success metrics
        await this.recordHandlerMetrics(event, performance.now() - startTime, 'success');
        
        return result;
        
      } catch (error) {
        // Record failure metrics
        await this.recordHandlerMetrics(event, performance.now() - startTime, 'failure');
        
        // Handle retry logic
        if (this.isRetryableError(error) && options.retryPolicy) {
          await this.scheduleRetry(event, handler, options.retryPolicy);
        } else {
          // Send to dead letter queue
          await this.deadLetterQueue.add(event, error);
        }
        
        throw error;
      }
    };
  }
}

// HIVE QUEEN workflow with event-driven integration
const eventDrivenWorkflow = cittyPro.defineWorkflow({
  id: 'event-driven-integration',
  steps: [
    {
      id: 'publishOrderEvent',
      use: cittyPro.defineTask({
        id: 'publish-order-event',
        run: async (orderData: any, ctx) => {
          const eventBus = new EnterpriseEventBus(ctx.eventBusConfig);
          
          await eventBus.publishEvent({
            type: 'order.created',
            tenantId: ctx.tenantId,
            data: orderData,
            metadata: {
              source: 'hive-queen-workflow',
              workflowId: ctx.workflowId,
              userId: ctx.userId
            }
          });
          
          return { eventPublished: true, orderId: orderData.id };
        }
      })
    },
    {
      id: 'waitForProcessing',
      use: cittyPro.defineTask({
        id: 'wait-for-fulfillment',
        run: async ({ orderId }, ctx) => {
          const eventBus = new EnterpriseEventBus(ctx.eventBusConfig);
          
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Order fulfillment timeout'));
            }, 300000); // 5 minutes
            
            eventBus.subscribeToEvents(
              ['order.fulfilled', 'order.failed'],
              async (event) => {
                if (event.data.orderId === orderId) {
                  clearTimeout(timeout);
                  resolve(event.data);
                }
              }
            );
          });
        }
      }),
      select: (state) => state.publishOrderEvent
    }
  ]
});
```

#### Message Queue Integration
```typescript
// Enterprise message queue integration
class EnterpriseMessageQueue {
  private connections = new Map<string, QueueConnection>();
  private deadLetterHandlers = new Map<string, DeadLetterHandler>();
  
  constructor(config: MessageQueueConfig) {
    this.setupConnections(config.connections);
    this.setupDeadLetterHandling(config.deadLetter);
  }
  
  async sendMessage(
    queueName: string,
    message: QueueMessage,
    options: SendOptions = {}
  ): Promise<MessageResult> {
    const connection = this.connections.get(queueName);
    if (!connection) {
      throw new Error(`Queue connection not found: ${queueName}`);
    }
    
    // Add enterprise headers
    const enrichedMessage = {
      ...message,
      headers: {
        ...message.headers,
        'x-tenant-id': options.tenantId,
        'x-correlation-id': options.correlationId || crypto.randomUUID(),
        'x-source': 'hive-queen-bdd',
        'x-timestamp': new Date().toISOString(),
        'x-priority': options.priority || 'normal'
      }
    };
    
    // Apply message transformation if needed
    const transformedMessage = options.transformer 
      ? await options.transformer(enrichedMessage)
      : enrichedMessage;
    
    try {
      const result = await connection.send(transformedMessage);
      
      // Log successful send
      await this.logMessageSent(queueName, transformedMessage, result);
      
      return result;
    } catch (error) {
      // Handle send failures
      await this.handleSendFailure(queueName, transformedMessage, error);
      throw error;
    }
  }
  
  async consumeMessages(
    queueName: string,
    handler: MessageHandler,
    options: ConsumeOptions = {}
  ): Promise<Consumer> {
    const connection = this.connections.get(queueName);
    if (!connection) {
      throw new Error(`Queue connection not found: ${queueName}`);
    }
    
    const wrappedHandler = this.wrapMessageHandler(handler, options);
    
    return connection.consume(wrappedHandler, {
      ...options,
      autoAck: false // Always use manual acknowledgment for reliability
    });
  }
  
  private wrapMessageHandler(
    handler: MessageHandler,
    options: ConsumeOptions
  ): MessageHandler {
    return async (message: QueueMessage) => {
      const processingStart = performance.now();
      
      try {
        // Validate message format
        if (options.validator) {
          await options.validator(message);
        }
        
        // Process with timeout
        const result = await Promise.race([
          handler(message),
          this.timeoutPromise(options.timeout || 60000)
        ]);
        
        // Acknowledge successful processing
        await message.ack();
        
        // Record processing metrics
        await this.recordProcessingMetrics(
          message,
          performance.now() - processingStart,
          'success'
        );
        
        return result;
        
      } catch (error) {
        // Record failure metrics
        await this.recordProcessingMetrics(
          message,
          performance.now() - processingStart,
          'failure'
        );
        
        // Handle retry logic
        if (this.shouldRetryMessage(message, error, options)) {
          await message.nack(true); // Requeue for retry
        } else {
          // Send to dead letter queue
          await this.sendToDeadLetter(message, error);
          await message.ack(); // Acknowledge to remove from main queue
        }
        
        throw error;
      }
    };
  }
}

// Message queue workflow integration
const messageQueueWorkflow = cittyPro.defineWorkflow({
  id: 'message-queue-integration',
  steps: [
    {
      id: 'processIncomingMessage',
      use: cittyPro.defineTask({
        id: 'process-queue-message',
        run: async (messageData: any, ctx) => {
          const messageQueue = new EnterpriseMessageQueue(ctx.queueConfig);
          
          // Start message consumer
          const consumer = await messageQueue.consumeMessages(
            'order-processing',
            async (message) => {
              // Process the message using HIVE QUEEN workflow
              const orderWorkflow = cittyPro.defineWorkflow({
                id: 'order-processing-sub',
                steps: [
                  {
                    id: 'validateOrder',
                    use: orderValidationTask,
                    select: () => message.data
                  },
                  {
                    id: 'processPayment',
                    use: paymentProcessingTask,
                    select: (state) => state.validateOrder
                  },
                  {
                    id: 'fulfillOrder',
                    use: orderFulfillmentTask,
                    select: (state) => state.processPayment
                  }
                ]
              });
              
              return await orderWorkflow.run(ctx);
            },
            {
              concurrency: 10,
              timeout: 120000, // 2 minutes
              retryPolicy: {
                maxRetries: 3,
                backoffStrategy: 'exponential'
              }
            }
          );
          
          return { consumerStarted: true, consumerId: consumer.id };
        }
      })
    }
  ]
});
```

### 3. Database Integration Patterns

#### Multi-Database Integration
```typescript
// Enterprise multi-database manager
class EnterpriseDataManager {
  private connections = new Map<string, DatabaseConnection>();
  private transactionManager: DistributedTransactionManager;
  private migrationManager: MigrationManager;
  
  constructor(config: DatabaseConfig) {
    this.setupConnections(config.databases);
    this.transactionManager = new DistributedTransactionManager(config.transaction);
    this.migrationManager = new MigrationManager(config.migrations);
  }
  
  async executeDistributedTransaction<T>(
    operations: DatabaseOperation[],
    options: TransactionOptions = {}
  ): Promise<T> {
    const transactionId = crypto.randomUUID();
    
    try {
      // Begin distributed transaction
      await this.transactionManager.begin(transactionId, operations);
      
      const results = new Map<string, any>();
      
      // Execute operations across different databases
      for (const operation of operations) {
        const connection = this.connections.get(operation.database);
        if (!connection) {
          throw new Error(`Database connection not found: ${operation.database}`);
        }
        
        const result = await connection.execute(operation, transactionId);
        results.set(operation.id, result);
      }
      
      // Commit distributed transaction
      await this.transactionManager.commit(transactionId);
      
      return this.aggregateResults(results, options.resultMapper);
      
    } catch (error) {
      // Rollback distributed transaction
      await this.transactionManager.rollback(transactionId);
      throw error;
    }
  }
  
  async syncDataAcrossSystems(
    syncConfig: DataSyncConfig
  ): Promise<SyncResult> {
    const syncId = crypto.randomUUID();
    const syncResults: SyncOperationResult[] = [];
    
    try {
      for (const mapping of syncConfig.mappings) {
        const sourceData = await this.fetchSourceData(mapping.source);
        const transformedData = await this.transformData(sourceData, mapping.transformation);
        const syncResult = await this.syncToTarget(transformedData, mapping.target);
        
        syncResults.push({
          mapping: mapping.id,
          recordsSynced: syncResult.count,
          status: 'success'
        });
        
        // Log sync operation for audit
        await this.logSyncOperation(syncId, mapping, syncResult);
      }
      
      return {
        syncId,
        status: 'completed',
        operations: syncResults,
        totalRecords: syncResults.reduce((sum, r) => sum + r.recordsSynced, 0)
      };
      
    } catch (error) {
      // Handle sync failure
      await this.handleSyncFailure(syncId, syncResults, error);
      throw error;
    }
  }
}

// Database integration workflow
const databaseIntegrationWorkflow = cittyPro.defineWorkflow({
  id: 'multi-database-integration',
  steps: [
    {
      id: 'syncCustomerData',
      use: cittyPro.defineTask({
        id: 'sync-customer-across-systems',
        run: async (customerUpdate: any, ctx) => {
          const dataManager = new EnterpriseDataManager(ctx.databaseConfig);
          
          // Define operations across multiple databases
          const operations: DatabaseOperation[] = [
            {
              id: 'update-crm',
              database: 'crm-db',
              type: 'UPDATE',
              table: 'customers',
              data: customerUpdate,
              condition: { id: customerUpdate.customerId }
            },
            {
              id: 'update-erp',
              database: 'erp-db',
              type: 'UPDATE',
              table: 'customer_master',
              data: {
                customer_id: customerUpdate.customerId,
                company_name: customerUpdate.companyName,
                updated_at: new Date()
              },
              condition: { customer_id: customerUpdate.customerId }
            },
            {
              id: 'update-warehouse',
              database: 'warehouse-db',
              type: 'UPDATE',
              table: 'customer_profiles',
              data: {
                customer_ref: customerUpdate.customerId,
                shipping_info: customerUpdate.shippingAddress
              },
              condition: { customer_ref: customerUpdate.customerId }
            }
          ];
          
          return await dataManager.executeDistributedTransaction(
            operations,
            {
              timeout: 60000,
              isolationLevel: 'READ_COMMITTED',
              resultMapper: (results) => ({
                crmUpdated: results.get('update-crm'),
                erpUpdated: results.get('update-erp'),
                warehouseUpdated: results.get('update-warehouse')
              })
            }
          );
        }
      })
    }
  ]
});
```

### 4. Legacy System Integration

#### Mainframe Integration
```typescript
// Mainframe system integration
class MainframeIntegration {
  private connectionPool: MainframeConnectionPool;
  private transactionManager: MainframeTransactionManager;
  private dataTransformer: DataTransformer;
  
  constructor(config: MainframeConfig) {
    this.connectionPool = new MainframeConnectionPool(config.connection);
    this.transactionManager = new MainframeTransactionManager(config.transaction);
    this.dataTransformer = new DataTransformer(config.transformation);
  }
  
  async executeCICSTransaction<T>(
    transactionId: string,
    data: any,
    options: CICSOptions = {}
  ): Promise<T> {
    const connection = await this.connectionPool.acquire();
    
    try {
      // Transform data to mainframe format
      const mainframeData = await this.dataTransformer.toMainframe(data);
      
      // Execute CICS transaction
      const result = await connection.executeCICS({
        transactionId,
        data: mainframeData,
        timeout: options.timeout || 30000,
        priority: options.priority || 'NORMAL'
      });
      
      // Transform result back to modern format
      const modernResult = await this.dataTransformer.fromMainframe(result);
      
      // Log transaction for audit
      await this.logMainframeTransaction(transactionId, data, modernResult);
      
      return modernResult;
      
    } finally {
      await this.connectionPool.release(connection);
    }
  }
  
  async batchDataExtract(
    jobDefinition: BatchJobDefinition
  ): Promise<BatchResult> {
    const jobId = crypto.randomUUID();
    
    try {
      // Submit batch job
      const job = await this.transactionManager.submitBatchJob({
        ...jobDefinition,
        jobId,
        priority: 'HIGH',
        notifyOnComplete: true
      });
      
      // Monitor job execution
      const result = await this.monitorBatchJob(job.id);
      
      if (result.status === 'COMPLETED') {
        // Extract and transform data
        const extractedData = await this.extractBatchOutput(result.outputDataset);
        return {
          jobId,
          status: 'SUCCESS',
          recordsExtracted: extractedData.length,
          data: extractedData
        };
      } else {
        throw new Error(`Batch job failed: ${result.errorMessage}`);
      }
      
    } catch (error) {
      await this.handleBatchJobError(jobId, error);
      throw error;
    }
  }
}

// Mainframe integration workflow
const mainframeWorkflow = cittyPro.defineWorkflow({
  id: 'mainframe-integration',
  steps: [
    {
      id: 'extractLegacyData',
      use: cittyPro.defineTask({
        id: 'extract-from-mainframe',
        run: async (extractRequest: any, ctx) => {
          const mainframe = new MainframeIntegration(ctx.mainframeConfig);
          
          // Extract customer data from mainframe
          const batchResult = await mainframe.batchDataExtract({
            jobName: 'CUSTEXTRACT',
            program: 'CUSTPGM',
            inputDataset: 'PROD.CUSTOMER.MASTER',
            outputDataset: 'TEMP.CUSTOMER.EXTRACT',
            parameters: {
              startDate: extractRequest.startDate,
              endDate: extractRequest.endDate,
              customerType: extractRequest.customerType
            }
          });
          
          return {
            extractedRecords: batchResult.recordsExtracted,
            data: batchResult.data
          };
        }
      })
    },
    {
      id: 'transformLegacyData',
      use: cittyPro.defineTask({
        id: 'transform-legacy-data',
        run: async ({ data }, ctx) => {
          // Transform legacy data format to modern schema
          const transformer = new LegacyDataTransformer({
            sourceFormat: 'COBOL-COPYBOOK',
            targetFormat: 'JSON-SCHEMA',
            mappingRules: ctx.transformationRules
          });
          
          const transformedData = await transformer.transform(data);
          
          return {
            transformedRecords: transformedData.length,
            data: transformedData
          };
        }
      }),
      select: (state) => state.extractLegacyData
    },
    {
      id: 'loadToModernSystem',
      use: cittyPro.defineTask({
        id: 'load-to-modern-db',
        run: async ({ data }, ctx) => {
          const modernDB = new EnterpriseDataManager(ctx.modernDBConfig);
          
          // Load transformed data into modern system
          const loadResult = await modernDB.bulkLoad({
            table: 'customers',
            data,
            options: {
              upsert: true,
              batchSize: 1000,
              conflictResolution: 'MERGE'
            }
          });
          
          return {
            recordsLoaded: loadResult.recordsInserted + loadResult.recordsUpdated,
            inserted: loadResult.recordsInserted,
            updated: loadResult.recordsUpdated
          };
        }
      }),
      select: (state) => state.transformLegacyData
    }
  ]
});
```

## Security Integration

### Enterprise Single Sign-On (SSO)
```typescript
// Enterprise SSO integration
class EnterpriseSSOProvider {
  private providers = new Map<string, SSOProvider>();
  private tokenValidator: TokenValidator;
  private sessionManager: SessionManager;
  
  constructor(config: SSOConfig) {
    this.setupProviders(config.providers);
    this.tokenValidator = new TokenValidator(config.validation);
    this.sessionManager = new SessionManager(config.sessions);
  }
  
  async authenticateUser(
    token: string,
    provider: string
  ): Promise<AuthenticationResult> {
    const ssoProvider = this.providers.get(provider);
    if (!ssoProvider) {
      throw new Error(`SSO provider not found: ${provider}`);
    }
    
    try {
      // Validate token with SSO provider
      const tokenValidation = await ssoProvider.validateToken(token);
      
      if (!tokenValidation.valid) {
        throw new AuthenticationError('Invalid SSO token');
      }
      
      // Extract user information
      const userInfo = await ssoProvider.getUserInfo(token);
      
      // Create enterprise session
      const session = await this.sessionManager.createSession({
        userId: userInfo.id,
        tenantId: userInfo.tenantId,
        roles: userInfo.roles,
        permissions: userInfo.permissions,
        provider,
        tokenExpiry: tokenValidation.expiry
      });
      
      return {
        authenticated: true,
        user: userInfo,
        session,
        permissions: userInfo.permissions
      };
      
    } catch (error) {
      await this.logAuthenticationFailure(token, provider, error);
      throw error;
    }
  }
  
  async authorizeWorkflowAccess(
    sessionId: string,
    workflowId: string,
    action: string
  ): Promise<AuthorizationResult> {
    const session = await this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new AuthorizationError('Invalid session');
    }
    
    // Check workflow-specific permissions
    const hasPermission = await this.checkWorkflowPermission(
      session.permissions,
      workflowId,
      action
    );
    
    if (!hasPermission) {
      await this.logAuthorizationFailure(session.userId, workflowId, action);
      throw new AuthorizationError('Insufficient permissions');
    }
    
    return {
      authorized: true,
      userId: session.userId,
      tenantId: session.tenantId,
      permissions: session.permissions
    };
  }
}

// SSO-protected workflow
const ssoProtectedWorkflow = cittyPro.defineWorkflow({
  id: 'sso-protected-workflow',
  steps: [
    {
      id: 'authenticateUser',
      use: cittyPro.defineTask({
        id: 'sso-authentication',
        run: async ({ token, provider }, ctx) => {
          const ssoProvider = new EnterpriseSSOProvider(ctx.ssoConfig);
          
          const authResult = await ssoProvider.authenticateUser(token, provider);
          
          // Store authentication context for subsequent steps
          ctx.user = authResult.user;
          ctx.session = authResult.session;
          ctx.permissions = authResult.permissions;
          
          return authResult;
        }
      })
    },
    {
      id: 'authorizeWorkflow',
      use: cittyPro.defineTask({
        id: 'workflow-authorization',
        run: async (workflowRequest: any, ctx) => {
          const ssoProvider = new EnterpriseSSOProvider(ctx.ssoConfig);
          
          return await ssoProvider.authorizeWorkflowAccess(
            ctx.session.id,
            workflowRequest.workflowId,
            workflowRequest.action
          );
        }
      }),
      select: (state) => state.workflowRequest
    },
    {
      id: 'executeSecureWorkflow',
      use: cittyPro.defineTask({
        id: 'secure-business-logic',
        run: async (request: any, ctx) => {
          // Execute business logic with authenticated context
          return await executeBusinessLogic(request, {
            userId: ctx.user.id,
            tenantId: ctx.user.tenantId,
            permissions: ctx.permissions
          });
        }
      }),
      select: (state) => state.workflowRequest
    }
  ]
});
```

## Monitoring and Observability Integration

### Enterprise Observability Stack
```typescript
// Comprehensive observability integration
class EnterpriseObservability {
  private metricsCollector: MetricsCollector;
  private tracingProvider: TracingProvider;
  private loggingService: LoggingService;
  private alertManager: AlertManager;
  
  constructor(config: ObservabilityConfig) {
    this.metricsCollector = new MetricsCollector(config.metrics);
    this.tracingProvider = new TracingProvider(config.tracing);
    this.loggingService = new LoggingService(config.logging);
    this.alertManager = new AlertManager(config.alerting);
  }
  
  async instrumentWorkflow(workflow: Workflow<any>): Promise<InstrumentedWorkflow<any>> {
    return {
      ...workflow,
      run: async (ctx: RunCtx) => {
        const trace = this.tracingProvider.startTrace({
          name: `workflow:${workflow.id}`,
          metadata: {
            workflowId: workflow.id,
            tenantId: ctx.tenantId,
            userId: ctx.userId
          }
        });
        
        const startTime = performance.now();
        
        try {
          // Add observability context
          const instrumentedCtx = {
            ...ctx,
            trace,
            metrics: this.metricsCollector,
            logger: this.loggingService
          };
          
          // Execute workflow with instrumentation
          const result = await workflow.run(instrumentedCtx);
          
          // Record success metrics
          const duration = performance.now() - startTime;
          await this.recordWorkflowSuccess(workflow.id, duration, result);
          
          return result;
          
        } catch (error) {
          // Record failure metrics
          const duration = performance.now() - startTime;
          await this.recordWorkflowFailure(workflow.id, duration, error);
          
          // Trigger alerts if necessary
          await this.evaluateErrorAlerts(workflow.id, error);
          
          throw error;
          
        } finally {
          trace.end();
        }
      }
    };
  }
  
  private async recordWorkflowSuccess(
    workflowId: string,
    duration: number,
    result: any
  ): Promise<void> {
    await this.metricsCollector.record([
      {
        name: 'workflow_execution_duration',
        value: duration,
        labels: { workflow_id: workflowId, status: 'success' }
      },
      {
        name: 'workflow_executions_total',
        value: 1,
        labels: { workflow_id: workflowId, status: 'success' }
      }
    ]);
    
    await this.loggingService.info('Workflow completed successfully', {
      workflowId,
      duration,
      resultSize: JSON.stringify(result).length
    });
  }
  
  private async evaluateErrorAlerts(
    workflowId: string,
    error: Error
  ): Promise<void> {
    // Check error rate threshold
    const recentErrors = await this.metricsCollector.query({
      metric: 'workflow_executions_total',
      labels: { workflow_id: workflowId, status: 'failure' },
      timeRange: '5m'
    });
    
    if (recentErrors.value > 10) {
      await this.alertManager.triggerAlert({
        name: 'high_workflow_error_rate',
        severity: 'critical',
        message: `High error rate detected for workflow ${workflowId}`,
        metadata: {
          workflowId,
          errorCount: recentErrors.value,
          latestError: error.message
        }
      });
    }
  }
}
```

This comprehensive enterprise integration guide provides Fortune 500 companies with proven patterns and practices for successfully integrating HIVE QUEEN BDD architecture with existing enterprise systems while maintaining security, compliance, and operational excellence.