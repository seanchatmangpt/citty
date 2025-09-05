/**
 * Advanced Rate Limiter with DDoS Protection
 * Implements sliding window, token bucket, and adaptive rate limiting
 */

import { Logger } from '../monitoring/Logger';

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  algorithm?: 'sliding-window' | 'token-bucket' | 'fixed-window';
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (identifier: string) => string;
  onLimitReached?: (identifier: string, hitInfo: RateLimitHitInfo) => void;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingPoints: number;
  msBeforeNext: number;
  totalHits: number;
}

export interface RateLimitHitInfo {
  totalHits: number;
  remainingPoints: number;
  msBeforeNext: number;
  timestamp: Date;
}

interface SlidingWindowData {
  hits: number[];
  windowStart: number;
}

interface TokenBucketData {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRate: number;
}

interface FixedWindowData {
  count: number;
  windowStart: number;
}

export class RateLimiter {
  private logger: Logger;
  private slidingWindows = new Map<string, SlidingWindowData>();
  private tokenBuckets = new Map<string, TokenBucketData>();
  private fixedWindows = new Map<string, FixedWindowData>();
  private suspiciousIPs = new Map<string, { score: number; lastUpdate: Date }>();
  private whitelistedIPs = new Set<string>();
  private blacklistedIPs = new Set<string>();

