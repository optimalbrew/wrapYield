import { db } from '../db/connection'
import { bitcoinTransactions, loans, users, signatures } from '../db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { SignatureService } from './signatureService'
import path from 'path'
import { spawn } from 'child_process'

// Validation schemas
export const createEscrowTransactionSchema = z.object({
  loanId: z.string().uuid(),
  borrowerPubkey: z.string().length(64), // Schnorr x-only pubkey
  lenderPubkey: z.string().length(64),
  preimageHashBorrower: z.string().length(64),
  borrowerTimelock: z.number(),
  amount: z.string(), // Decimal string
  originationFee: z.string().optional()
})

export const createCollateralTransactionSchema = z.object({
  loanId: z.string().uuid(),
  escrowTxid: z.string().length(64),
  escrowVout: z.number().default(0),
  borrowerPubkey: z.string().length(64),
  lenderPubkey: z.string().length(64),
  preimageHashLender: z.string().length(64),
  lenderTimelock: z.number(),
  collateralAmount: z.string(),
  originationFee: z.string().optional()
})

export const signTransactionSchema = z.object({
  transactionId: z.string().uuid(), // bitcoinTransactions.id
  signerUserId: z.string().uuid(),
  privateKey: z.string().optional() // For testing - in production this would be handled securely
})

export type CreateEscrowTransactionInput = z.infer<typeof createEscrowTransactionSchema>
export type CreateCollateralTransactionInput = z.infer<typeof createCollateralTransactionSchema>
export type SignTransactionInput = z.infer<typeof signTransactionSchema>

export class BitcoinTransactionService {
  private signatureService: SignatureService

  constructor() {
    this.signatureService = new SignatureService()
  }

  /**
   * Create escrow transaction using btc-vaultero
   * This creates the initial escrow where borrower deposits Bitcoin
   */
  async createEscrowTransaction(data: CreateEscrowTransactionInput) {
    // Store transaction in database
    const transaction = await db.insert(bitcoinTransactions).values({
      loanId: data.loanId,
      type: 'escrow',
      inputAmount: '0', // Will be updated after creation
      outputAmount: data.amount,
      status: 'pending'
    }).returning()

    const txRecord = transaction[0]

    try {
      // Call btc-vaultero to create the escrow transaction
      const escrowResult = await this.callVaulteroCreateEscrow({
        borrowerPubkey: data.borrowerPubkey,
        lenderPubkey: data.lenderPubkey,
        preimageHashBorrower: data.preimageHashBorrower,
        borrowerTimelock: data.borrowerTimelock,
        amount: parseFloat(data.amount),
        originationFee: data.originationFee ? parseFloat(data.originationFee) : 0.01
      })

      // Update transaction record with results
      await db.update(bitcoinTransactions)
        .set({
          rawTx: escrowResult.rawTx,
          inputAmount: escrowResult.inputAmount?.toString(),
          fee: escrowResult.fee?.toString(),
          metadata: {
            escrowAddress: escrowResult.escrowAddress,
            scriptDetails: escrowResult.scriptDetails
          },
          updatedAt: new Date()
        })
        .where(eq(bitcoinTransactions.id, txRecord.id))

      return {
        transactionId: txRecord.id,
        escrowAddress: escrowResult.escrowAddress,
        rawTransaction: escrowResult.rawTx,
        readyForSigning: true
      }

    } catch (error) {
      // Update transaction status to failed
      await db.update(bitcoinTransactions)
        .set({ 
          status: 'failed',
          metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
          updatedAt: new Date()
        })
        .where(eq(bitcoinTransactions.id, txRecord.id))

      throw error
    }
  }

