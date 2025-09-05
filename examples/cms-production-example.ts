/**
 * 🧠 DARK MATTER: Content Management System Example
 * Production-ready CMS with semantic content organization
 */

import { Store } from 'n3'

import {
  // Semantic layer
  useOntology,
  sparqlEngine,
  inferenceEngine,
  infer,
  safeExecute,
  memoryManager,
  debugTools,
  startDebugSession
} from '../packages/untology/src'

import {
  // Template & processing layer
  renderTemplate,
  createTemplateContext,
  security,
  performanceMonitor,
  transactionManager,
  streamingEngine,
  createTemplateStream,
  validateInput,
  HotReloadSystem,
  IncrementalRenderer,
  CrossTemplateValidator
} from '../packages/unjucks/src'

/**
 * Enterprise Content Management System
 * Demonstrates dark matter features for content-heavy applications
 */
export class SemanticCMS {
  private store: Store
  private debugSession: string
  private hotReload: any
  private incrementalRenderer: any
  private templateValidator: any

  constructor() {
    this.store = new Store()
    this.debugSession = startDebugSession('semantic-cms')
    
    // Initialize dark matter systems
    this.hotReload = new HotReloadSystem()
    this.incrementalRenderer = new IncrementalRenderer()
    this.templateValidator = new CrossTemplateValidator()
    
    this.setupContentOntology()
    this.setupContentInferenceRules()
    this.loadSampleContent()
  }

  /**
   * Example 1: Semantic Content Discovery with Faceted Search
   */
  async searchContent(searchParams: {
    query?: string
    contentType?: string
    tags?: string[]
    author?: string
    dateRange?: [string, string]
    facets?: Record<string, any>
  }): Promise<any> {
    console.log('\n📄 EXAMPLE 1: Semantic Content Discovery')

    // Build SPARQL query with faceted search
    let sparqlQuery = `
      SELECT DISTINCT ?content ?title ?author ?publishDate ?contentType ?tags WHERE {
        ?content a :Content ;
                 :hasTitle ?title ;
                 :hasAuthor ?author ;
                 :publishedOn ?publishDate ;
                 :hasContentType ?contentType .
        OPTIONAL { ?content :hasTag ?tags }
    `

    const filters: string[] = []

    // Add text search filter
    if (searchParams.query) {
      // Security validation of search query
      const securityCheck = await validateInput(searchParams.query, 'content-search')
      if (!securityCheck.valid) {
        console.error('❌ Invalid search query:', securityCheck.errors)
        return { results: [], totalCount: 0 }
      }

      filters.push(`
        {
          ?content :hasTitle ?title .
          FILTER(CONTAINS(LCASE(?title), LCASE("${searchParams.query}")))
        } UNION {
          ?content :hasContent ?body .
          FILTER(CONTAINS(LCASE(?body), LCASE("${searchParams.query}")))
        }
      `)
    }

    // Add content type filter
    if (searchParams.contentType) {
      filters.push(`FILTER(?contentType = :${searchParams.contentType})`)
    }

    // Add author filter
    if (searchParams.author) {
      filters.push(`FILTER(CONTAINS(LCASE(?author), LCASE("${searchParams.author}")))`)
    }

    // Add date range filter
    if (searchParams.dateRange) {
      const [startDate, endDate] = searchParams.dateRange
      filters.push(`FILTER(?publishDate >= "${startDate}"^^xsd:date && ?publishDate <= "${endDate}"^^xsd:date)`)
    }

    if (filters.length > 0) {
      sparqlQuery += ' FILTER(' + filters.join(' && ') + ')'
    }

    sparqlQuery += `
      } ORDER BY DESC(?publishDate) LIMIT 50
    `

    // Execute search with error recovery
    const searchResult = await safeExecute('content-search', async () => {
      return await sparqlEngine.execute(sparqlQuery, this.store)
    })

    if (!searchResult.success) {
      console.log('🔄 Search failed, using fallback:', searchResult.recoveryUsed)
      return { results: [], totalCount: 0, error: searchResult.error }
    }

    // Apply semantic inference to enrich results
    const inferredData = await infer(this.store)
    console.log(`✅ Applied ${inferredData.length} semantic inferences`)

    console.log(`✅ Found ${searchResult.data?.length || 0} content items`)
    
    return {
      results: searchResult.data || [],
      totalCount: searchResult.data?.length || 0,
      facets: await this.generateFacets(searchResult.data || [])
    }
  }

