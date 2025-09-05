import { marked } from 'marked'
import hljs from 'highlight.js'
import matter from 'gray-matter'
import { definePlugin } from '../plugin-system'
import type { PluginContext, TemplateContext } from '@unjs/unjucks'

// Configure marked with syntax highlighting
marked.setOptions({
  highlight: (code, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value
      } catch (error) {
        console.warn(`Failed to highlight code with language ${lang}:`, error)
      }
    }
    return hljs.highlightAuto(code).value
  },
  breaks: true,
  gfm: true
})

export default definePlugin({
  name: 'markdown',
  version: '1.0.0',
  description: 'Markdown processing plugin with syntax highlighting and frontmatter support',
  author: 'UnJucks Team',

  config: {
    extensions: ['.md', '.markdown'],
    syntaxHighlighting: true,
    frontmatter: true,
    customRenderer: null as ((markdown: string) => string) | null
  },

  async setup(context: PluginContext) {
    // Register markdown template loader
    context.unjucks.addLoader('markdown', async (templatePath: string) => {
      if (!this.config.extensions.some(ext => templatePath.endsWith(ext))) {
        return null
      }

      try {
        const content = await context.unjucks.readTemplate(templatePath)
        
        if (this.config.frontmatter) {
          const parsed = matter(content)
          return {
            template: parsed.content,
            data: parsed.data,
            meta: {
              type: 'markdown',
              frontmatter: parsed.data
            }
          }
        }

        return {
          template: content,
          meta: { type: 'markdown' }
        }
      } catch (error) {
        throw new Error(`Failed to load markdown template ${templatePath}: ${error}`)
      }
    })

    console.log('✅ Markdown plugin initialized')
  },

  beforeRender(template: string, data: any, context: TemplateContext) {
    // Add markdown helper data
    if (context.meta?.type === 'markdown') {
      data._markdown = {
        frontmatter: context.meta.frontmatter || {},
        renderer: this.config.customRenderer || marked
      }
    }
  },

  async afterRender(result: string, template: string, data: any, context: TemplateContext) {
    // Process markdown content
    if (context.meta?.type === 'markdown') {
      try {
        const renderer = this.config.customRenderer || marked
        return await renderer(result)
      } catch (error) {
        console.error('Markdown rendering failed:', error)
        throw error
      }
    }
    
    return result
  },

  filters: {
    // Convert markdown to HTML
    markdown: (text: string) => {
      if (typeof text !== 'string') return text
      return marked(text)
    },

    // Extract frontmatter from markdown
    frontmatter: (content: string) => {
      if (typeof content !== 'string') return {}
      const parsed = matter(content)
      return parsed.data
    },

    // Get markdown content without frontmatter  
    markdownContent: (content: string) => {
      if (typeof content !== 'string') return content
      const parsed = matter(content)
      return parsed.content
    },

    // Highlight code block
    highlight: (code: string, language?: string) => {
      if (!code || typeof code !== 'string') return code
      
      if (language && hljs.getLanguage(language)) {
        try {
          return hljs.highlight(code, { language }).value
        } catch (error) {
          console.warn(`Failed to highlight ${language}:`, error)
        }
      }
      
      return hljs.highlightAuto(code).value
    },

    // Extract headings for TOC
    extractHeadings: (markdownContent: string) => {
      if (!markdownContent || typeof markdownContent !== 'string') return []
      
      const headings: Array<{level: number, text: string, id: string}> = []
      const headingRegex = /^(#{1,6})\s+(.+)$/gm
      let match

      while ((match = headingRegex.exec(markdownContent)) !== null) {
        const level = match[1].length
        const text = match[2].trim()
        const id = text.toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')

        headings.push({ level, text, id })
      }

      return headings
    },

    // Create table of contents
    tableOfContents: (markdownContent: string) => {
      if (!markdownContent || typeof markdownContent !== 'string') return ''
      
      const headings = this.filters!.extractHeadings(markdownContent)
      if (headings.length === 0) return ''

      let toc = '<nav class="table-of-contents">\n<ul>\n'
      let currentLevel = 0

      for (const heading of headings) {
        if (heading.level > currentLevel) {
          // Open new nested lists
          for (let i = currentLevel; i < heading.level - 1; i++) {
            toc += '<li><ul>\n'
          }
        } else if (heading.level < currentLevel) {
          // Close nested lists
          for (let i = currentLevel; i > heading.level; i--) {
            toc += '</ul></li>\n'
          }
        }

        toc += `<li><a href="#${heading.id}">${heading.text}</a></li>\n`
        currentLevel = heading.level
      }

      // Close remaining lists
      for (let i = currentLevel; i > 0; i--) {
        toc += '</ul>\n'
      }
      toc += '</nav>'

      return toc
    }
  },

  functions: {
    // Parse and render markdown file
    includeMarkdown: async (context: PluginContext, filePath: string, data: any = {}) => {
      try {
        const content = await context.unjucks.readTemplate(filePath)
        const parsed = matter(content)
        
        // Merge data with frontmatter
        const mergedData = { ...data, ...parsed.data }
        
        // Render template first
        const rendered = await context.unjucks.render(parsed.content, mergedData)
        
        // Then process as markdown
        return marked(rendered)
      } catch (error) {
        throw new Error(`Failed to include markdown ${filePath}: ${error}`)
      }
    },

    // Render inline markdown
    renderMarkdown: (context: PluginContext, content: string) => {
      if (typeof content !== 'string') return content
      return marked(content)
    },

    // Get markdown metadata
    markdownMeta: async (context: PluginContext, filePath: string) => {
      try {
        const content = await context.unjucks.readTemplate(filePath)
        const parsed = matter(content)
        return parsed.data
      } catch (error) {
        throw new Error(`Failed to get markdown metadata ${filePath}: ${error}`)
      }
    }
  }
})