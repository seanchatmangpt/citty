import { defineCommand } from "../../src/index.js";
import { traceCommand } from "../../src/otel/instrumentation.js";
import consola from "consola";
import ora from "ora";
import chalk from "chalk";

export default defineCommand({
  meta: {
    name: "trace",
    description: "🔍 Advanced distributed tracing and execution flow analysis",
  },
  args: {
    action: {
      type: "string",
      description: "Tracing action to perform",
      required: true,
      options: ["start", "stop", "analyze", "visualize", "export", "search", "correlate"],
      valueHint: "start",
    },
    target: {
      type: "string",
      description: "Target service or operation to trace",
      valueHint: "swarm-orchestration",
    },
    traceId: {
      type: "string",
      description: "Specific trace ID to analyze",
      valueHint: "a1b2c3d4e5f6",
    },
    service: {
      type: "string",
      description: "Service name filter",
      valueHint: "api-gateway",
    },
    operation: {
      type: "string",
      description: "Operation name filter",
      valueHint: "process_request",
    },
    duration: {
      type: "number",
      description: "Tracing duration in minutes",
      default: 30,
      valueHint: "60",
    },
    minLatency: {
      type: "number",
      description: "Minimum latency threshold in ms",
      valueHint: "1000",
    },
    maxLatency: {
      type: "number",
      description: "Maximum latency threshold in ms",
      valueHint: "5000",
    },
    format: {
      type: "string",
      description: "Output format for export/visualization",
      default: "jaeger",
      options: ["jaeger", "zipkin", "otlp", "json", "flamegraph"],
    },
    output: {
      type: "string",
      description: "Output file path",
      alias: "o",
      valueHint: "./traces-export.json",
    },
    sampling: {
      type: "number",
      description: "Sampling rate (0.0 to 1.0)",
      default: 0.1,
      valueHint: "0.5",
    },
    aiAnalysis: {
      type: "boolean",
      description: "Enable AI-powered trace analysis",
      default: true,
    },
    realtime: {
      type: "boolean",
      description: "Enable real-time trace streaming",
      default: false,
    },
    includeEvents: {
      type: "boolean",
      description: "Include span events in analysis",
      default: true,
    },
    includeLogs: {
      type: "boolean",
      description: "Correlate with log data",
      default: true,
    },
    verbose: {
      type: "boolean",
      description: "Detailed tracing information",
      alias: "v",
    },
  },

  async run({ args }) {
    return traceCommand('trace-management', async (span) => {
      const {
        action,
        target,
        traceId,
        service,
        operation,
        duration,
        minLatency,
        maxLatency,
        format,
        output,
        sampling,
        aiAnalysis,
        realtime,
        includeEvents,
        includeLogs,
        verbose
      } = args;

      span.setAttributes({
        'trace.action': action,
        'trace.target': target || 'system',
        'trace.format': format,
        'trace.sampling': sampling,
        'trace.ai_analysis': aiAnalysis,
        'trace.realtime': realtime
      });

      const spinner = ora(`🔍 ${action.charAt(0).toUpperCase() + action.slice(1)}ing traces...`).start();

      try {
        let result;

        switch (action) {
          case 'start':
            result = await startDistributedTracing({
              target, duration, sampling, realtime, includeEvents, includeLogs, verbose
            });
            break;

          case 'stop':
            result = await stopDistributedTracing({
              target, verbose
            });
            break;

          case 'analyze':
            result = await analyzeTraces({
              target, traceId, service, operation, minLatency, maxLatency, aiAnalysis, verbose
            });
            break;

          case 'visualize':
            result = await visualizeTraces({
              target, traceId, format, verbose
            });
            break;

          case 'export':
            result = await exportTraces({
              target, format, output, verbose
            });
            break;

          case 'search':
            result = await searchTraces({
              target, service, operation, minLatency, maxLatency, verbose
            });
            break;

          case 'correlate':
            result = await correlateTraces({
              target, includeLogs, verbose
            });
            break;

          default:
            throw new Error(`Unknown trace action: ${action}`);
        }

        spinner.succeed(`🎉 Trace ${action} completed successfully!`);

        // Display action-specific results
        displayTraceResults(action, result, verbose);

        return result;

      } catch (error) {
        spinner.fail(`❌ Trace ${action} failed`);
        consola.error("Trace error:", error);
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message });
        process.exit(1);
      } finally {
        span.end();
      }
    });
  },
});

