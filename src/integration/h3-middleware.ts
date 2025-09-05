/**
 * 🌐 H3 Middleware: Request-Based Template Processing
 * Dynamic template rendering based on HTTP requests
 * Context-aware templating with request/response integration
 */

import type { EventHandler, H3Event } from 'h3'
import { 
  getQuery, 
  getBody, 
  getHeaders, 
  setHeaders, 
  send, 
  createError,
  getRouterParam,
  getCookie,
  getSession
} from 'h3'
import { resolve, join } from 'pathe'
import { defu } from 'defu'
import { UNJUCKS } from '../unjucks'
import { loadGraph, toContext } from '../untology'
import { MemoryCache } from '../cache'

export interface H3MiddlewareOptions {
  /**
   * Templates directory
   * @default './templates'
   */
  templatesDir?: string
  
  /**
   * Ontology directory
   * @default './ontology'
   */
  ontologyDir?: string
  
  /**
   * Route patterns to match
   * @default ['/templates/**', '/render/**']
   */
  routes?: string[]
  
  /**
   * Enable request context injection
   * @default true
   */
  injectRequestContext?: boolean
  
  /**
   * Enable response caching
   * @default true
   */
  enableCaching?: boolean
  
  /**
   * Cache TTL in milliseconds
   * @default 5 * 60 * 1000
   */
  cacheTtl?: number
  
  /**
   * Maximum request body size for context
   * @default '1mb'
   */
  maxBodySize?: string
  
  /**
   * Default content type for responses
   * @default 'text/html'
   */
  defaultContentType?: string
  
  /**
   * Enable CORS headers
   * @default false
   */
  enableCors?: boolean
  
  /**
   * Global context for all templates
   */
  globalContext?: Record<string, any>
  
  /**
   * Context extractors from request
   */
  contextExtractors?: ContextExtractor[]
  
  /**
   * Response transformers
   */
  responseTransformers?: ResponseTransformer[]
}

interface ContextExtractor {
  name: string
  extract: (event: H3Event) => Promise<Record<string, any>> | Record<string, any>
}

interface ResponseTransformer {
  name: string
  transform: (content: string, event: H3Event) => Promise<string> | string
}

interface TemplateRequest {
  templateId: string
  context?: Record<string, any>
  format?: 'html' | 'json' | 'xml' | 'text'
  cache?: boolean
}

interface TemplateResponse {
  content: string
  metadata: {
    templateId: string
    compiledAt: string
    fromCache: boolean
    duration: number
  }
}

