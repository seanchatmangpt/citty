// Transaction Engine with Dimensional Context and Security
import crypto from 'crypto';
import type { TransactionDimension, ProductDimension, UserDimension } from '../types/dimensional-models';
import { DimensionalMath } from '../types/dimensional-models';

export interface TransactionContext {
  buyer: UserDimension;
  seller: UserDimension;
  product: ProductDimension;
  quantity: number;
  metadata?: Record<string, unknown>;
}

export interface TransactionResult {
  transaction: TransactionDimension;
  success: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface TrustMetrics {
  distance: number;
  similarity: number;
  reputation: number;
  history: number;
  overall: number;
}

export class TransactionEngine {
  private transactions = new Map<string, TransactionDimension>();
  private fraudPatterns = new Set<string>();

  constructor() {
    this.initializeFraudPatterns();
  }

  private initializeFraudPatterns(): void {
    // Add common fraud patterns
    this.fraudPatterns.add('rapid_multiple_transactions');
    this.fraudPatterns.add('extreme_dimensional_distance');
    this.fraudPatterns.add('price_manipulation');
    this.fraudPatterns.add('identity_mismatch');
  }

  async createTransaction(context: TransactionContext): Promise<TransactionResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate transaction context
    const validation = this.validateContext(context);
    if (!validation.isValid) {
      return {
        transaction: {} as TransactionDimension,
        success: false,
        errors: validation.errors
      };
    }

    // Calculate trust metrics
    const trust = this.calculateTrustMetrics(context);
    if (trust.overall < 0.3) {
      warnings.push('Low trust score detected');
    }

    // Calculate pricing with dimensional adjustments
    const pricing = this.calculateDimensionalPricing(context);

    // Generate transaction ID and security elements
    const transactionId = this.generateTransactionId();
    const timestamp = new Date();
    const security = this.generateSecurityElements(context, transactionId, timestamp.getTime(), pricing);

    // Create transaction object
    const transaction: TransactionDimension = {
      id: transactionId,
      coordinates: this.calculateTransactionCoordinates(context),
      timestamp,
      version: 1,
      buyer: {
        id: context.buyer.id,
        coordinates: context.buyer.coordinates
      },
      seller: {
        id: context.seller.id,
        coordinates: context.seller.coordinates
      },
      product: {
        id: context.product.id,
        coordinates: context.product.coordinates,
        quantity: context.quantity
      },
      pricing,
      status: 'pending',
      metrics: {
        distance: trust.distance,
        similarity: trust.similarity,
        trust: trust.overall
      },
      security
    };

    // Fraud detection
    const fraudCheck = await this.detectFraud(transaction, context);
    if (fraudCheck.suspicious) {
      warnings.push(...fraudCheck.warnings);
      if (fraudCheck.blocked) {
        return {
          transaction,
          success: false,
          errors: ['Transaction blocked due to fraud detection'],
          warnings: warnings.length > 0 ? warnings : undefined
        };
      }
    }

    // Store transaction
    this.transactions.set(transactionId, transaction);

    return {
      transaction,
      success: true,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  private validateContext(context: TransactionContext): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic validation
    if (!context.buyer || !context.seller || !context.product) {
      errors.push('Missing required transaction participants');
      return { isValid: false, errors };
    }

    if (context.buyer.id === context.seller.id) {
      errors.push('Buyer and seller cannot be the same user');
    }

    if (context.quantity <= 0) {
      errors.push('Quantity must be positive');
    }

    // Price validation - allow zero for free products
    if (context.product.price.base < 0) {
      errors.push('Product price cannot be negative');
    }

    // Availability check
    if (context.product.availability.total < context.quantity) {
      errors.push('Insufficient product availability');
    }

    // Dimensional validation
    const buyerDims = Object.keys(context.buyer.coordinates);
    const sellerDims = Object.keys(context.seller.coordinates);
    const productDims = Object.keys(context.product.coordinates);
    
    if (buyerDims.length === 0 || sellerDims.length === 0 || productDims.length === 0) {
      errors.push('All entities must have dimensional coordinates');
    }

    return { isValid: errors.length === 0, errors };
  }