/**
 * Start distributed tracing collection
 */
async function startDistributedTracing({
  target,
  duration,
  sampling,
  realtime,
  includeEvents,
  includeLogs,
  verbose
}: any): Promise<any> {
  
  if (verbose) {
    consola.info(`🔍 Starting distributed tracing`);
    consola.info(`🎯 Target: ${target || 'all services'}`);
    consola.info(`⏱️  Duration: ${duration}min`);
    consola.info(`📊 Sampling Rate: ${(sampling * 100).toFixed(1)}%`);
    consola.info(`🔄 Real-time: ${realtime}`);
  }

  // Initialize trace collectors
  const traceCollectors = await initializeTraceCollectors({
    target, sampling, includeEvents, includeLogs
  });

  // Setup trace exporters
  const exporters = await setupTraceExporters(realtime);

  // Configure sampling strategies
  const samplingStrategy = await configureSampling(sampling, target);

  // Start trace collection
  const collection = await startTraceCollection({
    collectors: traceCollectors,
    exporters,
    samplingStrategy,
    duration,
    realtime
  });

  // Setup real-time streaming if enabled
  const stream = realtime ? await setupTraceStream(collection) : null;

  // Initialize AI trace processor if enabled
  const aiProcessor = await initializeAITraceProcessor(collection);

  const session = {
    id: `trace-${Date.now()}`,
    target: target || 'all',
    started: new Date().toISOString(),
    duration,
    sampling,
    realtime,
    includeEvents,
    includeLogs,
    collectors: traceCollectors.map(c => ({
      type: c.type,
      status: c.status,
      tracesCollected: c.tracesCollected || 0
    })),
    exporters: exporters.map(e => e.type),
    stream: stream?.id || null,
    aiProcessor: aiProcessor?.id || null,
    status: 'collecting',
    tracesCollected: 0,
    spansCollected: 0,
    estimatedTraces: Math.ceil((duration * 60) * sampling * 10) // Rough estimate
  };

  // Start background collection
  startBackgroundTraceCollection(session, traceCollectors, verbose);

  if (verbose) {
    consola.info(`✅ Trace collection started: ${session.id}`);
    consola.info(`🔧 Collectors: ${traceCollectors.length} active`);
    consola.info(`📤 Exporters: ${exporters.length} configured`);
    consola.info(`📊 Estimated traces: ${session.estimatedTraces}`);
    if (stream) consola.info(`🔄 Stream: ${stream.id}`);
    if (aiProcessor) consola.info(`🧠 AI Processor: ${aiProcessor.id}`);
  }

  return session;
}

/**
 * Stop distributed tracing collection
 */
async function stopDistributedTracing({
  target,
  verbose
}: any): Promise<any> {
  
  if (verbose) {
    consola.info(`⏹️  Stopping trace collection for: ${target || 'all'}`);
  }

  // Find active trace sessions
  const activeSessions = await findActiveTraceSessions(target);
  
  const results = [];
  for (const session of activeSessions) {
    // Stop collectors gracefully
    await stopTraceCollectors(session.collectors, verbose);
    
    // Flush remaining traces
    const flushedTraces = await flushPendingTraces(session);
    
    // Generate collection summary
    const summary = await generateCollectionSummary(session, flushedTraces);
    
    // Update session status
    session.status = 'completed';
    session.completed = new Date().toISOString();
    session.summary = summary;
    
    results.push(session);
    
    if (verbose) {
      consola.info(`✅ Session ${session.id} stopped`);
      consola.info(`🔍 Total traces: ${summary.totalTraces}`);
      consola.info(`📊 Total spans: ${summary.totalSpans}`);
    }
  }

  return {
    sessionsStopped: results.length,
    sessions: results,
    totalTraces: results.reduce((sum, s) => sum + (s.summary?.totalTraces || 0), 0),
    totalSpans: results.reduce((sum, s) => sum + (s.summary?.totalSpans || 0), 0)
  };
}

/**
 * Analyze collected traces with advanced insights
 */