  /**
   * Create collateral transaction using btc-vaultero
   * This creates the transaction that moves funds from escrow to collateral
   */
  async createCollateralTransaction(data: CreateCollateralTransactionInput) {
    // Store transaction in database
    const transaction = await db.insert(bitcoinTransactions).values({
      loanId: data.loanId,
      type: 'collateral',
      inputAmount: data.collateralAmount,
      outputAmount: data.collateralAmount,
      status: 'pending',
      metadata: {
        escrowTxid: data.escrowTxid,
        escrowVout: data.escrowVout
      }
    }).returning()

    const txRecord = transaction[0]

    try {
      // Call btc-vaultero to create the collateral transaction
      const collateralResult = await this.callVaulteroCreateCollateral({
        escrowTxid: data.escrowTxid,
        escrowVout: data.escrowVout,
        borrowerPubkey: data.borrowerPubkey,
        lenderPubkey: data.lenderPubkey,
        preimageHashLender: data.preimageHashLender,
        lenderTimelock: data.lenderTimelock,
        collateralAmount: parseFloat(data.collateralAmount),
        originationFee: data.originationFee ? parseFloat(data.originationFee) : 0.01
      })

      // Update transaction record
      await db.update(bitcoinTransactions)
        .set({
          rawTx: collateralResult.rawTx,
          fee: collateralResult.fee?.toString(),
          metadata: {
            ...(txRecord.metadata || {}),
            collateralAddress: collateralResult.collateralAddress,
            scriptDetails: collateralResult.scriptDetails
          },
          updatedAt: new Date()
        })
        .where(eq(bitcoinTransactions.id, txRecord.id))

      return {
        transactionId: txRecord.id,
        collateralAddress: collateralResult.collateralAddress,
        rawTransaction: collateralResult.rawTx,
        readyForSigning: true
      }

    } catch (error) {
      await db.update(bitcoinTransactions)
        .set({ 
          status: 'failed',
          metadata: { ...(txRecord.metadata || {}), error: error instanceof Error ? error.message : 'Unknown error' },
          updatedAt: new Date()
        })
        .where(eq(bitcoinTransactions.id, txRecord.id))

      throw error
    }
  }

