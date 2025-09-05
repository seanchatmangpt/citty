/**
 * Integration status endpoint for CNS and ByteStar systems
 */

import { getCNSManager } from '~/server/plugins/cns-integration'
import { getByteStarCrypto } from '~/server/plugins/bytestar-integration'

export default defineEventHandler(async (event) => {
  try {
    const cnsManager = getCNSManager()
    const byteStarCrypto = getByteStarCrypto()
    
    const integrationStatus = {
      cns: {
        initialized: !!cnsManager,
        layers: cnsManager ? {
          l1: cnsManager.isLayerActive('l1'),
          l2: cnsManager.isLayerActive('l2'),
          l3: cnsManager.isLayerActive('l3'),
          l4: cnsManager.isLayerActive('l4')
        } : null,
        engines: cnsManager ? {
          validation: cnsManager.isEngineActive('validation'),
          intelligence: cnsManager.isEngineActive('intelligence'),
          prediction: cnsManager.isEngineActive('prediction'),
          evolution: cnsManager.isEngineActive('evolution')
        } : null,
        memoryUsage: cnsManager ? await cnsManager.getMemoryStats() : null
      },
      byteStar: {
        initialized: !!byteStarCrypto,
        quantumResistant: true,
        algorithms: ['CRYSTALS-DILITHIUM', 'CRYSTALS-KYBER', 'SPHINCS+', 'FALCON'],
        keyPairsGenerated: !!byteStarCrypto
      },
      integration: {
        operational: !!(cnsManager && byteStarCrypto),
        securityLevel: cnsManager && byteStarCrypto ? 'quantum-resistant' : 'standard',
        timestamp: new Date().toISOString()
      }
    }
    
    // Test CNS memory operation
    if (cnsManager) {
      try {
        const testData = { test: 'integration-check', timestamp: Date.now() }
        await cnsManager.storeMemory('system', 'integration-test', testData, 'l2')
        const retrieved = await cnsManager.retrieveMemory('system', 'integration-test', 'l2')
        integrationStatus.cns.testResult = !!retrieved
      } catch (error) {
        integrationStatus.cns.testResult = false
        integrationStatus.cns.error = error.message
      }
    }
    
    // Test ByteStar cryptographic operation
    if (byteStarCrypto) {
      try {
        const testData = { message: 'integration-test' }
        const encrypted = await byteStarCrypto.encrypt(testData, 'marketplace-system')
        const decrypted = await byteStarCrypto.decrypt(encrypted)
        integrationStatus.byteStar.testResult = decrypted.verified && decrypted.plaintext.message === testData.message
      } catch (error) {
        integrationStatus.byteStar.testResult = false
        integrationStatus.byteStar.error = error.message
      }
    }
    
    return {
      success: true,
      data: integrationStatus
    }
    
  } catch (error: any) {
    console.error('Integration status check failed:', error)
    
    return {
      success: false,
      error: error.message,
      data: {
        cns: { initialized: false },
        byteStar: { initialized: false },
        integration: { operational: false }
      }
    }
  }
})