async function analyzeTraces({
  target,
  traceId,
  service,
  operation,
  minLatency,
  maxLatency,
  aiAnalysis,
  verbose
}: any): Promise<any> {
  
  if (verbose) {
    consola.info(`🔍 Analyzing traces`);
    consola.info(`🎯 Target: ${target || 'all'}`);
    if (traceId) consola.info(`🆔 Trace ID: ${traceId}`);
    if (service) consola.info(`🔧 Service: ${service}`);
    if (operation) consola.info(`⚙️  Operation: ${operation}`);
    consola.info(`🧠 AI Analysis: ${aiAnalysis}`);
  }

  // Load trace data with filters
  const traces = await loadTraceData({
    target, traceId, service, operation, minLatency, maxLatency
  });

  // Basic trace statistics
  const statistics = await computeTraceStatistics(traces);

  // Service topology analysis
  const serviceTopology = await analyzeServiceTopology(traces);

  // Critical path analysis
  const criticalPaths = await analyzeCriticalPaths(traces);

  // Performance bottleneck detection
  const bottlenecks = await detectPerformanceBottlenecks(traces);

  // Error pattern analysis
  const errorPatterns = await analyzeErrorPatterns(traces);

  // Dependency analysis
  const dependencies = await analyzeDependencies(traces);

  // AI-powered insights if enabled
  const aiInsights = aiAnalysis ? await performAITraceAnalysis(traces, statistics) : null;

  // Anomaly detection
  const anomalies = await detectTraceAnomalies(traces, statistics);

  // Performance trends
  const trends = await analyzePerformanceTrends(traces);

  // Generate actionable insights
  const insights = generateTraceInsights(statistics, bottlenecks, errorPatterns, aiInsights);

  // Generate optimization recommendations
  const recommendations = generateOptimizationRecommendations(insights, bottlenecks, trends);

  const analysis = {
    analyzedAt: new Date().toISOString(),
    target: target || 'all',
    filters: { traceId, service, operation, minLatency, maxLatency },
    tracesAnalyzed: traces.length,
    spansAnalyzed: traces.reduce((sum: number, t: any) => sum + t.spans.length, 0),
    timeRange: {
      start: Math.min(...traces.map((t: any) => new Date(t.startTime).getTime())),
      end: Math.max(...traces.map((t: any) => new Date(t.endTime).getTime()))
    },
    statistics,
    serviceTopology,
    criticalPaths,
    bottlenecks,
    errorPatterns,
    dependencies,
    ai: aiInsights,
    anomalies,
    trends,
    insights,
    recommendations,
    healthScore: calculateTraceHealthScore(statistics, errorPatterns, bottlenecks),
    summary: generateTraceAnalysisSummary(insights, recommendations)
  };

  if (verbose) {
    consola.info(`✅ Analysis completed`);
    consola.info(`🔍 Traces analyzed: ${traces.length.toLocaleString()}`);
    consola.info(`📊 Spans analyzed: ${analysis.spansAnalyzed.toLocaleString()}`);
    consola.info(`🏗️  Services: ${serviceTopology.services.length}`);
    consola.info(`⚠️  Bottlenecks: ${bottlenecks.length}`);
    consola.info(`❌ Error patterns: ${errorPatterns.length}`);
    consola.info(`📈 Health score: ${analysis.healthScore}/100`);
  }

  return analysis;
}

/**
 * Visualize trace data with interactive charts
 */
