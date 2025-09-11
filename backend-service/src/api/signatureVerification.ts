import { Router } from 'express'

const router = Router()

// Types matching the frontend
interface SignatureData {
  sig_borrower: string;
  tx_hex: string;
  input_amount: number;
  escrow_address_script: string;
  tapleaf_script_hex: string;
  escrow_is_odd: boolean;
  [key: string]: any; // Allow additional properties
}

interface VerificationRequest {
  signature_data: SignatureData;
  borrower_pubkey: string;
}

interface VerificationResponse {
  success: boolean;
  data: {
    is_valid: boolean;
    borrower_pubkey: string;
    message: string;
  };
  error: string | null;
  message: string;
}

/**
 * Verify a borrower's signature by proxying to Python API
 * POST /api/signature-verification/verify
 */
router.post('/verify', async (req, res) => {
  try {
    const { signatureData, borrowerPubkey }: { signatureData: SignatureData; borrowerPubkey: string } = req.body

    // Validate input
    if (!signatureData || !borrowerPubkey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'signatureData and borrowerPubkey are required'
      })
    }

    // Validate BTC public key format (64 characters)
    if (borrowerPubkey.length !== 64) {
      return res.status(400).json({
        success: false,
        error: 'Invalid BTC public key',
        message: 'BTC public key must be exactly 64 characters'
      })
    }

    // Get Python API URL from environment
    const pythonApiUrl = process.env.PYTHON_API_URL || 'http://python-api:8001'
    
    // Prepare request for Python API
    const verificationRequest: VerificationRequest = {
      signature_data: signatureData,
      borrower_pubkey: borrowerPubkey
    }

    try {
      // Call Python API
      const pythonResponse = await fetch(`${pythonApiUrl}/transactions/verify-signature`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(verificationRequest),
      })

      if (!pythonResponse.ok) {
        throw new Error(`Python API error: ${pythonResponse.status}`)
      }

      const result = await pythonResponse.json() as VerificationResponse
      
      // Return the result directly to the frontend
      return res.json(result)

    } catch (pythonError) {
      console.error('Python API error:', pythonError)
      return res.status(500).json({
        success: false,
        error: 'Failed to verify signature',
        message: 'Could not connect to Python API for signature verification',
        details: pythonError instanceof Error ? pythonError.message : 'Unknown error'
      })
    }

  } catch (error) {
    console.error('Error verifying signature:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to verify signature',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
})

/**
 * Generate a borrower signature by proxying to Python API
 * POST /api/signature-verification/generate
 */
router.post('/generate', async (req, res) => {
  try {
    const { loanData }: { loanData: any } = req.body

    // Validate input
    if (!loanData) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'loanData is required'
      })
    }

    // Get Python API URL from environment
    const pythonApiUrl = process.env.PYTHON_API_URL || 'http://python-api:8001'

    try {
      // Call Python API
      const pythonResponse = await fetch(`${pythonApiUrl}/transactions/borrower-signature`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loanData),
      })

      if (!pythonResponse.ok) {
        throw new Error(`Python API error: ${pythonResponse.status}`)
      }

      const result = await pythonResponse.json()
      
      // Return the result directly to the frontend
      return res.json(result)

    } catch (pythonError) {
      console.error('Python API error:', pythonError)
      return res.status(500).json({
        success: false,
        error: 'Failed to generate signature',
        message: 'Could not connect to Python API for signature generation',
        details: pythonError instanceof Error ? pythonError.message : 'Unknown error'
      })
    }

  } catch (error) {
    console.error('Error generating signature:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to generate signature',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
})

/**
 * Complete witness by proxying to Python API
 * POST /api/signature-verification/complete-witness
 */
router.post('/complete-witness', async (req, res) => {
  try {
    const { 
      loanId, 
      borrowerSignature, 
      borrowerPreimage 
    }: { 
      loanId: string; 
      borrowerSignature: any; 
      borrowerPreimage: string; 
    } = req.body

    // Validate input
    if (!loanId || !borrowerSignature || !borrowerPreimage) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'loanId, borrowerSignature, and borrowerPreimage are required'
      })
    }

    // Get Python API URL from environment
    const pythonApiUrl = process.env.PYTHON_API_URL || 'http://python-api:8001'

    // Create temporary file for borrower signature data
    // Note: We use a file-based approach here because the Python API expects a file path.
    // In the future, when we shift to PSBTs (Partially Signed Bitcoin Transactions), 
    // having a file path will be useful for handling larger transaction data and 
    // potentially sharing PSBT files between services.
    const signatureFileName = `borrower_signature_${loanId}_${Date.now()}.json`
    const signatureFilePath = `/tmp/${signatureFileName}`
    
    // Write signature data to temporary file
    const fs = require('fs')
    const path = require('path')
    
    // Ensure /tmp directory exists
    const tmpDir = '/tmp'
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true })
    }
    
    fs.writeFileSync(signatureFilePath, JSON.stringify(borrowerSignature, null, 2))

    // Prepare request for Python API
    // Note: We pass the lender private key from environment variable
    // In production, this should be loaded from a secure key management system
    const completeWitnessRequest = {
      signature_file_path: signatureFilePath,
      lender_private_key: process.env.LENDER_PRIVATE_KEY || '', // Get from environment
      preimage: borrowerPreimage,
      mine_block: true
    }

    // Retry configuration
    const maxRetries = 3
    const retryDelay = 1000 // 1 second
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${maxRetries} - Calling Python API for complete-witness`)
        
        // Call Python API
        const pythonResponse = await fetch(`${pythonApiUrl}/transactions/complete-witness`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(completeWitnessRequest),
        })

        if (!pythonResponse.ok) {
          throw new Error(`Python API error: ${pythonResponse.status}`)
        }

        const result = await pythonResponse.json()
        
        // Clean up temporary file on success
        try {
          fs.unlinkSync(signatureFilePath)
        } catch (cleanupError) {
          console.warn('Failed to clean up temporary signature file:', cleanupError)
        }
        
        console.log(`✅ Complete-witness successful on attempt ${attempt}`)
        // Return the result directly to the frontend
        return res.json(result)

      } catch (pythonError) {
        lastError = pythonError instanceof Error ? pythonError : new Error('Unknown error')
        console.error(`❌ Attempt ${attempt}/${maxRetries} failed:`, lastError.message)
        
        // If this is the last attempt, don't wait
        if (attempt < maxRetries) {
          console.log(`⏳ Waiting ${retryDelay}ms before retry...`)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
        }
      }
    }

    // All retries failed - clean up and return error
    try {
      fs.unlinkSync(signatureFilePath)
    } catch (cleanupError) {
      console.warn('Failed to clean up temporary signature file:', cleanupError)
    }

    console.error(`❌ All ${maxRetries} attempts failed for complete-witness`)
    return res.status(500).json({
      success: false,
      error: 'Failed to complete witness',
      message: `Could not connect to Python API for witness completion after ${maxRetries} attempts`,
      details: lastError?.message || 'Unknown error'
    })

  } catch (error) {
    console.error('Error completing witness:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to complete witness',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
})

export default router
