/**
 * Bitcoin Signature Management API
 * 
 * This API handles the file-based signature workflow where borrowers
 * generate signatures locally and upload them to the backend.
 */

import { Router } from 'express'
import databaseService from '../services/databaseService'
import { borrowerSignatures } from '../db/schema'
import { eq, sql } from 'drizzle-orm'

const router = Router()

// Utility functions for loan ID conversion
const stringToBigInt = (str: string | null): bigint | null => {
  return str ? BigInt(str) : null
}

const bigIntToString = (bigInt: bigint | null): string | null => {
  return bigInt ? bigInt.toString() : null
}

// Set preimage for a loan (for testing purposes)
router.post('/loan/:loanId/preimage', async (req, res) => {
  try {
    const { loanId } = req.params
    const { preimage } = req.body

    if (!preimage) {
      return res.status(400).json({ success: false, error: 'Preimage is required' })
    }

    const db = databaseService.getDatabase()
    const { loans } = await import('../db/schema')
    
    // Update loan with preimage
    const result = await db.update(loans)
      .set({ preimageBorrower: preimage })
      .where(eq(loans.loanReqId, loanId))
      .returning({ id: loans.id, loanReqId: loans.loanReqId, preimageBorrower: loans.preimageBorrower })

    if (result.length === 0) {
      return res.status(404).json({ success: false, error: 'Loan not found' })
    }

    return res.json({ 
      success: true, 
      message: 'Preimage set successfully',
      data: result[0]
    })
  } catch (error) {
    console.error('Failed to set preimage:', error)
    return res.status(500).json({ success: false, error: 'Failed to set preimage', details: error instanceof Error ? error.message : String(error) })
  }
})

// Get preimage for a loan
router.get('/loan/:loanId/preimage', async (req, res) => {
  try {
    const { loanId } = req.params
    const db = databaseService.getDatabase()
    const { loans } = await import('../db/schema')
    
    const result = await db.select({ preimageBorrower: loans.preimageBorrower })
      .from(loans)
      .where(eq(loans.loanReqId, loanId))
      .limit(1)

    if (result.length === 0) {
      return res.status(404).json({ success: false, error: 'Loan not found' })
    }

    return res.json({ 
      success: true, 
      preimage: result[0].preimageBorrower,
      message: result[0].preimageBorrower ? 'Preimage found' : 'No preimage set yet'
    })
  } catch (error) {
    console.error('Failed to get preimage:', error)
    return res.status(500).json({ success: false, error: 'Failed to get preimage', details: error instanceof Error ? error.message : String(error) })
  }
})

// Test route to verify router is working
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Bitcoin signatures router is working' })
})

// Simple database test
router.get('/db-test', async (req, res) => {
  try {
    const db = databaseService.getDatabase()
    const result = await db.select({ test: sql`1` })
    res.json({ 
      success: true, 
      message: 'Database connection works!', 
      result: result[0] 
    })
  } catch (error) {
    console.error('Database test failed:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Database test failed',
      details: error instanceof Error ? error.message : String(error)
    })
  }
})

// Debug route to see stored signatures from database
router.get('/debug', async (req, res) => {
  try {
    const db = databaseService.getDatabase()
    const result = await db.select({
      id: borrowerSignatures.id,
      loanId: borrowerSignatures.loanId,
      createdAt: borrowerSignatures.createdAt
    }).from(borrowerSignatures).orderBy(borrowerSignatures.createdAt)
    
    res.json({ 
      success: true, 
      count: result.length, 
      signatures: result 
    })
  } catch (error) {
    console.error('Debug query failed:', error)
    res.status(500).json({ success: false, error: 'Failed to query signatures' })
  }
})

// Debug route to see loans table
router.get('/loans-debug', async (req, res) => {
  try {
    const db = databaseService.getDatabase()
    const { loans } = await import('../db/schema')
    
    // Get all loan data - no BigInt issues with varchar storage
    const result = await db.select().from(loans).orderBy(loans.createdAt)
    
    return res.json({ 
      success: true, 
      count: result.length, 
      loans: result,
      message: "Full loan data retrieved (varchar storage, no BigInt issues)"
    })
  } catch (error) {
    console.error('Loans debug query failed:', error)
    return res.status(500).json({ success: false, error: 'Failed to query loans', details: error instanceof Error ? error.message : String(error) })
  }
})


