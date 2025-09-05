// API Routes for N-Dimensional Marketplace
import type { 
  ProductDimension, 
  UserDimension, 
  SearchQuery, 
  TransactionDimension 
} from '../types/dimensional-models';
import { DimensionalSearchEngine } from '../src/dimensional-search';
import { TransactionEngine } from '../src/transaction-engine';

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface APIContext {
  userId?: string;
  timestamp: Date;
  requestId: string;
}

export class MarketplaceAPI {
  private searchEngine?: DimensionalSearchEngine;
  private transactionEngine: TransactionEngine;
  private products = new Map<string, ProductDimension>();
  private users = new Map<string, UserDimension>();

  constructor() {
    this.transactionEngine = new TransactionEngine();
  }

  // Product Management Routes
  async createProduct(
    productData: Omit<ProductDimension, 'id' | 'timestamp' | 'version'>,
    context: APIContext
  ): Promise<APIResponse<ProductDimension>> {
    try {
      const product: ProductDimension = {
        ...productData,
        id: this.generateId('prod'),
        timestamp: new Date(),
        version: 1
      };

      this.products.set(product.id, product);
      this.updateSearchIndex();

      return {
        success: true,
        data: product,
        metadata: { requestId: context.requestId }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getProduct(
    productId: string,
    context: APIContext
  ): Promise<APIResponse<ProductDimension>> {
    const product = this.products.get(productId);
    
    if (!product) {
      return {
        success: false,
        error: 'Product not found'
      };
    }

    return {
      success: true,
      data: product,
      metadata: { requestId: context.requestId }
    };
  }

  async updateProduct(
    productId: string,
    updates: Partial<ProductDimension>,
    context: APIContext
  ): Promise<APIResponse<ProductDimension>> {
    const product = this.products.get(productId);
    
    if (!product) {
      return {
        success: false,
        error: 'Product not found'
      };
    }

    const updatedProduct = {
      ...product,
      ...updates,
      version: product.version + 1,
      timestamp: new Date()
    };

    this.products.set(productId, updatedProduct);
    this.updateSearchIndex();

    return {
      success: true,
      data: updatedProduct,
      metadata: { requestId: context.requestId }
    };
  }

  async deleteProduct(
    productId: string,
    context: APIContext
  ): Promise<APIResponse<boolean>> {
    const deleted = this.products.delete(productId);
    
    if (deleted) {
      this.updateSearchIndex();
    }

    return {
      success: deleted,
      data: deleted,
      error: deleted ? undefined : 'Product not found',
      metadata: { requestId: context.requestId }
    };
  }

  // User Management Routes
  async createUser(
    userData: Omit<UserDimension, 'id' | 'timestamp' | 'version'>,
    context: APIContext
  ): Promise<APIResponse<UserDimension>> {
    try {
      const user: UserDimension = {
        ...userData,
        id: this.generateId('user'),
        timestamp: new Date(),
        version: 1
      };

      this.users.set(user.id, user);

      return {
        success: true,
        data: user,
        metadata: { requestId: context.requestId }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getUser(
    userId: string,
    context: APIContext
  ): Promise<APIResponse<UserDimension>> {
    const user = this.users.get(userId);
    
    if (!user) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    return {
      success: true,
      data: user,
      metadata: { requestId: context.requestId }
    };
  }

  async updateUserPreferences(
    userId: string,
    preferences: Record<string, number>,
    context: APIContext
  ): Promise<APIResponse<UserDimension>> {
    const user = this.users.get(userId);
    
    if (!user) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    const updatedUser = {
      ...user,
      profile: {
        ...user.profile,
        preferences: { ...user.profile.preferences, ...preferences }
      },
      version: user.version + 1,
      timestamp: new Date()
    };

    this.users.set(userId, updatedUser);

    return {
      success: true,
      data: updatedUser,
      metadata: { requestId: context.requestId }
    };
  }

  // Search Routes
  async searchProducts(
    query: SearchQuery,
    context: APIContext
  ): Promise<APIResponse<import('../types/dimensional-models').SearchResult>> {
    if (!this.searchEngine) {
      return {
        success: false,
        error: 'Search engine not initialized'
      };
    }

    try {
      const user = context.userId ? this.users.get(context.userId) : undefined;
      const searchResult = await this.searchEngine.search(query, user);

      return {
        success: true,
        data: searchResult,
        metadata: { 
          requestId: context.requestId,
          userId: context.userId
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed'
      };
    }
  }

  async getSearchSuggestions(
    partialQuery: string,
    dimension?: string,
    context?: APIContext
  ): Promise<APIResponse<string[]>> {
    if (!this.searchEngine) {
      return {
        success: false,
        error: 'Search engine not initialized'
      };
    }

    try {
      const suggestions = this.searchEngine.getSuggestions(partialQuery, dimension);
      
      return {
        success: true,
        data: suggestions,
        metadata: context ? { requestId: context.requestId } : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get suggestions'
      };
    }
  }

  // Transaction Routes
  async createTransaction(
    transactionData: {
      buyerId: string;
      sellerId: string;
      productId: string;
      quantity: number;
    },
    context: APIContext
  ): Promise<APIResponse<TransactionDimension>> {
    try {
      const buyer = this.users.get(transactionData.buyerId);
      const seller = this.users.get(transactionData.sellerId);
      const product = this.products.get(transactionData.productId);

      if (!buyer || !seller || !product) {
        return {
          success: false,
          error: 'Invalid transaction participants'
        };
      }

      const result = await this.transactionEngine.createTransaction({
        buyer,
        seller,
        product,
        quantity: transactionData.quantity
      });

      return {
        success: result.success,
        data: result.success ? result.transaction : undefined,
        error: result.errors?.[0],
        metadata: {
          requestId: context.requestId,
          warnings: result.warnings
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transaction creation failed'
      };
    }
  }

  async processTransaction(
    transactionId: string,
    context: APIContext
  ): Promise<APIResponse<boolean>> {
    try {
      const result = await this.transactionEngine.processTransaction(transactionId);
      
      return {
        success: result,
        data: result,
        error: result ? undefined : 'Transaction processing failed',
        metadata: { requestId: context.requestId }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transaction processing failed'
      };
    }
  }

  async getTransaction(
    transactionId: string,
    context: APIContext
  ): Promise<APIResponse<TransactionDimension>> {
    const transaction = this.transactionEngine.getTransaction(transactionId);
    
    if (!transaction) {
      return {
        success: false,
        error: 'Transaction not found'
      };
    }

    return {
      success: true,
      data: transaction,
      metadata: { requestId: context.requestId }
    };
  }

  async getUserTransactionHistory(
    userId: string,
    limit = 50,
    context: APIContext
  ): Promise<APIResponse<TransactionDimension[]>> {
    try {
      const transactions = this.transactionEngine.getTransactionHistory(userId, limit);
      
      return {
        success: true,
        data: transactions,
        metadata: { 
          requestId: context.requestId,
          total: transactions.length 
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get transaction history'
      };
    }
  }

  async verifyTransaction(
    transactionId: string,
    context: APIContext
  ): Promise<APIResponse<boolean>> {
    try {
      const isValid = this.transactionEngine.verifyTransactionIntegrity(transactionId);
      
      return {
        success: true,
        data: isValid,
        metadata: { requestId: context.requestId }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Verification failed'
      };
    }
  }

  // Analytics Routes
  async getMarketplaceStats(
    context: APIContext
  ): Promise<APIResponse<{
    products: number;
    users: number;
    transactions: number;
    dimensions: string[];
  }>> {
    try {
      const stats = {
        products: this.products.size,
        users: this.users.size,
        transactions: 0, // Would need to count from transaction engine
        dimensions: this.searchEngine?.index.dimensions || []
      };

      return {
        success: true,
        data: stats,
        metadata: { requestId: context.requestId }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get stats'
      };
    }
  }

  // Health Check Route
  async healthCheck(context: APIContext): Promise<APIResponse<{
    status: string;
    timestamp: Date;
    services: Record<string, boolean>;
  }>> {
    const services = {
      searchEngine: !!this.searchEngine,
      transactionEngine: !!this.transactionEngine,
      products: this.products.size > 0,
      users: this.users.size > 0
    };

    const allHealthy = Object.values(services).every(Boolean);

    return {
      success: true,
      data: {
        status: allHealthy ? 'healthy' : 'partial',
        timestamp: new Date(),
        services
      },
      metadata: { requestId: context.requestId }
    };
  }

  // Private utility methods
  private generateId(prefix: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${prefix}_${timestamp}_${random}`;
  }

  private updateSearchIndex(): void {
    const products = Array.from(this.products.values());
    this.searchEngine = new DimensionalSearchEngine(products);
  }

  // Initialize with sample data for testing
  initializeSampleData(): void {
    // Add sample products
    const sampleProduct: ProductDimension = {
      id: 'prod_sample_1',
      coordinates: { price: 50, quality: 0.8, popularity: 0.6 },
      timestamp: new Date(),
      version: 1,
      name: 'Sample Product',
      description: 'A sample product for testing',
      price: { base: 50, currency: 'USD' },
      categories: ['electronics'],
      attributes: {},
      availability: { total: 100 },
      quality: { score: 0.8 },
      seller: {
        id: 'seller_1',
        reputation: 4.5,
        coordinates: { reliability: 0.9, speed: 0.8 }
      }
    };

    this.products.set(sampleProduct.id, sampleProduct);

    // Add sample user
    const sampleUser: UserDimension = {
      id: 'user_sample_1',
      coordinates: { price_sensitivity: 0.7, quality_preference: 0.9 },
      timestamp: new Date(),
      version: 1,
      profile: {
        name: 'Sample User',
        email: 'user@example.com',
        preferences: { price: 0.3, quality: 0.9, speed: 0.6 }
      },
      behavior: {
        browsingPattern: {},
        purchaseHistory: [],
        engagement: {}
      },
      reputation: {
        score: 4.0,
        reviews: 10,
        transactions: 5
      }
    };

    this.users.set(sampleUser.id, sampleUser);

    // Initialize search engine with sample data
    this.updateSearchIndex();
  }
}