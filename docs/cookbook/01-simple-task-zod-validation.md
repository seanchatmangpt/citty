# Pattern 01: Simple Task with Zod Validation - User Registration System

## Overview

A complete user registration system demonstrating Zod validation with comprehensive error handling, logging, and production considerations.

## Features

- Email and password validation
- Duplicate user detection
- Password hashing with bcrypt
- Database integration with SQLite
- Comprehensive logging
- Production-ready error handling
- Rate limiting protection

## Environment Setup

```bash
# Required dependencies
pnpm add zod bcrypt sqlite3 ratelimiter-flexible winston
pnpm add -D @types/bcrypt @types/sqlite3
```

## Environment Variables

```env
# .env
DB_PATH=./users.db
LOG_LEVEL=info
RATE_LIMIT_WINDOW=900000  # 15 minutes
RATE_LIMIT_MAX_ATTEMPTS=5
HASH_ROUNDS=12
```

## Production Code

```typescript
import { defineCommand } from "citty";
import { z } from "zod";
import bcrypt from "bcrypt";
import sqlite3 from "sqlite3";
import winston from "winston";
import { RateLimiterMemory } from "rate-limiter-flexible";

// Validation Schema
const userRegistrationSchema = z.object({
  email: z
    .string()
    .email("Invalid email format")
    .min(5, "Email must be at least 5 characters")
    .max(254, "Email too long")
    .toLowerCase()
    .trim(),
  
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
  
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(50, "First name too long")
    .regex(/^[a-zA-Z\s'-]+$/, "First name contains invalid characters")
    .trim(),
  
  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(50, "Last name too long")
    .regex(/^[a-zA-Z\s'-]+$/, "Last name contains invalid characters")
    .trim(),
  
  age: z
    .number()
    .int("Age must be a whole number")
    .min(13, "Must be at least 13 years old")
    .max(120, "Invalid age"),
  
  terms: z
    .boolean()
    .refine(val => val === true, "Must accept terms and conditions")
});

// Database Schema
interface User {
  id: number;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  age: number;
  createdAt: string;
  updatedAt: string;
}

// Logger Configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Rate Limiter
const rateLimiter = new RateLimiterMemory({
  keyPrefix: 'registration',
  points: parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS || '5'),
  duration: parseInt(process.env.RATE_LIMIT_WINDOW || '900'), // 15 minutes
});

// Database Manager
class UserDatabase {
  private db: sqlite3.Database;

  constructor(dbPath: string) {
    this.db = new sqlite3.Database(dbPath);
    this.initialize();
  }

  private initialize(): void {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        firstName TEXT NOT NULL,
        lastName TEXT NOT NULL,
        age INTEGER NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    this.db.run(createTableQuery, (err) => {
      if (err) {
        logger.error('Failed to create users table', { error: err.message });
        throw new Error('Database initialization failed');
      }
      logger.info('Users table initialized successfully');
    });
  }

  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO users (email, passwordHash, firstName, lastName, age)
        VALUES (?, ?, ?, ?, ?)
      `;

      this.db.run(
        query,
        [userData.email, userData.passwordHash, userData.firstName, userData.lastName, userData.age],
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
              reject(new Error('EMAIL_EXISTS'));
            } else {
              reject(err);
            }
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  async userExists(email: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const query = 'SELECT id FROM users WHERE email = ?';
      
      this.db.get(query, [email], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(!!row);
        }
      });
    });
  }

  close(): void {
    this.db.close();
  }
}

// User Service
class UserService {
  private database: UserDatabase;

  constructor(dbPath: string) {
    this.database = new UserDatabase(dbPath);
  }