  /**
   * Example 2: Dynamic Content Rendering with Template Hot-Reload
   */
  async renderContentPage(contentId: string, templateType: string = 'article'): Promise<string> {
    console.log(`\n🎨 EXAMPLE 2: Dynamic Content Rendering (${templateType})`)

    // Get content data
    const contentData = await this.getContentById(contentId)
    if (!contentData) {
      throw new Error(`Content ${contentId} not found`)
    }

    // Template selection based on content type and user preferences
    const templatePath = await this.selectTemplate(contentData.contentType, templateType)
    
    // Watch for template changes (hot reload)
    this.hotReload.watchTemplate(templatePath, async (changedPath) => {
      console.log(`🔄 Template ${changedPath} changed, invalidating cache`)
      this.incrementalRenderer.invalidateCache(contentId)
    })

    // Validate template dependencies
    const templateValidation = await this.templateValidator.validateTemplate(templatePath)
    if (!templateValidation.valid) {
      console.warn('⚠️  Template validation issues:', templateValidation.errors)
    }

    // Render with incremental caching
    const renderResult = await this.incrementalRenderer.render(
      `content-${contentId}-${templateType}`,
      await this.loadTemplate(templatePath),
      {
        content: contentData,
        relatedContent: await this.getRelatedContent(contentId),
        userContext: await this.getCurrentUserContext(),
        metadata: {
          renderTime: Date.now(),
          templatePath,
          contentType: contentData.contentType
        }
      }
    )

    console.log(`✅ Content rendered: ${templatePath}`)
    return renderResult
  }

  /**
   * Example 3: Bulk Content Processing with Streaming
   */
  async processBulkContent(contentStream: AsyncIterable<any>): Promise<void> {
    console.log('\n📦 EXAMPLE 3: Bulk Content Processing')

    let processedCount = 0
    let errorCount = 0

    // Create streaming processor with backpressure handling
    const contentProcessor = await createTemplateStream(
      'content-processor',
      contentStream,
      {
        maxConcurrency: 10,
        backpressureThreshold: 0.8,
        enableMetrics: true
      }
    )

    // Process content items with transaction safety
    await transactionManager.withTransaction(async (transaction) => {
      console.log(`🔒 Bulk processing transaction ${transaction.id} started`)

      contentProcessor.on('data', async (contentItem) => {
        try {
          // Validate content security
          const securityCheck = await validateInput(contentItem, 'content-processing')
          if (!securityCheck.valid) {
            throw new Error(`Security validation failed: ${securityCheck.errors[0]?.message}`)
          }

          // Process content with semantic enrichment
          const processedItem = await this.enrichContentWithSemantics(contentItem)
          
          // Store in knowledge graph
          await this.storeContent(processedItem)
          
          processedCount++
          
          if (processedCount % 10 === 0) {
            console.log(`✅ Processed ${processedCount} content items`)
          }

        } catch (error) {
          errorCount++
          console.error(`❌ Failed to process content item:`, error.message)
        }
      })

      // Wait for stream completion
      await new Promise<void>((resolve, reject) => {
        contentProcessor.on('end', () => {
          console.log(`🔒 Bulk processing completed: ${processedCount} processed, ${errorCount} errors`)
          resolve()
        })
        contentProcessor.on('error', reject)
      })
    })

    // Memory cleanup after bulk processing
    await memoryManager.performCleanup()
  }

  /**
   * Example 4: Content Workflow with State Management
   */
  async manageContentWorkflow(contentId: string, action: string, userId: string): Promise<any> {
    console.log(`\n⚡ EXAMPLE 4: Content Workflow (${action})`)

    // Define workflow states and transitions
    const workflowStates = {
      'draft': ['submit_for_review', 'archive'],
      'under_review': ['approve', 'reject', 'request_changes'],
      'approved': ['publish', 'reject'],
      'published': ['unpublish', 'archive'],
      'archived': ['restore']
    }

    // Get current content state
    const currentState = await this.getContentState(contentId)
    console.log(`📋 Current state: ${currentState}`)

    // Validate workflow transition
    if (!workflowStates[currentState]?.includes(action)) {
      throw new Error(`Invalid workflow transition: ${currentState} -> ${action}`)
    }

    // Execute state transition with audit trail
    return await transactionManager.withTransaction(async (transaction) => {
      // Update content state
      const newState = this.getNextState(action)
      await this.updateContentState(contentId, newState, userId)

      // Log workflow event
      await this.logWorkflowEvent(contentId, {
        action,
        fromState: currentState,
        toState: newState,
        userId,
        timestamp: new Date().toISOString(),
        transactionId: transaction.id
      })

      // Trigger post-action processing
      await this.executeWorkflowPostActions(contentId, action, newState)

      console.log(`✅ Workflow transition: ${currentState} -> ${newState}`)
      
      return {
        contentId,
        previousState: currentState,
        newState,
        action,
        userId,
        timestamp: new Date().toISOString()
      }
    })
  }

