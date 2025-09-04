import { db } from '../db/connection'
import { signatures, loans, users, bitcoinTransactions } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import fs from 'fs/promises'
import path from 'path'

// Validation schemas
export const createSignatureSchema = z.object({
  loanId: z.string().uuid(),
  signedBy: z.string().uuid(), // User ID who created the signature
  signatureType: z.enum(['borrower', 'lender']),
  signatureData: z.string().min(1), // Hex signature
  transactionHex: z.string().min(1), // Raw transaction hex
  inputAmount: z.string(), // Decimal string
  scriptPath: z.boolean().default(true),
  leafIndex: z.number().optional(),
  tapleafScript: z.string().optional(),
  controlBlock: z.string().optional(),
  witnessContext: z.record(z.any()).optional(), // Additional context
  expiresAt: z.string().datetime().optional()
})

export const completeWitnessSchema = z.object({
  borrowerSignatureId: z.string().uuid(),
  lenderSignatureId: z.string().uuid(),
  preimageHex: z.string().min(1) // Preimage provided by lender
})

export type CreateSignatureInput = z.infer<typeof createSignatureSchema>
export type CompleteWitnessInput = z.infer<typeof completeWitnessSchema>

export class SignatureService {
  
  /**
   * Create and store a Bitcoin transaction signature
   * This implements the "borrower generates signature offline" part of our workflow
   */
  async createSignature(data: CreateSignatureInput) {
    const signature = await db.insert(signatures).values({
      loanId: data.loanId,
      signedBy: data.signedBy,
      signatureType: data.signatureType,
      signatureData: data.signatureData,
      transactionHex: data.transactionHex,
      inputAmount: data.inputAmount,
      scriptPath: data.scriptPath,
      leafIndex: data.leafIndex ?? null,
      tapleafScript: data.tapleafScript ?? null,
      controlBlock: data.controlBlock ?? null,
      witnessContext: data.witnessContext,
      status: 'pending',
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours default
    }).returning()

    return signature[0]
  }

  /**
   * Get signature by ID with loan and user context
   */
  async getSignature(signatureId: string) {
    const result = await db
      .select({
        signature: signatures,
        loan: loans,
        signer: users
      })
      .from(signatures)
      .leftJoin(loans, eq(signatures.loanId, loans.id))
      .leftJoin(users, eq(signatures.signedBy, users.id))
      .where(eq(signatures.id, signatureId))
      .limit(1)

    return result[0] || null
  }


  /**
   * Get all signatures for a loan (for compatibility)
   */
  async getSignaturesForLoan(loanId: string) {
    return await db
      .select()
      .from(signatures)
      .where(eq(signatures.loanId, loanId))
      .orderBy(signatures.createdAt)
  }

