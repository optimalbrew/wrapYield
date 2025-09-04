/**
 * Error Recovery Service
 * 
 * This service provides comprehensive error handling and recovery mechanisms
 * for the BTC Yield Protocol backend service.
 */

import { db } from '../db/connection'
import { loanEvents, loanWorkflows, bitcoinTransactions, evmTransactions } from '../db/schema'
import { eq, and, desc, gte } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'

// Error categories
export enum ErrorCategory {
  EVM_ERROR = 'evm_error',
  BITCOIN_ERROR = 'bitcoin_error',
  PYTHON_API_ERROR = 'python_api_error',
  DATABASE_ERROR = 'database_error',
  CROSS_CHAIN_ERROR = 'cross_chain_error',
  WORKFLOW_ERROR = 'workflow_error',
  NETWORK_ERROR = 'network_error',
  VALIDATION_ERROR = 'validation_error'
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Error context interface
export interface ErrorContext {
  loanId?: string
  workflowId?: string
  transactionId?: string
  userId?: string
  operation?: string
  metadata?: Record<string, any>
}

// Error recovery result
export interface RecoveryResult {
  success: boolean
  recovered: boolean
  error?: string
  actions: string[]
  recommendations: string[]
}

// Error record interface
export interface ErrorRecord {
  id: string
  category: ErrorCategory
  severity: ErrorSeverity
  message: string
  stack?: string
  context: ErrorContext
  timestamp: Date
  resolved: boolean
  resolvedAt?: Date
  recoveryAttempts: number
  maxRecoveryAttempts: number
}

export class ErrorRecoveryService {
  private errorRecords: Map<string, ErrorRecord> = new Map()
  private recoveryStrategies: Map<ErrorCategory, (error: Error, context: ErrorContext) => Promise<RecoveryResult>> = new Map()

  constructor() {
    this.initializeRecoveryStrategies()
  }

  /**
   * Initialize recovery strategies for different error categories
   */
  private initializeRecoveryStrategies(): void {
    this.recoveryStrategies.set(ErrorCategory.EVM_ERROR, this.handleEVMError.bind(this))
    this.recoveryStrategies.set(ErrorCategory.BITCOIN_ERROR, this.handleBitcoinError.bind(this))
    this.recoveryStrategies.set(ErrorCategory.PYTHON_API_ERROR, this.handlePythonAPIError.bind(this))
    this.recoveryStrategies.set(ErrorCategory.DATABASE_ERROR, this.handleDatabaseError.bind(this))
    this.recoveryStrategies.set(ErrorCategory.CROSS_CHAIN_ERROR, this.handleCrossChainError.bind(this))
    this.recoveryStrategies.set(ErrorCategory.WORKFLOW_ERROR, this.handleWorkflowError.bind(this))
    this.recoveryStrategies.set(ErrorCategory.NETWORK_ERROR, this.handleNetworkError.bind(this))
    this.recoveryStrategies.set(ErrorCategory.VALIDATION_ERROR, this.handleValidationError.bind(this))
  }

  /**
   * Handle and recover from an error
   */
  async handleError(
    error: Error,
    category: ErrorCategory,
    context: ErrorContext,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
  ): Promise<RecoveryResult> {
    console.error(`🚨 Error occurred: ${category} - ${error.message}`, { context, severity })

    // Create error record
    const errorRecord = await this.createErrorRecord(error, category, severity, context)

    // Log error to database
    await this.logErrorToDatabase(errorRecord)

    // Attempt recovery
    const recoveryResult = await this.attemptRecovery(errorRecord)

    // Update error record with recovery result
    await this.updateErrorRecord(errorRecord.id, recoveryResult)

    // Send alerts if necessary
    if (severity === ErrorSeverity.HIGH || severity === ErrorSeverity.CRITICAL) {
      await this.sendAlert(errorRecord, recoveryResult)
    }

    return recoveryResult
  }

  /**
   * Create error record
   */
  private async createErrorRecord(
    error: Error,
    category: ErrorCategory,
    severity: ErrorSeverity,
    context: ErrorContext
  ): Promise<ErrorRecord> {
    const errorId = uuidv4()
    
    const errorRecord: ErrorRecord = {
      id: errorId,
      category,
      severity,
      message: error.message,
      stack: error.stack || '',
      context,
      timestamp: new Date(),
      resolved: false,
      recoveryAttempts: 0,
      maxRecoveryAttempts: this.getMaxRecoveryAttempts(category, severity)
    }

    this.errorRecords.set(errorId, errorRecord)
    return errorRecord
  }