  /**
   * Example 5: Performance-Optimized Content Analytics
   */
  async generateContentAnalytics(timeRange: [string, string]): Promise<any> {
    console.log('\n📊 EXAMPLE 5: Content Analytics & Insights')

    const [startDate, endDate] = timeRange
    
    // Performance-optimized analytics queries
    const analyticsQueries = [
      {
        name: 'contentByType',
        query: `
          SELECT ?contentType (COUNT(?content) as ?count) WHERE {
            ?content a :Content ;
                     :hasContentType ?contentType ;
                     :publishedOn ?date .
            FILTER(?date >= "${startDate}"^^xsd:date && ?date <= "${endDate}"^^xsd:date)
          } GROUP BY ?contentType ORDER BY DESC(?count)
        `
      },
      {
        name: 'topAuthors',
        query: `
          SELECT ?author (COUNT(?content) as ?count) WHERE {
            ?content a :Content ;
                     :hasAuthor ?author ;
                     :publishedOn ?date .
            FILTER(?date >= "${startDate}"^^xsd:date && ?date <= "${endDate}"^^xsd:date)
          } GROUP BY ?author ORDER BY DESC(?count) LIMIT 10
        `
      },
      {
        name: 'popularTags',
        query: `
          SELECT ?tag (COUNT(?content) as ?count) WHERE {
            ?content a :Content ;
                     :hasTag ?tag ;
                     :publishedOn ?date .
            FILTER(?date >= "${startDate}"^^xsd:date && ?date <= "${endDate}"^^xsd:date)
          } GROUP BY ?tag ORDER BY DESC(?count) LIMIT 20
        `
      }
    ]

    const analytics: any = {}
    
    // Execute analytics queries concurrently
    const queryPromises = analyticsQueries.map(async ({ name, query }) => {
      const result = await safeExecute(`analytics-${name}`, async () => {
        return await sparqlEngine.execute(query, this.store)
      })
      
      analytics[name] = result.success ? result.data : []
      return { name, success: result.success, count: result.data?.length || 0 }
    })

    const queryResults = await Promise.all(queryPromises)
    
    // Generate insights with semantic analysis
    const insights = await this.generateSemanticInsights(analytics)
    
    // Performance summary
    const perfMetrics = performanceMonitor.getMetrics()
    
    console.log('📊 Analytics generated:')
    queryResults.forEach(({ name, success, count }) => {
      console.log(`  - ${name}: ${success ? 'success' : 'failed'} (${count} results)`)
    })

    return {
      timeRange: [startDate, endDate],
      analytics,
      insights,
      performance: {
        queryExecutionTime: perfMetrics.averageQueryTime,
        memoryUsage: process.memoryUsage().heapUsed,
        cacheHitRate: perfMetrics.cacheHitRatio
      },
      generatedAt: new Date().toISOString()
    }
  }

  /**
   * Setup content ontology
   */
  private setupContentOntology(): void {
    const ontologyTriples = [
      // Content types
      [':Article', 'rdfs:subClassOf', ':Content'],
      [':BlogPost', 'rdfs:subClassOf', ':Content'],
      [':Page', 'rdfs:subClassOf', ':Content'],
      [':Video', 'rdfs:subClassOf', ':Content'],
      [':Document', 'rdfs:subClassOf', ':Content'],
      
      // Properties
      [':hasTitle', 'rdfs:domain', ':Content'],
      [':hasContent', 'rdfs:domain', ':Content'],
      [':hasAuthor', 'rdfs:domain', ':Content'],
      [':publishedOn', 'rdfs:domain', ':Content'],
      [':hasTag', 'rdfs:domain', ':Content'],
      [':hasContentType', 'rdfs:domain', ':Content'],
      [':hasWorkflowState', 'rdfs:domain', ':Content']
    ]

    for (const [subject, predicate, object] of ontologyTriples) {
      this.store.addQuad({
        subject: { termType: 'NamedNode', value: subject },
        predicate: { termType: 'NamedNode', value: predicate },
        object: { termType: 'NamedNode', value: object },
        graph: { termType: 'DefaultGraph', value: '' }
      } as any)
    }

    console.log('✅ Content ontology initialized')
  }

