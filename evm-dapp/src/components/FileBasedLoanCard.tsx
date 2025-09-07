/**
 * File-Based Loan Card Component
 * 
 * This component handles the file-based signature workflow where borrowers
 * generate signatures locally and upload them to the frontend.
 */

import React, { useState, useRef } from 'react'
import { useAccount, useWriteContract } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { BTC_COLLATERAL_LOAN_ABI, CONTRACTS } from '@/contracts'
import { useBitcoinSignatures } from '@/hooks/useBitcoinSignatures'

// Loan status types
type LoanStatus = 
  | 'requested'
  | 'offered' 
  | 'active'
  | 'repayment_in_progress'
  | 'repaid'
  | 'defaulted'
  | 'refunded_to_lender'
  | 'refunded_to_borrower'

// Cross-chain status
interface CrossChainStatus {
  evm: {
    status: LoanStatus
    transactionHash?: string
    blockNumber?: number
    confirmations: number
  }
  bitcoin: {
    escrow?: {
      status: 'pending' | 'broadcast' | 'confirmed'
      txid?: string
      confirmations: number
    }
    collateral?: {
      status: 'pending' | 'broadcast' | 'confirmed'
      txid?: string
      confirmations: number
    }
  }
  workflow: {
    currentStep: string
    status: 'pending' | 'in_progress' | 'completed' | 'failed'
    error?: string
  }
  signatures: {
    borrower?: {
      status: 'pending' | 'uploaded' | 'used'
      uploadedAt?: string
    }
    lender?: {
      status: 'pending' | 'completed'
      completedAt?: string
    }
  }
}

// Loan interface
interface Loan {
  id: string
  evmContractId: string
  borrowerAddress: string
  lenderAddress?: string
  amount: string
  collateralAmount?: string
  bondAmount?: string
  status: LoanStatus
  borrowerBtcPubkey: string
  lenderBtcPubkey?: string
  escrowAddress?: string
  collateralAddress?: string
  crossChainStatus: CrossChainStatus
  createdAt: string
  updatedAt: string
}

interface FileBasedLoanCardProps {
  loan: Loan
  userRole: 'borrower' | 'lender'
  onStatusUpdate: (loanId: string, status: CrossChainStatus) => void
}