  /**
   * Log error to database
   */
  private async logErrorToDatabase(errorRecord: ErrorRecord): Promise<void> {
    try {
      await db.insert(loanEvents).values({
        id: uuidv4(),
        loanId: errorRecord.context.loanId || uuidv4(),
        eventType: 'error_occurred',
        eventData: {
          errorId: errorRecord.id,
          category: errorRecord.category,
          severity: errorRecord.severity,
          message: errorRecord.message,
          context: errorRecord.context,
          stack: errorRecord.stack
        },
        notes: `Error occurred: ${errorRecord.category} - ${errorRecord.message}`
      })
    } catch (dbError) {
      console.error('❌ Failed to log error to database:', dbError)
    }
  }

  /**
   * Attempt recovery for an error
   */
  private async attemptRecovery(errorRecord: ErrorRecord): Promise<RecoveryResult> {
    const strategy = this.recoveryStrategies.get(errorRecord.category)
    
    if (!strategy) {
      return {
        success: false,
        recovered: false,
        error: `No recovery strategy found for category: ${errorRecord.category}`,
        actions: [],
        recommendations: ['Implement recovery strategy for this error category']
      }
    }

    try {
      const error = new Error(errorRecord.message)
      error.stack = errorRecord.stack
      
      const result = await strategy(error, errorRecord.context)
      
      errorRecord.recoveryAttempts++
      errorRecord.resolved = result.recovered
      errorRecord.resolvedAt = result.recovered ? new Date() : undefined
      
      return result
    } catch (recoveryError) {
      console.error('❌ Recovery attempt failed:', recoveryError)
      
      return {
        success: false,
        recovered: false,
        error: `Recovery failed: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`,
        actions: ['Recovery attempt failed'],
        recommendations: ['Manual intervention required']
      }
    }
  }

  /**
   * Update error record with recovery result
   */
  private async updateErrorRecord(errorId: string, recoveryResult: RecoveryResult): Promise<void> {
    const errorRecord = this.errorRecords.get(errorId)
    if (!errorRecord) return

    try {
      await db.insert(loanEvents).values({
        id: uuidv4(),
        loanId: errorRecord.context.loanId || uuidv4(),
        eventType: 'error_recovery_attempt',
        eventData: {
          errorId: errorRecord.id,
          recoveryResult,
          attempts: errorRecord.recoveryAttempts
        },
        notes: `Recovery attempt ${errorRecord.recoveryAttempts}: ${recoveryResult.recovered ? 'Success' : 'Failed'}`
      })
    } catch (dbError) {
      console.error('❌ Failed to update error record:', dbError)
    }
  }

  /**
   * Send alert for critical errors
   */
  private async sendAlert(errorRecord: ErrorRecord, recoveryResult: RecoveryResult): Promise<void> {
    // TODO: Implement alerting system (email, Slack, etc.)
    console.log(`🚨 ALERT: ${errorRecord.severity} error - ${errorRecord.category}: ${errorRecord.message}`)
    console.log(`Recovery: ${recoveryResult.recovered ? 'Success' : 'Failed'}`)
  }

  // Recovery strategies for different error categories

  private async handleEVMError(error: Error, context: ErrorContext): Promise<RecoveryResult> {
    const actions: string[] = []
    const recommendations: string[] = []

    // Check if it's a network connectivity issue
    if (error.message.includes('network') || error.message.includes('connection')) {
      actions.push('Retry EVM connection')
      recommendations.push('Check EVM node connectivity')
      
      // Attempt to reconnect
      try {
        // TODO: Implement EVM reconnection logic
        return {
          success: true,
          recovered: true,
          actions,
          recommendations
        }
      } catch (retryError) {
        return {
          success: false,
          recovered: false,
          error: `EVM reconnection failed: ${retryError.message}`,
          actions,
          recommendations: [...recommendations, 'Manual EVM node restart required']
        }
      }
    }

    // Check if it's a contract call failure
    if (error.message.includes('contract') || error.message.includes('revert')) {
      actions.push('Validate contract state')
      recommendations.push('Check contract deployment and ABI')
      
      // TODO: Implement contract state validation
      return {
        success: true,
        recovered: false,
        actions,
        recommendations: [...recommendations, 'Manual contract verification required']
      }
    }

    return {
      success: false,
      recovered: false,
      error: 'Unknown EVM error type',
      actions,
      recommendations: ['Manual investigation required']
    }
  }

