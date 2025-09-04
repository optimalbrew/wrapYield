/**
 * Cross-Chain State Synchronization Service
 * 
 * This service ensures consistency between EVM and Bitcoin states,
 * enforces timelocks, and handles dispute resolution.
 */

import { foundryEVMService } from './foundryEVMService'
import { db } from '../db/connection'
import { loans, bitcoinTransactions, evmTransactions, loanEvents } from '../db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'

interface BitcoinTransactionInfo {
  txid: string
  confirmations: number
  blockHeight?: number
  inputs: Array<{
    txid: string
    vout: number
    value: number
  }>
  outputs: Array<{
    address: string
    value: number
  }>
}

interface EVMContractState {
  loanId: string
  status: string
  borrowerAddress: string
  lenderAddress?: string
  amount: string
  bondAmount?: string
  timelocks: {
    loanReq: number
    btcEscrow: number
    repaymentAccept: number
    btcCollateral: number
  }
  blockHeights: {
    request?: number
    offer?: number
    activation?: number
    repayment?: number
  }
}

interface CrossChainValidationResult {
  isValid: boolean
  inconsistencies: string[]
  warnings: string[]
  recommendations: string[]
}

export class CrossChainStateSynchronizer {
  // Using Foundry EVM service instead of ethers provider
  private pythonApiUrl: string
  private bitcoinRpcUrl: string

  constructor(
    evmRpcUrl: string,
    pythonApiUrl: string,
    bitcoinRpcUrl: string
  ) {
    this.pythonApiUrl = pythonApiUrl
    this.bitcoinRpcUrl = bitcoinRpcUrl
  }

  /**
   * Validate EVM contract state for a loan
   */
  async validateEVMState(loanId: string): Promise<boolean> {
    try {
      console.log(`🔍 Validating EVM state for loan ${loanId}`)
      
      const loan = await this.getLoanFromDatabase(loanId)
      if (!loan) {
        throw new Error(`Loan ${loanId} not found in database`)
      }

      const evmState = await this.getEVMContractState(loan.evmContractId.toString())
      const validationResult = await this.compareStates(loan, evmState)
      
      if (!validationResult.isValid) {
        console.error(`❌ EVM state validation failed for loan ${loanId}:`, validationResult.inconsistencies)
        await this.logValidationFailure(loanId, 'evm_validation', validationResult)
        return false
      }

      console.log(`✅ EVM state validation passed for loan ${loanId}`)
      return true
    } catch (error) {
      console.error(`❌ Error validating EVM state for loan ${loanId}:`, error)
      return false
    }
  }

  /**
   * Validate Bitcoin state for a loan
   */
  async validateBitcoinState(loanId: string): Promise<boolean> {
    try {
      console.log(`🔍 Validating Bitcoin state for loan ${loanId}`)
      
      const loan = await this.getLoanFromDatabase(loanId)
      if (!loan) {
        throw new Error(`Loan ${loanId} not found in database`)
      }

      const bitcoinTxs = await this.getBitcoinTransactionsForLoan(loanId)
      const validationResult = await this.validateBitcoinTransactions(loan, bitcoinTxs)
      
      if (!validationResult.isValid) {
        console.error(`❌ Bitcoin state validation failed for loan ${loanId}:`, validationResult.inconsistencies)
        await this.logValidationFailure(loanId, 'bitcoin_validation', validationResult)
        return false
      }

      console.log(`✅ Bitcoin state validation passed for loan ${loanId}`)
      return true
    } catch (error) {
      console.error(`❌ Error validating Bitcoin state for loan ${loanId}:`, error)
      return false
    }
  }

  /**
   * Reconcile states between EVM and Bitcoin
   */
  async reconcileStates(loanId: string): Promise<void> {
    try {
      console.log(`🔄 Reconciling states for loan ${loanId}`)
      
      const loan = await this.getLoanFromDatabase(loanId)
      if (!loan) {
        throw new Error(`Loan ${loanId} not found in database`)
      }

      const evmState = await this.getEVMContractState(loan.evmContractId.toString())
      const bitcoinTxs = await this.getBitcoinTransactionsForLoan(loanId)
      
      // Check for state inconsistencies
      const inconsistencies = await this.detectInconsistencies(loan, evmState, bitcoinTxs)
      
      if (inconsistencies.length > 0) {
        console.warn(`⚠️ Found ${inconsistencies.length} inconsistencies for loan ${loanId}`)
        await this.handleInconsistencies(loanId, inconsistencies)
      } else {
        console.log(`✅ No inconsistencies found for loan ${loanId}`)
      }

      // Update loan status based on cross-chain state
      await this.updateLoanStatusFromCrossChainState(loan, evmState, bitcoinTxs)
      
    } catch (error) {
      console.error(`❌ Error reconciling states for loan ${loanId}:`, error)
      throw error
    }
  }