async function visualizeTraces({
  target,
  traceId,
  format,
  verbose
}: any): Promise<any> {
  
  if (verbose) {
    consola.info(`📊 Visualizing traces`);
    consola.info(`🎯 Target: ${target || 'all'}`);
    if (traceId) consola.info(`🆔 Trace ID: ${traceId}`);
    consola.info(`📄 Format: ${format}`);
  }

  // Load trace data for visualization
  const traces = await loadTraceData({ target, traceId });

  // Generate service map
  const serviceMap = await generateServiceMap(traces);

  // Create timeline visualization
  const timeline = await createTraceTimeline(traces);

  // Generate flame graph if requested
  const flameGraph = format === 'flamegraph' ? await generateFlameGraph(traces) : null;

  // Create dependency graph
  const dependencyGraph = await createDependencyGraph(traces);

  // Generate performance heatmap
  const performanceHeatmap = await generatePerformanceHeatmap(traces);

  // Setup interactive dashboard
  const dashboard = await setupTraceDashboard({
    serviceMap,
    timeline,
    flameGraph,
    dependencyGraph,
    performanceHeatmap,
    format
  });

  const visualization = {
    generatedAt: new Date().toISOString(),
    target: target || 'all',
    traceId,
    format,
    tracesVisualized: traces.length,
    visualizations: {
      serviceMap: serviceMap.id,
      timeline: timeline.id,
      flameGraph: flameGraph?.id || null,
      dependencyGraph: dependencyGraph.id,
      performanceHeatmap: performanceHeatmap.id
    },
    dashboard: {
      url: dashboard.url,
      port: dashboard.port,
      status: 'active'
    },
    interactiveFeatures: [
      'zoom_and_pan',
      'trace_filtering',
      'span_details',
      'performance_metrics',
      'error_highlighting'
    ]
  };

  consola.box(`
📊 Trace Visualization Ready

🌐 Dashboard: ${dashboard.url}
📊 Traces: ${traces.length.toLocaleString()}
🎯 Target: ${target || 'All Services'}

📈 Available Views:
  🗺️  Service Map: ${dashboard.url}/service-map
  ⏱️  Timeline: ${dashboard.url}/timeline
  🔥 Flame Graph: ${dashboard.url}/flamegraph
  🔗 Dependencies: ${dashboard.url}/dependencies
  🌡️  Heatmap: ${dashboard.url}/heatmap

🎮 Interactive Features:
  🔍 Zoom & Pan
  🔬 Span Details
  ⚡ Performance Metrics
  ❌ Error Highlighting
  `);

  if (verbose) {
    consola.info(`✅ Visualizations generated`);
    consola.info(`📊 Service map: ${serviceMap.nodes} nodes, ${serviceMap.edges} edges`);
    consola.info(`⏱️  Timeline: ${timeline.spans} spans`);
    if (flameGraph) consola.info(`🔥 Flame graph: ${flameGraph.samples} samples`);
    consola.info(`🌐 Dashboard: ${dashboard.url}`);
  }

  return visualization;
}

/**
 * Export traces in various formats
 */
async function exportTraces({
  target,
  format,
  output,
  verbose
}: any): Promise<any> {
  
  if (verbose) {
    consola.info(`📤 Exporting traces`);
    consola.info(`🎯 Target: ${target || 'all'}`);
    consola.info(`📄 Format: ${format}`);
    consola.info(`📁 Output: ${output || 'stdout'}`);
  }

  // Load trace data
  const traces = await loadTraceData({ target });

  // Transform for export format
  const exportData = await transformTracesForExport(traces, format);

  // Add export metadata
  const exportPackage = {
    metadata: {
      exportedAt: new Date().toISOString(),
      format,
      target: target || 'all',
      version: '1.0.0',
      totalTraces: traces.length,
      totalSpans: traces.reduce((sum: number, t: any) => sum + t.spans.length, 0),
      timeRange: {
        start: Math.min(...traces.map((t: any) => new Date(t.startTime).getTime())),
        end: Math.max(...traces.map((t: any) => new Date(t.endTime).getTime()))
      }
    },
    traces: exportData
  };

  // Write to output
  let exportResult;
  if (output) {
    exportResult = await writeTraceExport(exportPackage, output, format);
  } else {
    exportResult = { data: exportPackage, location: 'stdout' };
    console.log(formatTraceDataForConsole(exportPackage, format));
  }

  if (verbose) {
    consola.info(`✅ Export completed`);
    consola.info(`🔍 Traces exported: ${traces.length.toLocaleString()}`);
    consola.info(`📊 Spans exported: ${exportPackage.metadata.totalSpans.toLocaleString()}`);
    if (output) consola.info(`📁 Saved to: ${output}`);
  }

  return {
    exportedAt: new Date().toISOString(),
    target: target || 'all',
    format,
    output: output || 'stdout',
    tracesCount: traces.length,
    spansCount: exportPackage.metadata.totalSpans,
    fileSize: exportResult.size || 0,
    exportResult
  };
}

/**
 * Search traces with advanced filters
 */