  /**
   * Export signature to JSON file (for compatibility)
   */
  async exportSignatureToFile(signatureId: string, outputDir: string = './signatures'): Promise<string> {
    const signatureData = await this.getSignature(signatureId)
    
    if (!signatureData) {
      throw new Error(`Signature ${signatureId} not found`)
    }

    const { signature } = signatureData

    // Create the signature export data
    const exportData = {
      signatureId: signature.id,
      loanId: signature.loanId,
      signatureType: signature.signatureType,
      sig_borrower: signature.signatureData,
      txid: this.extractTxidFromHex(signature.transactionHex),
      vout: 0,
      tx_hex: signature.transactionHex,
      input_amount: parseFloat(signature.inputAmount),
      leaf_index: signature.leafIndex,
      tapleaf_script_hex: signature.tapleafScript,
      control_block_hex: signature.controlBlock,
      witness_context: signature.witnessContext,
      created_at: signature.createdAt,
      expires_at: signature.expiresAt,
    }

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true })

    // Create filename based on signature ID and type
    const filename = `${signature.signatureType}_signature_${signature.id.slice(0, 8)}.json`
    const filepath = path.join(outputDir, filename)

    // Write to file
    await fs.writeFile(filepath, JSON.stringify(exportData, null, 2))

    // Update signature status
    await db
      .update(signatures)
      .set({ 
        status: 'exported',
        updatedAt: new Date()
      })
      .where(eq(signatures.id, signatureId))

    return filepath
  }

  /**
   * Get signature statistics (for compatibility)
   */
  async getSignatureStats() {
    const stats = await db
      .select()
      .from(signatures)

    const statusCounts = stats.reduce((acc: Record<string, number>, sig: any) => {
      acc[sig.status] = (acc[sig.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const typeCounts = stats.reduce((acc, sig) => {
      acc[sig.signatureType] = (acc[sig.signatureType] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      total: stats.length,
      byStatus: statusCounts,
      byType: typeCounts,
      recentSignatures: stats.slice(-10)
    }
  }

  /**
   * Import signature from JSON file
   * This would be used when receiving a signature from another party
   */
  async importSignatureFromFile(filepath: string): Promise<string> {
    const fileContent = await fs.readFile(filepath, 'utf8')
    const signatureData = JSON.parse(fileContent)

    // Validate the imported data
    const importedSignature = await this.createSignature({
      loanId: signatureData.loanId,
      signedBy: signatureData.signedBy || signatureData.signatureId, // Handle different formats
      signatureType: signatureData.signatureType,
      signatureData: signatureData.sig_borrower || signatureData.signature,
      transactionHex: signatureData.tx_hex,
      inputAmount: signatureData.input_amount.toString(),
      scriptPath: true,
      leafIndex: signatureData.leaf_index,
      tapleafScript: signatureData.tapleaf_script_hex,
      controlBlock: signatureData.control_block_hex,
      witnessContext: signatureData.witness_context
    })

    return importedSignature.id
  }

  /**
   * Complete witness by combining borrower and lender signatures
   * This implements the "lender completes witness" part of our workflow
   */
  async completeWitness(data: CompleteWitnessInput) {
    // Get both signatures
    const borrowerSig = await this.getSignature(data.borrowerSignatureId)
    const lenderSig = await this.getSignature(data.lenderSignatureId)

    if (!borrowerSig || !lenderSig) {
      throw new Error('One or both signatures not found')
    }

    if (borrowerSig.loan?.id !== lenderSig.loan?.id) {
      throw new Error('Signatures must be for the same loan')
    }

    // Construct the complete witness data
    const witnessData = {
      borrowerSignature: borrowerSig.signature.signatureData,
      lenderSignature: lenderSig.signature.signatureData,
      preimageHex: data.preimageHex, // Borrower reveals their preimage on the EVM chain, when accepting a loan.
      tapleafScript: borrowerSig.signature.tapleafScript,
      controlBlock: borrowerSig.signature.controlBlock,
      transactionHex: borrowerSig.signature.transactionHex,
      inputAmount: borrowerSig.signature.inputAmount
    }

    // Mark signatures as used
    await Promise.all([
      db.update(signatures)
        .set({ 
          status: 'used', 
          usedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(signatures.id, data.borrowerSignatureId)),
      
      db.update(signatures)
        .set({ 
          status: 'used', 
          usedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(signatures.id, data.lenderSignatureId))
    ])

    return {
      witnessData,
      loanId: borrowerSig.loan?.id,
      readyForBroadcast: true
    }
  }

  /**
   * Mark signature as expired
   */
  async expireSignature(signatureId: string) {
    await db
      .update(signatures)
      .set({ 
        status: 'expired',
        updatedAt: new Date()
      })
      .where(eq(signatures.id, signatureId))
  }

  /**
   * Clean up expired signatures
   */
  async cleanupExpiredSignatures() {
    const expiredCount = await db
      .update(signatures)
      .set({ status: 'expired' })
      .where(and(
        eq(signatures.status, 'pending'),
        // @ts-ignore - SQL comparison works here
        signatures.expiresAt < new Date()
      ))

    return expiredCount
  }

  /**
   * Utility: Extract transaction ID from raw transaction hex
   */
  private extractTxidFromHex(txHex: string): string {
    // This is a placeholder - in reality you'd use a Bitcoin library to parse the transaction
    // For now, we'll generate a mock txid based on the hex
    const crypto = require('crypto')
    return crypto.createHash('sha256').update(txHex).digest('hex')
  }

}
