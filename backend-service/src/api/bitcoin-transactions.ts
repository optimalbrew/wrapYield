import { Router } from 'express'
import { BitcoinTransactionService } from '../services/bitcoinTransactionService'
import { 
  createEscrowTransactionSchema, 
  createCollateralTransactionSchema 
} from '../services/bitcoinTransactionService'
import { z } from 'zod'

const router = Router()
const bitcoinService = new BitcoinTransactionService()

// Validation middleware
const validate = (schema: z.ZodSchema) => (req: any, res: any, next: any) => {
  try {
    req.validatedData = schema.parse(req.body)
    next()
  } catch (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error instanceof Error ? error.message : 'Unknown validation error'
    })
  }
}

/**
 * POST /api/bitcoin-transactions/escrow
 * Create Bitcoin escrow transaction
 * 
 * This creates the initial escrow transaction where borrower deposits Bitcoin collateral
 */
router.post('/escrow', validate(createEscrowTransactionSchema), async (req, res) => {
  try {
    const result = await bitcoinService.createEscrowTransaction(req.validatedData)
    
    res.status(201).json({
      success: true,
      data: {
        transactionId: result.transactionId,
        escrowAddress: result.escrowAddress,
        rawTransaction: result.rawTransaction,
        readyForSigning: result.readyForSigning,
        message: 'Escrow transaction created successfully'
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create escrow transaction',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
})

/**
 * POST /api/bitcoin-transactions/collateral
 * Create Bitcoin collateral transaction
 * 
 * This creates the transaction that moves funds from escrow to collateral lock
 */
router.post('/collateral', validate(createCollateralTransactionSchema), async (req, res) => {
  try {
    const result = await bitcoinService.createCollateralTransaction(req.validatedData)
    
    res.status(201).json({
      success: true,
      data: {
        transactionId: result.transactionId,
        collateralAddress: result.collateralAddress,
        rawTransaction: result.rawTransaction,
        readyForSigning: result.readyForSigning,
        message: 'Collateral transaction created successfully'
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create collateral transaction',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
})

/**
 * POST /api/bitcoin-transactions/:id/broadcast
 * Broadcast completed transaction to Bitcoin network
 */
const broadcastSchema = z.object({
  witnessData: z.object({
    borrowerSignature: z.string(),
    lenderSignature: z.string(),
    preimageHex: z.string(),
    tapleafScript: z.string(),
    controlBlock: z.string()
  })
})

router.post('/:id/broadcast', validate(broadcastSchema), async (req, res) => {
  try {
    const result = await bitcoinService.broadcastTransaction(
      req.params.id,
      req.validatedData.witnessData
    )
    
    res.json({
      success: true,
      data: {
        transactionId: req.params.id,
        txid: result.txid,
        status: result.status,
        message: 'Transaction broadcast successfully'
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to broadcast transaction',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
})

/**
 * GET /api/bitcoin-transactions/:id
 * Get Bitcoin transaction details with signatures
 */
router.get('/:id', async (req, res) => {
  try {
    const transaction = await bitcoinService.getTransaction(req.params.id)
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      })
    }

    return res.json({
      success: true,
      data: transaction
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to get transaction',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
})

/**
 * GET /api/bitcoin-transactions/loan/:loanId
 * Get all Bitcoin transactions for a loan
 */
router.get('/loan/:loanId', async (req, res) => {
  try {
    const { db } = await import('../db/connection')
    const { bitcoinTransactions } = await import('../db/schema')
    const { eq } = await import('drizzle-orm')
    
    const transactions = await db
      .select()
      .from(bitcoinTransactions)
      .where(eq(bitcoinTransactions.loanId, req.params.loanId))
      .orderBy(bitcoinTransactions.createdAt)
    
    res.json({
      success: true,
      data: transactions
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get transactions for loan',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
})

/**
 * POST /api/bitcoin-transactions/workflow/escrow-to-collateral
 * Complete workflow: Create escrow transaction and prepare for collateral
 * 
 * This is a convenience endpoint that combines multiple steps
 */
const escrowToCollateralWorkflowSchema = z.object({
  // Loan details
  loanId: z.string().uuid(),
  
  // Participants
  borrowerPubkey: z.string().length(64),
  lenderPubkey: z.string().length(64),
  
  // Preimage hashes
  preimageHashBorrower: z.string().length(64),
  preimageHashLender: z.string().length(64),
  
  // Timelocks
  borrowerTimelock: z.number(),
  lenderTimelock: z.number(),
  
  // Amounts
  escrowAmount: z.string(),
  collateralAmount: z.string(),
  
  // Optional
  originationFee: z.string().optional()
})

router.post('/workflow/escrow-to-collateral', validate(escrowToCollateralWorkflowSchema), async (req, res) => {
  try {
    const data = req.validatedData

    // Step 1: Create escrow transaction
    const escrowResult = await bitcoinService.createEscrowTransaction({
      loanId: data.loanId,
      borrowerPubkey: data.borrowerPubkey,
      lenderPubkey: data.lenderPubkey,
      preimageHashBorrower: data.preimageHashBorrower,
      borrowerTimelock: data.borrowerTimelock,
      amount: data.escrowAmount,
      originationFee: data.originationFee
    })

    // For now, we'll return the escrow transaction details
    // In a real implementation, you might want to wait for escrow funding before creating collateral
    
    res.status(201).json({
      success: true,
      data: {
        workflow: 'escrow-to-collateral',
        step: 'escrow-created',
        escrowTransaction: {
          transactionId: escrowResult.transactionId,
          escrowAddress: escrowResult.escrowAddress,
          readyForSigning: escrowResult.readyForSigning
        },
        nextStep: {
          action: 'fund-escrow-and-sign',
          description: 'Borrower needs to fund the escrow address and create signature'
        }
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to execute escrow-to-collateral workflow',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
})

/**
 * GET /api/bitcoin-transactions/stats
 * Get Bitcoin transaction statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const { db } = await import('../db/connection')
    const { bitcoinTransactions } = await import('../db/schema')
    
    const transactions = await db
      .select()
      .from(bitcoinTransactions)
    
    const stats = {
      total: transactions.length,
      byType: transactions.reduce((acc: Record<string, number>, tx: any) => {
        acc[tx.type] = (acc[tx.type] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      byStatus: transactions.reduce((acc: Record<string, number>, tx: any) => {
        acc[tx.status] = (acc[tx.status] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      recentTransactions: transactions.slice(-10)
    }
    
    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get Bitcoin transaction stats',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
})

export default router