  private calculateTrustMetrics(context: TransactionContext): TrustMetrics {
    // Calculate Euclidean distance between buyer and seller
    const distance = DimensionalMath.euclideanDistance(
      context.buyer.coordinates,
      context.seller.coordinates
    );

    // Calculate preference similarity
    const similarity = DimensionalMath.cosineSimilarity(
      context.buyer.profile.preferences,
      context.seller.coordinates
    );

    // Reputation score (normalized)
    const reputation = (context.buyer.reputation.score + context.seller.reputation.score) / 10;

    // Transaction history weight
    const buyerHistory = context.buyer.behavior.purchaseHistory.length;
    const sellerTransactions = context.seller.reputation.transactions;
    const history = Math.min(1, (buyerHistory + sellerTransactions) / 100);

    // Overall trust calculation
    const overall = (
      (1 - Math.min(1, distance / 100)) * 0.3 +  // Closer is better
      similarity * 0.3 +                          // Similar preferences
      reputation * 0.3 +                          // Good reputation
      history * 0.1                               // Experience bonus
    );

    return {
      distance,
      similarity,
      reputation,
      history,
      overall
    };
  }

  private calculateDimensionalPricing(context: TransactionContext): TransactionDimension['pricing'] {
    let basePrice = context.product.price.base * context.quantity;
    const adjustments: Record<string, number> = {};

    // Apply dimensional pricing adjustments
    for (const [dim, buyerVal] of Object.entries(context.buyer.coordinates)) {
      const productVal = context.product.coordinates[dim] || 0;
      const sellerVal = context.seller.coordinates[dim] || 0;

      // Distance-based adjustment
      const buyerSellerDistance = Math.abs(buyerVal - sellerVal);
      const adjustment = buyerSellerDistance * 0.01; // 1% per unit distance
      adjustments[`${dim}_distance`] = adjustment;

      // Product dimension adjustment
      if (context.product.price.dimensions?.[dim]) {
        adjustments[`${dim}_product`] = context.product.price.dimensions[dim];
      }
    }

    const totalAdjustment = Object.values(adjustments).reduce((sum, adj) => sum + adj, 0);
    const finalPrice = basePrice + totalAdjustment;

    return {
      base: basePrice,
      adjustments,
      final: Math.max(0, finalPrice),
      currency: context.product.price.currency
    };
  }

  private calculateTransactionCoordinates(context: TransactionContext): Record<string, number> {
    const coordinates: Record<string, number> = {};
    
    // Combine all dimensional spaces
    const allDims = new Set([
      ...Object.keys(context.buyer.coordinates),
      ...Object.keys(context.seller.coordinates),
      ...Object.keys(context.product.coordinates)
    ]);

    for (const dim of allDims) {
      const buyerVal = context.buyer.coordinates[dim] || 0;
      const sellerVal = context.seller.coordinates[dim] || 0;
      const productVal = context.product.coordinates[dim] || 0;

      // Transaction coordinate is weighted average
      coordinates[dim] = (buyerVal * 0.4 + sellerVal * 0.3 + productVal * 0.3);
    }

    return coordinates;
  }

  private generateTransactionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `txn_${timestamp}_${random}`;
  }

  private generateSecurityElements(
    context: TransactionContext,
    transactionId: string,
    timestamp: number,
    pricing: TransactionDimension['pricing']
  ): TransactionDimension['security'] {
    // Create hash of transaction data including pricing
    const data = JSON.stringify({
      id: transactionId,
      buyer: context.buyer.id,
      seller: context.seller.id,
      product: context.product.id,
      quantity: context.quantity,
      timestamp: timestamp,
      pricing: pricing.final // Include final price in hash
    });

    const hash = crypto.createHash('sha256').update(data).digest('hex');

    // Create digital signature (simplified)
    const signature = crypto
      .createHmac('sha256', 'marketplace_secret_key')
      .update(data)
      .digest('hex');

    return {
      hash,
      signature,
      verified: false
    };
  }

