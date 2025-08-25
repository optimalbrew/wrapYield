import { Router } from 'express'
import { SignatureService } from '../services/signatureService'
import { BitcoinTransactionService } from '../services/bitcoinTransactionService'
import { createSignatureSchema, completeWitnessSchema } from '../services/signatureService'
import { signTransactionSchema } from '../services/bitcoinTransactionService'
import { z } from 'zod'

const router = Router()
const signatureService = new SignatureService()
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
 * POST /api/signatures
 * Create a new Bitcoin transaction signature
 * 
 * This endpoint implements the "borrower generates signature offline" workflow
 */
router.post('/', validate(createSignatureSchema), async (req, res) => {
  try {
    const signature = await signatureService.createSignature(req.validatedData)
    
    res.status(201).json({
      success: true,
      data: {
        signatureId: signature.id,
        loanId: signature.loanId,
        signatureType: signature.signatureType,
        status: signature.status,
        expiresAt: signature.expiresAt,
        createdAt: signature.createdAt
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create signature',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
})

/**
 * GET /api/signatures/:id
 * Get signature details
 */
router.get('/:id', async (req, res) => {
  try {
    const signature = await signatureService.getSignature(req.params.id)
    
    if (!signature) {
      return res.status(404).json({
        success: false,
        error: 'Signature not found'
      })
    }

    return res.json({
      success: true,
      data: signature
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to get signature',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
})

/**
 * GET /api/signatures/loan/:loanId
 * Get all signatures for a loan
 */
router.get('/loan/:loanId', async (req, res) => {
  try {
    const signatures = await signatureService.getSignaturesForLoan(req.params.loanId)
    
    res.json({
      success: true,
      data: signatures
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get signatures for loan',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
})

/**
 * POST /api/signatures/:id/export
 * Export signature to JSON file
 * 
 * This creates a JSON file like our test workflow for transmission to other party
 */
router.post('/:id/export', async (req, res) => {
  try {
    const outputDir = req.body.outputDir || './signatures'
    const filepath = await signatureService.exportSignatureToFile(req.params.id, outputDir)
    
    res.json({
      success: true,
      data: {
        signatureId: req.params.id,
        filepath: filepath,
        message: 'Signature exported successfully'
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to export signature',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
})

/**
 * POST /api/signatures/import
 * Import signature from JSON file
 */
const importSignatureSchema = z.object({
  filepath: z.string().min(1)
})

router.post('/import', validate(importSignatureSchema), async (req, res) => {
  try {
    const signatureId = await signatureService.importSignatureFromFile(req.validatedData.filepath)
    
    res.status(201).json({
      success: true,
      data: {
        signatureId: signatureId,
        message: 'Signature imported successfully'
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to import signature',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
})

/**
 * POST /api/signatures/complete-witness
 * Complete witness by combining borrower and lender signatures
 * 
 * This implements the "lender completes witness" part of our workflow
 */
router.post('/complete-witness', validate(completeWitnessSchema), async (req, res) => {
  try {
    const result = await signatureService.completeWitness(req.validatedData)
    
    res.json({
      success: true,
      data: {
        loanId: result.loanId,
        witnessData: result.witnessData,
        readyForBroadcast: result.readyForBroadcast,
        message: 'Witness completed successfully'
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to complete witness',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
})

/**
 * POST /api/signatures/transaction/:transactionId/sign
 * Sign a Bitcoin transaction and store the signature
 */
router.post('/transaction/:transactionId/sign', validate(signTransactionSchema.omit({ transactionId: true })), async (req, res) => {
  try {
    const result = await bitcoinService.signTransaction({
      transactionId: req.params.transactionId,
      ...req.validatedData
    })
    
    res.status(201).json({
      success: true,
      data: {
        signatureId: result.signatureId,
        transactionId: req.params.transactionId,
        canExport: result.canExport,
        message: 'Transaction signed successfully'
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to sign transaction',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
})

/**
 * DELETE /api/signatures/:id
 * Mark signature as expired/cancelled
 */
router.delete('/:id', async (req, res) => {
  try {
    await signatureService.expireSignature(req.params.id)
    
    res.json({
      success: true,
      message: 'Signature marked as expired'
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to expire signature',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
})

/**
 * GET /api/signatures/stats
 * Get signature statistics for monitoring
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await signatureService.getSignatureStats()
    
    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get signature stats',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
})

export default router