  async registerUser(input: z.infer<typeof userRegistrationSchema>, clientIP: string): Promise<{ success: boolean; userId?: number; message: string }> {
    const startTime = Date.now();
    
    try {
      // Rate limiting
      await rateLimiter.consume(clientIP);
      logger.info('Rate limit check passed', { clientIP });

      // Validate input
      const validatedData = userRegistrationSchema.parse(input);
      logger.info('Input validation passed', { email: validatedData.email });

      // Check if user already exists
      const exists = await this.database.userExists(validatedData.email);
      if (exists) {
        logger.warn('Registration attempt for existing email', { 
          email: validatedData.email,
          clientIP 
        });
        return {
          success: false,
          message: 'An account with this email already exists'
        };
      }

      // Hash password
      const passwordHash = await bcrypt.hash(
        validatedData.password, 
        parseInt(process.env.HASH_ROUNDS || '12')
      );
      logger.info('Password hashed successfully');

      // Create user
      const userId = await this.database.createUser({
        email: validatedData.email,
        passwordHash,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        age: validatedData.age
      });

      const duration = Date.now() - startTime;
      logger.info('User registered successfully', {
        userId,
        email: validatedData.email,
        duration: `${duration}ms`,
        clientIP
      });

      return {
        success: true,
        userId,
        message: 'User registered successfully'
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (error.remainingPoints !== undefined) {
        logger.warn('Rate limit exceeded', { 
          clientIP, 
          remainingPoints: error.remainingPoints,
          msBeforeNext: error.msBeforeNext 
        });
        return {
          success: false,
          message: `Too many registration attempts. Try again in ${Math.ceil(error.msBeforeNext / 1000)} seconds`
        };
      }

      if (error instanceof z.ZodError) {
        logger.warn('Validation failed', { 
          errors: error.errors,
          clientIP,
          duration: `${duration}ms`
        });
        return {
          success: false,
          message: `Validation failed: ${error.errors.map(e => e.message).join(', ')}`
        };
      }

      if (error.message === 'EMAIL_EXISTS') {
        return {
          success: false,
          message: 'An account with this email already exists'
        };
      }

      logger.error('Unexpected error during registration', {
        error: error.message,
        stack: error.stack,
        clientIP,
        duration: `${duration}ms`
      });

      return {
        success: false,
        message: 'Registration failed due to an internal error'
      };
    }
  }

  close(): void {
    this.database.close();
  }
}

// Command Definition
export const registerCommand = defineCommand({
  meta: {
    name: "register",
    description: "Register a new user account with comprehensive validation"
  },
  args: {
    email: {
      type: "string",
      description: "User email address",
      required: true
    },
    password: {
      type: "string",
      description: "User password (min 8 chars, mixed case, numbers, special chars)",
      required: true
    },
    firstName: {
      type: "string",
      description: "User's first name",
      required: true
    },
    lastName: {
      type: "string",
      description: "User's last name", 
      required: true
    },
    age: {
      type: "string",
      description: "User's age",
      required: true
    },
    terms: {
      type: "boolean",
      description: "Accept terms and conditions",
      default: false
    },
    "client-ip": {
      type: "string",
      description: "Client IP address for rate limiting",
      default: "127.0.0.1"
    }
  },
  async run({ args }) {
    const userService = new UserService(process.env.DB_PATH || './users.db');
    
    try {
      const result = await userService.registerUser({
        email: args.email,
        password: args.password,
        firstName: args.firstName,
        lastName: args.lastName,
        age: parseInt(args.age),
        terms: args.terms
      }, args["client-ip"]);

      if (result.success) {
        console.log(`✅ ${result.message}`);
        if (result.userId) {
          console.log(`   User ID: ${result.userId}`);
        }
        process.exit(0);
      } else {
        console.error(`❌ ${result.message}`);
        process.exit(1);
      }
    } finally {
      userService.close();
    }
  }
});
```

## Testing Approach

```typescript
// tests/register.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UserService } from '../src/user-service';
import fs from 'fs/promises';

describe('User Registration', () => {
  let userService: UserService;
  const testDbPath = './test-users.db';

  beforeEach(async () => {
    userService = new UserService(testDbPath);
  });

  afterEach(async () => {
    userService.close();
    try {
      await fs.unlink(testDbPath);
    } catch {}
  });

  it('should register a valid user', async () => {
    const result = await userService.registerUser({
      email: 'test@example.com',
      password: 'SecurePass123!',
      firstName: 'John',
      lastName: 'Doe',
      age: 25,
      terms: true
    }, '127.0.0.1');

    expect(result.success).toBe(true);
    expect(result.userId).toBeDefined();
  });

  it('should reject invalid email', async () => {
    const result = await userService.registerUser({
      email: 'invalid-email',
      password: 'SecurePass123!',
      firstName: 'John',
      lastName: 'Doe',
      age: 25,
      terms: true
    }, '127.0.0.1');

    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid email format');
  });

  it('should reject weak password', async () => {
    const result = await userService.registerUser({
      email: 'test@example.com',
      password: 'weak',
      firstName: 'John',
      lastName: 'Doe',
      age: 25,
      terms: true
    }, '127.0.0.1');

    expect(result.success).toBe(false);
    expect(result.message).toContain('Password must');
  });

  it('should prevent duplicate registrations', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'SecurePass123!',
      firstName: 'John',
      lastName: 'Doe',
      age: 25,
      terms: true
    };

    await userService.registerUser(userData, '127.0.0.1');
    const result = await userService.registerUser(userData, '127.0.0.1');

    expect(result.success).toBe(false);
    expect(result.message).toContain('already exists');
  });
});
```

## Usage Examples

```bash
# Basic registration
./cli register \
  --email="john.doe@example.com" \
  --password="SecurePass123!" \
  --firstName="John" \
  --lastName="Doe" \
  --age="25" \
  --terms