  /**
   * Enforce timelocks for a loan
   */
  async enforceTimelocks(loanId: string): Promise<void> {
    try {
      console.log(`⏰ Enforcing timelocks for loan ${loanId}`)
      
      const loan = await this.getLoanFromDatabase(loanId)
      if (!loan) {
        throw new Error(`Loan ${loanId} not found in database`)
      }

      const currentBlock = await this.provider.getBlockNumber()
      const currentBitcoinHeight = await this.getCurrentBitcoinHeight()
      
      // Check EVM timelocks
      await this.checkEVMTimelocks(loan, currentBlock)
      
      // Check Bitcoin timelocks
      await this.checkBitcoinTimelocks(loan, currentBitcoinHeight)
      
    } catch (error) {
      console.error(`❌ Error enforcing timelocks for loan ${loanId}:`, error)
      throw error
    }
  }

  /**
   * Handle disputes between borrower and lender
   */
  async handleDisputes(loanId: string): Promise<void> {
    try {
      console.log(`⚖️ Checking for disputes in loan ${loanId}`)
      
      const loan = await this.getLoanFromDatabase(loanId)
      if (!loan) {
        throw new Error(`Loan ${loanId} not found in database`)
      }

      const disputes = await this.detectDisputes(loan)
      
      if (disputes.length > 0) {
        console.warn(`⚠️ Found ${disputes.length} disputes for loan ${loanId}`)
        await this.resolveDisputes(loanId, disputes)
      } else {
        console.log(`✅ No disputes found for loan ${loanId}`)
      }
      
    } catch (error) {
      console.error(`❌ Error handling disputes for loan ${loanId}:`, error)
      throw error
    }
  }

  // Private helper methods

  private async getLoanFromDatabase(loanId: string) {
    const result = await db
      .select()
      .from(loans)
      .where(eq(loans.id, loanId))
      .limit(1)
    
    return result[0] || null
  }

  private async getEVMContractState(contractLoanId: string): Promise<EVMContractState> {
    // TODO: Implement contract state reading
    // This would read the current state from the EVM contract
    throw new Error('EVM contract state reading not implemented yet')
  }

  private async getBitcoinTransactionsForLoan(loanId: string) {
    return await db
      .select()
      .from(bitcoinTransactions)
      .where(eq(bitcoinTransactions.loanId, loanId))
      .orderBy(desc(bitcoinTransactions.createdAt))
  }

  private async compareStates(loan: any, evmState: EVMContractState): Promise<CrossChainValidationResult> {
    const inconsistencies: string[] = []
    const warnings: string[] = []
    const recommendations: string[] = []

    // Compare loan status
    if (loan.status !== evmState.status) {
      inconsistencies.push(`Status mismatch: DB=${loan.status}, EVM=${evmState.status}`)
    }

    // Compare amounts
    if (loan.amount !== evmState.amount) {
      inconsistencies.push(`Amount mismatch: DB=${loan.amount}, EVM=${evmState.amount}`)
    }

    // Compare bond amounts
    if (loan.bondAmount && evmState.bondAmount && loan.bondAmount !== evmState.bondAmount) {
      inconsistencies.push(`Bond amount mismatch: DB=${loan.bondAmount}, EVM=${evmState.bondAmount}`)
    }

    // Check for missing lender
    if (loan.status === 'offered' && !loan.lenderId && evmState.lenderAddress) {
      warnings.push('Loan is offered but no lender ID in database')
      recommendations.push('Update lender ID from EVM state')
    }

    return {
      isValid: inconsistencies.length === 0,
      inconsistencies,
      warnings,
      recommendations
    }
  }

  private async validateBitcoinTransactions(loan: any, bitcoinTxs: any[]): Promise<CrossChainValidationResult> {
    const inconsistencies: string[] = []
    const warnings: string[] = []
    const recommendations: string[] = []

    // Check for required Bitcoin transactions based on loan status
    const requiredTxTypes = this.getRequiredBitcoinTransactionTypes(loan.status)
    
    for (const requiredType of requiredTxTypes) {
      const hasTx = bitcoinTxs.some(tx => tx.type === requiredType)
      if (!hasTx) {
        inconsistencies.push(`Missing required Bitcoin transaction: ${requiredType}`)
      }
    }

    // Validate transaction confirmations
    for (const tx of bitcoinTxs) {
      if (tx.status === 'broadcast' && tx.confirmations < 1) {
        warnings.push(`Transaction ${tx.txid} is broadcast but not confirmed`)
      }
      
      if (tx.status === 'confirmed' && tx.confirmations < 6) {
        warnings.push(`Transaction ${tx.txid} has only ${tx.confirmations} confirmations`)
      }
    }

    return {
      isValid: inconsistencies.length === 0,
      inconsistencies,
      warnings,
      recommendations
    }
  }