/**
 * Save borrower signature data from frontend
 */
router.post('/save', async (req, res) => {
  try {
    const { 
      loanId, 
      signatureData, 
      borrowerAddress,
      transactionType = 'collateral'
    } = req.body

    if (!loanId || !signatureData || !borrowerAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: loanId, signatureData, borrowerAddress'
      })
    }

    // Parse the signature data
    let parsedSignature
    try {
      parsedSignature = typeof signatureData === 'string' 
        ? JSON.parse(signatureData) 
        : signatureData
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid signature data format'
      })
    }

    // Validate required signature fields
    const requiredFields = ['sig_borrower', 'txid', 'tx_hex', 'input_amount']
    for (const field of requiredFields) {
      if (parsedSignature[field] === undefined || parsedSignature[field] === null) {
        return res.status(400).json({
          success: false,
          error: `Missing required signature field: ${field}`
        })
      }
    }
    
    // Validate vout separately since it can be 0
    if (parsedSignature.vout === undefined || parsedSignature.vout === null) {
      return res.status(400).json({
        success: false,
        error: 'Missing required signature field: vout'
      })
    }

    // Try database storage first, fallback to in-memory
    let signatureRecord: any = null
    
    try {
      const db = databaseService.getDatabase()
      
      // Insert signature into database using Drizzle ORM
      const signatureQuery = await db.insert(borrowerSignatures).values({
        loanId: loanId,
        signatureData: parsedSignature
      }).returning({ id: borrowerSignatures.id })
      
      signatureRecord = { id: signatureQuery[0].id }
      console.log('✅ Signature saved to database:', signatureRecord.id)
      
    } catch (dbError) {
      console.error('❌ Database save failed:', dbError)
      return res.status(500).json({
        success: false,
        error: 'Failed to save signature to database'
      })
    }

    return res.json({
      success: true,
      data: {
        signatureId: signatureRecord.id,
        loanId,
        transactionType,
        signatureData: parsedSignature,
        message: 'Signature saved successfully'
      }
    })

  } catch (error) {
    console.error('Error saving signature:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to save signature'
    })
  }
})

/**
 * Get borrower signature for a loan (for lenders)
 */
router.get('/loan/:loanId/borrower', async (req, res) => {
  try {
    const { loanId } = req.params

    // Try database query first, fallback to in-memory
    let signature = null
    
    try {
      const db = databaseService.getDatabase()
      
      // Query database for borrower signature using Drizzle ORM
      const dbSignature = await db.select().from(borrowerSignatures)
        .where(eq(borrowerSignatures.loanId, loanId))
        .limit(1)
      
      if (dbSignature.length > 0) {
        signature = dbSignature[0]
        console.log('✅ Signature found in database:', signature.id)
      }
    } catch (dbError) {
      console.error('❌ Database query failed:', dbError)
      return res.status(500).json({
        success: false,
        error: 'Failed to query database'
      })
    }
    
    if (!signature) {
      return res.json({
        success: true,
        data: null,
        message: 'No borrower signature found for this loan'
      })
    }

    // Return the signature data directly from the database
    const signatureData = signature.signatureData

    return res.json({
      success: true,
      data: signatureData,
      message: 'Borrower signature found'
    })

  } catch (error) {
    console.error('Error fetching borrower signature:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch borrower signature'
    })
  }
})

/**
 * Get signatures for a loan
 */
router.get('/loan/:loanId', async (req, res) => {
  try {
    const { loanId } = req.params

    // TODO: Implement actual database query using Drizzle ORM
    // For now, return empty array
    return res.json({
      success: true,
      data: {
        signatures: [],
        loanId,
        message: 'No signatures found for this loan'
      }
    })

  } catch (error) {
    console.error('Error fetching signatures:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch signatures'
    })
  }
})

/**
 * Get signature statistics
 */
router.get('/stats', async (req, res) => {
  try {
    return res.json({
      success: true,
      data: {
        total: 0,
        pending: 0,
        used: 0,
        expired: 0,
        byType: {},
        recentSignatures: []
      }
    })

  } catch (error) {
    console.error('Error fetching signature stats:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch signature statistics'
    })
  }
})

export default router