export function FileBasedLoanCard({ loan, userRole, onStatusUpdate }: FileBasedLoanCardProps) {
  const { address } = useAccount()
  const { writeContract: writeEVMContract } = useWriteContract()
  const { uploadSignature, getSignatureStatus, downloadSignatureTemplate } = useBitcoinSignatures()
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [selectedTransactionType, setSelectedTransactionType] = useState<'escrow' | 'collateral'>('escrow')
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get signature status for this loan
  const signatureStatus = getSignatureStatus(loan.id)

  // Handle EVM contract interactions
  const handleEVMTransaction = async (functionName: any, args: readonly unknown[], value?: bigint) => {
    if (!address) {
      throw new Error('EVM wallet not connected')
    }

    setIsLoading(true)
    setError(null)

    try {
      await writeEVMContract({
        address: CONTRACTS.BTC_COLLATERAL_LOAN as `0x${string}`,
        abi: BTC_COLLATERAL_LOAN_ABI,
        functionName,
        args: args as any,
        value: value as any
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'EVM transaction failed'
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  // Handle signature file upload
  const handleSignatureUpload = async (file: File) => {
    if (!file) return

    setIsLoading(true)
    setError(null)

    try {
      await uploadSignature(loan.id, file, selectedTransactionType)
      setShowSignatureModal(false)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Signature upload failed'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle file input change
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleSignatureUpload(file)
    }
  }

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'confirmed':
      case 'repaid':
      case 'uploaded':
        return 'bg-green-100 text-green-800'
      case 'pending':
      case 'requested':
        return 'bg-yellow-100 text-yellow-800'
      case 'in_progress':
      case 'active':
        return 'bg-blue-100 text-blue-800'
      case 'failed':
      case 'defaulted':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Get available actions based on loan status and user role
  const getAvailableActions = () => {
    const actions = []

    if (userRole === 'borrower') {
      switch (loan.status) {
        case 'requested':
          if (loan.crossChainStatus.bitcoin.escrow?.status === 'pending') {
            actions.push({
              label: 'Generate & Upload Escrow Signature',
              action: () => {
                setSelectedTransactionType('escrow')
                setShowSignatureModal(true)
              },
              type: 'signature' as const
            })
          }
          break
        case 'offered':
          actions.push({
            label: 'Accept Loan Offer',
            action: () => handleEVMTransaction('acceptLoanOffer', [loan.evmContractId, '0x0']),
            type: 'evm' as const
          })
          if (loan.crossChainStatus.bitcoin.collateral?.status === 'pending') {
            actions.push({
              label: 'Generate & Upload Collateral Signature',
              action: () => {
                setSelectedTransactionType('collateral')
                setShowSignatureModal(true)
              },
              type: 'signature' as const
            })
          }
          break
        case 'active':
          actions.push({
            label: 'Initiate Repayment',
            action: () => handleEVMTransaction('attemptRepayment', [loan.evmContractId, '0x0']),
            type: 'evm' as const
          })
          break
      }
    } else if (userRole === 'lender') {
      switch (loan.status) {
        case 'requested':
          actions.push({
            label: 'Extend Loan Offer',
            action: () => handleEVMTransaction('extendLoanOffer', [loan.evmContractId]),
            type: 'evm' as const
          })
          break
        case 'repayment_in_progress':
          actions.push({
            label: 'Accept Repayment',
            action: () => handleEVMTransaction('acceptLoanRepayment', [loan.evmContractId, '0x0']),
            type: 'evm' as const
          })
          break
        case 'active':
          actions.push({
            label: 'Mark as Defaulted',
            action: () => handleEVMTransaction('markAsDefaulted', [loan.evmContractId]),
            type: 'evm' as const
          })
          break
      }
    }

    return actions
  }

  const availableActions = getAvailableActions()

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-4">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Loan #{loan.evmContractId}
          </h3>
          <p className="text-sm text-gray-600">
            Amount: {formatEther(BigInt(loan.amount))} rBTC
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(loan.status)}`}>
          {loan.status.replace('_', ' ').toUpperCase()}
        </div>
      </div>

      {/* Cross-Chain Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        {/* EVM Status */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">EVM Chain</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Status:</span>
              <span className={`text-sm px-2 py-1 rounded ${getStatusColor(loan.crossChainStatus.evm.status)}`}>
                {loan.crossChainStatus.evm.status}
              </span>
            </div>
            {loan.crossChainStatus.evm.transactionHash && (
              <div className="text-xs text-gray-500">
                TX: {loan.crossChainStatus.evm.transactionHash.slice(0, 10)}...
              </div>
            )}
            <div className="text-xs text-gray-500">
              Confirmations: {loan.crossChainStatus.evm.confirmations}
            </div>
          </div>
        </div>

        {/* Bitcoin Status */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Bitcoin Network</h4>
          <div className="space-y-2">
            {loan.crossChainStatus.bitcoin.escrow && (
              <div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Escrow:</span>
                  <span className={`text-sm px-2 py-1 rounded ${getStatusColor(loan.crossChainStatus.bitcoin.escrow.status)}`}>
                    {loan.crossChainStatus.bitcoin.escrow.status}
                  </span>
                </div>
                {loan.crossChainStatus.bitcoin.escrow.txid && (
                  <div className="text-xs text-gray-500">
                    TX: {loan.crossChainStatus.bitcoin.escrow.txid.slice(0, 10)}...
                  </div>
                )}
              </div>
            )}
            {loan.crossChainStatus.bitcoin.collateral && (
              <div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Collateral:</span>
                  <span className={`text-sm px-2 py-1 rounded ${getStatusColor(loan.crossChainStatus.bitcoin.collateral.status)}`}>
                    {loan.crossChainStatus.bitcoin.collateral.status}
                  </span>
                </div>
                {loan.crossChainStatus.bitcoin.collateral.txid && (
                  <div className="text-xs text-gray-500">
                    TX: {loan.crossChainStatus.bitcoin.collateral.txid.slice(0, 10)}...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Signature Status */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Signatures</h4>
          <div className="space-y-2">
            {loan.crossChainStatus.signatures.borrower && (
              <div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Borrower:</span>
                  <span className={`text-sm px-2 py-1 rounded ${getStatusColor(loan.crossChainStatus.signatures.borrower.status)}`}>
                    {loan.crossChainStatus.signatures.borrower.status}
                  </span>
                </div>
                {loan.crossChainStatus.signatures.borrower.uploadedAt && (
                  <div className="text-xs text-gray-500">
                    {new Date(loan.crossChainStatus.signatures.borrower.uploadedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            )}
            {loan.crossChainStatus.signatures.lender && (
              <div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Lender:</span>
                  <span className={`text-sm px-2 py-1 rounded ${getStatusColor(loan.crossChainStatus.signatures.lender.status)}`}>
                    {loan.crossChainStatus.signatures.lender.status}
                  </span>
                </div>
                {loan.crossChainStatus.signatures.lender.completedAt && (
                  <div className="text-xs text-gray-500">
                    {new Date(loan.crossChainStatus.signatures.lender.completedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Workflow Status */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Workflow</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Step:</span>
              <span className="text-sm text-gray-900">{loan.crossChainStatus.workflow.currentStep}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Status:</span>
              <span className={`text-sm px-2 py-1 rounded ${getStatusColor(loan.crossChainStatus.workflow.status)}`}>
                {loan.crossChainStatus.workflow.status}
              </span>
            </div>
            {loan.crossChainStatus.workflow.error && (
              <div className="text-xs text-red-600">
                Error: {loan.crossChainStatus.workflow.error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Signature Upload Modal */}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Upload Bitcoin Signature
              </h3>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-4">
                  To sign the {selectedTransactionType} transaction:
                </p>
                
                <div className="bg-blue-50 p-4 rounded-lg mb-4">
                  <h4 className="font-medium text-blue-900 mb-2">Steps:</h4>
                  <ol className="text-sm text-blue-800 space-y-1">
                    <li>1. Download the signature template</li>
                    <li>2. Run your local Python API with your private key</li>
                    <li>3. Generate the signature JSON file</li>
                    <li>4. Upload the file here</li>
                  </ol>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => downloadSignatureTemplate(loan.id, selectedTransactionType)}
                    className="w-full px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
                  >
                    Download Signature Template
                  </button>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="w-full px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50"
                  >
                    {isLoading ? 'Uploading...' : 'Upload Signature File'}
                  </button>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowSignatureModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {availableActions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {availableActions.map((action, index) => (
            <button
              key={index}
              onClick={action.action}
              disabled={isLoading}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                action.type === 'evm'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-orange-600 text-white hover:bg-orange-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isLoading ? 'Processing...' : action.label}
              {action.type === 'signature' && ' (File Upload)'}
            </button>
          ))}
        </div>
      )}

      {/* Loan Details */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
          View Loan Details
        </summary>
        <div className="mt-2 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Borrower:</span>
              <div className="font-mono text-xs">{loan.borrowerAddress}</div>
            </div>
            {loan.lenderAddress && (
              <div>
                <span className="font-medium">Lender:</span>
                <div className="font-mono text-xs">{loan.lenderAddress}</div>
              </div>
            )}
            <div>
              <span className="font-medium">Escrow Address:</span>
              <div className="font-mono text-xs">{loan.escrowAddress || 'Not set'}</div>
            </div>
            <div>
              <span className="font-medium">Collateral Address:</span>
              <div className="font-mono text-xs">{loan.collateralAddress || 'Not set'}</div>
            </div>
          </div>
        </div>
      </details>
    </div>
  )
}
