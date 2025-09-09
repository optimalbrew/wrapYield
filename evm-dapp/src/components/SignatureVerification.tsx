'use client'

import { useState, useEffect } from 'react'
import { verifyBorrowerSignature, SignatureData, VerificationResponse } from '@/utils/signatureVerification'

interface SignatureVerificationProps {
  signatureData?: SignatureData
  borrowerPubkey?: string
  onVerificationResult?: (isValid: boolean, result: VerificationResponse) => void
  className?: string
}

export default function SignatureVerification({
  signatureData,
  borrowerPubkey,
  onVerificationResult,
  className = ''
}: SignatureVerificationProps) {
  const [isVerifying, setIsVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState<VerificationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [localSignatureData, setLocalSignatureData] = useState<SignatureData | undefined>(signatureData)
  const [localBorrowerPubkey, setLocalBorrowerPubkey] = useState<string>(borrowerPubkey || '')

  // Sync local state with props when they change
  useEffect(() => {
    setLocalSignatureData(signatureData)
  }, [signatureData])

  useEffect(() => {
    setLocalBorrowerPubkey(borrowerPubkey || '')
  }, [borrowerPubkey])

  const handleVerify = async () => {
    if (!localSignatureData || !localBorrowerPubkey) {
      setError('Signature data and borrower public key are required')
      return
    }

    setIsVerifying(true)
    setError(null)
    setVerificationResult(null)

    try {
      const result = await verifyBorrowerSignature(localSignatureData, localBorrowerPubkey)
      setVerificationResult(result)
      onVerificationResult?.(result.data.is_valid, result)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      onVerificationResult?.(false, {
        success: false,
        data: {
          is_valid: false,
          borrower_pubkey: localBorrowerPubkey,
          message: errorMessage
        },
        error: errorMessage,
        message: 'Verification failed'
      })
    } finally {
      setIsVerifying(false)
    }
  }

  const getStatusColor = () => {
    if (isVerifying) return 'text-blue-600'
    if (verificationResult?.data.is_valid) return 'text-green-600'
    if (verificationResult && !verificationResult.data.is_valid) return 'text-red-600'
    return 'text-gray-600'
  }

  const getStatusIcon = () => {
    if (isVerifying) return '⏳'
    if (verificationResult?.data.is_valid) return '✅'
    if (verificationResult && !verificationResult.data.is_valid) return '❌'
    return '🔍'
  }

  return (
    <div className={`bg-white p-4 rounded-lg border ${className}`}>
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        {getStatusIcon()} Signature Verification
      </h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Borrower Public Key
          </label>
          <div className="mb-1 text-xs text-gray-500">
            💡 Use x-only pubkeys (64 characters, no 02/03 prefix)
          </div>
          <input
            type="text"
            value={localBorrowerPubkey}
            onChange={(e) => setLocalBorrowerPubkey(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md bg-white text-sm font-mono text-gray-900"
            placeholder="Enter 64-character x-only public key"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Signature Data
          </label>
          <textarea
            value={localSignatureData ? JSON.stringify(localSignatureData, null, 2) : ''}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value)
                setLocalSignatureData(parsed)
              } catch (err) {
                // Invalid JSON, but allow typing
              }
            }}
            rows={6}
            className="w-full p-2 border border-gray-300 rounded-md bg-white text-xs font-mono text-gray-900"
            placeholder="Paste your signature JSON data here..."
          />
        </div>

        <button
          onClick={handleVerify}
          disabled={isVerifying || !localSignatureData || !localBorrowerPubkey}
          className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
            isVerifying || !localSignatureData || !localBorrowerPubkey
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isVerifying ? 'Verifying...' : 'Verify Signature'}
        </button>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {verificationResult && (
          <div className={`p-3 rounded-md border ${
            verificationResult.data.is_valid 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{getStatusIcon()}</span>
              <span className={`font-medium ${
                verificationResult.data.is_valid ? 'text-green-800' : 'text-red-800'
              }`}>
                {verificationResult.data.message}
              </span>
            </div>
            <p className="text-sm text-gray-600">
              Verification completed at {new Date().toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
