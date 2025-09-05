import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TestEnvironment } from '../utils/test-environment'
import { TestDataManager } from '../utils/test-data-manager'
import { MockServices } from '../utils/mock-services'
import axios from 'axios'
import { randomBytes, createHash } from 'crypto'

describe('Post-Quantum Cryptography Security Tests', () => {
  let testEnv: TestEnvironment
  let dataManager: TestDataManager
  let mockServices: MockServices
  let services: any

  beforeAll(async () => {
    testEnv = new TestEnvironment()
    dataManager = new TestDataManager()
    mockServices = new MockServices()

    await testEnv.initialize()
    await dataManager.setup()
    await mockServices.start()

    services = testEnv.getServices()
  })

  afterAll(async () => {
    await mockServices.stop()
    await dataManager.cleanup()
    await testEnv.destroy()
  })

  describe('Post-Quantum Key Exchange', () => {
    it('should establish secure post-quantum key exchange', async () => {
      const buyer = dataManager.getUser('user-buyer-001')
      expect(buyer).toBeDefined()

      // Initiate key exchange using post-quantum algorithms
      const keyExchangeResponse = await axios.post(
        `${services.marketplace.apiUrl}/crypto/pq-keyexchange`,
        {
          algorithm: 'CRYSTALS-Kyber',
          key_size: 768,
          client_id: buyer!.id
        },
        {
          headers: { 'Authorization': `Bearer ${buyer!.apiKey}` }
        }
      )

      expect(keyExchangeResponse.status).toBe(200)
      expect(keyExchangeResponse.data.public_key).toBeDefined()
      expect(keyExchangeResponse.data.session_id).toBeDefined()
      expect(keyExchangeResponse.data.algorithm).toBe('CRYSTALS-Kyber')
      expect(keyExchangeResponse.data.key_size).toBe(768)

      // Verify key strength
      const publicKey = keyExchangeResponse.data.public_key
      expect(publicKey.length).toBeGreaterThan(1000) // Post-quantum keys are larger

      // Test key exchange completion
      const sharedSecretResponse = await axios.post(
        `${services.marketplace.apiUrl}/crypto/complete-keyexchange`,
        {
          session_id: keyExchangeResponse.data.session_id,
          client_public_key: generateMockPublicKey()
        },
        {
          headers: { 'Authorization': `Bearer ${buyer!.apiKey}` }
        }
      )

      expect(sharedSecretResponse.status).toBe(200)
      expect(sharedSecretResponse.data.shared_secret).toBeDefined()
      expect(sharedSecretResponse.data.cipher_suite).toBe('AES-256-GCM')
    })

    it('should resist quantum attacks on key exchange', async () => {
      const algorithms = ['CRYSTALS-Kyber', 'CRYSTALS-Dilithium', 'SPHINCS+']
      
      for (const algorithm of algorithms) {
        const keyGenResponse = await axios.post(
          `${services.marketplace.apiUrl}/crypto/generate-keypair`,
          {
            algorithm,
            security_level: 3, // NIST Level 3 (192-bit equivalent)
            quantum_resistant: true
          }
        )

        expect(keyGenResponse.status).toBe(200)
        expect(keyGenResponse.data.public_key).toBeDefined()
        expect(keyGenResponse.data.private_key_id).toBeDefined()
        expect(keyGenResponse.data.security_level).toBe(3)

        // Simulate quantum attack (Shor's algorithm simulation)
        const quantumAttackResponse = await axios.post(
          `${services.marketplace.apiUrl}/crypto/test-quantum-resistance`,
          {
            public_key: keyGenResponse.data.public_key,
            algorithm,
            attack_type: 'shors_algorithm_simulation'
          }
        )

        expect(quantumAttackResponse.status).toBe(200)
        expect(quantumAttackResponse.data.quantum_resistant).toBe(true)
        expect(quantumAttackResponse.data.time_to_break).toBe('infeasible')
        expect(quantumAttackResponse.data.security_level).toBeGreaterThanOrEqual(128)
      }
    })

    it('should validate post-quantum signatures', async () => {
      const provider = dataManager.getUser('user-provider-001')
      const asset = dataManager.getAsset('asset-model-001')
      
      expect(provider).toBeDefined()
      expect(asset).toBeDefined()

      // Create post-quantum digital signature for asset
      const signatureResponse = await axios.post(
        `${services.marketplace.apiUrl}/crypto/sign`,
        {
          data: asset,
          algorithm: 'CRYSTALS-Dilithium',
          signer_id: provider!.id
        },
        {
          headers: { 'Authorization': `Bearer ${provider!.apiKey}` }
        }
      )

      expect(signatureResponse.status).toBe(200)
      expect(signatureResponse.data.signature).toBeDefined()
      expect(signatureResponse.data.public_key).toBeDefined()
      expect(signatureResponse.data.algorithm).toBe('CRYSTALS-Dilithium')

      // Verify signature
      const verificationResponse = await axios.post(
        `${services.marketplace.apiUrl}/crypto/verify`,
        {
          data: asset,
          signature: signatureResponse.data.signature,
          public_key: signatureResponse.data.public_key,
          algorithm: 'CRYSTALS-Dilithium'
        }
      )

      expect(verificationResponse.status).toBe(200)
      expect(verificationResponse.data.valid).toBe(true)
      expect(verificationResponse.data.confidence).toBe(1.0)

      // Test signature tampering detection
      const tamperedAsset = { ...asset, price: 99999 }
      const tamperVerificationResponse = await axios.post(
        `${services.marketplace.apiUrl}/crypto/verify`,
        {
          data: tamperedAsset,
          signature: signatureResponse.data.signature,
          public_key: signatureResponse.data.public_key,
          algorithm: 'CRYSTALS-Dilithium'
        }
      )

      expect(tamperVerificationResponse.status).toBe(200)
      expect(tamperVerificationResponse.data.valid).toBe(false)
    })
  })

  describe('Quantum-Safe Encryption', () => {
    it('should encrypt data with quantum-safe algorithms', async () => {
      const sensitiveData = {
        user_id: 'user-test-001',
        transaction_details: {
          amount: 1000,
          currency: 'USD',
          timestamp: Date.now()
        },
        personal_info: {
          name: 'Test User',
          email: 'test@example.com'
        }
      }

      const encryptionResponse = await axios.post(
        `${services.marketplace.apiUrl}/crypto/encrypt`,
        {
          data: sensitiveData,
          algorithm: 'AES-256-GCM',
          key_derivation: 'HKDF-SHA256',
          quantum_safe: true
        }
      )

      expect(encryptionResponse.status).toBe(200)
      expect(encryptionResponse.data.encrypted_data).toBeDefined()
      expect(encryptionResponse.data.nonce).toBeDefined()
      expect(encryptionResponse.data.auth_tag).toBeDefined()
      expect(encryptionResponse.data.key_id).toBeDefined()

      // Verify encrypted data cannot be read without key
      expect(encryptionResponse.data.encrypted_data).not.toContain('Test User')
      expect(encryptionResponse.data.encrypted_data).not.toContain('test@example.com')

      // Test decryption
      const decryptionResponse = await axios.post(
        `${services.marketplace.apiUrl}/crypto/decrypt`,
        {
          encrypted_data: encryptionResponse.data.encrypted_data,
          nonce: encryptionResponse.data.nonce,
          auth_tag: encryptionResponse.data.auth_tag,
          key_id: encryptionResponse.data.key_id
        }
      )

      expect(decryptionResponse.status).toBe(200)
      expect(decryptionResponse.data.decrypted_data).toEqual(sensitiveData)
    })

    it('should protect against side-channel attacks', async () => {
      const testData = 'sensitive information for side-channel testing'
      const encryptionCount = 1000

      const timings: number[] = []
      
      for (let i = 0; i < encryptionCount; i++) {
        const startTime = process.hrtime.bigint()
        
        await axios.post(`${services.marketplace.apiUrl}/crypto/encrypt`, {
          data: testData + i,
          algorithm: 'AES-256-GCM',
          side_channel_protection: true
        })
        
        const endTime = process.hrtime.bigint()
        timings.push(Number(endTime - startTime) / 1000000) // Convert to ms
      }

      // Analyze timing consistency
      const mean = timings.reduce((a, b) => a + b, 0) / timings.length
      const variance = timings.reduce((sum, timing) => sum + Math.pow(timing - mean, 2), 0) / timings.length
      const stdDev = Math.sqrt(variance)
      const coefficientOfVariation = stdDev / mean

      // Low coefficient of variation indicates timing attack resistance
      expect(coefficientOfVariation).toBeLessThan(0.1) // Less than 10% variation
      expect(stdDev).toBeLessThan(mean * 0.1) // Standard deviation < 10% of mean
    })

    it('should implement secure key rotation', async () => {
      const keyId = 'test-key-rotation-001'
      
      // Generate initial key
      const initialKeyResponse = await axios.post(
        `${services.marketplace.apiUrl}/crypto/generate-key`,
        {
          key_id: keyId,
          algorithm: 'AES-256',
          purpose: 'encryption',
          rotation_policy: 'monthly'
        }
      )

      expect(initialKeyResponse.status).toBe(200)
      expect(initialKeyResponse.data.key_id).toBe(keyId)
      expect(initialKeyResponse.data.version).toBe(1)

      // Rotate key
      const rotationResponse = await axios.post(
        `${services.marketplace.apiUrl}/crypto/rotate-key`,
        { key_id: keyId }
      )

      expect(rotationResponse.status).toBe(200)
      expect(rotationResponse.data.new_version).toBe(2)
      expect(rotationResponse.data.old_version).toBe(1)
      expect(rotationResponse.data.rotation_timestamp).toBeDefined()

      // Verify old key is still accessible for decryption
      const oldKeyStatusResponse = await axios.get(
        `${services.marketplace.apiUrl}/crypto/key-status/${keyId}/1`
      )

      expect(oldKeyStatusResponse.status).toBe(200)
      expect(oldKeyStatusResponse.data.status).toBe('deprecated')
      expect(oldKeyStatusResponse.data.can_decrypt).toBe(true)
      expect(oldKeyStatusResponse.data.can_encrypt).toBe(false)

      // Verify new key is active
      const newKeyStatusResponse = await axios.get(
        `${services.marketplace.apiUrl}/crypto/key-status/${keyId}/2`
      )

      expect(newKeyStatusResponse.status).toBe(200)
      expect(newKeyStatusResponse.data.status).toBe('active')
      expect(newKeyStatusResponse.data.can_decrypt).toBe(true)
      expect(newKeyStatusResponse.data.can_encrypt).toBe(true)
    })
  })

  describe('Cross-System Authentication', () => {
    it('should validate authentication across all systems', async () => {
      const user = dataManager.getUser('user-buyer-001')
      expect(user).toBeDefined()

      // Test authentication with each system
      const systemTests = [
        {
          name: 'CNS Authentication',
          endpoint: `${services.cns.baseUrl}/auth/validate`,
          expectedClaims: ['cns:validate', 'cns:semantic_analyze']
        },
        {
          name: 'ByteStar Authentication',
          endpoint: `${services.bytestar.baseUrl}/auth/validate`,
          expectedClaims: ['bytestar:inference', 'bytestar:metrics']
        },
        {
          name: 'Marketplace Authentication',
          endpoint: `${services.marketplace.apiUrl}/auth/validate`,
          expectedClaims: ['marketplace:search', 'marketplace:purchase']
        }
      ]

      for (const test of systemTests) {
        const authResponse = await axios.post(test.endpoint, {
          token: user!.apiKey,
          user_id: user!.id
        })

        expect(authResponse.status).toBe(200)
        expect(authResponse.data.valid).toBe(true)
        expect(authResponse.data.user_id).toBe(user!.id)
        expect(authResponse.data.claims).toBeDefined()

        // Verify expected claims are present
        for (const claim of test.expectedClaims) {
          expect(authResponse.data.claims).toContain(claim)
        }
      }
    })

    it('should handle token expiration and renewal', async () => {
      const user = dataManager.getUser('user-buyer-001')
      expect(user).toBeDefined()

      // Request short-lived token
      const tokenResponse = await axios.post(
        `${services.marketplace.apiUrl}/auth/token`,
        {
          user_id: user!.id,
          expires_in: 5 // 5 seconds
        },
        {
          headers: { 'Authorization': `Bearer ${user!.apiKey}` }
        }
      )

      expect(tokenResponse.status).toBe(200)
      expect(tokenResponse.data.access_token).toBeDefined()
      expect(tokenResponse.data.refresh_token).toBeDefined()
      expect(tokenResponse.data.expires_in).toBe(5)

      // Use token before expiration
      const validUseResponse = await axios.get(
        `${services.marketplace.apiUrl}/user/profile`,
        {
          headers: { 'Authorization': `Bearer ${tokenResponse.data.access_token}` }
        }
      )

      expect(validUseResponse.status).toBe(200)

      // Wait for token expiration
      await new Promise(resolve => setTimeout(resolve, 6000))

      // Attempt to use expired token
      const expiredUseResponse = await axios.get(
        `${services.marketplace.apiUrl}/user/profile`,
        {
          headers: { 'Authorization': `Bearer ${tokenResponse.data.access_token}` },
          validateStatus: () => true
        }
      )

      expect(expiredUseResponse.status).toBe(401)
      expect(expiredUseResponse.data.error).toBe('token_expired')

      // Refresh token
      const refreshResponse = await axios.post(
        `${services.marketplace.apiUrl}/auth/refresh`,
        {
          refresh_token: tokenResponse.data.refresh_token
        }
      )

      expect(refreshResponse.status).toBe(200)
      expect(refreshResponse.data.access_token).toBeDefined()
      expect(refreshResponse.data.access_token).not.toBe(tokenResponse.data.access_token)

      // Use new token
      const newTokenUseResponse = await axios.get(
        `${services.marketplace.apiUrl}/user/profile`,
        {
          headers: { 'Authorization': `Bearer ${refreshResponse.data.access_token}` }
        }
      )

      expect(newTokenUseResponse.status).toBe(200)
    })

    it('should prevent privilege escalation attacks', async () => {
      const regularUser = dataManager.getUser('user-buyer-001')
      const adminUser = dataManager.getUser('user-admin-001')
      
      expect(regularUser).toBeDefined()
      expect(adminUser).toBeDefined()

      // Regular user attempts admin operation
      const unauthorizedResponse = await axios.post(
        `${services.marketplace.apiUrl}/admin/users`,
        {
          user_data: {
            email: 'malicious@test.com',
            role: 'admin'
          }
        },
        {
          headers: { 'Authorization': `Bearer ${regularUser!.apiKey}` },
          validateStatus: () => true
        }
      )

      expect(unauthorizedResponse.status).toBe(403)
      expect(unauthorizedResponse.data.error).toContain('insufficient_privileges')

      // Admin user performs same operation
      const authorizedResponse = await axios.post(
        `${services.marketplace.apiUrl}/admin/users`,
        {
          user_data: {
            email: 'legitimate@test.com',
            role: 'user'
          }
        },
        {
          headers: { 'Authorization': `Bearer ${adminUser!.apiKey}` }
        }
      )

      expect(authorizedResponse.status).toBe(201)

      // Test token manipulation attempt
      const manipulatedToken = regularUser!.apiKey.replace(/.$/, '0') // Change last character
      
      const tokenManipulationResponse = await axios.get(
        `${services.marketplace.apiUrl}/admin/statistics`,
        {
          headers: { 'Authorization': `Bearer ${manipulatedToken}` },
          validateStatus: () => true
        }
      )

      expect(tokenManipulationResponse.status).toBe(401)
      expect(tokenManipulationResponse.data.error).toBe('invalid_token')
    })
  })

  describe('Data Protection and Privacy', () => {
    it('should encrypt sensitive data at rest', async () => {
      const sensitiveData = {
        user_id: 'privacy-test-001',
        payment_info: {
          card_number: '4111111111111111',
          cvv: '123',
          expiry: '12/25'
        },
        personal_data: {
          ssn: '123-45-6789',
          address: '123 Privacy St, Secure City, SC 12345'
        }
      }

      // Store sensitive data
      const storeResponse = await axios.post(
        `${services.marketplace.apiUrl}/secure/store`,
        {
          data: sensitiveData,
          encryption: 'AES-256-GCM',
          classification: 'PII'
        }
      )

      expect(storeResponse.status).toBe(200)
      expect(storeResponse.data.storage_id).toBeDefined()
      expect(storeResponse.data.encrypted).toBe(true)

      // Verify data is encrypted in storage
      const storageCheckResponse = await axios.get(
        `${services.marketplace.apiUrl}/secure/raw/${storeResponse.data.storage_id}`
      )

      expect(storageCheckResponse.status).toBe(200)
      expect(storageCheckResponse.data.data).not.toContain('4111111111111111')
      expect(storageCheckResponse.data.data).not.toContain('123-45-6789')
      expect(storageCheckResponse.data.encryption_metadata).toBeDefined()

      // Retrieve and decrypt data
      const retrieveResponse = await axios.get(
        `${services.marketplace.apiUrl}/secure/retrieve/${storeResponse.data.storage_id}`,
        {
          headers: { 'Authorization': `Bearer ${dataManager.getUser('user-admin-001')!.apiKey}` }
        }
      )

      expect(retrieveResponse.status).toBe(200)
      expect(retrieveResponse.data.data).toEqual(sensitiveData)
    })

    it('should implement data anonymization', async () => {
      const userData = dataManager.getAllUsers().map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        transactions: dataManager.getTransactionsByUser(user.id)
      }))

      const anonymizationResponse = await axios.post(
        `${services.marketplace.apiUrl}/privacy/anonymize`,
        {
          data: userData,
          anonymization_level: 'k-anonymity',
          k_value: 5
        }
      )

      expect(anonymizationResponse.status).toBe(200)
      expect(anonymizationResponse.data.anonymized_data).toBeDefined()

      const anonymizedData = anonymizationResponse.data.anonymized_data

      // Verify personal identifiers are removed/anonymized
      anonymizedData.forEach((record: any) => {
        expect(record.email).toMatch(/^[a-f0-9]+@anonymized\.com$/) // Hashed email
        expect(record.name).toMatch(/^User_[A-Z0-9]+$/) // Anonymized name
        expect(record.id).toMatch(/^anon_[a-f0-9]+$/) // Anonymized ID
      })

      // Verify statistical properties are preserved
      expect(anonymizedData).toHaveLength(userData.length)
      
      const originalTransactionCount = userData.reduce((sum, u) => sum + u.transactions.length, 0)
      const anonymizedTransactionCount = anonymizedData.reduce((sum: number, u: any) => sum + u.transactions.length, 0)
      
      expect(anonymizedTransactionCount).toBe(originalTransactionCount)
    })

    it('should implement right to be forgotten', async () => {
      // Create test user with data
      const testUser = dataManager.createRandomUser('user')
      const testAsset = dataManager.createRandomAsset(testUser.id)
      const testTransaction = dataManager.createRandomTransaction(
        testUser.id,
        dataManager.getUser('user-provider-001')!.id,
        testAsset.id
      )

      // Verify data exists
      const dataCheckResponse = await axios.get(
        `${services.marketplace.apiUrl}/users/${testUser.id}/data-inventory`,
        {
          headers: { 'Authorization': `Bearer ${testUser.apiKey}` }
        }
      )

      expect(dataCheckResponse.status).toBe(200)
      expect(dataCheckResponse.data.user_data).toBeDefined()
      expect(dataCheckResponse.data.assets).toHaveLength(1)
      expect(dataCheckResponse.data.transactions).toHaveLength(1)

      // Submit deletion request
      const deletionResponse = await axios.post(
        `${services.marketplace.apiUrl}/privacy/delete-user-data`,
        {
          user_id: testUser.id,
          deletion_type: 'complete',
          verification_code: 'test-verification-123'
        },
        {
          headers: { 'Authorization': `Bearer ${testUser.apiKey}` }
        }
      )

      expect(deletionResponse.status).toBe(200)
      expect(deletionResponse.data.deletion_id).toBeDefined()
      expect(deletionResponse.data.status).toBe('processing')

      // Wait for deletion processing
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Verify data is deleted
      const postDeletionCheckResponse = await axios.get(
        `${services.marketplace.apiUrl}/users/${testUser.id}`,
        {
          headers: { 'Authorization': `Bearer ${testUser.apiKey}` },
          validateStatus: () => true
        }
      )

      expect(postDeletionCheckResponse.status).toBe(404)
      expect(postDeletionCheckResponse.data.error).toBe('user_not_found')

      // Verify cascading deletion of related data
      const assetCheckResponse = await axios.get(
        `${services.marketplace.apiUrl}/assets/${testAsset.id}`,
        { validateStatus: () => true }
      )

      expect(assetCheckResponse.status).toBe(404)
    })
  })
})

// Helper function to generate mock public key
function generateMockPublicKey(): string {
  return randomBytes(1024).toString('base64')
}