/**
 * Enterprise-Grade Encryption Service
 * Implements AES-256, RSA, ECDH key exchange, and secure key management
 */

import crypto from 'crypto';
import { Logger } from '../monitoring/Logger';

export interface EncryptionResult {
  encrypted: string;
  iv?: string;
  tag?: string;
  algorithm: string;
  keyId?: string;
}

export interface DecryptionResult {
  decrypted: string;
  verified: boolean;
}

export interface KeyPair {
  publicKey: string;
  privateKey: string;
  keyId: string;
  algorithm: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface EncryptionConfig {
  defaultAlgorithm: 'aes-256-gcm' | 'aes-256-cbc' | 'chacha20-poly1305';
  keyRotationIntervalMs: number;
  keyDerivationIterations: number;
  saltLength: number;
  ivLength: number;
  tagLength: number;
}

export class Encryptor {
  private logger: Logger;
  private config: EncryptionConfig;
  private masterKey: Buffer;
  private keyCache = new Map<string, { key: Buffer; expires: Date }>();
  private keyPairs = new Map<string, KeyPair>();
  private currentKeyId: string;

  constructor(
    masterKeyHex: string,
    config: Partial<EncryptionConfig> = {}
  ) {
    this.logger = new Logger({ service: 'Encryptor' });
    this.config = {
      defaultAlgorithm: 'aes-256-gcm',
      keyRotationIntervalMs: 24 * 60 * 60 * 1000, // 24 hours
      keyDerivationIterations: 100000,
      saltLength: 32,
      ivLength: 16,
      tagLength: 16,
      ...config
    };

    if (!masterKeyHex || masterKeyHex.length !== 64) {
      throw new Error('Master key must be a 64-character hex string (32 bytes)');
    }

    this.masterKey = Buffer.from(masterKeyHex, 'hex');
    this.currentKeyId = crypto.randomUUID();
    
    // Initialize key rotation
    this.startKeyRotation();
  }

  /**
   * Encrypt data with specified algorithm
   */
  async encrypt(
    data: string | Buffer,
    options: {
      algorithm?: string;
      keyId?: string;
      associatedData?: string;
    } = {}
  ): Promise<EncryptionResult> {
    try {
      const algorithm = options.algorithm || this.config.defaultAlgorithm;
      const keyId = options.keyId || this.currentKeyId;
      const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');

      switch (algorithm) {
        case 'aes-256-gcm':
          return await this.encryptAESGCM(dataBuffer, keyId, options.associatedData);
        case 'aes-256-cbc':
          return await this.encryptAESCBC(dataBuffer, keyId);
        case 'chacha20-poly1305':
          return await this.encryptChaCha20(dataBuffer, keyId, options.associatedData);
        default:
          throw new Error(`Unsupported encryption algorithm: ${algorithm}`);
      }
    } catch (error) {
      await this.logger.error('Encryption failed', { error, algorithm: options.algorithm });
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt data
   */
  async decrypt(
    encryptionResult: EncryptionResult,
    options: {
      associatedData?: string;
    } = {}
  ): Promise<DecryptionResult> {
    try {
      const { encrypted, algorithm, keyId } = encryptionResult;

      switch (algorithm) {
        case 'aes-256-gcm':
          return await this.decryptAESGCM(encryptionResult, options.associatedData);
        case 'aes-256-cbc':
          return await this.decryptAESCBC(encryptionResult);
        case 'chacha20-poly1305':
          return await this.decryptChaCha20(encryptionResult, options.associatedData);
        default:
          throw new Error(`Unsupported decryption algorithm: ${algorithm}`);
      }
    } catch (error) {
      await this.logger.error('Decryption failed', { error, algorithm: encryptionResult.algorithm });
      return { decrypted: '', verified: false };
    }
  }

  /**
   * AES-256-GCM encryption (recommended for most use cases)
   */
  private async encryptAESGCM(
    data: Buffer,
    keyId: string,
    associatedData?: string
  ): Promise<EncryptionResult> {
    const key = await this.getOrCreateKey(keyId);
    const iv = crypto.randomBytes(this.config.ivLength);
    const cipher = crypto.createCipher('aes-256-gcm', key);
    cipher.setIV(iv);

    if (associatedData) {
      cipher.setAAD(Buffer.from(associatedData, 'utf8'));
    }

    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      algorithm: 'aes-256-gcm',
      keyId
    };
  }

  /**
   * AES-256-CBC encryption
   */
  private async encryptAESCBC(data: Buffer, keyId: string): Promise<EncryptionResult> {
    const key = await this.getOrCreateKey(keyId);
    const iv = crypto.randomBytes(this.config.ivLength);
    const cipher = crypto.createCipher('aes-256-cbc', key);
    cipher.setIV(iv);

    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      algorithm: 'aes-256-cbc',
      keyId
    };
  }