  constructor() {
    this.logger = new Logger({ service: 'RateLimiter' });
    
    // Cleanup old entries periodically
    setInterval(() => this.cleanup(), 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Check rate limit using specified algorithm
   */
  async checkLimit(
    identifier: string,
    max: number,
    windowMs: number,
    algorithm: 'sliding-window' | 'token-bucket' | 'fixed-window' = 'sliding-window'
  ): Promise<RateLimitResult> {
    try {
      // Check if IP is blacklisted
      const ip = this.extractIP(identifier);
      if (this.blacklistedIPs.has(ip)) {
        await this.logger.security('BLACKLISTED_IP_BLOCKED', { identifier, ip });
        return {
          allowed: false,
          remainingPoints: 0,
          msBeforeNext: windowMs,
          totalHits: max + 1
        };
      }

      // Check if IP is whitelisted
      if (this.whitelistedIPs.has(ip)) {
        return {
          allowed: true,
          remainingPoints: max,
          msBeforeNext: 0,
          totalHits: 0
        };
      }

      let result: RateLimitResult;

      switch (algorithm) {
        case 'sliding-window':
          result = await this.checkSlidingWindow(identifier, max, windowMs);
          break;
        case 'token-bucket':
          result = await this.checkTokenBucket(identifier, max, windowMs);
          break;
        case 'fixed-window':
          result = await this.checkFixedWindow(identifier, max, windowMs);
          break;
        default:
          result = await this.checkSlidingWindow(identifier, max, windowMs);
      }

      // Update suspicious IP tracking
      if (!result.allowed) {
        await this.updateSuspiciousIP(ip);
      }

      return result;
    } catch (error) {
      await this.logger.error('Rate limit check failed', { error, identifier });
      // Fail open - allow request but log error
      return {
        allowed: true,
        remainingPoints: max,
        msBeforeNext: 0,
        totalHits: 0
      };
    }
  }

  /**
   * Sliding window rate limiting
   */
  private async checkSlidingWindow(
    identifier: string,
    max: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    let data = this.slidingWindows.get(identifier);
    if (!data) {
      data = { hits: [], windowStart: now };
      this.slidingWindows.set(identifier, data);
    }

    // Remove hits outside the window
    data.hits = data.hits.filter(hit => hit > windowStart);
    
    // Add current hit
    data.hits.push(now);
    
    const totalHits = data.hits.length;
    const allowed = totalHits <= max;
    const remainingPoints = Math.max(0, max - totalHits);
    
    let msBeforeNext = 0;
    if (!allowed && data.hits.length > 0) {
      const oldestHit = Math.min(...data.hits);
      msBeforeNext = Math.max(0, windowMs - (now - oldestHit));
    }

    if (!allowed) {
      await this.logger.warn('Rate limit exceeded (sliding window)', {
        identifier,
        totalHits,
        max,
        windowMs,
        msBeforeNext
      });
    }

    return {
      allowed,
      remainingPoints,
      msBeforeNext,
      totalHits
    };
  }

  /**
   * Token bucket rate limiting
   */
  private async checkTokenBucket(
    identifier: string,
    capacity: number,
    refillIntervalMs: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const refillRate = capacity / refillIntervalMs; // tokens per ms
    
    let bucket = this.tokenBuckets.get(identifier);
    if (!bucket) {
      bucket = {
        tokens: capacity,
        lastRefill: now,
        capacity,
        refillRate
      };
      this.tokenBuckets.set(identifier, bucket);
    }

    // Refill tokens
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = timePassed * bucket.refillRate;
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Check if we can consume a token
    const allowed = bucket.tokens >= 1;
    if (allowed) {
      bucket.tokens -= 1;
    }

    const msBeforeNext = allowed ? 0 : Math.ceil((1 - bucket.tokens) / bucket.refillRate);

    if (!allowed) {
      await this.logger.warn('Rate limit exceeded (token bucket)', {
        identifier,
        tokensRemaining: bucket.tokens,
        capacity,
        msBeforeNext
      });
    }

    return {
      allowed,
      remainingPoints: Math.floor(bucket.tokens),
      msBeforeNext,
      totalHits: capacity - Math.floor(bucket.tokens)
    };
  }

  /**
   * Fixed window rate limiting
   */
  private async checkFixedWindow(
    identifier: string,
    max: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    
    let data = this.fixedWindows.get(identifier);
    if (!data || data.windowStart !== windowStart) {
      data = { count: 0, windowStart };
      this.fixedWindows.set(identifier, data);
    }

    data.count++;
    
    const allowed = data.count <= max;
    const remainingPoints = Math.max(0, max - data.count);
    const msBeforeNext = allowed ? 0 : (windowStart + windowMs) - now;

    if (!allowed) {
      await this.logger.warn('Rate limit exceeded (fixed window)', {
        identifier,
        count: data.count,
        max,
        windowStart,
        msBeforeNext
      });
    }

    return {
      allowed,
      remainingPoints,
      msBeforeNext,
      totalHits: data.count
    };
  }

  /**
   * DDoS Protection: Detect and mitigate distributed attacks
   */
  async checkDDoSProtection(
    identifier: string,
    requestsPerSecond: number,
    suspiciousThreshold: number = 100
  ): Promise<{
    blocked: boolean;
    reason?: string;
    mitigationLevel: 'none' | 'soft' | 'hard';
  }> {
    const ip = this.extractIP(identifier);
    const suspicious = this.suspiciousIPs.get(ip);
    
    if (suspicious && suspicious.score > suspiciousThreshold) {
      await this.logger.security('DDOS_ATTACK_DETECTED', {
        ip,
        suspiciousScore: suspicious.score,
        identifier
      });

      // Auto-blacklist for severe attacks
      if (suspicious.score > suspiciousThreshold * 2) {
        this.blacklistedIPs.add(ip);
        return {
          blocked: true,
          reason: 'DDoS attack detected - IP blacklisted',
          mitigationLevel: 'hard'
        };
      }

      return {
        blocked: true,
        reason: 'Suspicious activity detected',
        mitigationLevel: 'soft'
      };
    }

    return {
      blocked: false,
      mitigationLevel: 'none'
    };
  }

  /**
   * Adaptive rate limiting based on system load
   */
  async getAdaptiveLimit(
    baseLimit: number,
    systemLoad: number,
    errorRate: number
  ): Promise<number> {
    let adaptedLimit = baseLimit;

    // Reduce limit if system is under stress
    if (systemLoad > 0.8) {
      adaptedLimit = Math.floor(baseLimit * 0.5);
    } else if (systemLoad > 0.6) {
      adaptedLimit = Math.floor(baseLimit * 0.75);
    }

    // Further reduce if error rate is high
    if (errorRate > 0.1) {
      adaptedLimit = Math.floor(adaptedLimit * 0.5);
    }

    await this.logger.debug('Adaptive rate limit calculated', {
      baseLimit,
      adaptedLimit,
      systemLoad,
      errorRate
    });

    return Math.max(1, adaptedLimit); // Minimum 1 request allowed
  }

  /**
   * Whitelist management
   */
  addToWhitelist(ip: string): void {
    this.whitelistedIPs.add(ip);
    this.blacklistedIPs.delete(ip); // Remove from blacklist if present
    this.suspiciousIPs.delete(ip); // Clear suspicious tracking
  }

  removeFromWhitelist(ip: string): void {
    this.whitelistedIPs.delete(ip);
  }

  /**
   * Blacklist management
   */
  addToBlacklist(ip: string, reason?: string): void {
    this.blacklistedIPs.add(ip);
    this.whitelistedIPs.delete(ip); // Remove from whitelist if present
    this.logger.security('IP_BLACKLISTED', { ip, reason });
  }

  removeFromBlacklist(ip: string): void {
    this.blacklistedIPs.delete(ip);
  }

  /**
   * Clear rate limit data for identifier
   */
  reset(identifier: string): void {
    this.slidingWindows.delete(identifier);
    this.tokenBuckets.delete(identifier);
    this.fixedWindows.delete(identifier);
  }

  /**
   * Get rate limit status
   */
  getStatus(identifier: string): {
    slidingWindow?: SlidingWindowData;
    tokenBucket?: TokenBucketData;
    fixedWindow?: FixedWindowData;
  } {
    return {
      slidingWindow: this.slidingWindows.get(identifier),
      tokenBucket: this.tokenBuckets.get(identifier),
      fixedWindow: this.fixedWindows.get(identifier)
    };
  }

  /**
   * Get rate limiter statistics
   */
  getStatistics(): {
    totalIdentifiers: number;
    whitelistedIPs: number;
    blacklistedIPs: number;
    suspiciousIPs: number;
    memoryUsage: {
      slidingWindows: number;
      tokenBuckets: number;
      fixedWindows: number;
    };
  } {
    return {
      totalIdentifiers: this.slidingWindows.size + this.tokenBuckets.size + this.fixedWindows.size,
      whitelistedIPs: this.whitelistedIPs.size,
      blacklistedIPs: this.blacklistedIPs.size,
      suspiciousIPs: this.suspiciousIPs.size,
      memoryUsage: {
        slidingWindows: this.slidingWindows.size,
        tokenBuckets: this.tokenBuckets.size,
        fixedWindows: this.fixedWindows.size
      }
    };
  }

  /**
   * Extract IP from identifier
   */
  private extractIP(identifier: string): string {
    // Simple extraction - identifier format: "action:ip:other"
    const parts = identifier.split(':');
    return parts.find(part => this.isValidIP(part)) || 'unknown';
  }

  /**
   * Simple IP validation
   */
  private isValidIP(ip: string): boolean {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * Update suspicious IP score
   */
  private async updateSuspiciousIP(ip: string): Promise<void> {
    const now = new Date();
    const existing = this.suspiciousIPs.get(ip) || { score: 0, lastUpdate: now };
    
    // Increase score
    existing.score += 1;
    existing.lastUpdate = now;
    
    this.suspiciousIPs.set(ip, existing);

    // Log high-risk IPs
    if (existing.score > 50 && existing.score % 10 === 0) {
      await this.logger.security('HIGH_RISK_IP_DETECTED', { ip, score: existing.score });
    }
  }

  /**
   * Cleanup old data
   */
  private cleanup(): void {
    const now = Date.now();
    const cleanupAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean sliding windows
    for (const [key, data] of this.slidingWindows.entries()) {
      if (now - Math.max(...data.hits, 0) > cleanupAge) {
        this.slidingWindows.delete(key);
      }
    }

    // Clean token buckets
    for (const [key, bucket] of this.tokenBuckets.entries()) {
      if (now - bucket.lastRefill > cleanupAge) {
        this.tokenBuckets.delete(key);
      }
    }

    // Clean fixed windows
    for (const [key, data] of this.fixedWindows.entries()) {
      if (now - data.windowStart > cleanupAge) {
        this.fixedWindows.delete(key);
      }
    }

    // Clean suspicious IPs (decay scores over time)
    for (const [ip, data] of this.suspiciousIPs.entries()) {
      const hoursSinceUpdate = (now - data.lastUpdate.getTime()) / (60 * 60 * 1000);
      if (hoursSinceUpdate > 24) {
        // Decay score over time
        data.score = Math.max(0, data.score - Math.floor(hoursSinceUpdate / 24));
        if (data.score === 0) {
          this.suspiciousIPs.delete(ip);
        }
      }
    }
  }
}