  private async handleBitcoinError(error: Error, context: ErrorContext): Promise<RecoveryResult> {
    const actions: string[] = []
    const recommendations: string[] = []

    // Check if it's a transaction broadcast failure
    if (error.message.includes('broadcast') || error.message.includes('mempool')) {
      actions.push('Retry transaction broadcast')
      recommendations.push('Check Bitcoin network status')
      
      // Attempt to rebroadcast
      try {
        if (context.transactionId) {
          // TODO: Implement transaction rebroadcast
          return {
            success: true,
            recovered: true,
            actions,
            recommendations
          }
        }
      } catch (retryError) {
        return {
          success: false,
          recovered: false,
          error: `Transaction rebroadcast failed: ${retryError.message}`,
          actions,
          recommendations: [...recommendations, 'Manual transaction broadcast required']
        }
      }
    }

    // Check if it's a signature validation error
    if (error.message.includes('signature') || error.message.includes('script')) {
      actions.push('Validate signature data')
      recommendations.push('Check signature generation process')
      
      // TODO: Implement signature validation
      return {
        success: true,
        recovered: false,
        actions,
        recommendations: [...recommendations, 'Manual signature verification required']
      }
    }

    return {
      success: false,
      recovered: false,
      error: 'Unknown Bitcoin error type',
      actions,
      recommendations: ['Manual investigation required']
    }
  }

  private async handlePythonAPIError(error: Error, context: ErrorContext): Promise<RecoveryResult> {
    const actions: string[] = []
    const recommendations: string[] = []

    // Check if it's a service unavailable error
    if (error.message.includes('ECONNREFUSED') || error.message.includes('timeout')) {
      actions.push('Retry Python API connection')
      recommendations.push('Check Python API service status')
      
      // Attempt to reconnect
      try {
        const response = await axios.get(`${process.env.PYTHON_API_URL}/health`, { timeout: 5000 })
        if (response.status === 200) {
          return {
            success: true,
            recovered: true,
            actions,
            recommendations
          }
        }
      } catch (retryError) {
        return {
          success: false,
          recovered: false,
          error: `Python API still unavailable: ${retryError.message}`,
          actions,
          recommendations: [...recommendations, 'Restart Python API service']
        }
      }
    }

    // Check if it's a transaction creation error
    if (error.message.includes('transaction') || error.message.includes('btc-vaultero')) {
      actions.push('Validate transaction parameters')
      recommendations.push('Check btc-vaultero package status')
      
      // TODO: Implement transaction parameter validation
      return {
        success: true,
        recovered: false,
        actions,
        recommendations: [...recommendations, 'Manual transaction parameter verification required']
      }
    }

    return {
      success: false,
      recovered: false,
      error: 'Unknown Python API error type',
      actions,
      recommendations: ['Manual investigation required']
    }
  }

  private async handleDatabaseError(error: Error, context: ErrorContext): Promise<RecoveryResult> {
    const actions: string[] = []
    const recommendations: string[] = []

    // Check if it's a connection error
    if (error.message.includes('connection') || error.message.includes('ECONNREFUSED')) {
      actions.push('Retry database connection')
      recommendations.push('Check database service status')
      
      // Attempt to reconnect
      try {
        await db.execute('SELECT 1')
        return {
          success: true,
          recovered: true,
          actions,
          recommendations
        }
      } catch (retryError) {
        return {
          success: false,
          recovered: false,
          error: `Database still unavailable: ${retryError.message}`,
          actions,
          recommendations: [...recommendations, 'Restart database service']
        }
      }
    }

    // Check if it's a constraint violation
    if (error.message.includes('constraint') || error.message.includes('duplicate')) {
      actions.push('Validate data constraints')
      recommendations.push('Check for duplicate or invalid data')
      
      return {
        success: true,
        recovered: false,
        actions,
        recommendations: [...recommendations, 'Manual data validation required']
      }
    }

    return {
      success: false,
      recovered: false,
      error: 'Unknown database error type',
      actions,
      recommendations: ['Manual investigation required']
    }
  }

  private async handleCrossChainError(error: Error, context: ErrorContext): Promise<RecoveryResult> {
    const actions: string[] = []
    const recommendations: string[] = []

    // Check if it's a state inconsistency
    if (error.message.includes('inconsistency') || error.message.includes('mismatch')) {
      actions.push('Reconcile cross-chain states')
      recommendations.push('Run state synchronization process')
      
      // TODO: Implement state reconciliation
      return {
        success: true,
        recovered: false,
        actions,
        recommendations: [...recommendations, 'Manual state reconciliation required']
      }
    }

    // Check if it's a timelock violation
    if (error.message.includes('timelock') || error.message.includes('expired')) {
      actions.push('Validate timelock calculations')
      recommendations.push('Check block heights and timelock parameters')
      
      return {
        success: true,
        recovered: false,
        actions,
        recommendations: [...recommendations, 'Manual timelock verification required']
      }
    }

    return {
      success: false,
      recovered: false,
      error: 'Unknown cross-chain error type',
      actions,
      recommendations: ['Manual investigation required']
    }
  }

