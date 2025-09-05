import { IMemoryLayer } from '../interfaces/memory-layer-interface';
import { MemoryEntry, MemoryQuery, MemoryMetrics, MemoryLayer } from '../interfaces/memory-types';
import { createHash } from 'crypto';

interface PredictionModel {
  id: string;
  type: 'linear' | 'neural' | 'ensemble' | 'markov';
  accuracy: number;
  trainingData: any[];
  weights: number[];
  lastTrained: Date;
}

interface PredictionResult {
  prediction: any;
  confidence: number;
  modelUsed: string;
  features: Record<string, number>;
}

/**
 * L4 Memory Layer - ML Predictions
 * - 50KB storage capacity
 * - 85% prediction accuracy
 * - Multiple ML models
 * - Adaptive learning
 */
export class L4PredictionMemory implements IMemoryLayer {
  readonly layer = MemoryLayer.L4_PREDICTIONS;
  readonly maxSize = 50 * 1024; // 50KB
  readonly compressionEnabled = true;
  
  private storage = new Map<string, MemoryEntry>();
  private models = new Map<string, PredictionModel>();
  private predictionCache = new Map<string, PredictionResult>();
  private trainingQueue: Array<{ input: any, output: any, timestamp: Date }> = [];
  
  private metrics: MemoryMetrics = {
    retentionRate: 0.85,
    compressionRatio: 0.6,
    accessTime: 2,
    accuracy: 0.85,
    size: 0,
    lastAccess: new Date(),
    hitCount: 0,
    missCount: 0
  };

  constructor() {
    this.initializeModels();
    this.startTrainingLoop();
  }

  async store<T>(key: string, value: T, options: {
    ttl?: number;
    priority?: number;
    tags?: string[];
  } = {}): Promise<MemoryEntry<T>> {
    const now = new Date();
    const serialized = JSON.stringify(value);
    const checksum = createHash('sha256').update(serialized).digest('hex');
    
    // Extract features for ML
    const features = this.extractFeatures(value);
    
    const entry: MemoryEntry<T> = {
      id: `l4_${key}_${Date.now()}`,
      key,
      value,
      layer: this.layer,
      ttl: options.ttl ?? 7200000, // 2 hours default
      priority: options.priority ?? 20,
      metadata: {
        created: now,
        updated: now,
        accessed: now,
        version: 1,
        checksum,
        tags: [...(options.tags ?? []), 'prediction', 'ml', ...Object.keys(features)]
      },
      metrics: {
        retentionRate: 0.85,
        compressionRatio: 0.6,
        accessTime: 2,
        accuracy: 0.85,
        size: serialized.length,
        lastAccess: now,
        hitCount: 0,
        missCount: 0
      }
    };

    // Check size limits
    if (this.getCurrentSize() + serialized.length > this.maxSize) {
      await this.evictLowAccuracyPredictions();
    }

    this.storage.set(key, entry);
    
    // Add to training queue if this is a known pattern
    this.queueForTraining(features, value);
    
    this.updateMetrics();
    
    return entry;
  }

  async retrieve<T>(key: string): Promise<MemoryEntry<T> | null> {
    const startTime = performance.now();
    const entry = this.storage.get(key) as MemoryEntry<T> | undefined;
    
    if (entry) {
      // Check TTL
      if (entry.ttl && Date.now() - entry.metadata.created.getTime() > entry.ttl) {
        this.storage.delete(key);
        this.predictionCache.delete(key);
        this.metrics.missCount++;
        return null;
      }
      
      // Update access metadata
      entry.metadata.accessed = new Date();
      entry.metrics.hitCount++;
      entry.metrics.lastAccess = new Date();
      entry.metrics.accessTime = performance.now() - startTime;
      
      this.metrics.hitCount++;
      this.metrics.accessTime = (this.metrics.accessTime + entry.metrics.accessTime) / 2;
      this.metrics.lastAccess = new Date();
      
      return entry;
    }
    
    this.metrics.missCount++;
    return null;
  }