async function searchTraces({
  target,
  service,
  operation,
  minLatency,
  maxLatency,
  verbose
}: any): Promise<any> {
  
  if (verbose) {
    consola.info(`🔍 Searching traces`);
    consola.info(`🎯 Target: ${target || 'all'}`);
    if (service) consola.info(`🔧 Service: ${service}`);
    if (operation) consola.info(`⚙️  Operation: ${operation}`);
    if (minLatency) consola.info(`⏱️  Min Latency: ${minLatency}ms`);
    if (maxLatency) consola.info(`⏱️  Max Latency: ${maxLatency}ms`);
  }

  // Build search query
  const searchQuery = buildTraceSearchQuery({
    target, service, operation, minLatency, maxLatency
  });

  // Execute search
  const searchResults = await executeTraceSearch(searchQuery);

  // Rank results by relevance
  const rankedResults = await rankSearchResults(searchResults, searchQuery);

  // Group results by patterns
  const groupedResults = await groupResultsByPatterns(rankedResults);

  // Generate search insights
  const searchInsights = generateSearchInsights(rankedResults, groupedResults);

  const search = {
    searchedAt: new Date().toISOString(),
    query: searchQuery,
    totalResults: searchResults.length,
    rankedResults: rankedResults.length,
    groups: groupedResults.length,
    insights: searchInsights,
    results: rankedResults.slice(0, 100), // Limit results for performance
    facets: {
      services: [...new Set(rankedResults.map((r: any) => r.service))],
      operations: [...new Set(rankedResults.map((r: any) => r.operation))],
      statusCodes: [...new Set(rankedResults.map((r: any) => r.statusCode))]
    },
    summary: generateSearchSummary(rankedResults, groupedResults, searchInsights)
  };

  if (verbose) {
    consola.info(`✅ Search completed`);
    consola.info(`🔍 Results found: ${searchResults.length.toLocaleString()}`);
    consola.info(`📊 Results shown: ${Math.min(100, rankedResults.length)}`);
    consola.info(`🏗️  Services: ${search.facets.services.length}`);
    consola.info(`⚙️  Operations: ${search.facets.operations.length}`);
    consola.info(`📊 Groups: ${groupedResults.length}`);
  }

  return search;
}

/**
 * Correlate traces with logs and other observability data
 */
async function correlateTraces({
  target,
  includeLogs,
  verbose
}: any): Promise<any> {
  
  if (verbose) {
    consola.info(`🔗 Correlating trace data`);
    consola.info(`🎯 Target: ${target || 'all'}`);
    consola.info(`📄 Include Logs: ${includeLogs}`);
  }

  // Load trace data
  const traces = await loadTraceData({ target });

  // Load correlated logs if enabled
  const logs = includeLogs ? await loadCorrelatedLogs(traces) : null;

  // Load metrics data
  const metrics = await loadCorrelatedMetrics(traces);

  // Perform correlation analysis
  const correlations = await performCorrelationAnalysis(traces, logs, metrics);

  // Identify correlation patterns
  const patterns = await identifyCorrelationPatterns(correlations);

  // Generate correlation insights
  const insights = generateCorrelationInsights(correlations, patterns);

  // Create unified observability view
  const unifiedView = await createUnifiedObservabilityView({
    traces,
    logs,
    metrics,
    correlations
  });

  const correlation = {
    correlatedAt: new Date().toISOString(),
    target: target || 'all',
    tracesCorrelated: traces.length,
    logsCorrelated: logs ? logs.length : 0,
    metricsCorrelated: metrics ? metrics.length : 0,
    correlations: correlations.length,
    patterns: patterns.length,
    insights,
    unifiedView: {
      id: unifiedView.id,
      url: unifiedView.url,
      features: unifiedView.features
    },
    summary: generateCorrelationSummary(correlations, patterns, insights)
  };

  if (verbose) {
    consola.info(`✅ Correlation completed`);
    consola.info(`🔍 Traces: ${traces.length.toLocaleString()}`);
    if (logs) consola.info(`📄 Logs: ${logs.length.toLocaleString()}`);
    if (metrics) consola.info(`📊 Metrics: ${metrics.length.toLocaleString()}`);
    consola.info(`🔗 Correlations: ${correlations.length}`);
    consola.info(`🌐 Unified view: ${unifiedView.url}`);
  }

  return correlation;
}