const DEFAULT_OPTIONS: Required<Omit<H3MiddlewareOptions, 'contextExtractors' | 'responseTransformers'>> & {
  contextExtractors: ContextExtractor[]
  responseTransformers: ResponseTransformer[]
} = {
  templatesDir: './templates',
  ontologyDir: './ontology',
  routes: ['/templates/**', '/render/**'],
  injectRequestContext: true,
  enableCaching: true,
  cacheTtl: 5 * 60 * 1000,
  maxBodySize: '1mb',
  defaultContentType: 'text/html',
  enableCors: false,
  globalContext: {},
  contextExtractors: [],
  responseTransformers: []
}\n\nclass UnjucksH3Middleware {\n  private cache: MemoryCache<TemplateResponse>\n  private options: typeof DEFAULT_OPTIONS\n  private ontologyLoaded = false\n  \n  constructor(options: H3MiddlewareOptions = {}) {\n    this.options = defu(options, DEFAULT_OPTIONS)\n    this.cache = new MemoryCache<TemplateResponse>({\n      defaultTtl: this.options.cacheTtl\n    })\n    \n    // Add default context extractors\n    this.addDefaultContextExtractors()\n    this.addDefaultResponseTransformers()\n  }\n  \n  private addDefaultContextExtractors() {\n    // Query parameters extractor\n    this.options.contextExtractors.push({\n      name: 'query',\n      extract: (event) => ({ query: getQuery(event) })\n    })\n    \n    // Headers extractor\n    this.options.contextExtractors.push({\n      name: 'headers',\n      extract: (event) => ({ headers: getHeaders(event) })\n    })\n    \n    // Route parameters extractor\n    this.options.contextExtractors.push({\n      name: 'params',\n      extract: (event) => {\n        const params: Record<string, any> = {}\n        \n        // Extract common route parameters\n        const templateId = getRouterParam(event, 'templateId')\n        const generator = getRouterParam(event, 'generator')\n        const action = getRouterParam(event, 'action')\n        \n        if (templateId) params.templateId = templateId\n        if (generator) params.generator = generator  \n        if (action) params.action = action\n        \n        return { params }\n      }\n    })\n    \n    // Request metadata extractor\n    this.options.contextExtractors.push({\n      name: 'request',\n      extract: (event) => ({\n        request: {\n          url: event.node.req.url,\n          method: event.node.req.method,\n          timestamp: new Date().toISOString(),\n          userAgent: getHeaders(event)['user-agent'],\n          ip: getClientIP(event)\n        }\n      })\n    })\n    \n    // Session/cookie extractor\n    this.options.contextExtractors.push({\n      name: 'session',\n      extract: async (event) => {\n        const session: Record<string, any> = {}\n        \n        // Extract cookies\n        const cookies = parseCookies(event)\n        if (Object.keys(cookies).length > 0) {\n          session.cookies = cookies\n        }\n        \n        return { session }\n      }\n    })\n  }\n  \n  private addDefaultResponseTransformers() {\n    // Minify HTML in production\n    this.options.responseTransformers.push({\n      name: 'minify',\n      transform: (content, event) => {\n        if (process.env.NODE_ENV === 'production' && \n            getHeaders(event)['accept']?.includes('text/html')) {\n          // Simple minification\n          return content\n            .replace(/\\s+/g, ' ')\n            .replace(/<!--[\\s\\S]*?-->/g, '')\n            .trim()\n        }\n        return content\n      }\n    })\n    \n    // Inject development helpers\n    this.options.responseTransformers.push({\n      name: 'dev-helpers',\n      transform: (content, event) => {\n        if (process.env.NODE_ENV === 'development' && \n            content.includes('</body>')) {\n          const devScript = `\n<script>\n  window.__UNJUCKS_DEV__ = {\n    templateId: '${getRouterParam(event, 'templateId') || 'unknown'}',\n    timestamp: '${new Date().toISOString()}',\n    reload: () => location.reload()\n  };\n  console.log('[unjucks] Template rendered:', window.__UNJUCKS_DEV__);\n</script>`\n          return content.replace('</body>', devScript + '</body>')\n        }\n        return content\n      }\n    })\n  }\n  \n  async initialize(templatesDir?: string, ontologyDir?: string) {\n    // Load ontology files\n    const ontologyPath = resolve(ontologyDir || this.options.ontologyDir)\n    \n    try {\n      const { glob } = await import('fast-glob')\n      const ontologyFiles = await glob(['**/*.ttl', '**/*.jsonld', '**/*.n3'], {\n        cwd: ontologyPath,\n        onlyFiles: true\n      })\n      \n      for (const file of ontologyFiles) {\n        await loadGraph(join(ontologyPath, file))\n      }\n      \n      this.ontologyLoaded = ontologyFiles.length > 0\n      \n      if (this.ontologyLoaded) {\n        console.log(`[unjucks-h3] Loaded ${ontologyFiles.length} ontology files`)\n      }\n    } catch (error) {\n      console.warn('[unjucks-h3] Failed to load ontologies:', error)\n    }\n  }\n  \n  createHandler(): EventHandler {\n    return async (event: H3Event) => {\n      const startTime = Date.now()\n      \n      try {\n        // Parse request for template information\n        const templateRequest = await this.parseTemplateRequest(event)\n        \n        if (!templateRequest.templateId) {\n          throw createError({\n            statusCode: 400,\n            statusMessage: 'Template ID is required'\n          })\n        }\n        \n        // Check cache if enabled\n        if (this.options.enableCaching && templateRequest.cache !== false) {\n          const cacheKey = this.generateCacheKey(templateRequest)\n          const cached = this.cache.get(cacheKey)\n          \n          if (cached) {\n            await this.sendResponse(event, {\n              ...cached,\n              metadata: {\n                ...cached.metadata,\n                fromCache: true,\n                duration: Date.now() - startTime\n              }\n            })\n            return\n          }\n        }\n        \n        // Extract context from request\n        const requestContext = await this.extractContext(event)\n        \n        // Merge all contexts\n        const mergedContext = {\n          ...this.options.globalContext,\n          ...requestContext,\n          ...templateRequest.context,\n          ...(this.ontologyLoaded ? toContext() : {})\n        }\n        \n        // Generate template\n        const result = await UNJUCKS.generateFromOntology(\n          this.options.ontologyDir,\n          templateRequest.templateId,\n          {\n            context: mergedContext,\n            cache: this.options.enableCaching\n          }\n        )\n        \n        if (!result.success || !result.files.length) {\n          throw createError({\n            statusCode: 500,\n            statusMessage: 'Template generation failed',\n            data: result.errors\n          })\n        }\n        \n        let content = result.files[0].content\n        \n        // Apply response transformers\n        for (const transformer of this.options.responseTransformers) {\n          try {\n            content = await transformer.transform(content, event)\n          } catch (error) {\n            console.warn(`[unjucks-h3] Response transformer '${transformer.name}' failed:`, error)\n          }\n        }\n        \n        const response: TemplateResponse = {\n          content,\n          metadata: {\n            templateId: templateRequest.templateId,\n            compiledAt: new Date().toISOString(),\n            fromCache: false,\n            duration: Date.now() - startTime\n          }\n        }\n        \n        // Cache response if enabled\n        if (this.options.enableCaching && templateRequest.cache !== false) {\n          const cacheKey = this.generateCacheKey(templateRequest)\n          this.cache.set(cacheKey, response)\n        }\n        \n        await this.sendResponse(event, response)\n        \n      } catch (error) {\n        console.error('[unjucks-h3] Handler error:', error)\n        \n        if (error.statusCode) {\n          throw error // Re-throw H3 errors\n        }\n        \n        throw createError({\n          statusCode: 500,\n          statusMessage: 'Internal template error',\n          data: process.env.NODE_ENV === 'development' ? error : undefined\n        })\n      }\n    }\n  }\n  \n  private async parseTemplateRequest(event: H3Event): Promise<TemplateRequest> {\n    const method = event.node.req.method?.toUpperCase()\n    const url = event.node.req.url || ''\n    \n    // Extract template ID from route\n    let templateId = getRouterParam(event, 'templateId') || \n                    getRouterParam(event, 'generator') ||\n                    getQuery(event).template as string\n    \n    // Handle different request methods\n    let context: Record<string, any> = {}\n    let format: TemplateRequest['format'] = 'html'\n    let cache = true\n    \n    if (method === 'GET') {\n      const query = getQuery(event)\n      context = { ...query }\n      \n      // Extract format from query or Accept header\n      format = (query.format as any) || this.detectFormat(event)\n      cache = query.cache !== 'false'\n      \n    } else if (method === 'POST') {\n      try {\n        const body = await readBody(event)\n        \n        if (typeof body === 'object') {\n          templateId = templateId || body.templateId || body.template\n          context = body.context || body\n          format = body.format || this.detectFormat(event)\n          cache = body.cache !== false\n        } else {\n          context = { body }\n        }\n      } catch (error) {\n        console.warn('[unjucks-h3] Failed to parse request body:', error)\n      }\n    }\n    \n    return {\n      templateId,\n      context,\n      format,\n      cache\n    }\n  }\n  \n  private async extractContext(event: H3Event): Promise<Record<string, any>> {\n    const context: Record<string, any> = {}\n    \n    for (const extractor of this.options.contextExtractors) {\n      try {\n        const extracted = await extractor.extract(event)\n        Object.assign(context, extracted)\n      } catch (error) {\n        console.warn(`[unjucks-h3] Context extractor '${extractor.name}' failed:`, error)\n      }\n    }\n    \n    return context\n  }\n  \n  private detectFormat(event: H3Event): TemplateRequest['format'] {\n    const accept = getHeaders(event).accept || ''\n    \n    if (accept.includes('application/json')) return 'json'\n    if (accept.includes('application/xml') || accept.includes('text/xml')) return 'xml'\n    if (accept.includes('text/plain')) return 'text'\n    return 'html'\n  }\n  \n  private async sendResponse(event: H3Event, response: TemplateResponse) {\n    // Set response headers\n    const headers: Record<string, string> = {\n      'x-template-id': response.metadata.templateId,\n      'x-compiled-at': response.metadata.compiledAt,\n      'x-from-cache': response.metadata.fromCache.toString(),\n      'x-duration': `${response.metadata.duration}ms`\n    }\n    \n    // Determine content type\n    const query = getQuery(event)\n    const format = query.format as string || this.detectFormat(event)\n    \n    switch (format) {\n      case 'json':\n        headers['content-type'] = 'application/json'\n        break\n      case 'xml':\n        headers['content-type'] = 'application/xml'\n        break\n      case 'text':\n        headers['content-type'] = 'text/plain'\n        break\n      default:\n        headers['content-type'] = this.options.defaultContentType + '; charset=utf-8'\n    }\n    \n    // Add CORS headers if enabled\n    if (this.options.enableCors) {\n      headers['access-control-allow-origin'] = '*'\n      headers['access-control-allow-methods'] = 'GET, POST, OPTIONS'\n      headers['access-control-allow-headers'] = 'content-type, accept'\n    }\n    \n    // Cache headers\n    if (this.options.enableCaching) {\n      headers['cache-control'] = process.env.NODE_ENV === 'production' \n        ? 'public, max-age=300' \n        : 'no-cache'\n    }\n    \n    setHeaders(event, headers)\n    \n    // Format response based on requested format\n    let responseContent: string\n    \n    if (format === 'json') {\n      responseContent = JSON.stringify({\n        content: response.content,\n        metadata: response.metadata\n      }, null, 2)\n    } else {\n      responseContent = response.content\n    }\n    \n    await send(event, responseContent)\n  }\n  \n  private generateCacheKey(request: TemplateRequest): string {\n    return `${request.templateId}-${JSON.stringify(request.context)}-${request.format}`\n  }\n  \n  getCacheStats() {\n    return {\n      size: this.cache.size,\n      stats: this.cache.getStats()\n    }\n  }\n  \n  clearCache(pattern?: string) {\n    if (pattern) {\n      const regex = new RegExp(pattern)\n      const keys = Array.from(this.cache.keys())\n      \n      for (const key of keys) {\n        if (regex.test(key)) {\n          this.cache.delete(key)\n        }\n      }\n    } else {\n      this.cache.clear()\n    }\n  }\n}\n\n/**\n * Create H3 middleware for template processing\n */\nexport function createUnjucksMiddleware(options: H3MiddlewareOptions = {}) {\n  const middleware = new UnjucksH3Middleware(options)\n  \n  return {\n    middleware,\n    handler: middleware.createHandler(),\n    initialize: (templatesDir?: string, ontologyDir?: string) => \n      middleware.initialize(templatesDir, ontologyDir)\n  }\n}\n\n/**\n * Utility functions\n */\nfunction getClientIP(event: H3Event): string {\n  const headers = getHeaders(event)\n  return headers['x-forwarded-for'] || \n         headers['x-real-ip'] ||\n         event.node.req.socket?.remoteAddress || \n         'unknown'\n}\n\nfunction parseCookies(event: H3Event): Record<string, string> {\n  const cookieHeader = getHeaders(event).cookie\n  const cookies: Record<string, string> = {}\n  \n  if (cookieHeader) {\n    cookieHeader.split(';').forEach(cookie => {\n      const [name, ...rest] = cookie.split('=')\n      if (name && rest.length > 0) {\n        cookies[name.trim()] = decodeURIComponent(rest.join('=').trim())\n      }\n    })\n  }\n  \n  return cookies\n}\n\nasync function readBody(event: H3Event): Promise<any> {\n  try {\n    return await getBody(event)\n  } catch {\n    return {}\n  }\n}\n\nexport { UnjucksH3Middleware }\nexport type { H3MiddlewareOptions, ContextExtractor, ResponseTransformer }