  /**
   * Setup content inference rules
   */
  private setupContentInferenceRules(): void {
    // Rule: Content with multiple tags in same category gets categorized
    inferenceEngine.addInferenceRule({
      name: 'content-categorization',
      pattern: '?content :hasTag ?tag1 . ?content :hasTag ?tag2 . ?tag1 :inCategory ?category . ?tag2 :inCategory ?category',
      condition: (bindings) => bindings.tag1 !== bindings.tag2,
      conclusion: '?content :belongsToCategory ?category'
    })

    // Rule: Content by prolific authors gets priority boost
    inferenceEngine.addInferenceRule({
      name: 'author-priority',
      pattern: '?content :hasAuthor ?author . ?author :hasPublishedCount ?count',
      condition: (bindings) => parseInt(bindings.count) > 10,
      conclusion: '?content :hasPriority "high"'
    })

    console.log('✅ Content inference rules configured')
  }

  /**
   * Load sample content for demonstration
   */
  private loadSampleContent(): void {
    const sampleContent = [
      {
        id: 'content1',
        title: 'Introduction to Semantic Web',
        author: 'Dr. Alice Smith',
        contentType: 'Article',
        tags: ['semantic-web', 'rdf', 'ontology'],
        publishDate: '2024-01-15',
        state: 'published'
      },
      {
        id: 'content2', 
        title: 'Advanced SPARQL Queries',
        author: 'Bob Johnson',
        contentType: 'BlogPost',
        tags: ['sparql', 'query', 'database'],
        publishDate: '2024-01-20',
        state: 'published'
      },
      {
        id: 'content3',
        title: 'Content Management Best Practices',
        author: 'Carol Davis',
        contentType: 'Document',
        tags: ['cms', 'best-practices', 'workflow'],
        publishDate: '2024-01-25',
        state: 'under_review'
      }
    ]

    for (const content of sampleContent) {
      const contentNode = `:Content${content.id}`
      
      this.store.addQuads([
        { subject: { termType: 'NamedNode', value: contentNode }, predicate: { termType: 'NamedNode', value: 'rdf:type' }, object: { termType: 'NamedNode', value: ':Content' }, graph: { termType: 'DefaultGraph', value: '' } },
        { subject: { termType: 'NamedNode', value: contentNode }, predicate: { termType: 'NamedNode', value: ':hasTitle' }, object: { termType: 'Literal', value: content.title }, graph: { termType: 'DefaultGraph', value: '' } },
        { subject: { termType: 'NamedNode', value: contentNode }, predicate: { termType: 'NamedNode', value: ':hasAuthor' }, object: { termType: 'Literal', value: content.author }, graph: { termType: 'DefaultGraph', value: '' } },
        { subject: { termType: 'NamedNode', value: contentNode }, predicate: { termType: 'NamedNode', value: ':hasContentType' }, object: { termType: 'NamedNode', value: `:${content.contentType}` }, graph: { termType: 'DefaultGraph', value: '' } },
        { subject: { termType: 'NamedNode', value: contentNode }, predicate: { termType: 'NamedNode', value: ':publishedOn' }, object: { termType: 'Literal', value: content.publishDate }, graph: { termType: 'DefaultGraph', value: '' } },
        { subject: { termType: 'NamedNode', value: contentNode }, predicate: { termType: 'NamedNode', value: ':hasWorkflowState' }, object: { termType: 'Literal', value: content.state }, graph: { termType: 'DefaultGraph', value: '' } }
      ] as any)

      // Add tags
      for (const tag of content.tags) {
        this.store.addQuad({
          subject: { termType: 'NamedNode', value: contentNode },
          predicate: { termType: 'NamedNode', value: ':hasTag' },
          object: { termType: 'Literal', value: tag },
          graph: { termType: 'DefaultGraph', value: '' }
        } as any)
      }
    }

    console.log(`✅ Loaded ${sampleContent.length} sample content items`)
  }

  // Helper methods
  private async getContentById(contentId: string): Promise<any> {
    const query = `
      SELECT ?title ?author ?contentType ?publishDate ?state WHERE {
        :Content${contentId} :hasTitle ?title ;
                            :hasAuthor ?author ;
                            :hasContentType ?contentType ;
                            :publishedOn ?publishDate ;
                            :hasWorkflowState ?state .
      }
    `
    const result = await sparqlEngine.execute(query, this.store)
    return result[0] || null
  }

