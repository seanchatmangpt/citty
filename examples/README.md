# UnJucks Ecosystem Examples

This directory contains comprehensive examples demonstrating real-world integration of UnJucks with the UnJS ecosystem. Each example showcases best practices and practical implementations.

## 🚀 Examples Overview

### 1. [Nuxt Blog](./nuxt-blog/) - Semantic Blog Templates
A complete Nuxt 3 blog application using UnJucks semantic templates with automatic Schema.org integration.

**Features:**
- 📝 Blog post rendering with semantic HTML
- 🏷️ Automatic Schema.org microdata
- ⚡ Server-side template caching  
- 🎨 Tailwind CSS styling
- 📊 SEO-optimized markup
- 🔗 UnJucks + Nitro integration

**Key Files:**
- `server/plugins/unjucks.ts` - UnJucks Nitro plugin
- `templates/blog-post.njk` - Semantic blog template  
- `pages/blog/[slug].vue` - Dynamic blog pages

**Run Example:**
```bash
cd examples/nuxt-blog
pnpm install
pnpm dev
```

### 2. [Nitro API](./nitro-api/) - Ontology-Driven Documentation  
A Nitro API server with auto-generated documentation from UnJucks ontology definitions.

**Features:**
- 📚 Auto-generated API documentation
- 🏗️ Ontology-based schema validation
- 📊 Semantic API responses  
- 🔍 Interactive API explorer
- ⚡ Performance monitoring
- 🛡️ Type-safe request/response handling

**Key Files:**
- `server/plugins/unjucks-ontology.ts` - Ontology integration
- `templates/api-docs.njk` - Documentation template
- `server/api/users/index.get.ts` - Semantic API endpoint

**Run Example:**
```bash
cd examples/nitro-api
pnpm install  
pnpm dev
# Visit /api/docs for generated documentation
```

### 3. [CLI Generator](./cli-generator/) - UnJS CLI Tool Builder
An interactive CLI generator that creates modern command-line tools with UnJS integrations.

**Features:**
- 🛠️ Interactive project scaffolding
- 🏗️ Citty-based CLI framework
- 📦 UnJS ecosystem integration
- 🎨 Template-driven code generation
- ⚙️ Configurable feature selection
- 📝 Auto-generated documentation

**Key Files:**
- `src/cli.ts` - Main CLI application
- `templates/citty/` - Project templates
- `src/semantic-generator.ts` - Template processor

**Run Example:**
```bash
cd examples/cli-generator
pnpm install
pnpm build
pnpm start create my-awesome-cli
```

### 4. [Full-Stack H3](./fullstack-h3/) - Complete Web Application
A full-stack web application using Nuxt 3, H3, and UnJucks with database integration.

**Features:**
- 🌐 Full-stack Nuxt 3 application
- 🗄️ Database integration with Drizzle ORM
- 🔌 H3 API handlers with semantic responses
- 🎨 Vue 3 frontend with Tailwind CSS
- 🔐 Authentication system
- 📊 Real-time data updates
- 🏗️ Modular architecture

**Key Files:**
- `server/plugins/unjucks-fullstack.ts` - Full integration
- `server/api/posts/index.get.ts` - Semantic API endpoints
- `pages/posts/index.vue` - Frontend with semantic data

**Run Example:**
```bash
cd examples/fullstack-h3
pnpm install
pnpm dev
```

### 5. [Plugin Development](./plugin-development/) - Extensible Plugin System
Comprehensive plugin development example showing how to extend UnJucks functionality.

**Features:**
- 🔌 Complete plugin architecture
- 📝 Markdown processing plugin
- 🌐 I18n localization plugin  
- 💾 Caching plugin system
- 🧪 Plugin development utilities
- 📊 Plugin performance monitoring
- 🎭 Plugin composition examples

**Key Files:**
- `src/plugin-system.ts` - Core plugin architecture
- `src/plugins/markdown.ts` - Markdown processing
- `src/plugins/i18n.ts` - Internationalization
- `demo/plugin-demo.mjs` - Interactive demo

**Run Example:**
```bash
cd examples/plugin-development
pnpm install
pnpm build
pnpm demo
```

### 6. [Nunjucks Migration](./nunjucks-migration/) - Legacy Template Migration
Complete migration toolkit for upgrading from Nunjucks to UnJucks with automated conversion.

**Features:**
- 🔄 Automated template conversion
- 📊 Migration analysis and reporting
- ⚡ Performance comparisons
- 🧪 Validation testing
- 📚 Migration best practices
- 🛠️ Interactive migration tools

**Key Files:**
- `scripts/migrate.mjs` - Migration automation
- `demo/comparison-demo.mjs` - Before/after comparison
- `scripts/validate.mjs` - Template validation

