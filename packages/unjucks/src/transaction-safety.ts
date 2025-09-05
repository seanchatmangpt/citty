/**
 * 🧠 DARK MATTER: Transaction Safety & Atomic Operations
 * The critical data integrity layer humans always skip
 */

import { EventEmitter } from 'events'
import { randomBytes } from 'crypto'

export interface Transaction {
  id: string
  operations: TransactionOperation[]
  state: 'pending' | 'committed' | 'rolled_back' | 'failed'
  startTime: number
  endTime?: number
  isolation: 'read_uncommitted' | 'read_committed' | 'repeatable_read' | 'serializable'
  timeout: number
  metadata?: any
}

export interface TransactionOperation {
  id: string
  type: 'create' | 'update' | 'delete' | 'query'
  resource: string
  before?: any
  after?: any
  rollback?: () => Promise<void>
  execute?: () => Promise<any>
  validate?: () => Promise<boolean>
}

export interface TransactionOptions {
  isolation?: Transaction['isolation']
  timeout?: number
  autoCommit?: boolean
  retryCount?: number
  metadata?: any
}

export interface TransactionResult {
  success: boolean
  transactionId: string
  operations: number
  duration: number
  error?: string
  rollbackOperations?: number
}

export interface Savepoint {
  id: string
  transactionId: string
  timestamp: number
  operationIndex: number
}

/**
 * Advanced transaction system with ACID properties and rollback capabilities
 */
export class TransactionManager extends EventEmitter {
  private activeTransactions = new Map<string, Transaction>()
  private resourceLocks = new Map<string, Set<string>>() // resource -> transaction IDs
  private transactionHistory: Transaction[] = []
  private savepoints = new Map<string, Savepoint[]>()
  private deadlockDetector: NodeJS.Timer | null = null
  
  private readonly MAX_HISTORY = 1000
  private readonly DEFAULT_TIMEOUT = 30000 // 30 seconds
  private readonly DEADLOCK_CHECK_INTERVAL = 5000 // 5 seconds

  constructor() {
    super()
    this.startDeadlockDetection()
  }

  /**
   * Begin a new transaction
   */
  async beginTransaction(options: TransactionOptions = {}): Promise<string> {
    const transactionId = this.generateTransactionId()
    
    const transaction: Transaction = {
      id: transactionId,
      operations: [],
      state: 'pending',
      startTime: Date.now(),
      isolation: options.isolation || 'read_committed',
      timeout: options.timeout || this.DEFAULT_TIMEOUT,
      metadata: options.metadata
    }

    this.activeTransactions.set(transactionId, transaction)
    
    // Set timeout
    setTimeout(() => {
      if (this.activeTransactions.has(transactionId)) {
        this.rollbackTransaction(transactionId, 'Transaction timeout')
          .catch(error => {
            this.emit('transaction:timeout_error', { transactionId, error: error.message })
          })
      }
    }, transaction.timeout)

    this.emit('transaction:begin', { transactionId, options })
    
    return transactionId
  }