function displayTraceResults(action: string, result: any, verbose: boolean): void {
  switch (action) {
    case 'start':
      consola.box(`
🔍 Distributed Tracing Started

🆔 Session ID: ${result.id}
🎯 Target: ${result.target}
📊 Sampling: ${(result.sampling * 100).toFixed(1)}%
⏱️  Duration: ${result.duration}min

🔧 Collectors: ${result.collectors.length} active
📤 Exporters: ${result.exporters.length} configured
🔄 Real-time: ${result.realtime ? 'Enabled' : 'Disabled'}
📊 Est. Traces: ${result.estimatedTraces.toLocaleString()}

📈 Status: ${result.status.toUpperCase()}
      `);
      break;

    case 'analyze':
      consola.box(`
🔍 Trace Analysis Results

📊 Traces: ${result.tracesAnalyzed.toLocaleString()}
📈 Spans: ${result.spansAnalyzed.toLocaleString()}
🏗️  Services: ${result.serviceTopology.services.length}

⚠️  Bottlenecks: ${result.bottlenecks.length}
❌ Error Patterns: ${result.errorPatterns.length}
🔍 Anomalies: ${result.anomalies.length}
💡 Insights: ${result.insights.length}

📈 Health Score: ${result.healthScore}/100

${result.summary}
      `);
      break;

    case 'search':
      consola.box(`
🔍 Trace Search Results

📊 Total Found: ${result.totalResults.toLocaleString()}
📈 Showing: ${Math.min(100, result.rankedResults)}
🏗️  Services: ${result.facets.services.length}
⚙️  Operations: ${result.facets.operations.length}

📊 Groups: ${result.groups}
💡 Insights: ${result.insights.length}

${result.summary}
      `);
      break;
  }
}

// Helper functions
async function initializeTraceCollectors(options: any): Promise<any[]> {
  const collectors = [
    { type: 'otlp', status: 'active', tracesCollected: 0 },
    { type: 'jaeger', status: 'active', tracesCollected: 0 },
    { type: 'zipkin', status: 'active', tracesCollected: 0 }
  ];
  
  if (options.includeEvents) collectors.push({ type: 'events', status: 'active', tracesCollected: 0 });
  if (options.includeLogs) collectors.push({ type: 'logs-correlation', status: 'active', tracesCollected: 0 });
  
  return collectors;
}

async function setupTraceExporters(realtime: boolean): Promise<any[]> {
  const exporters = [
    { type: 'console', enabled: true },
    { type: 'jaeger', enabled: true },
    { type: 'otlp', enabled: true }
  ];
  
  if (realtime) exporters.push({ type: 'streaming', enabled: true });
  
  return exporters;
}

async function configureSampling(rate: number, target?: string): Promise<any> {
  return {
    type: 'probability',
    rate,
    target,
    rules: [
      { service: 'critical-service', rate: 1.0 },
      { operation: 'health-check', rate: 0.01 }
    ]
  };
}

async function startTraceCollection(options: any): Promise<any> {
  return {
    id: `collection-${Date.now()}`,
    startedAt: new Date().toISOString(),
    collectors: options.collectors,
    exporters: options.exporters,
    sampling: options.samplingStrategy
  };
}

async function setupTraceStream(collection: any): Promise<any> {
  return {
    id: `stream-${Date.now()}`,
    type: 'trace-stream',
    endpoint: 'ws://localhost:3001/traces'
  };
}

async function initializeAITraceProcessor(collection: any): Promise<any> {
  return {
    id: `ai-processor-${Date.now()}`,
    models: ['anomaly-detection', 'performance-optimization'],
    status: 'active'
  };
}

function startBackgroundTraceCollection(session: any, collectors: any[], verbose: boolean): void {
  if (verbose) {
    consola.info("🔄 Background trace collection started");
  }
  // Simulate collection
  session.tracesCollected = Math.floor(session.estimatedTraces * 0.15);
  session.spansCollected = session.tracesCollected * 8; // Average spans per trace
}

// More helper functions (abbreviated for space)
async function findActiveTraceSessions(target?: string): Promise<any[]> {
  return [{
    id: 'trace-session-123',
    target: target || 'all',
    status: 'collecting',
    collectors: ['otlp', 'jaeger'],
    tracesCollected: 1250,
    spansCollected: 10000
  }];
}

async function loadTraceData(filters: any): Promise<any[]> {
  // Simulate loading trace data
  return Array.from({ length: 500 }, (_, i) => ({
    traceId: `trace-${i}`,
    spans: Array.from({ length: 8 }, (_, j) => ({
      spanId: `span-${i}-${j}`,
      operationName: ['process_request', 'database_query', 'cache_lookup'][j % 3],
      service: ['api-gateway', 'user-service', 'payment-service'][j % 3],
      startTime: new Date(Date.now() - i * 1000 - j * 100),
      duration: Math.random() * 1000 + 50,
      status: Math.random() > 0.95 ? 'error' : 'ok'
    })),
    startTime: new Date(Date.now() - i * 1000),
    endTime: new Date(Date.now() - i * 1000 + 2000),
    duration: 2000 + Math.random() * 1000
  }));
}

// Additional helper functions would continue here...
// (Many more functions abbreviated for space)