  private async detectFraud(
    transaction: TransactionDimension,
    context: TransactionContext
  ): Promise<{ suspicious: boolean; blocked: boolean; warnings: string[] }> {
    const warnings: string[] = [];
    let suspicious = false;
    let blocked = false;

    // Check for rapid multiple transactions
    const recentTransactions = Array.from(this.transactions.values())
      .filter(t => 
        t.buyer.id === context.buyer.id &&
        Date.now() - t.timestamp.getTime() < 300000 // 5 minutes
      );

    if (recentTransactions.length > 5) {
      suspicious = true;
      warnings.push('Rapid multiple transactions detected');
    }

    // Check dimensional distance (potential location fraud)
    if (transaction.metrics.distance && transaction.metrics.distance > 1000) {
      suspicious = true;
      warnings.push('Extreme dimensional distance detected');
    }

    // Check for price manipulation
    const expectedPrice = context.product.price.base * context.quantity;
    const actualPrice = transaction.pricing.final;
    
    // Handle zero price products
    let priceDeviation = 0;
    if (expectedPrice > 0) {
      priceDeviation = Math.abs(actualPrice - expectedPrice) / expectedPrice;
    } else {
      // For zero-price products, only flag if final price is unexpectedly high
      priceDeviation = actualPrice > 10 ? 1 : 0; // Flag if final price > 10 for zero-base product
    }

    if (priceDeviation > 0.5) {
      suspicious = true;
      warnings.push('Unusual price deviation detected');
      if (priceDeviation > 1.0) {
        blocked = true;
      }
    }

    // Check trust score
    if (transaction.metrics.trust && transaction.metrics.trust < 0.2) {
      suspicious = true;
      warnings.push('Very low trust score');
      if (transaction.metrics.trust < 0.1) {
        blocked = true;
      }
    }

    return { suspicious, blocked, warnings };
  }

  async processTransaction(transactionId: string): Promise<boolean> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.status !== 'pending') {
      throw new Error('Transaction cannot be processed in current status');
    }

    try {
      // Simulate payment processing
      await this.simulatePayment(transaction);
      
      // Update transaction status
      transaction.status = 'confirmed';
      transaction.security.verified = true;
      
      this.transactions.set(transactionId, transaction);
      return true;
    } catch (error) {
      transaction.status = 'cancelled';
      this.transactions.set(transactionId, transaction);
      return false;
    }
  }

  private async simulatePayment(transaction: TransactionDimension): Promise<void> {
    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Simulate occasional payment failures
    if (Math.random() < 0.05) { // 5% failure rate
      throw new Error('Payment processing failed');
    }
  }

  getTransaction(transactionId: string): TransactionDimension | undefined {
    return this.transactions.get(transactionId);
  }

  getTransactionHistory(userId: string, limit = 50): TransactionDimension[] {
    return Array.from(this.transactions.values())
      .filter(t => t.buyer.id === userId || t.seller.id === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  verifyTransactionIntegrity(transactionId: string): boolean {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) return false;

    // Reconstruct the hash using the same format as creation
    const data = JSON.stringify({
      id: transactionId,
      buyer: transaction.buyer.id,
      seller: transaction.seller.id,
      product: transaction.product.id,
      quantity: transaction.product.quantity, // Quantity is stored in product
      timestamp: transaction.timestamp.getTime(),
      pricing: transaction.pricing.final // Include pricing in verification
    });

    const expectedHash = crypto.createHash('sha256').update(data).digest('hex');
    
    // Debug output
    // console.log('Verification data:', data);
    // console.log('Expected hash:', expectedHash);
    // console.log('Actual hash:', transaction.security.hash);
    
    // Also verify signature
    const expectedSignature = crypto
      .createHmac('sha256', 'marketplace_secret_key')
      .update(data)
      .digest('hex');
    
    return transaction.security.hash === expectedHash && 
           transaction.security.signature === expectedSignature;
  }
}