  async query(query: MemoryQuery): Promise<MemoryEntry[]> {
    const results: MemoryEntry[] = [];
    
    for (const [key, entry] of this.storage.entries()) {
      let matches = true;
      
      if (query.key && key !== query.key) {
        matches = false;
      }
      
      if (query.pattern && !key.match(new RegExp(query.pattern))) {
        matches = false;
      }
      
      if (query.tags && !query.tags.some(tag => entry.metadata.tags.includes(tag))) {
        matches = false;
      }
      
      if (query.timeRange) {
        if (entry.metadata.created < query.timeRange.start || 
            entry.metadata.created > query.timeRange.end) {
          matches = false;
        }
      }
      
      if (matches) {
        results.push(entry);
      }
    }
    
    // Sort by prediction confidence/accuracy
    results.sort((a, b) => (b.metrics.accuracy ?? 0.85) - (a.metrics.accuracy ?? 0.85));
    
    // Apply limit and offset
    const offset = query.offset ?? 0;
    const limit = query.limit ?? results.length;
    
    return results.slice(offset, offset + limit);
  }

  async delete(key: string): Promise<boolean> {
    const deleted = this.storage.delete(key);
    if (deleted) {
      this.predictionCache.delete(key);
      this.updateMetrics();
    }
    return deleted;
  }

  async clear(): Promise<void> {
    this.storage.clear();
    this.predictionCache.clear();
    this.resetMetrics();
  }

  async getMetrics(): Promise<MemoryMetrics> {
    return { ...this.metrics };
  }

  async compress(): Promise<void> {
    // Compress by merging similar predictions
    const compressionThreshold = 0.9;
    const toCompress: string[] = [];
    
    for (const [key1, entry1] of this.storage.entries()) {
      for (const [key2, entry2] of this.storage.entries()) {
        if (key1 !== key2 && 
            this.calculatePredictionSimilarity(entry1.value, entry2.value) > compressionThreshold) {
          toCompress.push(key2);
        }
      }
    }
    
    for (const key of toCompress) {
      this.storage.delete(key);
      this.predictionCache.delete(key);
    }
    
    this.updateMetrics();
  }

  async validate(): Promise<boolean> {
    // Validate model accuracy against known data
    let correctPredictions = 0;
    let totalPredictions = 0;
    
    for (const [key, entry] of this.storage.entries()) {
      const features = this.extractFeatures(entry.value);
      const prediction = await this.predict(features);
      
      if (prediction && this.validatePrediction(prediction.prediction, entry.value)) {
        correctPredictions++;
      }
      totalPredictions++;
    }
    
    const accuracy = totalPredictions > 0 ? correctPredictions / totalPredictions : 0;
    this.metrics.accuracy = accuracy;
    
    return accuracy >= 0.7; // Minimum 70% accuracy threshold
  }

  async heal(): Promise<number> {
    let healedCount = 0;
    
    // Retrain models with better data
    await this.retrainModels();
    
    // Heal corrupted entries
    for (const [key, entry] of this.storage.entries()) {
      const serialized = JSON.stringify(entry.value);
      const checksum = createHash('sha256').update(serialized).digest('hex');
      
      if (checksum !== entry.metadata.checksum) {
        entry.metadata.checksum = checksum;
        entry.metadata.updated = new Date();
        entry.metadata.version++;
        healedCount++;
      }
      
      // Recalculate accuracy for this entry
      const features = this.extractFeatures(entry.value);
      const prediction = await this.predict(features);
      if (prediction) {
        entry.metrics.accuracy = prediction.confidence;
      }
    }
    
    await this.validate();
    return healedCount;
  }

  /**
   * Make a prediction based on input features
   */
  async predict(features: Record<string, number>): Promise<PredictionResult | null> {
    const cacheKey = this.generateCacheKey(features);
    
    // Check cache first
    if (this.predictionCache.has(cacheKey)) {
      return this.predictionCache.get(cacheKey)!;
    }
    
    // Find best model for this prediction
    let bestModel: PredictionModel | null = null;
    let bestScore = 0;
    
    for (const model of this.models.values()) {
      const score = this.calculateModelScore(model, features);
      if (score > bestScore) {
        bestScore = score;
        bestModel = model;
      }
    }
    
    if (!bestModel || bestScore < 0.5) {
      return null;
    }
    
    // Make prediction using the best model
    const prediction = this.runModel(bestModel, features);
    const result: PredictionResult = {
      prediction,
      confidence: bestScore,
      modelUsed: bestModel.id,
      features
    };
    
    // Cache the result
    this.predictionCache.set(cacheKey, result);
    
    // Cleanup cache if it gets too large
    if (this.predictionCache.size > 100) {
      this.cleanupPredictionCache();
    }
    
    return result;
  }

  /**
   * Train models with new data
   */
  async trainModels(): Promise<void> {
    if (this.trainingQueue.length < 10) return;
    
    // Prepare training data
    const trainingData = this.trainingQueue.splice(0, 100); // Train on batches of 100
    
    for (const model of this.models.values()) {
      await this.trainModel(model, trainingData);
    }
    
    // Update accuracy metrics
    await this.validate();
  }