  /**
   * ChaCha20-Poly1305 encryption
   */
  private async encryptChaCha20(
    data: Buffer,
    keyId: string,
    associatedData?: string
  ): Promise<EncryptionResult> {
    const key = await this.getOrCreateKey(keyId);
    const iv = crypto.randomBytes(12); // ChaCha20 uses 12-byte nonce
    const cipher = crypto.createCipher('chacha20-poly1305', key);
    cipher.setIV(iv);

    if (associatedData) {
      cipher.setAAD(Buffer.from(associatedData, 'utf8'));
    }

    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      algorithm: 'chacha20-poly1305',
      keyId
    };
  }

  /**
   * AES-256-GCM decryption
   */
  private async decryptAESGCM(
    encryptionResult: EncryptionResult,
    associatedData?: string
  ): Promise<DecryptionResult> {
    const key = await this.getOrCreateKey(encryptionResult.keyId!);
    const iv = Buffer.from(encryptionResult.iv!, 'base64');
    const tag = Buffer.from(encryptionResult.tag!, 'base64');
    const encrypted = Buffer.from(encryptionResult.encrypted, 'base64');

    const decipher = crypto.createDecipher('aes-256-gcm', key);
    decipher.setIV(iv);
    decipher.setAuthTag(tag);

    if (associatedData) {
      decipher.setAAD(Buffer.from(associatedData, 'utf8'));
    }

    try {
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return {
        decrypted: decrypted.toString('utf8'),
        verified: true
      };
    } catch (error) {
      return {
        decrypted: '',
        verified: false
      };
    }
  }

  /**
   * AES-256-CBC decryption
   */
  private async decryptAESCBC(encryptionResult: EncryptionResult): Promise<DecryptionResult> {
    const key = await this.getOrCreateKey(encryptionResult.keyId!);
    const iv = Buffer.from(encryptionResult.iv!, 'base64');
    const encrypted = Buffer.from(encryptionResult.encrypted, 'base64');

    const decipher = crypto.createDecipher('aes-256-cbc', key);
    decipher.setIV(iv);

    try {
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return {
        decrypted: decrypted.toString('utf8'),
        verified: true
      };
    } catch (error) {
      return {
        decrypted: '',
        verified: false
      };
    }
  }

  /**
   * ChaCha20-Poly1305 decryption
   */
  private async decryptChaCha20(
    encryptionResult: EncryptionResult,
    associatedData?: string
  ): Promise<DecryptionResult> {
    const key = await this.getOrCreateKey(encryptionResult.keyId!);
    const iv = Buffer.from(encryptionResult.iv!, 'base64');
    const tag = Buffer.from(encryptionResult.tag!, 'base64');
    const encrypted = Buffer.from(encryptionResult.encrypted, 'base64');

    const decipher = crypto.createDecipher('chacha20-poly1305', key);
    decipher.setIV(iv);
    decipher.setAuthTag(tag);

    if (associatedData) {
      decipher.setAAD(Buffer.from(associatedData, 'utf8'));
    }

    try {
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return {
        decrypted: decrypted.toString('utf8'),
        verified: true
      };
    } catch (error) {
      return {
        decrypted: '',
        verified: false
      };
    }
  }

  /**
   * Generate RSA key pair
   */
  async generateRSAKeyPair(keySize: 2048 | 3072 | 4096 = 2048): Promise<KeyPair> {
    const keyId = crypto.randomUUID();
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: keySize,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    const keyPair: KeyPair = {
      keyId,
      publicKey,
      privateKey,
      algorithm: `rsa-${keySize}`,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
    };

    this.keyPairs.set(keyId, keyPair);
    return keyPair;
  }

  /**
   * Generate ECDH key pair
   */
  async generateECDHKeyPair(curve: 'secp256r1' | 'secp384r1' | 'secp521r1' = 'secp256r1'): Promise<KeyPair> {
    const keyId = crypto.randomUUID();
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: curve,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    const keyPair: KeyPair = {
      keyId,
      publicKey,
      privateKey,
      algorithm: `ecdh-${curve}`,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
    };

    this.keyPairs.set(keyId, keyPair);
    return keyPair;
  }

  /**
   * RSA encryption
   */
  async encryptRSA(data: string, publicKeyPem: string): Promise<string> {
    const buffer = Buffer.from(data, 'utf8');
    const encrypted = crypto.publicEncrypt({
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    }, buffer);
    
    return encrypted.toString('base64');
  }

  /**
   * RSA decryption
   */
  async decryptRSA(encryptedData: string, privateKeyPem: string): Promise<string> {
    const buffer = Buffer.from(encryptedData, 'base64');
    const decrypted = crypto.privateDecrypt({
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    }, buffer);
    
    return decrypted.toString('utf8');
  }

  /**
   * Digital signature creation
   */
  async sign(data: string, privateKeyPem: string, algorithm: 'sha256' | 'sha384' | 'sha512' = 'sha256'): Promise<string> {
    const sign = crypto.createSign(algorithm);
    sign.update(data);
    sign.end();
    
    const signature = sign.sign(privateKeyPem);
    return signature.toString('base64');
  }

