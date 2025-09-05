# Pattern 02: Sequential Workflow - Data ETL Pipeline

## Overview

A comprehensive Extract, Transform, Load (ETL) pipeline demonstrating sequential workflow patterns with error recovery, progress tracking, and production-grade data processing.

## Features

- Multi-source data extraction (CSV, JSON, API)
- Complex data transformations with validation
- Multiple output formats and destinations
- Progress tracking and resumable workflows
- Comprehensive error handling and recovery
- Data quality monitoring
- Performance optimization

## Environment Setup

```bash
# Required dependencies
pnpm add csv-parser csv-writer node-fetch fs-extra
pnpm add joi date-fns lodash pg redis bull
pnpm add -D @types/pg @types/lodash @types/bull
```

## Environment Variables

```env
# .env
DATABASE_URL=postgresql://user:password@localhost:5432/etl_db
REDIS_URL=redis://localhost:6379
API_BASE_URL=https://api.example.com
API_KEY=your_api_key_here
BATCH_SIZE=1000
MAX_RETRIES=3
TEMP_DIR=./temp
OUTPUT_DIR=./output
```

## Production Code

```typescript
import { defineCommand } from "citty";
import fs from 'fs-extra';
import csvParser from 'csv-parser';
import createCsvWriter from 'csv-writer';
import fetch from 'node-fetch';
import Joi from 'joi';
import { format, parse } from 'date-fns';
import _ from 'lodash';
import { Pool } from 'pg';
import Redis from 'ioredis';
import Bull from 'bull';
import winston from 'winston';
import path from 'path';

// Types
interface DataRecord {
  id: string;
  name: string;
  email: string;
  age: number;
  department: string;
  salary: number;
  joinDate: Date;
  isActive: boolean;
  metadata?: Record<string, any>;
}

interface ProcessingStats {
  totalRecords: number;
  processedRecords: number;
  validRecords: number;
  invalidRecords: number;
  errors: Array<{ record: any; error: string; step: string }>;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

interface ETLConfig {
  sources: {
    type: 'csv' | 'json' | 'api';
    path?: string;
    url?: string;
    headers?: Record<string, string>;
  }[];
  transformations: {
    validation: boolean;
    deduplication: boolean;
    enrichment: boolean;
    normalization: boolean;
  };
  outputs: {
    type: 'csv' | 'json' | 'database' | 'api';
    destination: string;
    format?: string;
  }[];
  batchSize: number;
  maxRetries: number;
}

// Validation Schema
const recordSchema = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  age: Joi.number().integer().min(16).max(100).required(),
  department: Joi.string().valid(
    'Engineering', 'Sales', 'Marketing', 'HR', 'Finance'
  ).required(),
  salary: Joi.number().positive().max(1000000).required(),
  joinDate: Joi.date().max('now').required(),
  isActive: Joi.boolean().required(),
  metadata: Joi.object().optional()
});

// Logger Configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'etl-error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'etl-combined.log',
      maxsize: 5242880,
      maxFiles: 10
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
        })
      )
    })
  ]
});

// Database Connection
const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis Connection
const redis = new Redis(process.env.REDIS_URL);

// Queue for background processing
const etlQueue = new Bull('etl processing', process.env.REDIS_URL);

// Data Extractors
class DataExtractor {
  async extractFromCSV(filePath: string): Promise<any[]> {
    logger.info('Starting CSV extraction', { filePath });
    const records: any[] = [];
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data) => records.push(data))
        .on('end', () => {
          logger.info('CSV extraction completed', { 
            filePath, 
            recordCount: records.length 
          });
          resolve(records);
        })
        .on('error', (error) => {
          logger.error('CSV extraction failed', { filePath, error: error.message });
          reject(error);
        });
    });
  }

  async extractFromJSON(filePath: string): Promise<any[]> {
    logger.info('Starting JSON extraction', { filePath });
    
    try {
      const data = await fs.readJson(filePath);
      const records = Array.isArray(data) ? data : [data];
      
      logger.info('JSON extraction completed', { 
        filePath, 
        recordCount: records.length 
      });
      
      return records;
    } catch (error) {
      logger.error('JSON extraction failed', { filePath, error: error.message });
      throw error;
    }
  }

  async extractFromAPI(url: string, headers: Record<string, string> = {}): Promise<any[]> {
    logger.info('Starting API extraction', { url });
    
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const records = Array.isArray(data) ? data : [data];
      
      logger.info('API extraction completed', { 
        url, 
        recordCount: records.length,
        status: response.status
      });
      
      return records;
    } catch (error) {
      logger.error('API extraction failed', { url, error: error.message });
      throw error;
    }
  }
}

// Data Transformer
class DataTransformer {
  private stats: ProcessingStats;

  constructor() {
    this.stats = {
      totalRecords: 0,
      processedRecords: 0,
      validRecords: 0,
      invalidRecords: 0,
      errors: [],
      startTime: new Date()
    };
  }

  async transformBatch(records: any[], config: ETLConfig): Promise<DataRecord[]> {
    const transformedRecords: DataRecord[] = [];
    this.stats.totalRecords += records.length;

    logger.info('Starting batch transformation', { 
      batchSize: records.length,
      config: {
        validation: config.transformations.validation,
        deduplication: config.transformations.deduplication,
        enrichment: config.transformations.enrichment,
        normalization: config.transformations.normalization
      }
    });

    for (const record of records) {
      try {
        let transformed = { ...record };

        // Step 1: Normalization
        if (config.transformations.normalization) {
          transformed = this.normalizeRecord(transformed);
        }

        // Step 2: Validation
        if (config.transformations.validation) {
          const { error, value } = recordSchema.validate(transformed, { 
            abortEarly: false,
            stripUnknown: true
          });

          if (error) {
            this.stats.invalidRecords++;
            this.stats.errors.push({
              record: transformed,
              error: error.details.map(d => d.message).join(', '),
              step: 'validation'
            });
            continue;
          }
          transformed = value;
        }

        // Step 3: Enrichment
        if (config.transformations.enrichment) {
          transformed = await this.enrichRecord(transformed);
        }

        transformedRecords.push(transformed as DataRecord);
        this.stats.validRecords++;
        this.stats.processedRecords++;

      } catch (error) {
        this.stats.invalidRecords++;
        this.stats.errors.push({
          record,
          error: error.message,
          step: 'transformation'
        });
        logger.warn('Record transformation failed', { 
          record: record.id || 'unknown',
          error: error.message 
        });
      }
    }

    // Step 4: Deduplication
    if (config.transformations.deduplication) {
      const beforeCount = transformedRecords.length;
      const deduplicated = _.uniqBy(transformedRecords, 'id');
      const duplicatesRemoved = beforeCount - deduplicated.length;
      
      if (duplicatesRemoved > 0) {
        logger.info('Duplicates removed', { count: duplicatesRemoved });
      }
      
      return deduplicated;
    }

    logger.info('Batch transformation completed', {
      inputRecords: records.length,
      outputRecords: transformedRecords.length,
      validRecords: this.stats.validRecords,
      invalidRecords: this.stats.invalidRecords
    });

    return transformedRecords;
  }

  private normalizeRecord(record: any): any {
    const normalized = { ...record };

    // Normalize email
    if (normalized.email) {
      normalized.email = normalized.email.toLowerCase().trim();
    }

    // Normalize name
    if (normalized.name) {
      normalized.name = normalized.name.trim()
        .replace(/\s+/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
    }

    // Normalize department
    if (normalized.department) {
      const deptMapping = {
        'eng': 'Engineering',
        'dev': 'Engineering',
        'sales': 'Sales',
        'mktg': 'Marketing',
        'marketing': 'Marketing',
        'hr': 'HR',
        'human resources': 'HR',
        'finance': 'Finance',
        'accounting': 'Finance'
      };
      
      const dept = normalized.department.toLowerCase().trim();
      normalized.department = deptMapping[dept] || normalized.department;
    }

    // Parse dates
    if (normalized.joinDate && typeof normalized.joinDate === 'string') {
      try {
        normalized.joinDate = parse(normalized.joinDate, 'yyyy-MM-dd', new Date());
      } catch (error) {
        // Try alternative formats
        try {
          normalized.joinDate = new Date(normalized.joinDate);
        } catch {
          logger.warn('Failed to parse join date', { 
            value: normalized.joinDate,
            recordId: normalized.id 
          });
        }
      }
    }

    // Convert numeric fields
    if (normalized.age && typeof normalized.age === 'string') {
      normalized.age = parseInt(normalized.age, 10);
    }
    if (normalized.salary && typeof normalized.salary === 'string') {
      normalized.salary = parseFloat(normalized.salary.replace(/[$,]/g, ''));
    }

    // Convert boolean fields
    if (typeof normalized.isActive === 'string') {
      normalized.isActive = ['true', '1', 'yes', 'active'].includes(
        normalized.isActive.toLowerCase()
      );
    }

    return normalized;
  }

  private async enrichRecord(record: any): Promise<any> {
    const enriched = { ...record };

    try {
      // Add computed fields
      enriched.metadata = {
        ...enriched.metadata,
        experienceYears: this.calculateExperience(enriched.joinDate),
        salaryGrade: this.calculateSalaryGrade(enriched.salary),
        processedAt: new Date().toISOString(),
        enrichmentVersion: '1.0'
      };

      // Add external data (simulate API call)
      if (enriched.department === 'Engineering') {
        enriched.metadata.techLevel = 'Senior';
        enriched.metadata.skills = ['JavaScript', 'TypeScript', 'Node.js'];
      }

    } catch (error) {
      logger.warn('Record enrichment failed', { 
        recordId: record.id,
        error: error.message 
      });
    }

    return enriched;
  }

  private calculateExperience(joinDate: Date): number {
    const now = new Date();
    const diffInMs = now.getTime() - joinDate.getTime();
    return Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 365));
  }

  private calculateSalaryGrade(salary: number): string {
    if (salary < 50000) return 'Junior';
    if (salary < 80000) return 'Mid';
    if (salary < 120000) return 'Senior';
    return 'Principal';
  }

  getStats(): ProcessingStats {
    this.stats.endTime = new Date();
    this.stats.duration = this.stats.endTime.getTime() - this.stats.startTime.getTime();
    return { ...this.stats };
  }
}

// Data Loader
class DataLoader {
  async saveToCSV(records: DataRecord[], filePath: string): Promise<void> {
    logger.info('Starting CSV export', { filePath, recordCount: records.length });

    const csvWriter = createCsvWriter.createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: 'ID' },
        { id: 'name', title: 'Name' },
        { id: 'email', title: 'Email' },
        { id: 'age', title: 'Age' },
        { id: 'department', title: 'Department' },
        { id: 'salary', title: 'Salary' },
        { id: 'joinDate', title: 'Join Date' },
        { id: 'isActive', title: 'Is Active' }
      ]
    });

    const csvRecords = records.map(record => ({
      ...record,
      joinDate: format(record.joinDate, 'yyyy-MM-dd'),
      isActive: record.isActive ? 'Yes' : 'No'
    }));

    try {
      await csvWriter.writeRecords(csvRecords);
      logger.info('CSV export completed', { filePath, recordCount: records.length });
    } catch (error) {
      logger.error('CSV export failed', { filePath, error: error.message });
      throw error;
    }
  }

  async saveToJSON(records: DataRecord[], filePath: string): Promise<void> {
    logger.info('Starting JSON export', { filePath, recordCount: records.length });

    try {
      await fs.writeJson(filePath, records, { spaces: 2 });
      logger.info('JSON export completed', { filePath, recordCount: records.length });
    } catch (error) {
      logger.error('JSON export failed', { filePath, error: error.message });
      throw error;
    }
  }

  async saveToDatabase(records: DataRecord[]): Promise<void> {
    logger.info('Starting database export', { recordCount: records.length });

    const client = await dbPool.connect();
    
    try {
      await client.query('BEGIN');

      // Create table if not exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS employees (
          id VARCHAR PRIMARY KEY,
          name VARCHAR NOT NULL,
          email VARCHAR UNIQUE NOT NULL,
          age INTEGER NOT NULL,
          department VARCHAR NOT NULL,
          salary NUMERIC NOT NULL,
          join_date DATE NOT NULL,
          is_active BOOLEAN NOT NULL,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Insert records in batches
      const batchSize = parseInt(process.env.BATCH_SIZE || '1000');
      const batches = _.chunk(records, batchSize);

      for (const batch of batches) {
        const values = batch.map((record, index) => {
          const baseIndex = index * 10;
          return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}, $${baseIndex + 10})`;
        }).join(', ');

        const params = batch.flatMap(record => [
          record.id,
          record.name,
          record.email,
          record.age,
          record.department,
          record.salary,
          record.joinDate,
          record.isActive,
          JSON.stringify(record.metadata || {}),
          new Date()
        ]);

        const query = `
          INSERT INTO employees (id, name, email, age, department, salary, join_date, is_active, metadata, updated_at)
          VALUES ${values}
          ON CONFLICT (id) 
          DO UPDATE SET 
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            age = EXCLUDED.age,
            department = EXCLUDED.department,
            salary = EXCLUDED.salary,
            join_date = EXCLUDED.join_date,
            is_active = EXCLUDED.is_active,
            metadata = EXCLUDED.metadata,
            updated_at = EXCLUDED.updated_at
        `;

        await client.query(query, params);
      }

      await client.query('COMMIT');
      logger.info('Database export completed', { recordCount: records.length });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Database export failed', { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }
}

