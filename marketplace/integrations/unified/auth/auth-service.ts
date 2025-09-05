import { EventEmitter } from 'events';
import { createHash, createHmac, randomBytes } from 'crypto';
import { AuthContext, AuthContextSchema } from '../types/orchestration';

interface AuthConfig {
  required: boolean;
  excludedPaths: string[];
  tokenExpiration: number; // in milliseconds
  secretKey: string;
  supportedMethods: Array<'api-key' | 'bearer' | 'oauth2' | 'custom'>;
  oauth2?: {
    clientId: string;
    clientSecret: string;
    tokenEndpoint: string;
    userInfoEndpoint: string;
  };
}

interface User {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  apiKey?: string;
  active: boolean;
  createdAt: Date;
  lastLogin?: Date;
  metadata?: Record<string, any>;
}

interface ApiKey {
  key: string;
  userId: string;
  name: string;
  scopes: string[];
  expiresAt?: Date;
  rateLimit?: {
    requests: number;
    window: number; // in seconds
  };
  active: boolean;
  createdAt: Date;
  lastUsed?: Date;
}

interface Session {
  id: string;
  userId: string;
  token: string;
  refreshToken?: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  active: boolean;
  createdAt: Date;
  lastActivity: Date;
  permissions: string[];
  roles: string[];
  metadata?: Record<string, any>;
}

export class AuthenticationService extends EventEmitter {
  private config: AuthConfig;
  private users: Map<string, User> = new Map();
  private apiKeys: Map<string, ApiKey> = new Map();
  private sessions: Map<string, Session> = new Map();
  private blacklistedTokens: Set<string> = new Set();

  constructor(config: AuthConfig) {
    super();
    this.config = config;
    this.setupDefaultUsers();
  }

  async initialize(): Promise<void> {
    // In a real implementation, this would connect to a database or external auth service
    this.emit('initialized');
  }

  private setupDefaultUsers(): void {
    // Create system admin user
    const adminUser: User = {
      id: 'admin',
      email: 'admin@citty.dev',
      name: 'System Administrator',
      roles: ['admin', 'user'],
      permissions: ['*'],
      active: true,
      createdAt: new Date(),
      apiKey: this.generateApiKey()
    };
    this.users.set(adminUser.id, adminUser);

    // Create API key for admin
    const adminApiKey: ApiKey = {
      key: adminUser.apiKey!,
      userId: adminUser.id,
      name: 'Admin API Key',
      scopes: ['*'],
      active: true,
      createdAt: new Date()
    };
    this.apiKeys.set(adminApiKey.key, adminApiKey);

    // Create demo user
    const demoUser: User = {
      id: 'demo',
      email: 'demo@citty.dev',
      name: 'Demo User',
      roles: ['user'],
      permissions: ['read', 'marketplace.search', 'marketplace.browse'],
      active: true,
      createdAt: new Date(),
      apiKey: this.generateApiKey()
    };
    this.users.set(demoUser.id, demoUser);

    // Create API key for demo user
    const demoApiKey: ApiKey = {
      key: demoUser.apiKey!,
      userId: demoUser.id,
      name: 'Demo API Key',
      scopes: ['read', 'marketplace:basic'],
      rateLimit: { requests: 100, window: 3600 }, // 100 requests per hour
      active: true,
      createdAt: new Date()
    };
    this.apiKeys.set(demoApiKey.key, demoApiKey);
  }

  async authenticate(security?: {
    token?: string;
    permissions?: string[];
    apiKey?: string;
    signature?: string;
  }): Promise<AuthContext> {
    if (!security) {
      throw new Error('No authentication credentials provided');
    }

    // Try API key authentication first
    if (security.apiKey) {
      return await this.authenticateApiKey(security.apiKey);
    }

    // Try bearer token authentication
    if (security.token) {
      return await this.authenticateToken(security.token);
    }

    throw new Error('No valid authentication method provided');
  }

  private async authenticateApiKey(apiKey: string): Promise<AuthContext> {
    const keyRecord = this.apiKeys.get(apiKey);
    if (!keyRecord) {
      throw new Error('Invalid API key');
    }

    if (!keyRecord.active) {
      throw new Error('API key is inactive');
    }

    if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
      throw new Error('API key has expired');
    }