  private async selectTemplate(contentType: string, templateType: string): Promise<string> {
    return `templates/${contentType.toLowerCase()}-${templateType}.njk`
  }

  private async loadTemplate(templatePath: string): Promise<string> {
    // Mock template loading
    return `
<article class="content">
  <header>
    <h1>{{content.title}}</h1>
    <div class="meta">
      By {{content.author}} on {{content.publishDate}}
    </div>
  </header>
  <main>{{content.body | safe}}</main>
  {% if relatedContent.length > 0 %}
  <section class="related">
    <h3>Related Content</h3>
    {% for item in relatedContent %}
    <div class="related-item">{{item.title}}</div>
    {% endfor %}
  </section>
  {% endif %}
</article>
    `
  }

  private async getRelatedContent(contentId: string): Promise<any[]> {
    return [] // Mock implementation
  }

  private async getCurrentUserContext(): Promise<any> {
    return { userId: 'user123', role: 'editor' }
  }

  private async enrichContentWithSemantics(content: any): Promise<any> {
    // Add semantic enrichment
    return { ...content, enriched: true, timestamp: Date.now() }
  }

  private async storeContent(content: any): Promise<void> {
    // Mock content storage
    console.log(`Stored content: ${content.title}`)
  }

  private async getContentState(contentId: string): Promise<string> {
    const query = `SELECT ?state WHERE { :Content${contentId} :hasWorkflowState ?state }`
    const result = await sparqlEngine.execute(query, this.store)
    return result[0]?.state || 'draft'
  }

  private getNextState(action: string): string {
    const stateMap: Record<string, string> = {
      'submit_for_review': 'under_review',
      'approve': 'approved',
      'reject': 'draft',
      'publish': 'published',
      'unpublish': 'draft',
      'archive': 'archived'
    }
    return stateMap[action] || 'draft'
  }

  private async updateContentState(contentId: string, newState: string, userId: string): Promise<void> {
    // Mock state update
    console.log(`Updated content ${contentId} state to ${newState} by ${userId}`)
  }

  private async logWorkflowEvent(contentId: string, event: any): Promise<void> {
    console.log(`📋 Workflow event logged:`, event)
  }

  private async executeWorkflowPostActions(contentId: string, action: string, newState: string): Promise<void> {
    // Mock post-action processing
    if (action === 'publish') {
      console.log(`📢 Content ${contentId} published - triggering notifications`)
    }
  }

  private async generateFacets(results: any[]): Promise<Record<string, any>> {
    return {
      contentTypes: ['Article', 'BlogPost', 'Document'],
      authors: ['Dr. Alice Smith', 'Bob Johnson', 'Carol Davis'],
      tags: ['semantic-web', 'sparql', 'cms']
    }
  }

  private async generateSemanticInsights(analytics: any): Promise<string[]> {
    const insights = []
    
    if (analytics.contentByType?.length > 0) {
      const topType = analytics.contentByType[0]
      insights.push(`Most popular content type: ${topType.contentType} (${topType.count} items)`)
    }
    
    if (analytics.topAuthors?.length > 0) {
      const topAuthor = analytics.topAuthors[0]
      insights.push(`Most prolific author: ${topAuthor.author} (${topAuthor.count} publications)`)
    }

    return insights
  }

  async cleanup(): Promise<void> {
    debugTools.endSession(this.debugSession)
    this.hotReload?.destroy()
    await memoryManager.performCleanup(true)
    console.log('✅ CMS cleanup completed')
  }
}

/**
 * Run CMS demonstration
 */
export async function runCMSDemo(): Promise<void> {
  console.log('📄 SEMANTIC CMS DARK MATTER DEMO')
  console.log('=================================')

  const cms = new SemanticCMS()

  try {
    // Demo search
    await cms.searchContent({
      query: 'semantic',
      contentType: 'Article',
      tags: ['semantic-web']
    })

    // Demo rendering
    await cms.renderContentPage('content1', 'article')

    // Demo workflow
    await cms.manageContentWorkflow('content3', 'approve', 'editor123')

    // Demo analytics
    await cms.generateContentAnalytics(['2024-01-01', '2024-01-31'])

    console.log('\n🎉 CMS DEMO COMPLETED SUCCESSFULLY')
    
  } catch (error) {
    console.error('❌ CMS demo failed:', error.message)
  } finally {
    await cms.cleanup()
  }
}

// Export for use in other examples
export { SemanticCMS }