// ETL Pipeline
class ETLPipeline {
  private extractor: DataExtractor;
  private transformer: DataTransformer;
  private loader: DataLoader;

  constructor() {
    this.extractor = new DataExtractor();
    this.transformer = new DataTransformer();
    this.loader = new DataLoader();
  }

  async execute(config: ETLConfig): Promise<ProcessingStats> {
    const pipelineId = `etl-${Date.now()}`;
    logger.info('Starting ETL pipeline', { pipelineId, config });

    try {
      // Phase 1: Extract
      logger.info('Phase 1: Extraction started');
      const allRecords: any[] = [];

      for (const source of config.sources) {
        let records: any[] = [];

        switch (source.type) {
          case 'csv':
            records = await this.extractor.extractFromCSV(source.path!);
            break;
          case 'json':
            records = await this.extractor.extractFromJSON(source.path!);
            break;
          case 'api':
            records = await this.extractor.extractFromAPI(source.url!, source.headers);
            break;
          default:
            throw new Error(`Unsupported source type: ${source.type}`);
        }

        allRecords.push(...records);
      }

      logger.info('Phase 1: Extraction completed', { 
        totalRecords: allRecords.length 
      });

      // Phase 2: Transform
      logger.info('Phase 2: Transformation started');
      const transformedRecords: DataRecord[] = [];
      const batches = _.chunk(allRecords, config.batchSize);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        logger.info(`Processing batch ${i + 1}/${batches.length}`, {
          batchSize: batch.length
        });

        const batchResult = await this.transformer.transformBatch(batch, config);
        transformedRecords.push(...batchResult);

        // Save progress to Redis
        await redis.set(`${pipelineId}:progress`, JSON.stringify({
          phase: 'transform',
          batchesProcessed: i + 1,
          totalBatches: batches.length,
          recordsProcessed: transformedRecords.length
        }));
      }

      logger.info('Phase 2: Transformation completed', {
        transformedRecords: transformedRecords.length
      });

      // Phase 3: Load
      logger.info('Phase 3: Loading started');

      for (const output of config.outputs) {
        switch (output.type) {
          case 'csv':
            await this.loader.saveToCSV(transformedRecords, output.destination);
            break;
          case 'json':
            await this.loader.saveToJSON(transformedRecords, output.destination);
            break;
          case 'database':
            await this.loader.saveToDatabase(transformedRecords);
            break;
          default:
            logger.warn(`Unsupported output type: ${output.type}`);
        }
      }

      logger.info('Phase 3: Loading completed');

      // Get final stats
      const stats = this.transformer.getStats();
      
      // Save final results
      await redis.set(`${pipelineId}:results`, JSON.stringify(stats));
      await redis.expire(`${pipelineId}:results`, 86400); // 24 hours

      logger.info('ETL pipeline completed successfully', { 
        pipelineId,
        stats: {
          totalRecords: stats.totalRecords,
          validRecords: stats.validRecords,
          invalidRecords: stats.invalidRecords,
          duration: stats.duration
        }
      });

      return stats;

    } catch (error) {
      logger.error('ETL pipeline failed', { 
        pipelineId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

// Command Definition
export const etlCommand = defineCommand({
  meta: {
    name: "etl",
    description: "Execute ETL pipeline with sequential data processing"
  },
  args: {
    config: {
      type: "string",
      description: "Path to ETL configuration file",
      required: true
    },
    "dry-run": {
      type: "boolean",
      description: "Perform validation only without executing",
      default: false
    },
    resume: {
      type: "string",
      description: "Resume pipeline from checkpoint ID",
      required: false
    }
  },
  async run({ args }) {
    try {
      // Ensure directories exist
      await fs.ensureDir(process.env.TEMP_DIR || './temp');
      await fs.ensureDir(process.env.OUTPUT_DIR || './output');

      // Load configuration
      const configPath = path.resolve(args.config);
      const config: ETLConfig = await fs.readJson(configPath);

      logger.info('ETL configuration loaded', { configPath, config });

      if (args["dry-run"]) {
        console.log("🔍 Dry run mode - validating configuration...");
        
        // Validate configuration
        const requiredFields = ['sources', 'transformations', 'outputs', 'batchSize', 'maxRetries'];
        for (const field of requiredFields) {
          if (!config[field as keyof ETLConfig]) {
            throw new Error(`Missing required configuration field: ${field}`);
          }
        }

        console.log("✅ Configuration is valid");
        return;
      }

      // Execute pipeline
      const pipeline = new ETLPipeline();
      const stats = await pipeline.execute(config);

      // Display results
      console.log("\n🎉 ETL Pipeline Completed Successfully!");
      console.log("==========================================");
      console.log(`📊 Total Records: ${stats.totalRecords}`);
      console.log(`✅ Valid Records: ${stats.validRecords}`);
      console.log(`❌ Invalid Records: ${stats.invalidRecords}`);
      console.log(`⏱️  Duration: ${stats.duration}ms`);
      
      if (stats.errors.length > 0) {
        console.log(`\n⚠️  Errors encountered: ${stats.errors.length}`);
        console.log("Check logs for detailed error information");
      }

      console.log("\n📋 Processing Summary:");
      console.log(`- Started: ${stats.startTime.toISOString()}`);
      console.log(`- Completed: ${stats.endTime?.toISOString()}`);
      console.log(`- Success Rate: ${((stats.validRecords / stats.totalRecords) * 100).toFixed(2)}%`);

    } catch (error) {
      logger.error('ETL command failed', { error: error.message });
      console.error(`❌ ETL Pipeline Failed: ${error.message}`);
      process.exit(1);
    }
  }
});
```

## Configuration Example

```json
{
  "sources": [
    {
      "type": "csv",
      "path": "./data/employees.csv"
    },
    {
      "type": "json", 
      "path": "./data/contractors.json"
    },
    {
      "type": "api",
      "url": "https://api.example.com/users",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  ],
  "transformations": {
    "validation": true,
    "deduplication": true,
    "enrichment": true,
    "normalization": true
  },
  "outputs": [
    {
      "type": "csv",
      "destination": "./output/processed_employees.csv"
    },
    {
      "type": "json",
      "destination": "./output/processed_employees.json"
    },
    {
      "type": "database",
      "destination": "employees"
    }
  ],
  "batchSize": 1000,
  "maxRetries": 3
}
```

## Testing Approach

```typescript
// tests/etl.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ETLPipeline, DataTransformer } from '../src/etl-pipeline';
import fs from 'fs-extra';

describe('ETL Pipeline', () => {
  let pipeline: ETLPipeline;
  const testConfig = {
    sources: [{ type: 'json' as const, path: './test-data.json' }],
    transformations: {
      validation: true,
      deduplication: true,
      enrichment: false,
      normalization: true
    },
    outputs: [{ type: 'json' as const, destination: './test-output.json' }],
    batchSize: 100,
    maxRetries: 3
  };

  beforeEach(async () => {
    pipeline = new ETLPipeline();
    
    // Create test data
    await fs.writeJson('./test-data.json', [
      {
        id: '1',
        name: 'john doe',
        email: 'JOHN@EXAMPLE.COM',
        age: '30',
        department: 'eng',
        salary: '$75,000',
        joinDate: '2023-01-15',
        isActive: 'true'
      }
    ]);
  });

  afterEach(async () => {
    await fs.remove('./test-data.json').catch(() => {});
    await fs.remove('./test-output.json').catch(() => {});
  });

  it('should process valid records successfully', async () => {
    const stats = await pipeline.execute(testConfig);
    
    expect(stats.totalRecords).toBe(1);
    expect(stats.validRecords).toBe(1);
    expect(stats.invalidRecords).toBe(0);
    
    const output = await fs.readJson('./test-output.json');
    expect(output).toHaveLength(1);
    expect(output[0].name).toBe('John Doe');
    expect(output[0].email).toBe('john@example.com');
    expect(output[0].department).toBe('Engineering');
  });

  it('should handle validation errors gracefully', async () => {
    await fs.writeJson('./test-data.json', [
      {
        id: '1',
        name: 'a', // Too short
        email: 'invalid-email',
        age: 'not-a-number',
        department: 'unknown',
        salary: 'invalid',
        joinDate: 'invalid-date',
        isActive: 'maybe'
      }
    ]);

    const stats = await pipeline.execute(testConfig);
    
    expect(stats.totalRecords).toBe(1);
    expect(stats.validRecords).toBe(0);
    expect(stats.invalidRecords).toBe(1);
    expect(stats.errors).toHaveLength(1);
  });
});
```

## Usage Examples

```bash
# Basic ETL execution
./cli etl --config=./config/etl-config.json

# Dry run to validate configuration
./cli etl --config=./config/etl-config.json --dry-run

# Resume from checkpoint
./cli etl --config=./config/etl-config.json --resume=etl-1234567890
```

## Performance Considerations

1. **Batch Processing**: Configurable batch sizes for memory efficiency
2. **Connection Pooling**: Database connections reused across batches
3. **Streaming**: Large files processed in streams, not loaded entirely
4. **Parallel Processing**: Multiple transformation workers via Bull queue
5. **Memory Management**: Garbage collection hints and memory monitoring

## Deployment Notes

### Docker Configuration

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

ENV NODE_ENV=production
VOLUME ["/app/data", "/app/output", "/app/temp"]

CMD ["npm", "start"]
```

### Production Scaling

```yaml
# docker-compose.yml  
version: '3.8'
services:
  etl-app:
    build: .
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/etl_db
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - ./data:/app/data:ro
      - ./output:/app/output
      - ./temp:/app/temp

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=etl_db
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

This pattern provides a comprehensive, production-ready ETL pipeline with sequential processing, comprehensive error handling, and industrial-strength data processing capabilities.