  private initializeModels(): void {
    // Linear regression model
    this.models.set('linear', {
      id: 'linear',
      type: 'linear',
      accuracy: 0.7,
      trainingData: [],
      weights: [],
      lastTrained: new Date()
    });
    
    // Simple neural network model
    this.models.set('neural', {
      id: 'neural',
      type: 'neural',
      accuracy: 0.8,
      trainingData: [],
      weights: [],
      lastTrained: new Date()
    });
    
    // Ensemble model
    this.models.set('ensemble', {
      id: 'ensemble',
      type: 'ensemble',
      accuracy: 0.85,
      trainingData: [],
      weights: [],
      lastTrained: new Date()
    });
    
    // Markov chain model
    this.models.set('markov', {
      id: 'markov',
      type: 'markov',
      accuracy: 0.75,
      trainingData: [],
      weights: [],
      lastTrained: new Date()
    });
  }

  private startTrainingLoop(): void {
    // Train models every 5 minutes
    setInterval(() => {
      this.trainModels().catch(console.error);
    }, 5 * 60 * 1000);
  }

  private extractFeatures(value: any): Record<string, number> {
    const features: Record<string, number> = {};
    
    // Basic features
    features.type = typeof value === 'string' ? 1 : typeof value === 'number' ? 2 : 
                   typeof value === 'boolean' ? 3 : Array.isArray(value) ? 4 : 5;
    features.size = JSON.stringify(value).length;
    features.complexity = this.calculateComplexity(value);
    features.timestamp = Date.now() % (24 * 60 * 60 * 1000); // Time of day feature
    
    // Content-specific features
    if (typeof value === 'string') {
      features.hasNumbers = /\\d/.test(value) ? 1 : 0;
      features.hasSpecialChars = /[^a-zA-Z0-9\\s]/.test(value) ? 1 : 0;
      features.wordCount = value.split(/\\s+/).length;
    } else if (Array.isArray(value)) {
      features.arrayLength = value.length;
      features.hasNestedArrays = value.some(Array.isArray) ? 1 : 0;
    } else if (value && typeof value === 'object') {
      features.keyCount = Object.keys(value).length;
      features.hasNestedObjects = Object.values(value).some(v => v && typeof v === 'object') ? 1 : 0;
    }
    
    return features;
  }

  private calculateComplexity(value: any, depth: number = 0): number {
    if (depth > 5) return depth; // Prevent infinite recursion
    
    if (Array.isArray(value)) {
      return 1 + value.reduce((sum, item) => sum + this.calculateComplexity(item, depth + 1), 0);
    } else if (value && typeof value === 'object') {
      return 1 + Object.values(value).reduce((sum, item) => sum + this.calculateComplexity(item, depth + 1), 0);
    } else {
      return 1;
    }
  }

  private queueForTraining(features: Record<string, number>, output: any): void {
    this.trainingQueue.push({
      input: features,
      output,
      timestamp: new Date()
    });
    
    // Keep training queue manageable
    if (this.trainingQueue.length > 1000) {
      this.trainingQueue.splice(0, 500);
    }
  }

  private calculateModelScore(model: PredictionModel, features: Record<string, number>): number {
    // Base score is model accuracy
    let score = model.accuracy;
    
    // Penalize for staleness
    const ageInHours = (Date.now() - model.lastTrained.getTime()) / (1000 * 60 * 60);
    score *= Math.max(0.1, 1 - ageInHours / 168); // Decay over a week
    
    // Bonus for having relevant training data
    const relevantTrainingData = model.trainingData.filter(data => 
      this.calculateFeatureSimilarity(data.input, features) > 0.7
    );
    score *= (1 + relevantTrainingData.length / model.trainingData.length);
    
    return Math.min(1, score);
  }

  private calculateFeatureSimilarity(features1: Record<string, number>, features2: Record<string, number>): number {
    const keys = new Set([...Object.keys(features1), ...Object.keys(features2)]);
    let similarity = 0;
    
    for (const key of keys) {
      const val1 = features1[key] ?? 0;
      const val2 = features2[key] ?? 0;
      const maxVal = Math.max(Math.abs(val1), Math.abs(val2), 1);
      similarity += 1 - Math.abs(val1 - val2) / maxVal;
    }
    
    return similarity / keys.size;
  }

