import { randomBytes, randomUUID } from 'crypto'

export interface TestUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'user' | 'provider'
  apiKey: string
  permissions: string[]
}

export interface TestAsset {
  id: string
  name: string
  type: 'model' | 'dataset' | 'algorithm'
  provider: string
  price: number
  metadata: Record<string, any>
}

export interface TestTransaction {
  id: string
  buyerId: string
  sellerId: string
  assetId: string
  amount: number
  status: 'pending' | 'completed' | 'failed'
  timestamp: Date
}

export class TestDataManager {
  private users: Map<string, TestUser> = new Map()
  private assets: Map<string, TestAsset> = new Map()
  private transactions: Map<string, TestTransaction> = new Map()
  private initialized = false

  async setup(): Promise<void> {
    if (this.initialized) return
    
    console.log('Setting up test data...')
    
    // Create test users
    await this.createTestUsers()
    
    // Create test assets
    await this.createTestAssets()
    
    // Create test transactions
    await this.createTestTransactions()
    
    this.initialized = true
    console.log('Test data setup complete')
  }

  async reset(): Promise<void> {
    // Reset all test data to initial state
    this.users.clear()
    this.assets.clear()
    this.transactions.clear()
    
    await this.setup()
  }

  async cleanup(): Promise<void> {
    console.log('Cleaning up test data...')
    
    // Clean up any persistent test data
    this.users.clear()
    this.assets.clear()
    this.transactions.clear()
    
    this.initialized = false
  }

  private async createTestUsers(): Promise<void> {
    const testUsers: TestUser[] = [
      {
        id: 'user-admin-001',
        email: 'admin@test.com',
        name: 'Test Admin',
        role: 'admin',
        apiKey: this.generateApiKey(),
        permissions: ['*']
      },
      {
        id: 'user-provider-001',
        email: 'provider1@test.com',
        name: 'Test Provider 1',
        role: 'provider',
        apiKey: this.generateApiKey(),
        permissions: ['asset:create', 'asset:update', 'asset:delete', 'transaction:view']
      },
      {
        id: 'user-provider-002',
        email: 'provider2@test.com',
        name: 'Test Provider 2',
        role: 'provider',
        apiKey: this.generateApiKey(),
        permissions: ['asset:create', 'asset:update', 'asset:delete', 'transaction:view']
      },
      {
        id: 'user-buyer-001',
        email: 'buyer1@test.com',
        name: 'Test Buyer 1',
        role: 'user',
        apiKey: this.generateApiKey(),
        permissions: ['asset:view', 'transaction:create']
      },
      {
        id: 'user-buyer-002',
        email: 'buyer2@test.com',
        name: 'Test Buyer 2',
        role: 'user',
        apiKey: this.generateApiKey(),
        permissions: ['asset:view', 'transaction:create']
      }
    ]

    for (const user of testUsers) {
      this.users.set(user.id, user)
    }
  }

  private async createTestAssets(): Promise<void> {
    const testAssets: TestAsset[] = [
      {
        id: 'asset-model-001',
        name: 'Advanced NLP Model',
        type: 'model',
        provider: 'user-provider-001',
        price: 999.99,
        metadata: {
          accuracy: 0.95,
          size: '2.1GB',
          framework: 'PyTorch',
          language: 'en',
          version: '1.0.0'
        }
      },
      {
        id: 'asset-dataset-001',
        name: 'Financial Time Series Dataset',
        type: 'dataset',
        provider: 'user-provider-001',
        price: 499.99,
        metadata: {
          records: 1000000,
          timespan: '2020-2024',
          format: 'CSV',
          size: '500MB'
        }
      },
      {
        id: 'asset-algorithm-001',
        name: 'Quantum-Enhanced Optimizer',
        type: 'algorithm',
        provider: 'user-provider-002',
        price: 1499.99,
        metadata: {
          complexity: 'O(log n)',
          domain: 'optimization',
          quantum: true,
          version: '2.0.0'
        }
      },
      {
        id: 'asset-model-002',
        name: 'Computer Vision Model',
        type: 'model',
        provider: 'user-provider-002',
        price: 799.99,
        metadata: {
          accuracy: 0.92,
          size: '1.8GB',
          framework: 'TensorFlow',
          domain: 'vision',
          version: '1.2.0'
        }
      }
    ]

    for (const asset of testAssets) {
      this.assets.set(asset.id, asset)
    }
  }