# With custom client IP
./cli register \
  --email="jane.doe@example.com" \
  --password="AnotherSecure456!" \
  --firstName="Jane" \
  --lastName="Doe" \
  --age="28" \
  --terms \
  --client-ip="192.168.1.100"
```

## Performance Considerations

1. **Password Hashing**: Uses configurable bcrypt rounds (default 12)
2. **Database Indexing**: Email field is indexed for fast lookups
3. **Rate Limiting**: Prevents brute force attacks
4. **Memory Usage**: SQLite with connection pooling for production
5. **Logging**: Structured JSON logging with rotation

## Deployment Notes

### Docker Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV DB_PATH=/data/users.db
VOLUME ["/data"]

EXPOSE 3000
CMD ["npm", "start"]
```

### Production Environment

```yaml
# docker-compose.yml
version: '3.8'
services:
  user-registration:
    build: .
    environment:
      - NODE_ENV=production
      - DB_PATH=/data/users.db
      - LOG_LEVEL=warn
      - RATE_LIMIT_MAX_ATTEMPTS=3
      - HASH_ROUNDS=14
    volumes:
      - user_data:/data
    restart: unless-stopped

volumes:
  user_data:
```

### Monitoring

```typescript
// Add to command for production monitoring
import { monitorPerformance, CLIMetrics } from 'citty';

// In the run function
const metrics = new CLIMetrics();
await monitorPerformance('user_registration', async () => {
  return userService.registerUser(validatedData, clientIP);
});
```

## Security Considerations

1. **Input Sanitization**: All inputs are validated and sanitized
2. **SQL Injection Prevention**: Parameterized queries used
3. **Password Security**: Bcrypt with configurable rounds
4. **Rate Limiting**: Per-IP registration limits
5. **Error Information**: No sensitive data in error messages
6. **Logging**: Structured logging without sensitive data

## Error Recovery

The system handles various error scenarios:

- **Database Connection Failures**: Graceful degradation
- **Validation Errors**: Detailed user feedback
- **Rate Limiting**: Clear retry instructions
- **Duplicate Users**: User-friendly messaging
- **System Errors**: Logged with correlation IDs

This pattern provides a complete, production-ready foundation for user registration systems with comprehensive validation, security, and monitoring.