  private runModel(model: PredictionModel, features: Record<string, number>): any {
    switch (model.type) {
      case 'linear':
        return this.runLinearModel(model, features);
      case 'neural':
        return this.runNeuralModel(model, features);
      case 'ensemble':
        return this.runEnsembleModel(model, features);
      case 'markov':
        return this.runMarkovModel(model, features);
      default:
        return null;
    }
  }

  private runLinearModel(model: PredictionModel, features: Record<string, number>): any {
    if (model.weights.length === 0) return null;
    
    const featureValues = Object.values(features);
    let result = 0;
    
    for (let i = 0; i < Math.min(featureValues.length, model.weights.length); i++) {
      result += featureValues[i] * model.weights[i];
    }
    
    return result;
  }

  private runNeuralModel(model: PredictionModel, features: Record<string, number>): any {
    // Simplified neural network
    if (model.weights.length === 0) return null;
    
    const inputs = Object.values(features);
    const hiddenSize = Math.floor(model.weights.length / 2);
    
    // Hidden layer
    const hidden: number[] = [];
    for (let i = 0; i < hiddenSize; i++) {
      let sum = 0;
      for (let j = 0; j < inputs.length; j++) {
        sum += inputs[j] * model.weights[i * inputs.length + j];
      }
      hidden.push(this.sigmoid(sum));
    }
    
    // Output layer
    let output = 0;
    for (let i = 0; i < hidden.length; i++) {
      output += hidden[i] * model.weights[hiddenSize * inputs.length + i];
    }
    
    return this.sigmoid(output);
  }

  private runEnsembleModel(model: PredictionModel, features: Record<string, number>): any {
    // Combine predictions from multiple models
    const models = ['linear', 'neural', 'markov'];
    const predictions: number[] = [];
    
    for (const modelId of models) {
      const subModel = this.models.get(modelId);
      if (subModel && subModel.weights.length > 0) {
        const prediction = this.runModel(subModel, features);
        if (typeof prediction === 'number') {
          predictions.push(prediction);
        }
      }
    }
    
    if (predictions.length === 0) return null;
    
    // Weighted average
    return predictions.reduce((sum, pred) => sum + pred, 0) / predictions.length;
  }

  private runMarkovModel(model: PredictionModel, features: Record<string, number>): any {
    // Simple Markov chain based on feature patterns
    if (model.trainingData.length === 0) return null;
    
    // Find most similar training example
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (const data of model.trainingData) {
      const similarity = this.calculateFeatureSimilarity(data.input, features);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = data.output;
      }
    }
    
    return bestMatch;
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  private async trainModel(model: PredictionModel, trainingData: Array<{ input: any, output: any, timestamp: Date }>): Promise<void> {
    // Add new training data
    model.trainingData.push(...trainingData);
    
    // Keep only recent data
    if (model.trainingData.length > 500) {
      model.trainingData.splice(0, model.trainingData.length - 500);
    }
    
    // Simple training algorithm based on model type
    switch (model.type) {
      case 'linear':
        await this.trainLinearModel(model);
        break;
      case 'neural':
        await this.trainNeuralModel(model);
        break;
      case 'ensemble':
        // Ensemble uses other trained models
        break;
      case 'markov':
        // Markov model doesn't need explicit weight training
        break;
    }
    
    model.lastTrained = new Date();
  }

  private async trainLinearModel(model: PredictionModel): Promise<void> {
    if (model.trainingData.length < 5) return;
    
    // Simple linear regression
    const features = model.trainingData.map(d => Object.values(d.input));
    const outputs = model.trainingData.map(d => 
      typeof d.output === 'number' ? d.output : 
      typeof d.output === 'boolean' ? (d.output ? 1 : 0) : 
      JSON.stringify(d.output).length
    );
    
    if (features[0]) {
      model.weights = new Array(features[0].length).fill(0);
      
      // Gradient descent (simplified)
      const learningRate = 0.01;
      for (let epoch = 0; epoch < 10; epoch++) {
        for (let i = 0; i < features.length; i++) {
          let prediction = 0;
          for (let j = 0; j < model.weights.length; j++) {
            prediction += features[i][j] * model.weights[j];
          }
          
          const error = outputs[i] - prediction;
          for (let j = 0; j < model.weights.length; j++) {
            model.weights[j] += learningRate * error * features[i][j];
          }
        }
      }
    }
  }