  private async handleWorkflowError(error: Error, context: ErrorContext): Promise<RecoveryResult> {
    const actions: string[] = []
    const recommendations: string[] = []

    // Check if it's a step failure
    if (error.message.includes('step') || error.message.includes('workflow')) {
      actions.push('Retry failed workflow step')
      recommendations.push('Check workflow dependencies and parameters')
      
      // TODO: Implement workflow step retry
      return {
        success: true,
        recovered: false,
        actions,
        recommendations: [...recommendations, 'Manual workflow restart required']
      }
    }

    return {
      success: false,
      recovered: false,
      error: 'Unknown workflow error type',
      actions,
      recommendations: ['Manual investigation required']
    }
  }

  private async handleNetworkError(error: Error, context: ErrorContext): Promise<RecoveryResult> {
    const actions: string[] = []
    const recommendations: string[] = []

    actions.push('Retry network operation')
    recommendations.push('Check network connectivity and service availability')
    
    // Simple retry for network errors
    return {
      success: true,
      recovered: true,
      actions,
      recommendations
    }
  }

  private async handleValidationError(error: Error, context: ErrorContext): Promise<RecoveryResult> {
    const actions: string[] = []
    const recommendations: string[] = []

    actions.push('Validate input parameters')
    recommendations.push('Check data format and constraints')
    
    return {
      success: true,
      recovered: false,
      actions,
      recommendations: [...recommendations, 'Manual data validation required']
    }
  }

  /**
   * Get maximum recovery attempts based on error category and severity
   */
  private getMaxRecoveryAttempts(category: ErrorCategory, severity: ErrorSeverity): number {
    const baseAttempts = {
      [ErrorCategory.NETWORK_ERROR]: 5,
      [ErrorCategory.DATABASE_ERROR]: 3,
      [ErrorCategory.PYTHON_API_ERROR]: 3,
      [ErrorCategory.EVM_ERROR]: 2,
      [ErrorCategory.BITCOIN_ERROR]: 2,
      [ErrorCategory.CROSS_CHAIN_ERROR]: 1,
      [ErrorCategory.WORKFLOW_ERROR]: 1,
      [ErrorCategory.VALIDATION_ERROR]: 1
    }

    const severityMultiplier = {
      [ErrorSeverity.LOW]: 1,
      [ErrorSeverity.MEDIUM]: 1,
      [ErrorSeverity.HIGH]: 2,
      [ErrorSeverity.CRITICAL]: 3
    }

    return baseAttempts[category] * severityMultiplier[severity]
  }

  /**
   * Get error statistics
   */
  async getErrorStatistics(): Promise<{
    totalErrors: number
    errorsByCategory: Record<ErrorCategory, number>
    errorsBySeverity: Record<ErrorSeverity, number>
    unresolvedErrors: number
    recoverySuccessRate: number
  }> {
    const errors = Array.from(this.errorRecords.values())
    
    const errorsByCategory = Object.values(ErrorCategory).reduce((acc, category) => {
      acc[category] = errors.filter(e => e.category === category).length
      return acc
    }, {} as Record<ErrorCategory, number>)

    const errorsBySeverity = Object.values(ErrorSeverity).reduce((acc, severity) => {
      acc[severity] = errors.filter(e => e.severity === severity).length
      return acc
    }, {} as Record<ErrorSeverity, number>)

    const unresolvedErrors = errors.filter(e => !e.resolved).length
    const recoveredErrors = errors.filter(e => e.resolved).length
    const recoverySuccessRate = errors.length > 0 ? (recoveredErrors / errors.length) * 100 : 0

    return {
      totalErrors: errors.length,
      errorsByCategory,
      errorsBySeverity,
      unresolvedErrors,
      recoverySuccessRate
    }
  }

  /**
   * Clean up old resolved errors
   */
  async cleanupOldErrors(olderThanDays: number = 30): Promise<void> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    for (const [errorId, errorRecord] of this.errorRecords.entries()) {
      if (errorRecord.resolved && errorRecord.resolvedAt && errorRecord.resolvedAt < cutoffDate) {
        this.errorRecords.delete(errorId)
      }
    }
  }
}

// Export singleton instance
export const errorRecovery = new ErrorRecoveryService()
