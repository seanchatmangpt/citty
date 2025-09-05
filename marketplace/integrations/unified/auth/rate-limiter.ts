import { EventEmitter } from 'events';
import { RateLimit, RateLimitSchema } from '../types/orchestration';

interface RateLimitRule {
  identifier: string; // Pattern or specific identifier
  requests: number;
  window: number; // in seconds
  burstAllowance?: number; // Allow burst of requests
  priority?: number; // Higher number = higher priority
}

interface RateLimitConfig {
  global: { requests: number; window: number };
  perUser: { requests: number; window: number };
  perResource: Record<string, { requests: number; window: number }>;
  rules?: RateLimitRule[];
  storage?: 'memory' | 'redis'; // Future: support external storage
  cleanupInterval?: number; // in milliseconds
}

interface BucketState {
  tokens: number;
  lastRefill: Date;
  requestCount: number;
  windowStart: Date;
  blocked: boolean;
  blockUntil?: Date;
}

export class RateLimiter extends EventEmitter {
  private config: RateLimitConfig;
  private buckets: Map<string, BucketState> = new Map();
  private rules: RateLimitRule[] = [];
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: RateLimitConfig) {
    super();
    this.config = {
      cleanupInterval: 300000, // 5 minutes
      ...config
    };
    
    this.initializeRules();
    this.startCleanup();
  }

  private initializeRules(): void {
    // Add default global rule
    this.rules.push({
      identifier: '*',
      requests: this.config.global.requests,
      window: this.config.global.window,
      priority: 1
    });

    // Add per-user rule
    this.rules.push({
      identifier: 'user:*',
      requests: this.config.perUser.requests,
      window: this.config.perUser.window,
      priority: 10
    });

    // Add per-resource rules
    for (const [resource, limit] of Object.entries(this.config.perResource)) {
      this.rules.push({
        identifier: `resource:${resource}`,
        requests: limit.requests,
        window: limit.window,
        priority: 5
      });
    }

    // Add custom rules
    if (this.config.rules) {
      this.rules.push(...this.config.rules);
    }

    // Sort rules by priority (highest first)
    this.rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  private startCleanup(): void {
    if (this.config.cleanupInterval) {
      this.cleanupInterval = setInterval(() => {
        this.cleanupExpiredBuckets();
      }, this.config.cleanupInterval);
    }
  }

  private cleanupExpiredBuckets(): void {
    const now = new Date();
    const expiredKeys: string[] = [];

    for (const [key, bucket] of this.buckets.entries()) {
      const rule = this.findRule(key);
      if (!rule) continue;

      const windowExpired = now.getTime() - bucket.windowStart.getTime() > rule.window * 1000;
      const blockExpired = bucket.blockUntil && now > bucket.blockUntil;

      if (windowExpired && (bucket.requestCount === 0 || blockExpired)) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.buckets.delete(key);
    }

    if (expiredKeys.length > 0) {
      this.emit('cleanup', { removedBuckets: expiredKeys.length });
    }
  }

  private findRule(identifier: string): RateLimitRule | undefined {
    // Find most specific matching rule
    for (const rule of this.rules) {
      if (this.matchesRule(identifier, rule.identifier)) {
        return rule;
      }
    }
    return undefined;
  }

  private matchesRule(identifier: string, rulePattern: string): boolean {
    if (rulePattern === '*') {
      return true;
    }

    if (rulePattern === identifier) {
      return true;
    }

    // Handle wildcard patterns
    if (rulePattern.endsWith('*')) {
      const prefix = rulePattern.slice(0, -1);
      return identifier.startsWith(prefix);
    }

    return false;
  }

  private getBucket(identifier: string): BucketState {
    let bucket = this.buckets.get(identifier);
    if (!bucket) {
      const rule = this.findRule(identifier);
      if (!rule) {
        throw new Error(`No rate limit rule found for: ${identifier}`);
      }

      bucket = {
        tokens: rule.requests,
        lastRefill: new Date(),
        requestCount: 0,
        windowStart: new Date(),
        blocked: false
      };
      this.buckets.set(identifier, bucket);
    }
    return bucket;
  }

  private updateBucket(identifier: string, bucket: BucketState): void {
    const rule = this.findRule(identifier);
    if (!rule) return;

    const now = new Date();
    const windowDuration = rule.window * 1000;

    // Check if we need to start a new window
    if (now.getTime() - bucket.windowStart.getTime() >= windowDuration) {
      bucket.windowStart = now;
      bucket.requestCount = 0;
      bucket.tokens = rule.requests;
      bucket.blocked = false;
      bucket.blockUntil = undefined;
    }

    // Token bucket algorithm for burst handling
    if (rule.burstAllowance) {
      const timeSinceRefill = now.getTime() - bucket.lastRefill.getTime();
      const refillRate = rule.requests / rule.window; // tokens per second
      const tokensToAdd = Math.floor((timeSinceRefill / 1000) * refillRate);
      
      bucket.tokens = Math.min(rule.requests + rule.burstAllowance, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }
  }

  async isLimited(identifier: string): Promise<boolean> {
    const bucket = this.getBucket(identifier);
    const rule = this.findRule(identifier);
    
    if (!rule) {
      return false;
    }

    this.updateBucket(identifier, bucket);

    // Check if still blocked from previous violation
    if (bucket.blocked && bucket.blockUntil && new Date() < bucket.blockUntil) {
      return true;
    }

    // Check current window limit
    if (bucket.requestCount >= rule.requests) {
      bucket.blocked = true;
      // Block for remainder of current window
      const windowEnd = new Date(bucket.windowStart.getTime() + rule.window * 1000);
      bucket.blockUntil = windowEnd;
      
      this.emit('limit-exceeded', {
        identifier,
        rule,
        requestCount: bucket.requestCount,
        windowStart: bucket.windowStart
      });
      
      return true;
    }

    // Check token bucket for burst
    if (rule.burstAllowance && bucket.tokens <= 0) {
      this.emit('burst-limit-exceeded', {
        identifier,
        rule,
        tokens: bucket.tokens
      });
      return true;
    }

    return false;
  }

  async consumeToken(identifier: string): Promise<RateLimit> {
    if (await this.isLimited(identifier)) {
      throw new Error(`Rate limit exceeded for: ${identifier}`);
    }

    const bucket = this.getBucket(identifier);
    const rule = this.findRule(identifier)!;

    // Consume request
    bucket.requestCount++;
    if (rule.burstAllowance) {
      bucket.tokens--;
    }

    // Calculate reset time
    const windowEnd = new Date(bucket.windowStart.getTime() + rule.window * 1000);

    const rateLimit: RateLimit = {
      identifier,
      resource: this.extractResource(identifier),
      limit: rule.requests,
      window: rule.window,
      current: bucket.requestCount,
      reset: windowEnd,
      blocked: bucket.blocked
    };

    this.emit('token-consumed', {
      identifier,
      remaining: rule.requests - bucket.requestCount,
      resetTime: windowEnd
    });

    return RateLimitSchema.parse(rateLimit);
  }

  private extractResource(identifier: string): string {
    if (identifier.startsWith('resource:')) {
      return identifier.substring(9);
    }
    if (identifier.startsWith('user:')) {
      return 'user-requests';
    }
    return 'global';
  }

  getLimit(identifier: string): RateLimit | null {
    const rule = this.findRule(identifier);
    if (!rule) {
      return null;
    }

    const bucket = this.getBucket(identifier);
    this.updateBucket(identifier, bucket);

    const windowEnd = new Date(bucket.windowStart.getTime() + rule.window * 1000);

    return {
      identifier,
      resource: this.extractResource(identifier),
      limit: rule.requests,
      window: rule.window,
      current: bucket.requestCount,
      reset: windowEnd,
      blocked: bucket.blocked
    };
  }

  async resetLimit(identifier: string): Promise<boolean> {
    const bucket = this.buckets.get(identifier);
    if (!bucket) {
      return false;
    }

    const rule = this.findRule(identifier);
    if (!rule) {
      return false;
    }

    bucket.requestCount = 0;
    bucket.tokens = rule.requests + (rule.burstAllowance || 0);
    bucket.windowStart = new Date();
    bucket.blocked = false;
    bucket.blockUntil = undefined;

    this.emit('limit-reset', { identifier });
    return true;
  }

  addRule(rule: RateLimitRule): void {
    // Remove existing rule with same identifier
    this.rules = this.rules.filter(r => r.identifier !== rule.identifier);
    
    // Add new rule
    this.rules.push(rule);
    
    // Re-sort by priority
    this.rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    this.emit('rule-added', rule);
  }

  removeRule(identifier: string): boolean {
    const initialLength = this.rules.length;
    this.rules = this.rules.filter(r => r.identifier !== identifier);
    
    if (this.rules.length < initialLength) {
      // Remove associated buckets
      for (const [bucketKey] of this.buckets.entries()) {
        if (this.matchesRule(bucketKey, identifier)) {
          this.buckets.delete(bucketKey);
        }
      }
      
      this.emit('rule-removed', identifier);
      return true;
    }
    
    return false;
  }

  // Statistics and monitoring
  getStats(): {
    totalBuckets: number;
    activeBuckets: number;
    blockedBuckets: number;
    totalRules: number;
    requestsPerMinute: number;
  } {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    
    let activeBuckets = 0;
    let blockedBuckets = 0;
    let recentRequests = 0;

    for (const bucket of this.buckets.values()) {
      if (bucket.windowStart > oneMinuteAgo) {
        activeBuckets++;
        recentRequests += bucket.requestCount;
      }
      
      if (bucket.blocked) {
        blockedBuckets++;
      }
    }

    return {
      totalBuckets: this.buckets.size,
      activeBuckets,
      blockedBuckets,
      totalRules: this.rules.length,
      requestsPerMinute: recentRequests
    };
  }

  getTopConsumers(limit: number = 10): Array<{
    identifier: string;
    requests: number;
    blocked: boolean;
    windowStart: Date;
  }> {
    const consumers = Array.from(this.buckets.entries())
      .map(([identifier, bucket]) => ({
        identifier,
        requests: bucket.requestCount,
        blocked: bucket.blocked,
        windowStart: bucket.windowStart
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, limit);

    return consumers;
  }

  getAllLimits(): Array<RateLimit & { rule: RateLimitRule }> {
    const limits: Array<RateLimit & { rule: RateLimitRule }> = [];

    for (const [identifier, bucket] of this.buckets.entries()) {
      const rule = this.findRule(identifier);
      if (!rule) continue;

      this.updateBucket(identifier, bucket);
      const windowEnd = new Date(bucket.windowStart.getTime() + rule.window * 1000);

      limits.push({
        identifier,
        resource: this.extractResource(identifier),
        limit: rule.requests,
        window: rule.window,
        current: bucket.requestCount,
        reset: windowEnd,
        blocked: bucket.blocked,
        rule
      });
    }

    return limits.sort((a, b) => b.current - a.current);
  }

  // Cleanup and shutdown
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.buckets.clear();
    this.emit('stopped');
  }

  // Testing utilities
  simulateTime(milliseconds: number): void {
    // For testing: advance all bucket timestamps
    const now = new Date();
    const futureTime = new Date(now.getTime() + milliseconds);

    for (const bucket of this.buckets.values()) {
      const timeDiff = milliseconds;
      bucket.lastRefill = new Date(bucket.lastRefill.getTime() + timeDiff);
      bucket.windowStart = new Date(bucket.windowStart.getTime() + timeDiff);
      
      if (bucket.blockUntil) {
        bucket.blockUntil = new Date(bucket.blockUntil.getTime() + timeDiff);
      }
    }
  }
}