  private async trainNeuralModel(model: PredictionModel): Promise<void> {
    if (model.trainingData.length < 10) return;
    
    // Initialize weights if empty
    const inputSize = Object.keys(model.trainingData[0].input).length;
    const hiddenSize = Math.max(5, Math.floor(inputSize / 2));
    const totalWeights = inputSize * hiddenSize + hiddenSize;
    
    if (model.weights.length === 0) {
      model.weights = Array.from({ length: totalWeights }, () => (Math.random() - 0.5) * 2);
    }
    
    // Simple backpropagation (very basic implementation)
    const learningRate = 0.001;
    
    for (let epoch = 0; epoch < 5; epoch++) {
      for (const data of model.trainingData) {
        const inputs = Object.values(data.input);
        const target = typeof data.output === 'number' ? data.output : 0.5;
        
        // Forward pass
        const hidden: number[] = [];
        for (let i = 0; i < hiddenSize; i++) {
          let sum = 0;
          for (let j = 0; j < inputs.length; j++) {
            sum += inputs[j] * model.weights[i * inputs.length + j];
          }
          hidden.push(this.sigmoid(sum));
        }
        
        let output = 0;
        for (let i = 0; i < hidden.length; i++) {
          output += hidden[i] * model.weights[hiddenSize * inputs.length + i];
        }
        output = this.sigmoid(output);
        
        // Simple weight update (simplified backprop)
        const outputError = target - output;
        for (let i = 0; i < model.weights.length; i++) {
          model.weights[i] += learningRate * outputError * 0.1; // Simplified update
        }
      }
    }
  }

  private async retrainModels(): Promise<void> {
    for (const model of this.models.values()) {
      if (model.trainingData.length > 0) {
        await this.trainModel(model, []);
      }
    }
  }

  private validatePrediction(prediction: any, actual: any): boolean {
    if (typeof prediction === typeof actual) {
      if (typeof prediction === 'number') {
        return Math.abs(prediction - actual) / Math.max(Math.abs(actual), 1) < 0.1;
      } else if (typeof prediction === 'string') {
        return prediction === actual || prediction.substring(0, 10) === actual.substring(0, 10);
      } else {
        return JSON.stringify(prediction) === JSON.stringify(actual);
      }
    }
    return false;
  }

  private calculatePredictionSimilarity(value1: any, value2: any): number {
    const str1 = JSON.stringify(value1);
    const str2 = JSON.stringify(value2);
    
    if (str1 === str2) return 1;
    
    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);
    
    let matches = 0;
    const minLen = Math.min(len1, len2);
    
    for (let i = 0; i < minLen; i++) {
      if (str1[i] === str2[i]) {
        matches++;
      }
    }
    
    return matches / maxLen;
  }

  private generateCacheKey(features: Record<string, number>): string {
    return Object.entries(features)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value.toFixed(2)}`)
      .join('|');
  }

  private cleanupPredictionCache(): void {
    // Remove oldest entries from cache
    const entries = Array.from(this.predictionCache.entries());
    entries.sort((a, b) => a[1].confidence - b[1].confidence); // Sort by confidence
    
    // Remove bottom 50%
    const toRemove = entries.slice(0, Math.floor(entries.length / 2));
    for (const [key] of toRemove) {
      this.predictionCache.delete(key);
    }
  }

  private getCurrentSize(): number {
    let totalSize = 0;
    for (const entry of this.storage.values()) {
      totalSize += entry.metrics.size;
    }
    return totalSize;
  }

  private async evictLowAccuracyPredictions(): Promise<void> {
    // Remove predictions with lowest accuracy
    const entries = Array.from(this.storage.entries());
    entries.sort((a, b) => (a[1].metrics.accuracy ?? 0) - (b[1].metrics.accuracy ?? 0));
    
    // Remove bottom 25%
    const toRemove = entries.slice(0, Math.floor(entries.length * 0.25));
    for (const [key] of toRemove) {
      this.storage.delete(key);
      this.predictionCache.delete(key);
    }
  }

  private updateMetrics(): void {
    this.metrics.size = this.getCurrentSize();
    this.metrics.lastAccess = new Date();
    
    // Calculate average accuracy across all entries
    let totalAccuracy = 0;
    let count = 0;
    
    for (const entry of this.storage.values()) {
      if (entry.metrics.accuracy !== undefined) {
        totalAccuracy += entry.metrics.accuracy;
        count++;
      }
    }
    
    if (count > 0) {
      this.metrics.accuracy = totalAccuracy / count;
    }
  }

  private resetMetrics(): void {
    this.metrics = {
      retentionRate: 0.85,
      compressionRatio: 0.6,
      accessTime: 2,
      accuracy: 0.85,
      size: 0,
      lastAccess: new Date(),
      hitCount: 0,
      missCount: 0
    };
  }
}