  private getRequiredBitcoinTransactionTypes(loanStatus: string): string[] {
    switch (loanStatus) {
      case 'requested':
        return ['escrow']
      case 'offered':
        return ['escrow', 'collateral']
      case 'active':
        return ['escrow', 'collateral']
      case 'repayment_in_progress':
        return ['escrow', 'collateral']
      case 'repaid':
        return ['escrow', 'collateral', 'collateral_release']
      case 'defaulted':
        return ['escrow', 'collateral', 'collateral_capture']
      default:
        return []
    }
  }

  private async detectInconsistencies(loan: any, evmState: EVMContractState, bitcoinTxs: any[]): Promise<string[]> {
    const inconsistencies: string[] = []

    // Check if EVM state matches database state
    const evmValidation = await this.compareStates(loan, evmState)
    inconsistencies.push(...evmValidation.inconsistencies)

    // Check if Bitcoin transactions match loan status
    const bitcoinValidation = await this.validateBitcoinTransactions(loan, bitcoinTxs)
    inconsistencies.push(...bitcoinValidation.inconsistencies)

    return inconsistencies
  }

  private async handleInconsistencies(loanId: string, inconsistencies: string[]): Promise<void> {
    console.log(`🔧 Handling ${inconsistencies.length} inconsistencies for loan ${loanId}`)
    
    // Log inconsistencies
    await this.logValidationFailure(loanId, 'state_inconsistency', {
      isValid: false,
      inconsistencies,
      warnings: [],
      recommendations: []
    })

    // TODO: Implement automatic resolution strategies
    // For now, just log the inconsistencies
    for (const inconsistency of inconsistencies) {
      console.warn(`⚠️ Inconsistency: ${inconsistency}`)
    }
  }

  private async updateLoanStatusFromCrossChainState(loan: any, evmState: EVMContractState, bitcoinTxs: any[]): Promise<void> {
    // Update loan status based on cross-chain state
    if (evmState.status !== loan.status) {
      console.log(`📝 Updating loan ${loan.id} status from ${loan.status} to ${evmState.status}`)
      
      await db
        .update(loans)
        .set({ status: evmState.status })
        .where(eq(loans.id, loan.id))

      // Log the status change
      await db.insert(loanEvents).values({
        loanId: loan.id,
        eventType: 'status_update_from_cross_chain',
        fromStatus: loan.status,
        toStatus: evmState.status,
        eventData: {
          source: 'cross_chain_sync',
          evmState,
          bitcoinTxCount: bitcoinTxs.length
        },
        notes: `Status updated from cross-chain state synchronization`
      })
    }
  }

  private async checkEVMTimelocks(loan: any, currentBlock: number): Promise<void> {
    const timelocks = {
      loanReq: loan.timelockLoanReq,
      btcEscrow: loan.timelockBtcEscrow,
      repaymentAccept: loan.timelockRepaymentAccept,
      btcCollateral: loan.timelockBtcCollateral
    }

    // Check if loan request timelock has expired
    if (loan.status === 'requested' && loan.requestBlockHeight) {
      const blocksSinceRequest = currentBlock - Number(loan.requestBlockHeight)
      if (blocksSinceRequest > timelocks.loanReq) {
        console.warn(`⚠️ Loan request timelock expired for loan ${loan.id}`)
        await this.handleExpiredTimelock(loan.id, 'loan_request', blocksSinceRequest, timelocks.loanReq)
      }
    }

    // Check if repayment acceptance timelock has expired
    if (loan.status === 'repayment_in_progress' && loan.repaymentBlockHeight) {
      const blocksSinceRepayment = currentBlock - Number(loan.repaymentBlockHeight)
      if (blocksSinceRepayment > timelocks.repaymentAccept) {
        console.warn(`⚠️ Repayment acceptance timelock expired for loan ${loan.id}`)
        await this.handleExpiredTimelock(loan.id, 'repayment_acceptance', blocksSinceRepayment, timelocks.repaymentAccept)
      }
    }
  }

  private async checkBitcoinTimelocks(loan: any, currentBitcoinHeight: number): Promise<void> {
    // Check Bitcoin transaction timelocks
    const bitcoinTxs = await this.getBitcoinTransactionsForLoan(loan.id)
    
    for (const tx of bitcoinTxs) {
      if (tx.metadata?.timelock && tx.blockHeight) {
        const blocksSinceTx = currentBitcoinHeight - tx.blockHeight
        if (blocksSinceTx > tx.metadata.timelock) {
          console.warn(`⚠️ Bitcoin transaction timelock expired for ${tx.txid}`)
          await this.handleExpiredBitcoinTimelock(loan.id, tx.id, blocksSinceTx, tx.metadata.timelock)
        }
      }
    }
  }