**Run Example:**
```bash
cd examples/nunjucks-migration
pnpm install
pnpm migrate -- --source ./old-templates --output ./migrated
pnpm demo:before && pnpm demo:after
```

## 🛠️ Getting Started

### Prerequisites
- Node.js 16+ 
- pnpm (recommended) or npm
- Basic knowledge of templating systems

### Installation
```bash
# Clone or navigate to examples directory
cd examples

# Install dependencies for all examples
pnpm install

# Or install for specific example
cd nuxt-blog && pnpm install
```

### Running Examples

Each example includes:
- `README.md` - Detailed documentation
- `package.json` - Dependencies and scripts  
- Working configuration files
- Sample data and templates
- Development scripts

**Common Commands:**
```bash
pnpm install    # Install dependencies
pnpm dev        # Development mode
pnpm build      # Production build  
pnpm test       # Run tests
pnpm lint       # Code linting
```

## 📚 Learning Path

**Beginner:**
1. Start with [Nuxt Blog](./nuxt-blog/) for basic concepts
2. Explore [Nunjucks Migration](./nunjucks-migration/) for transition

**Intermediate:**
3. Study [Nitro API](./nitro-api/) for backend integration
4. Try [CLI Generator](./cli-generator/) for tooling

**Advanced:** 
5. Build with [Full-Stack H3](./fullstack-h3/) for complete applications
6. Extend with [Plugin Development](./plugin-development/) for custom functionality

## 🏗️ Architecture Patterns

### Semantic Templates
All examples demonstrate semantic HTML generation with:
- Schema.org microdata integration
- Accessibility-first markup
- SEO-optimized structure
- Type-safe template contexts

### Ontology-Driven Development
Examples showcase:
- Schema definition and validation
- Context-aware template rendering  
- Auto-generated documentation
- Type-safe API contracts

### Plugin Architecture
Extensible design with:
- Modular plugin system
- Composable functionality
- Performance optimization
- Development utilities

### UnJS Ecosystem Integration
Seamless integration with:
- **Citty** - CLI development
- **Nitro** - Server framework
- **H3** - HTTP utilities
- **Nuxt** - Full-stack framework
- **Defu** - Configuration merging
- **Pathe** - Path utilities
- **Consola** - Logging
- **Ofetch** - HTTP client

## 🧪 Testing & Validation

Each example includes:
- Unit tests for core functionality
- Integration tests for API endpoints
- Template validation scripts
- Performance benchmarks
- Type checking

**Run All Tests:**
```bash
# From examples root
find . -name "package.json" -execdir pnpm test \;
```

## 🚀 Deployment

### Production Builds
```bash
# Build all examples
find . -name "package.json" -execdir pnpm build \;
```

### Docker Support
Several examples include Dockerfile for containerization:
```bash
# Example: Full-stack H3
cd fullstack-h3
docker build -t fullstack-unjucks .
docker run -p 3000:3000 fullstack-unjucks
```

### Cloud Deployment
Examples are optimized for:
- **Vercel** - Nuxt and Nitro apps
- **Netlify** - Static site generation
- **Railway** - Full-stack applications  
- **Docker** - Container deployment

## 🤝 Contributing

### Adding New Examples
1. Create directory in `/examples/`
2. Follow naming convention: `kebab-case`
3. Include comprehensive README.md
4. Add to main examples README
5. Ensure all dependencies work with workspace

### Example Requirements
- ✅ Working package.json with scripts
- ✅ Detailed README with setup instructions  
- ✅ Sample data and realistic use case
- ✅ Error handling and edge cases
- ✅ Performance considerations
- ✅ TypeScript support where applicable

### Code Standards
- Follow UnJS ecosystem conventions
- Use semantic templating practices
- Include proper error handling
- Document complex logic
- Add tests for critical paths

## 📖 Additional Resources

### Documentation
- [UnJucks Core Documentation](../README.md)
- [UnJS Ecosystem](https://unjs.io)
- [Citty CLI Framework](https://citty.unjs.io)
- [Nitro Server Framework](https://nitro.unjs.io)

### Community  
- [GitHub Discussions](https://github.com/unjs/unjucks/discussions)
- [Discord Server](https://discord.gg/unjs)
- [Twitter @unjsio](https://twitter.com/unjsio)

### Tutorials
- [Getting Started with UnJucks](../docs/getting-started.md)
- [Template Best Practices](../docs/best-practices.md)  
- [Plugin Development Guide](../docs/plugins.md)
- [Migration from Nunjucks](../docs/migration.md)

---

## 🎯 Quick Start

**Try all examples with one command:**
```bash
# From repository root
pnpm install
pnpm examples:demo
```

This will:
1. Install all dependencies
2. Run each example's demo script
3. Generate usage reports
4. Open interactive playground

**Happy coding with UnJucks! 🚀**