  /**
   * Create signature for a Bitcoin transaction
   * This implements our separate signing workflow
   */
  async signTransaction(data: SignTransactionInput) {
    const transaction = await db
      .select()
      .from(bitcoinTransactions)
      .where(eq(bitcoinTransactions.id, data.transactionId))
      .limit(1)

    const txRecord = transaction[0]
    if (!txRecord) {
      throw new Error('Transaction not found')
    }

    // Get user info to determine signature type
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, data.signerUserId))
      .limit(1)

    if (!user[0]) {
      throw new Error('User not found')
    }

    const signerRole = user[0].role
    const signatureType = signerRole === 'lender' ? 'lender' : 'borrower'

    try {
      // Call btc-vaultero to generate signature
      const signatureResult = await this.callVaulteroSignTransaction({
        rawTx: txRecord.rawTx!,
        inputAmount: parseFloat(txRecord.inputAmount!),
        signerType: signatureType,
        privateKey: data.privateKey // In production, this would be handled more securely
      })

      // Store signature using SignatureService
      const signature = await this.signatureService.createSignature({
        loanId: txRecord.loanId,
        signedBy: data.signerUserId,
        signatureType: signatureType as 'borrower' | 'lender',
        signatureData: signatureResult.signature,
        transactionHex: txRecord.rawTx!,
        inputAmount: txRecord.inputAmount!,
        scriptPath: true,
        leafIndex: signatureResult.leafIndex,
        tapleafScript: signatureResult.tapleafScript,
        controlBlock: signatureResult.controlBlock,
        witnessContext: signatureResult.witnessContext
      })

      return {
        signatureId: signature.id,
        signatureData: signatureResult.signature,
        canExport: true
      }

    } catch (error) {
      throw new Error(`Failed to sign transaction: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Broadcast completed transaction to Bitcoin network
   */
  async broadcastTransaction(transactionId: string, witnessData: any) {
    const transaction = await db
      .select()
      .from(bitcoinTransactions)
      .where(eq(bitcoinTransactions.id, transactionId))
      .limit(1)

    const txRecord = transaction[0]
    if (!txRecord) {
      throw new Error('Transaction not found')
    }

    try {
      // Call btc-vaultero to broadcast transaction
      const broadcastResult = await this.callVautebroadcastTransaction({
        rawTx: txRecord.rawTx!,
        witnessData: witnessData
      })

      // Update transaction record
      await db.update(bitcoinTransactions)
        .set({
          txid: broadcastResult.txid,
          status: 'broadcast',
          metadata: {
            ...(txRecord.metadata || {}),
            broadcastAt: new Date(),
            witnessData: witnessData
          },
          updatedAt: new Date()
        })
        .where(eq(bitcoinTransactions.id, transactionId))

      return {
        txid: broadcastResult.txid,
        status: 'broadcast'
      }

    } catch (error) {
      await db.update(bitcoinTransactions)
        .set({ 
          status: 'failed',
          metadata: { ...(txRecord.metadata || {}), broadcastError: error instanceof Error ? error.message : 'Unknown error' },
          updatedAt: new Date()
        })
        .where(eq(bitcoinTransactions.id, transactionId))

      throw error
    }
  }

  /**
   * Get transaction details with signatures
   */
  async getTransaction(transactionId: string) {
    const result = await db
      .select({
        transaction: bitcoinTransactions,
        loan: loans,
        signatures: signatures
      })
      .from(bitcoinTransactions)
      .leftJoin(loans, eq(bitcoinTransactions.loanId, loans.id))
      .leftJoin(signatures, eq(signatures.bitcoinTxId, bitcoinTransactions.id))
      .where(eq(bitcoinTransactions.id, transactionId))

    if (result.length === 0) {
      return null
    }

    const transaction = result[0].transaction
    const loan = result[0].loan
    const transactionSignatures = result.filter(r => r.signatures).map(r => r.signatures)

    return {
      transaction,
      loan,
      signatures: transactionSignatures
    }
  }

  // Private methods to call Python API service
  
  private async callVaulteroCreateEscrow(params: any) {
    const response = await fetch(`${this.getPythonApiUrl()}/transactions/escrow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        loan_id: params.loanId || 'unknown',
        borrower_pubkey: params.borrowerPubkey,
        preimage_hash_borrower: params.preimageHashBorrower,
        borrower_timelock: params.borrowerTimelock,
        amount: params.amount.toString(),
        origination_fee: params.originationFee?.toString()
      })
    })

    if (!response.ok) {
      const error = await response.json() as any
      throw new Error(`Python API error: ${error.error || response.statusText}`)
    }

    const result = await response.json() as any
    if (!result.success) {
      throw new Error(`Python API failed: ${result.error}`)
    }

    const data = result.data
    return {
      rawTx: data.raw_tx,
      inputAmount: data.input_amount,
      fee: data.fee,
      escrowAddress: data.escrow_address,
      scriptDetails: data.script_details
    }
  }

  private async callVaulteroCreateCollateral(params: any) {
    const response = await fetch(`${this.getPythonApiUrl()}/transactions/collateral`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        loan_id: params.loanId || 'unknown',
        escrow_txid: params.escrowTxid,
        escrow_vout: params.escrowVout,
        borrower_pubkey: params.borrowerPubkey,
        preimage_hash_lender: params.preimageHashLender,
        lender_timelock: params.lenderTimelock,
        collateral_amount: params.collateralAmount.toString(),
        origination_fee: params.originationFee?.toString()
      })
    })

    if (!response.ok) {
      const error = await response.json() as any
      throw new Error(`Python API error: ${error.error || response.statusText}`)
    }

    const result = await response.json() as any
    if (!result.success) {
      throw new Error(`Python API failed: ${result.error}`)
    }

    const data = result.data
    return {
      rawTx: data.raw_tx,
      fee: data.fee,
      collateralAddress: data.collateral_address,
      scriptDetails: data.script_details
    }
  }

  private async callVaulteroSignTransaction(params: any) {
    const response = await fetch(`${this.getPythonApiUrl()}/transactions/sign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        loan_id: params.loanId || 'unknown',
        raw_tx: params.rawTx,
        input_amount: params.inputAmount.toString(),
        signer_type: 'lender', // This service only handles lender signatures
        transaction_type: params.transactionType || 'escrow'
      })
    })

    if (!response.ok) {
      const error = await response.json() as any
      throw new Error(`Python API error: ${error.error || response.statusText}`)
    }

    const result = await response.json() as any
    if (!result.success) {
      throw new Error(`Python API failed: ${result.error}`)
    }

    const data = result.data
    return {
      signature: data.signature,
      leafIndex: data.leaf_index,
      tapleafScript: data.tapleaf_script,
      controlBlock: data.control_block,
      witnessContext: data.witness_context
    }
  }

  private async callVautebroadcastTransaction(params: any) {
    const response = await fetch(`${this.getPythonApiUrl()}/transactions/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw_tx: params.rawTx,
        witness_data: params.witnessData
      })
    })

    if (!response.ok) {
      const error = await response.json() as any
      throw new Error(`Python API error: ${error.error || response.statusText}`)
    }

    const result = await response.json() as any
    if (!result.success) {
      throw new Error(`Python API failed: ${result.error}`)
    }

    const data = result.data
    return {
      txid: data.txid,
      success: data.success
    }
  }

  private getPythonApiUrl(): string {
    // In Docker, services communicate using service names
    // In development, you might use localhost
    return process.env.PYTHON_API_URL || 'http://python-api:8001'
  }
}
