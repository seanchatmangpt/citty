# Citty Pro Marketplace

A modern, feature-rich marketplace for Citty Pro CLI tools, templates, plugins, and workflows built with Nuxt 4 and TypeScript.

## 🚀 Features

- **Server-Side Rendering (SSR)** - Optimized for performance and SEO
- **TypeScript Support** - Full type safety throughout the application
- **Modern UI** - Built with Tailwind CSS and responsive design
- **Dark Mode** - Automatic theme switching with system preference detection
- **Search & Filtering** - Advanced search with real-time filtering
- **Type Safety** - Comprehensive Zod schemas for data validation
- **Composables** - Reusable state management with Vue composables
- **API Routes** - Full-stack application with Nitro server
- **Component Library** - Reusable marketplace components

## 📁 Project Structure

```
marketplace/
├── assets/css/           # Global styles and Tailwind CSS
├── components/           # Vue components
│   └── marketplace/      # Marketplace-specific components
├── composables/          # Vue composables for state management
├── layouts/              # Application layouts
├── pages/                # Application pages and routes
├── server/api/           # API endpoints
├── types/                # TypeScript type definitions
└── nuxt.config.ts        # Nuxt configuration
```

## 🛠️ Tech Stack

- **Framework**: Nuxt 4
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Validation**: Zod
- **State Management**: Pinia
- **Server**: Nitro
- **Package Manager**: pnpm

## 🚦 Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm 8+

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## 📊 Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm generate` - Generate static site
- `pnpm preview` - Preview production build
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Fix ESLint issues
- `pnpm typecheck` - Run TypeScript type checking
- `pnpm test` - Run tests with Vitest
- `pnpm test:ui` - Run tests with UI
- `pnpm test:coverage` - Generate test coverage

## 🎨 Design System

### Colors
- **Primary**: Marketplace blue (#0ea5e9)
- **Secondary**: Tailwind grays
- **Accent**: Various for categories

### Components
- **Cards**: Consistent card design throughout
- **Buttons**: Primary, secondary, and outline variants
- **Forms**: Consistent form styling with dark mode support
- **Navigation**: Responsive navigation with mobile menu

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# JWT Secret for authentication
JWT_SECRET=your-jwt-secret

# API Base URL
API_BASE=http://localhost:3000/api

# App Version
APP_VERSION=1.0.0
```

### Nuxt Configuration

The `nuxt.config.ts` file includes:

- TypeScript configuration with strict mode
- SSR optimization
- Tailwind CSS integration
- Module configurations (Pinia, VueUse, Color Mode)
- Runtime configuration for environment variables
- Auto-imports for composables and utilities

## 📡 API Endpoints

### Marketplace API

- `GET /api/marketplace/search` - Search marketplace items
- `GET /api/marketplace/items/[id]` - Get single item details  
- `GET /api/marketplace/featured` - Get featured items
- `GET /api/marketplace/popular` - Get popular items

### Request/Response Examples

```typescript
// Search Request
GET /api/marketplace/search?query=vue&type=template&limit=20

// Search Response
{
  items: MarketplaceItem[],
  total: number,
  hasMore: boolean,
  filters: SearchFilters
}
```

## 🧩 Key Components

### MarketplaceItemCard
Displays marketplace items in grid or list view with:
- Item metadata and stats
- Action buttons (view, favorite, install)
- Type and category badges
- Responsive design

### SearchModal
Global search modal with:
- Real-time search
- Recent searches
- Quick filters
- Keyboard shortcuts (Cmd/Ctrl + K)

### Composables

#### useMarketplace
- Search and filtering
- Pagination
- State management
- API integration

#### useMarketplaceInteractions
- Favorites management
- Reviews and ratings
- User interactions

#### useMarketplaceDownloads
- Item downloads
- Installation handling
- Progress tracking

## 🎯 Type Safety

Comprehensive TypeScript types with Zod schemas:

```typescript
// Marketplace Item Types
export type MarketplaceItemUnion = Template | Plugin | Workflow | Theme

// Search Filters
export type SearchFilters = z.infer<typeof SearchFiltersSchema>

// API Response
export type APIResponse = z.infer<typeof APIResponseSchema>
```

## 📱 Responsive Design

- Mobile-first approach
- Breakpoints: `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px)
- Flexible grid system
- Touch-friendly interactions

## 🌙 Dark Mode

Automatic dark mode with:
- System preference detection
- Manual toggle
- Persistent user preference
- Smooth transitions

## 🚀 Performance Optimizations

- SSR for faster initial loads
- Code splitting with Nuxt 4
- Optimized images and assets
- Efficient state management
- Minimal JavaScript bundles

## 🧪 Testing

Testing setup with Vitest:

```bash
# Run tests
pnpm test

# Run with UI
pnpm test:ui

# Generate coverage
pnpm test:coverage
```

## 📈 Future Enhancements

- [ ] User authentication and profiles
- [ ] Real database integration
- [ ] File uploads and storage
- [ ] Payment processing
- [ ] Advanced analytics
- [ ] Social features (comments, ratings)
- [ ] API documentation generator
- [ ] Mobile application

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details