  /**
   * Digital signature verification
   */
  async verify(data: string, signature: string, publicKeyPem: string, algorithm: 'sha256' | 'sha384' | 'sha512' = 'sha256'): Promise<boolean> {
    try {
      const verify = crypto.createVerify(algorithm);
      verify.update(data);
      verify.end();
      
      return verify.verify(publicKeyPem, signature, 'base64');
    } catch (error) {
      await this.logger.error('Signature verification failed', { error });
      return false;
    }
  }

  /**
   * Hash functions
   */
  async hash(data: string, algorithm: 'sha256' | 'sha384' | 'sha512' | 'blake2b512' = 'sha256'): Promise<string> {
    const hash = crypto.createHash(algorithm);
    hash.update(data);
    return hash.digest('hex');
  }

  /**
   * HMAC generation
   */
  async hmac(data: string, key: string, algorithm: 'sha256' | 'sha384' | 'sha512' = 'sha256'): Promise<string> {
    const hmac = crypto.createHmac(algorithm, key);
    hmac.update(data);
    return hmac.digest('hex');
  }

  /**
   * Password-based key derivation (PBKDF2)
   */
  async deriveKey(password: string, salt?: Buffer): Promise<{ key: Buffer; salt: Buffer }> {
    const actualSalt = salt || crypto.randomBytes(this.config.saltLength);
    const key = crypto.pbkdf2Sync(password, actualSalt, this.config.keyDerivationIterations, 32, 'sha256');
    
    return { key, salt: actualSalt };
  }

  /**
   * Secure random generation
   */
  generateSecureRandom(length: number): Buffer {
    return crypto.randomBytes(length);
  }

  generateSecureRandomString(length: number, encoding: 'hex' | 'base64' | 'base64url' = 'hex'): string {
    const buffer = crypto.randomBytes(Math.ceil(length / 2));
    if (encoding === 'hex') {
      return buffer.toString('hex').substring(0, length);
    } else if (encoding === 'base64url') {
      return buffer.toString('base64').replace(/[+/]/g, '_').replace(/=/g, '').substring(0, length);
    } else {
      return buffer.toString('base64').substring(0, length);
    }
  }

  /**
   * Key management
   */
  private async getOrCreateKey(keyId: string): Promise<Buffer> {
    let cached = this.keyCache.get(keyId);
    
    if (!cached || cached.expires < new Date()) {
      // Derive key from master key and keyId
      const derivedKey = crypto.hkdfSync('sha256', this.masterKey, Buffer.from(keyId), '', 32);
      
      cached = {
        key: derivedKey,
        expires: new Date(Date.now() + this.config.keyRotationIntervalMs)
      };
      
      this.keyCache.set(keyId, cached);
    }
    
    return cached.key;
  }

  private startKeyRotation(): void {
    setInterval(() => {
      this.rotateKeys();
    }, this.config.keyRotationIntervalMs);
  }

  private async rotateKeys(): Promise<void> {
    // Create new current key
    const oldKeyId = this.currentKeyId;
    this.currentKeyId = crypto.randomUUID();
    
    await this.logger.info('Key rotation completed', { 
      oldKeyId: oldKeyId.substring(0, 8) + '...', 
      newKeyId: this.currentKeyId.substring(0, 8) + '...' 
    });

    // Clean up expired keys
    this.cleanupExpiredKeys();
  }

  private cleanupExpiredKeys(): void {
    const now = new Date();
    
    // Clean key cache
    for (const [keyId, cached] of this.keyCache.entries()) {
      if (cached.expires < now) {
        this.keyCache.delete(keyId);
      }
    }

    // Clean expired key pairs
    for (const [keyId, keyPair] of this.keyPairs.entries()) {
      if (keyPair.expiresAt && keyPair.expiresAt < now) {
        this.keyPairs.delete(keyId);
      }
    }
  }

  /**
   * Get encryption statistics
   */
  getStatistics(): {
    cacheSize: number;
    keyPairs: number;
    currentKeyId: string;
    algorithms: string[];
  } {
    return {
      cacheSize: this.keyCache.size,
      keyPairs: this.keyPairs.size,
      currentKeyId: this.currentKeyId.substring(0, 8) + '...',
      algorithms: ['aes-256-gcm', 'aes-256-cbc', 'chacha20-poly1305', 'rsa', 'ecdh']
    };
  }

  /**
   * Key pair management
   */
  getKeyPair(keyId: string): KeyPair | undefined {
    return this.keyPairs.get(keyId);
  }

  listKeyPairs(): KeyPair[] {
    return Array.from(this.keyPairs.values());
  }

  revokeKeyPair(keyId: string): boolean {
    return this.keyPairs.delete(keyId);
  }
}