  private async getCurrentBitcoinHeight(): Promise<number> {
    try {
      const response = await axios.post(this.bitcoinRpcUrl, {
        jsonrpc: '2.0',
        method: 'getblockcount',
        params: [],
        id: 1
      })
      return response.data.result
    } catch (error) {
      console.error('❌ Error getting Bitcoin block height:', error)
      throw error
    }
  }

  private async detectDisputes(loan: any): Promise<string[]> {
    const disputes: string[] = []

    // Check for borrower default
    if (loan.status === 'active' && loan.activationBlockHeight) {
      const currentBlock = await this.provider.getBlockNumber()
      const blocksSinceActivation = currentBlock - Number(loan.activationBlockHeight)
      const loanDuration = loan.durationBlocks
      
      if (blocksSinceActivation > loanDuration) {
        disputes.push('borrower_default')
      }
    }

    // Check for lender non-participation
    if (loan.status === 'repayment_in_progress' && loan.repaymentBlockHeight) {
      const currentBlock = await this.provider.getBlockNumber()
      const blocksSinceRepayment = currentBlock - Number(loan.repaymentBlockHeight)
      const repaymentAcceptTimelock = loan.timelockRepaymentAccept
      
      if (blocksSinceRepayment > repaymentAcceptTimelock) {
        disputes.push('lender_non_participation')
      }
    }

    return disputes
  }

  private async resolveDisputes(loanId: string, disputes: string[]): Promise<void> {
    console.log(`⚖️ Resolving ${disputes.length} disputes for loan ${loanId}`)
    
    for (const dispute of disputes) {
      switch (dispute) {
        case 'borrower_default':
          await this.resolveBorrowerDefault(loanId)
          break
        case 'lender_non_participation':
          await this.resolveLenderNonParticipation(loanId)
          break
        default:
          console.warn(`⚠️ Unknown dispute type: ${dispute}`)
      }
    }
  }

  private async resolveBorrowerDefault(loanId: string): Promise<void> {
    console.log(`🔧 Resolving borrower default for loan ${loanId}`)
    
    // Update loan status to defaulted
    await db
      .update(loans)
      .set({ status: 'defaulted' })
      .where(eq(loans.id, loanId))

    // Log the dispute resolution
    await db.insert(loanEvents).values({
      loanId,
      eventType: 'dispute_resolved',
      fromStatus: 'active',
      toStatus: 'defaulted',
      eventData: {
        disputeType: 'borrower_default',
        resolution: 'automatic_default'
      },
      notes: 'Loan automatically defaulted due to borrower non-payment'
    })

    // TODO: Trigger collateral capture process
  }

  private async resolveLenderNonParticipation(loanId: string): Promise<void> {
    console.log(`🔧 Resolving lender non-participation for loan ${loanId}`)
    
    // Update loan status to refunded to borrower
    await db
      .update(loans)
      .set({ status: 'refunded_to_borrower' })
      .where(eq(loans.id, loanId))

    // Log the dispute resolution
    await db.insert(loanEvents).values({
      loanId,
      eventType: 'dispute_resolved',
      fromStatus: 'repayment_in_progress',
      toStatus: 'refunded_to_borrower',
      eventData: {
        disputeType: 'lender_non_participation',
        resolution: 'automatic_refund_to_borrower'
      },
      notes: 'Loan refunded to borrower due to lender non-participation'
    })

    // TODO: Trigger collateral release process
  }

  private async handleExpiredTimelock(loanId: string, timelockType: string, actualBlocks: number, expectedBlocks: number): Promise<void> {
    await db.insert(loanEvents).values({
      loanId,
      eventType: 'timelock_expired',
      eventData: {
        timelockType,
        actualBlocks,
        expectedBlocks,
        expiredBy: actualBlocks - expectedBlocks
      },
      notes: `${timelockType} timelock expired`
    })
  }

  private async handleExpiredBitcoinTimelock(loanId: string, txId: string, actualBlocks: number, expectedBlocks: number): Promise<void> {
    await db.insert(loanEvents).values({
      loanId,
      eventType: 'bitcoin_timelock_expired',
      eventData: {
        transactionId: txId,
        actualBlocks,
        expectedBlocks,
        expiredBy: actualBlocks - expectedBlocks
      },
      notes: `Bitcoin transaction timelock expired`
    })
  }

  private async logValidationFailure(loanId: string, validationType: string, result: CrossChainValidationResult): Promise<void> {
    await db.insert(loanEvents).values({
      loanId,
      eventType: 'validation_failure',
      eventData: {
        validationType,
        result
      },
      notes: `Validation failed: ${validationType}`
    })
  }
}

// Export singleton instance
export const crossChainSync = new CrossChainStateSynchronizer(
  process.env.EVM_RPC_URL || 'http://localhost:8545',
  process.env.PYTHON_API_URL || 'http://localhost:8001',
  process.env.BITCOIN_RPC_URL || 'http://localhost:8332'
)
