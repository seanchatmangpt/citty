import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { config } from 'dotenv'
import { TestEnvironment } from './test-environment'
import { TestDataManager } from './test-data-manager'
import { MockServices } from './mock-services'

// Load test environment variables
config({ path: '.env.test' })

let testEnv: TestEnvironment
let dataManager: TestDataManager
let mockServices: MockServices

beforeAll(async () => {
  console.log('🚀 Initializing test environment...')
  
  // Initialize test environment
  testEnv = new TestEnvironment()
  await testEnv.initialize()
  
  // Initialize test data manager
  dataManager = new TestDataManager()
  await dataManager.setup()
  
  // Initialize mock services
  mockServices = new MockServices()
  await mockServices.start()
  
  console.log('✅ Test environment initialized')
})

afterAll(async () => {
  console.log('🧹 Cleaning up test environment...')
  
  if (mockServices) {
    await mockServices.stop()
  }
  
  if (dataManager) {
    await dataManager.cleanup()
  }
  
  if (testEnv) {
    await testEnv.destroy()
  }
  
  console.log('✅ Test environment cleaned up')
})

beforeEach(async () => {
  // Reset test data before each test
  await dataManager.reset()
})

afterEach(async () => {
  // Clean up any test artifacts
  await testEnv.cleanupArtifacts()
})

// Global test utilities
global.testEnv = testEnv
global.dataManager = dataManager
global.mockServices = mockServices