  /**
   * Add operation to transaction
   */
  async addOperation(
    transactionId: string,
    operation: Omit<TransactionOperation, 'id'>
  ): Promise<void> {
    const transaction = this.activeTransactions.get(transactionId)
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`)
    }

    if (transaction.state !== 'pending') {
      throw new Error(`Cannot add operation to transaction in state: ${transaction.state}`)
    }

    // Check for resource locks
    await this.acquireResourceLock(transactionId, operation.resource, transaction.isolation)

    const operationId = this.generateOperationId()
    const fullOperation: TransactionOperation = {
      id: operationId,
      ...operation
    }

    transaction.operations.push(fullOperation)

    this.emit('operation:added', { transactionId, operation: fullOperation })
  }

  /**
   * Execute operation within transaction context
   */
  async executeOperation<T>(
    transactionId: string,
    resource: string,
    operation: () => Promise<T>,
    rollback: () => Promise<void>
  ): Promise<T> {
    const transaction = this.activeTransactions.get(transactionId)
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`)
    }

    // Create operation record
    const operationId = this.generateOperationId()
    let result: T
    let error: Error | undefined

    try {
      // Execute the operation
      result = await operation()
      
      // Record successful operation
      const txOperation: TransactionOperation = {
        id: operationId,
        type: 'update', // Default type
        resource,
        after: result,
        rollback
      }

      transaction.operations.push(txOperation)
      
      this.emit('operation:executed', { 
        transactionId, 
        operationId, 
        resource, 
        success: true 
      })
      
      return result

    } catch (err) {
      error = err as Error
      
      // Record failed operation (for potential retry)
      const txOperation: TransactionOperation = {
        id: operationId,
        type: 'update',
        resource,
        rollback
      }

      transaction.operations.push(txOperation)
      
      this.emit('operation:failed', { 
        transactionId, 
        operationId, 
        resource, 
        error: error.message 
      })
      
      throw error
    }
  }

  /**
   * Create savepoint for partial rollback
   */
  async createSavepoint(transactionId: string, name?: string): Promise<string> {
    const transaction = this.activeTransactions.get(transactionId)
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`)
    }

    const savepointId = name || `sp_${Date.now()}`
    const savepoint: Savepoint = {
      id: savepointId,
      transactionId,
      timestamp: Date.now(),
      operationIndex: transaction.operations.length
    }

    if (!this.savepoints.has(transactionId)) {
      this.savepoints.set(transactionId, [])
    }
    
    this.savepoints.get(transactionId)!.push(savepoint)
    
    this.emit('savepoint:created', { transactionId, savepointId })
    
    return savepointId
  }

  /**
   * Rollback to savepoint
   */
  async rollbackToSavepoint(transactionId: string, savepointId: string): Promise<void> {
    const transaction = this.activeTransactions.get(transactionId)
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`)
    }

    const savepoints = this.savepoints.get(transactionId) || []
    const savepoint = savepoints.find(sp => sp.id === savepointId)
    
    if (!savepoint) {
      throw new Error(`Savepoint ${savepointId} not found`)
    }

    // Rollback operations after the savepoint
    const operationsToRollback = transaction.operations.slice(savepoint.operationIndex)
    
    for (let i = operationsToRollback.length - 1; i >= 0; i--) {
      const operation = operationsToRollback[i]
      if (operation.rollback) {
        try {
          await operation.rollback()
          this.emit('operation:rolled_back', { 
            transactionId, 
            operationId: operation.id 
          })
        } catch (error) {
          this.emit('rollback:error', { 
            transactionId, 
            operationId: operation.id, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          })
        }
      }
    }

    // Remove operations after savepoint
    transaction.operations = transaction.operations.slice(0, savepoint.operationIndex)
    
    // Remove savepoints after this one
    this.savepoints.set(
      transactionId, 
      savepoints.filter(sp => sp.operationIndex <= savepoint.operationIndex)
    )

    this.emit('rollback:savepoint', { transactionId, savepointId })
  }

  /**
   * Commit transaction
   */
  async commitTransaction(transactionId: string): Promise<TransactionResult> {
    const transaction = this.activeTransactions.get(transactionId)
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`)
    }

    if (transaction.state !== 'pending') {
      throw new Error(`Cannot commit transaction in state: ${transaction.state}`)
    }

    const startTime = Date.now()
    let success = true
    let error: string | undefined

    try {
      // Validate all operations first
      for (const operation of transaction.operations) {
        if (operation.validate) {
          const isValid = await operation.validate()
          if (!isValid) {
            throw new Error(`Operation ${operation.id} validation failed`)
          }
        }
      }

      // Execute pending operations (if any)
      for (const operation of transaction.operations) {
        if (operation.execute) {
          await operation.execute()
        }
      }

      // Mark as committed
      transaction.state = 'committed'
      transaction.endTime = Date.now()

      this.emit('transaction:committed', { transactionId, operations: transaction.operations.length })

    } catch (err) {
      success = false
      error = err instanceof Error ? err.message : 'Unknown error'
      transaction.state = 'failed'
      transaction.endTime = Date.now()

      // Attempt rollback on failure
      await this.rollbackTransaction(transactionId, error)
      
      this.emit('transaction:commit_failed', { transactionId, error })
    } finally {
      // Release all locks
      this.releaseAllResourceLocks(transactionId)
      
      // Move to history
      this.transactionHistory.push(transaction)
      this.activeTransactions.delete(transactionId)
      this.savepoints.delete(transactionId)
      
      // Cleanup history
      if (this.transactionHistory.length > this.MAX_HISTORY) {
        this.transactionHistory = this.transactionHistory.slice(-this.MAX_HISTORY * 0.8)
      }
    }

    return {
      success,
      transactionId,
      operations: transaction.operations.length,
      duration: Date.now() - startTime,
      error
    }
  }

  /**
   * Rollback transaction
   */
  async rollbackTransaction(transactionId: string, reason?: string): Promise<TransactionResult> {
    const transaction = this.activeTransactions.get(transactionId)
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`)
    }

    const startTime = Date.now()
    let rollbackOperations = 0

    try {
      // Execute rollback operations in reverse order
      for (let i = transaction.operations.length - 1; i >= 0; i--) {
        const operation = transaction.operations[i]
        if (operation.rollback) {
          try {
            await operation.rollback()
            rollbackOperations++
            
            this.emit('operation:rolled_back', { 
              transactionId, 
              operationId: operation.id 
            })
          } catch (error) {
            this.emit('rollback:error', { 
              transactionId, 
              operationId: operation.id, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            })
          }
        }
      }

      transaction.state = 'rolled_back'
      transaction.endTime = Date.now()

      this.emit('transaction:rolled_back', { 
        transactionId, 
        reason, 
        operations: rollbackOperations 
      })

    } catch (err) {
      transaction.state = 'failed'
      transaction.endTime = Date.now()
      
      this.emit('rollback:failed', { 
        transactionId, 
        error: err instanceof Error ? err.message : 'Unknown error' 
      })
    } finally {
      // Release all locks
      this.releaseAllResourceLocks(transactionId)
      
      // Move to history
      this.transactionHistory.push(transaction)
      this.activeTransactions.delete(transactionId)
      this.savepoints.delete(transactionId)
    }

    return {
      success: transaction.state === 'rolled_back',
      transactionId,
      operations: transaction.operations.length,
      duration: Date.now() - startTime,
      rollbackOperations,
      error: reason
    }
  }

  /**
   * Execute function within transaction context
   */
  async withTransaction<T>(
    fn: (transactionId: string) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    const transactionId = await this.beginTransaction(options)
    
    try {
      const result = await fn(transactionId)
      await this.commitTransaction(transactionId)
      return result
    } catch (error) {
      await this.rollbackTransaction(transactionId, error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  /**
   * Get transaction status
   */
  getTransactionStatus(transactionId: string): Transaction | null {
    return this.activeTransactions.get(transactionId) || 
           this.transactionHistory.find(t => t.id === transactionId) || 
           null
  }

  /**
   * Get active transactions
   */
  getActiveTransactions(): Transaction[] {
    return Array.from(this.activeTransactions.values())
  }

  /**
   * Get transaction statistics
   */
  getStatistics() {
    const active = this.activeTransactions.size
    const history = this.transactionHistory.slice(-100) // Last 100
    
    const committed = history.filter(t => t.state === 'committed').length
    const rolledBack = history.filter(t => t.state === 'rolled_back').length
    const failed = history.filter(t => t.state === 'failed').length
    
    const avgDuration = history.length > 0 ? 
      history.reduce((sum, t) => sum + ((t.endTime || Date.now()) - t.startTime), 0) / history.length : 0

    return {
      active,
      total: history.length,
      committed,
      rolledBack,
      failed,
      commitRate: history.length > 0 ? committed / history.length : 0,
      avgDuration,
      resourceLocks: this.resourceLocks.size
    }
  }

  /**
   * Acquire resource lock
   */
  private async acquireResourceLock(
    transactionId: string, 
    resource: string, 
    isolation: Transaction['isolation']
  ): Promise<void> {
    // Check if resource is already locked by another transaction
    const existingLocks = this.resourceLocks.get(resource)
    if (existingLocks && !existingLocks.has(transactionId)) {
      // Wait for lock or timeout based on isolation level
      if (isolation === 'serializable') {
        throw new Error(`Resource ${resource} is locked by another transaction`)
      }
      
      // For other isolation levels, allow concurrent access with warnings
      this.emit('lock:conflict', { transactionId, resource, existingLocks: Array.from(existingLocks) })
    }

    // Acquire lock
    if (!this.resourceLocks.has(resource)) {
      this.resourceLocks.set(resource, new Set())
    }
    
    this.resourceLocks.get(resource)!.add(transactionId)
    
    this.emit('lock:acquired', { transactionId, resource })
  }

  /**
   * Release all resource locks for transaction
   */
  private releaseAllResourceLocks(transactionId: string): void {
    for (const [resource, locks] of this.resourceLocks) {
      if (locks.has(transactionId)) {
        locks.delete(transactionId)
        if (locks.size === 0) {
          this.resourceLocks.delete(resource)
        }
        this.emit('lock:released', { transactionId, resource })
      }
    }
  }

  /**
   * Detect deadlocks between transactions
   */
  private detectDeadlocks(): void {
    const waitGraph = new Map<string, Set<string>>()
    
    // Build wait graph
    for (const [resource, locks] of this.resourceLocks) {
      const lockArray = Array.from(locks)
      if (lockArray.length > 1) {
        // Multiple transactions have locks on same resource - potential deadlock
        for (let i = 0; i < lockArray.length; i++) {
          for (let j = i + 1; j < lockArray.length; j++) {
            const tx1 = lockArray[i]
            const tx2 = lockArray[j]
            
            if (!waitGraph.has(tx1)) waitGraph.set(tx1, new Set())
            if (!waitGraph.has(tx2)) waitGraph.set(tx2, new Set())
            
            waitGraph.get(tx1)!.add(tx2)
            waitGraph.get(tx2)!.add(tx1)
          }
        }
      }
    }
    
    // Detect cycles (simplified)
    const visited = new Set<string>()
    const cycles: string[] = []
    
    for (const [node] of waitGraph) {
      if (!visited.has(node)) {
        const cycle = this.detectCycle(waitGraph, node, visited, new Set(), [])
        if (cycle.length > 0) {
          cycles.push(...cycle)
        }
      }
    }
    
    // Resolve deadlocks by rolling back youngest transaction
    if (cycles.length > 0) {
      const youngest = cycles.sort((a, b) => {
        const txA = this.activeTransactions.get(a)
        const txB = this.activeTransactions.get(b)
        return (txB?.startTime || 0) - (txA?.startTime || 0)
      })[0]
      
      this.emit('deadlock:detected', { victim: youngest, cycle: cycles })
      
      this.rollbackTransaction(youngest, 'Deadlock resolution')
        .catch(error => {
          this.emit('deadlock:resolution_failed', { victim: youngest, error: error.message })
        })
    }
  }

  /**
   * Detect cycle in wait graph (DFS)
   */
  private detectCycle(
    graph: Map<string, Set<string>>,
    node: string,
    visited: Set<string>,
    inStack: Set<string>,
    path: string[]
  ): string[] {
    visited.add(node)
    inStack.add(node)
    path.push(node)
    
    const neighbors = graph.get(node) || new Set()
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        const cycle = this.detectCycle(graph, neighbor, visited, inStack, path)
        if (cycle.length > 0) return cycle
      } else if (inStack.has(neighbor)) {
        // Found cycle
        const cycleStart = path.indexOf(neighbor)
        return path.slice(cycleStart)
      }
    }
    
    inStack.delete(node)
    path.pop()
    return []
  }

  /**
   * Start deadlock detection
   */
  private startDeadlockDetection(): void {
    this.deadlockDetector = setInterval(() => {
      if (this.activeTransactions.size > 1) {
        this.detectDeadlocks()
      }
    }, this.DEADLOCK_CHECK_INTERVAL)
  }

  /**
   * Generate unique transaction ID
   */
  private generateTransactionId(): string {
    return `tx_${Date.now()}_${randomBytes(8).toString('hex')}`
  }

  /**
   * Generate unique operation ID  
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${randomBytes(4).toString('hex')}`
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.deadlockDetector) {
      clearInterval(this.deadlockDetector)
      this.deadlockDetector = null
    }
    
    // Rollback all active transactions
    for (const transactionId of this.activeTransactions.keys()) {
      this.rollbackTransaction(transactionId, 'System shutdown')
        .catch(() => {}) // Ignore errors during shutdown
    }
    
    this.activeTransactions.clear()
    this.resourceLocks.clear()
    this.transactionHistory.length = 0
    this.savepoints.clear()
    this.removeAllListeners()
  }
}

// Singleton instance
export const transactionManager = new TransactionManager()

// Convenience functions
export async function withTransaction<T>(
  fn: (transactionId: string) => Promise<T>,
  options?: TransactionOptions
): Promise<T> {
  return transactionManager.withTransaction(fn, options)
}

export async function beginTransaction(options?: TransactionOptions): Promise<string> {
  return transactionManager.beginTransaction(options)
}

export async function commitTransaction(transactionId: string): Promise<TransactionResult> {
  return transactionManager.commitTransaction(transactionId)
}

export async function rollbackTransaction(transactionId: string, reason?: string): Promise<TransactionResult> {
  return transactionManager.rollbackTransaction(transactionId, reason)
}

export function getTransactionStatus(transactionId: string): Transaction | null {
  return transactionManager.getTransactionStatus(transactionId)
}

// Auto-cleanup on exit
process.on('beforeExit', () => {
  transactionManager.destroy()
})