  private async createTestTransactions(): Promise<void> {
    const testTransactions: TestTransaction[] = [
      {
        id: 'tx-001',
        buyerId: 'user-buyer-001',
        sellerId: 'user-provider-001',
        assetId: 'asset-model-001',
        amount: 999.99,
        status: 'completed',
        timestamp: new Date(Date.now() - 86400000) // 1 day ago
      },
      {
        id: 'tx-002',
        buyerId: 'user-buyer-002',
        sellerId: 'user-provider-001',
        assetId: 'asset-dataset-001',
        amount: 499.99,
        status: 'pending',
        timestamp: new Date(Date.now() - 3600000) // 1 hour ago
      },
      {
        id: 'tx-003',
        buyerId: 'user-buyer-001',
        sellerId: 'user-provider-002',
        assetId: 'asset-algorithm-001',
        amount: 1499.99,
        status: 'completed',
        timestamp: new Date(Date.now() - 7200000) // 2 hours ago
      }
    ]

    for (const transaction of testTransactions) {
      this.transactions.set(transaction.id, transaction)
    }
  }

  private generateApiKey(): string {
    return 'test_' + randomBytes(32).toString('hex')
  }

  // Getter methods
  getUser(id: string): TestUser | undefined {
    return this.users.get(id)
  }

  getUserByEmail(email: string): TestUser | undefined {
    return Array.from(this.users.values()).find(u => u.email === email)
  }

  getAllUsers(): TestUser[] {
    return Array.from(this.users.values())
  }

  getAsset(id: string): TestAsset | undefined {
    return this.assets.get(id)
  }

  getAssetsByProvider(providerId: string): TestAsset[] {
    return Array.from(this.assets.values()).filter(a => a.provider === providerId)
  }

  getAllAssets(): TestAsset[] {
    return Array.from(this.assets.values())
  }

  getTransaction(id: string): TestTransaction | undefined {
    return this.transactions.get(id)
  }

  getTransactionsByUser(userId: string): TestTransaction[] {
    return Array.from(this.transactions.values())
      .filter(t => t.buyerId === userId || t.sellerId === userId)
  }

  getAllTransactions(): TestTransaction[] {
    return Array.from(this.transactions.values())
  }

  // Dynamic data creation
  createRandomUser(role: TestUser['role'] = 'user'): TestUser {
    const user: TestUser = {
      id: `user-${role}-${randomUUID()}`,
      email: `test-${randomUUID()}@test.com`,
      name: `Test ${role} ${Math.random().toString(36).substring(7)}`,
      role,
      apiKey: this.generateApiKey(),
      permissions: role === 'admin' ? ['*'] : 
                  role === 'provider' ? ['asset:create', 'asset:update', 'asset:delete', 'transaction:view'] :
                  ['asset:view', 'transaction:create']
    }
    
    this.users.set(user.id, user)
    return user
  }

  createRandomAsset(providerId: string): TestAsset {
    const types: TestAsset['type'][] = ['model', 'dataset', 'algorithm']
    const type = types[Math.floor(Math.random() * types.length)]
    
    const asset: TestAsset = {
      id: `asset-${type}-${randomUUID()}`,
      name: `Test ${type} ${Math.random().toString(36).substring(7)}`,
      type,
      provider: providerId,
      price: Math.round(Math.random() * 2000 * 100) / 100,
      metadata: {
        version: '1.0.0',
        created: new Date().toISOString(),
        test: true
      }
    }
    
    this.assets.set(asset.id, asset)
    return asset
  }

  createRandomTransaction(buyerId: string, sellerId: string, assetId: string): TestTransaction {
    const asset = this.getAsset(assetId)
    if (!asset) throw new Error(`Asset ${assetId} not found`)
    
    const transaction: TestTransaction = {
      id: `tx-${randomUUID()}`,
      buyerId,
      sellerId,
      assetId,
      amount: asset.price,
      status: 'pending',
      timestamp: new Date()
    }
    
    this.transactions.set(transaction.id, transaction)
    return transaction
  }
}