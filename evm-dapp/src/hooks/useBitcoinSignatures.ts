/**
 * Bitcoin Signature Management Hook
 * 
 * This hook handles the file-based signature workflow where:
 * 1. Borrower generates signature locally using Python API
 * 2. Borrower uploads signature JSON file to frontend
 * 3. Frontend sends signature to backend for coordination
 * 4. Lender completes witness using backend Python API
 */

import { useState, useCallback } from 'react'

// Signature file interface
export interface SignatureFile {
  file: File
  data: BorrowerSignatureData
  loanId: string
  transactionType: 'escrow' | 'collateral'
}

// Borrower signature data (from JSON file)
export interface BorrowerSignatureData {
  sig_borrower: string
  txid: string
  vout: number
  tx_hex: string
  input_amount: number
  leaf_index: number
  escrow_address_script: string
  tapleaf_script_hex: string
  escrow_is_odd: boolean
}

// Signature upload status
export interface SignatureUploadStatus {
  loanId: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
  signatureId?: string
}

export function useBitcoinSignatures() {
  const [uploadStatuses, setUploadStatuses] = useState<Map<string, SignatureUploadStatus>>(new Map())
  const [isUploading, setIsUploading] = useState(false)

  // Parse signature JSON file
  const parseSignatureFile = useCallback(async (file: File): Promise<BorrowerSignatureData> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string
          const data = JSON.parse(content) as BorrowerSignatureData
          
          // Validate required fields
          if (!data.sig_borrower || !data.txid || !data.tx_hex) {
            throw new Error('Invalid signature file format')
          }
          
          resolve(data)
        } catch (error) {
          reject(new Error(`Failed to parse signature file: ${error.message}`))
        }
      }
      
      reader.onerror = () => {
        reject(new Error('Failed to read signature file'))
      }
      
      reader.readAsText(file)
    })
  }, [])

  // Upload signature to backend
  const uploadSignature = useCallback(async (
    loanId: string,
    signatureFile: File,
    transactionType: 'escrow' | 'collateral'
  ): Promise<string> => {
    setIsUploading(true)
    
    // Update status to uploading
    setUploadStatuses(prev => new Map(prev).set(loanId, {
      loanId,
      status: 'uploading'
    }))

    try {
      // Parse the signature file
      const signatureData = await parseSignatureFile(signatureFile)
      
      // Create FormData for file upload
      const formData = new FormData()
      formData.append('signatureFile', signatureFile)
      formData.append('loanId', loanId)
      formData.append('transactionType', transactionType)
      formData.append('signatureData', JSON.stringify(signatureData))

      // Upload to backend
      const response = await fetch('/api/bitcoin/signatures/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to upload signature')
      }

      const result = await response.json()
      
      // Update status to success
      setUploadStatuses(prev => new Map(prev).set(loanId, {
        loanId,
        status: 'success',
        signatureId: result.signatureId
      }))

      return result.signatureId

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      
      // Update status to error
      setUploadStatuses(prev => new Map(prev).set(loanId, {
        loanId,
        status: 'error',
        error: errorMessage
      }))

      throw error
    } finally {
      setIsUploading(false)
    }
  }, [parseSignatureFile])

  // Get signature status for a loan
  const getSignatureStatus = useCallback((loanId: string): SignatureUploadStatus | undefined => {
    return uploadStatuses.get(loanId)
  }, [uploadStatuses])

  // Clear signature status
  const clearSignatureStatus = useCallback((loanId: string) => {
    setUploadStatuses(prev => {
      const newMap = new Map(prev)
      newMap.delete(loanId)
      return newMap
    })
  }, [])

  // Download signature template (for borrower to use with local Python API)
  const downloadSignatureTemplate = useCallback((loanId: string, transactionType: 'escrow' | 'collateral') => {
    const template = {
      loan_id: loanId,
      transaction_type: transactionType,
      instructions: {
        step_1: "Run your local Python API with your private key",
        step_2: `Use the /transactions/borrower-signature endpoint`,
        step_3: "Save the generated signature JSON file",
        step_4: "Upload the file using this interface"
      },
      python_api_command: `curl -X POST http://localhost:8001/transactions/borrower-signature \\
  -H "Content-Type: application/json" \\
  -d '{
    "loan_id": "${loanId}",
    "escrow_txid": "YOUR_ESCROW_TXID",
    "borrower_pubkey": "YOUR_PUBKEY",
    "lender_pubkey": "LENDER_PUBKEY",
    "preimage_hash_borrower": "YOUR_PREIMAGE_HASH",
    "borrower_timelock": 144,
    "collateral_amount": "0.001",
    "borrower_private_key": "YOUR_PRIVATE_KEY_WIF"
  }'`
    }

    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `signature-template-${loanId}-${transactionType}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  return {
    // State
    uploadStatuses: Array.from(uploadStatuses.values()),
    isUploading,
    
    // Actions
    uploadSignature,
    parseSignatureFile,
    getSignatureStatus,
    clearSignatureStatus,
    downloadSignatureTemplate
  }
}