    const user = this.users.get(keyRecord.userId);
    if (!user || !user.active) {
      throw new Error('User account is inactive');
    }

    // Update last used timestamp
    keyRecord.lastUsed = new Date();
    user.lastLogin = new Date();

    const context: AuthContext = {
      userId: user.id,
      sessionId: this.generateSessionId(),
      permissions: [...user.permissions, ...keyRecord.scopes],
      roles: user.roles,
      scopes: keyRecord.scopes,
      expires: new Date(Date.now() + this.config.tokenExpiration),
      metadata: {
        authMethod: 'api-key',
        apiKeyName: keyRecord.name,
        userEmail: user.email,
        userName: user.name
      }
    };

    this.emit('authenticated', { userId: user.id, method: 'api-key' });
    return AuthContextSchema.parse(context);
  }

  private async authenticateToken(token: string): Promise<AuthContext> {
    if (this.blacklistedTokens.has(token)) {
      throw new Error('Token has been revoked');
    }

    const session = Array.from(this.sessions.values()).find(s => 
      s.token === token && s.active && s.expiresAt > new Date()
    );

    if (!session) {
      throw new Error('Invalid or expired token');
    }

    const user = this.users.get(session.userId);
    if (!user || !user.active) {
      throw new Error('User account is inactive');
    }

    // Update last activity
    session.lastActivity = new Date();
    user.lastLogin = new Date();

    const context: AuthContext = {
      userId: user.id,
      sessionId: session.id,
      permissions: session.permissions,
      roles: session.roles,
      scopes: ['full-access'],
      expires: session.expiresAt,
      metadata: {
        authMethod: 'bearer-token',
        sessionId: session.id,
        userEmail: user.email,
        userName: user.name,
        ip: session.ipAddress,
        userAgent: session.userAgent
      }
    };

    this.emit('authenticated', { userId: user.id, method: 'bearer-token' });
    return AuthContextSchema.parse(context);
  }

  async createUser(userData: {
    email: string;
    name: string;
    password: string;
    roles?: string[];
    permissions?: string[];
  }): Promise<User> {
    const existingUser = Array.from(this.users.values()).find(u => u.email === userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const user: User = {
      id: this.generateUserId(),
      email: userData.email,
      name: userData.name,
      roles: userData.roles || ['user'],
      permissions: userData.permissions || ['read'],
      active: true,
      createdAt: new Date(),
      apiKey: this.generateApiKey()
    };

    this.users.set(user.id, user);

    // Create default API key
    const apiKey: ApiKey = {
      key: user.apiKey!,
      userId: user.id,
      name: 'Default API Key',
      scopes: user.permissions,
      active: true,
      createdAt: new Date()
    };
    this.apiKeys.set(apiKey.key, apiKey);

    this.emit('user-created', user.id);
    return user;
  }

  async createSession(userId: string, metadata?: {
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ session: Session; token: string }> {
    const user = this.users.get(userId);
    if (!user || !user.active) {
      throw new Error('User not found or inactive');
    }

    const sessionId = this.generateSessionId();
    const token = this.generateToken(sessionId);
    
    const session: Session = {
      id: sessionId,
      userId,
      token,
      expiresAt: new Date(Date.now() + this.config.tokenExpiration),
      active: true,
      createdAt: new Date(),
      lastActivity: new Date(),
      permissions: user.permissions,
      roles: user.roles,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent
    };

    this.sessions.set(sessionId, session);
    user.lastLogin = new Date();

    this.emit('session-created', { userId, sessionId });
    return { session, token };
  }

  async revokeSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.active = false;
    this.blacklistedTokens.add(session.token);
    
    if (session.refreshToken) {
      this.blacklistedTokens.add(session.refreshToken);
    }

    this.emit('session-revoked', { sessionId, userId: session.userId });
    return true;
  }

  async createApiKey(userId: string, keyData: {
    name: string;
    scopes: string[];
    expiresAt?: Date;
    rateLimit?: { requests: number; window: number };
  }): Promise<ApiKey> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const apiKey: ApiKey = {
      key: this.generateApiKey(),
      userId,
      name: keyData.name,
      scopes: keyData.scopes,
      expiresAt: keyData.expiresAt,
      rateLimit: keyData.rateLimit,
      active: true,
      createdAt: new Date()
    };

    this.apiKeys.set(apiKey.key, apiKey);
    this.emit('api-key-created', { userId, keyName: keyData.name });
    return apiKey;
  }

  async revokeApiKey(apiKey: string): Promise<boolean> {
    const keyRecord = this.apiKeys.get(apiKey);
    if (!keyRecord) {
      return false;
    }

    keyRecord.active = false;
    this.emit('api-key-revoked', { userId: keyRecord.userId, keyName: keyRecord.name });
    return true;
  }

  // Authorization methods
  hasPermission(context: AuthContext, permission: string): boolean {
    // Admin has all permissions
    if (context.permissions.includes('*')) {
      return true;
    }

    // Check exact permission
    if (context.permissions.includes(permission)) {
      return true;
    }

    // Check wildcard permissions
    const parts = permission.split('.');
    for (let i = parts.length - 1; i >= 0; i--) {
      const wildcardPerm = parts.slice(0, i).join('.') + '.*';
      if (context.permissions.includes(wildcardPerm)) {
        return true;
      }
    }

    return false;
  }

  hasRole(context: AuthContext, role: string): boolean {
    return context.roles.includes(role);
  }

  hasScope(context: AuthContext, scope: string): boolean {
    return context.scopes.includes(scope) || context.scopes.includes('*');
  }

  // User management
  async updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    Object.assign(user, updates);
    this.emit('user-updated', userId);
    return user;
  }

  async deleteUser(userId: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) {
      return false;
    }

    // Deactivate instead of deleting
    user.active = false;

    // Revoke all API keys
    for (const [key, apiKey] of this.apiKeys.entries()) {
      if (apiKey.userId === userId) {
        apiKey.active = false;
      }
    }

    // Revoke all sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        session.active = false;
        this.blacklistedTokens.add(session.token);
      }
    }

    this.emit('user-deleted', userId);
    return true;
  }

  // Query methods
  getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  getUserByEmail(email: string): User | undefined {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  getUserApiKeys(userId: string): ApiKey[] {
    return Array.from(this.apiKeys.values()).filter(key => key.userId === userId);
  }

  getUserSessions(userId: string): Session[] {
    return Array.from(this.sessions.values()).filter(session => 
      session.userId === userId && session.active
    );
  }

  // Utility methods
  private generateApiKey(): string {
    return 'ak_' + randomBytes(24).toString('hex');
  }

  private generateUserId(): string {
    return 'usr_' + randomBytes(12).toString('hex');
  }

  private generateSessionId(): string {
    return 'ses_' + randomBytes(16).toString('hex');
  }

  private generateToken(sessionId: string): string {
    const timestamp = Date.now().toString();
    const payload = `${sessionId}.${timestamp}`;
    const signature = createHmac('sha256', this.config.secretKey)
      .update(payload)
      .digest('hex');
    
    return `${Buffer.from(payload).toString('base64')}.${signature}`;
  }

  // Cleanup methods
  cleanupExpiredSessions(): void {
    const now = new Date();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        session.active = false;
        this.blacklistedTokens.add(session.token);
        this.emit('session-expired', sessionId);
      }
    }
  }

  cleanupExpiredApiKeys(): void {
    const now = new Date();
    for (const [key, apiKey] of this.apiKeys.entries()) {
      if (apiKey.expiresAt && apiKey.expiresAt < now) {
        apiKey.active = false;
        this.emit('api-key-expired', key);
      }
    }
  }

  // Health and statistics
  getAuthStats(): {
    users: { total: number; active: number };
    sessions: { total: number; active: number };
    apiKeys: { total: number; active: number };
    blacklistedTokens: number;
  } {
    const users = Array.from(this.users.values());
    const sessions = Array.from(this.sessions.values());
    const apiKeys = Array.from(this.apiKeys.values());

    return {
      users: {
        total: users.length,
        active: users.filter(u => u.active).length
      },
      sessions: {
        total: sessions.length,
        active: sessions.filter(s => s.active && s.expiresAt > new Date()).length
      },
      apiKeys: {
        total: apiKeys.length,
        active: apiKeys.filter(k => k.active).length
      },
      blacklistedTokens: this.blacklistedTokens.size
    };
  }
}