/**
 * Unified Loan Card Component
 * 
 * This component provides a unified interface for managing loans that involve
 * both EVM and Bitcoin operations, showing cross-chain status and actions.
 */

import React, { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { BTC_COLLATERAL_LOAN_ABI, CONTRACTS } from '@/contracts'
import { useBitcoinWallet, BitcoinTransaction } from '@/hooks/useBitcoinWallet'

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

interface UnifiedLoanCardProps {
  loan: Loan
  userRole: 'borrower' | 'lender'
  onStatusUpdate: (loanId: string, status: CrossChainStatus) => void
}

export function UnifiedLoanCard({ loan, userRole, onStatusUpdate }: UnifiedLoanCardProps) {
  const { address } = useAccount()
  const { writeContract: writeEVMContract } = useWriteContract()
  const { 
    bitcoinAccount, 
    signBitcoinTransaction, 
    isConnected: isBitcoinConnected 
  } = useBitcoinWallet()
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bitcoinTransaction, setBitcoinTransaction] = useState<BitcoinTransaction | null>(null)

  // Real-time status updates via WebSocket
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:3002/loans/${loan.id}/status`) //backend express service runs on port 3002
    
    ws.onmessage = (event) => {
      const statusUpdate = JSON.parse(event.data)
      onStatusUpdate(loan.id, statusUpdate)
    }
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
    
    return () => ws.close()
  }, [loan.id, onStatusUpdate])

  // Handle EVM contract interactions
  const handleEVMTransaction = async (functionName: string, args: any[], value?: bigint) => {
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
        args,
        value
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'EVM transaction failed'
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Bitcoin transaction signing
  const handleBitcoinTransaction = async (transactionType: 'escrow' | 'collateral') => {
    if (!isBitcoinConnected) {
      throw new Error('Bitcoin wallet not connected')
    }

    setIsLoading(true)
    setError(null)

    try {
      // Request Bitcoin transaction from backend
      const response = await fetch(`/api/bitcoin/transactions/${transactionType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId: loan.id,
          borrowerPubkey: loan.borrowerBtcPubkey,
          lenderPubkey: loan.lenderBtcPubkey,
          amount: loan.amount
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create Bitcoin transaction')
      }

      const { data } = await response.json()
      const transaction: BitcoinTransaction = {
        id: data.transactionId,
        rawTx: data.rawTransaction,
        inputs: data.inputs || [],
        outputs: data.outputs || [],
        signingInstructions: data.signingInstructions || {}
      }

      setBitcoinTransaction(transaction)

      // Sign the transaction
      const signature = await signBitcoinTransaction(transaction)

      // Send signature to backend
      await fetch('/api/bitcoin/signatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId: loan.id,
          transactionId: transaction.id,
          signature: signature.signature,
          signerType: userRole
        })
      })

      setBitcoinTransaction(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Bitcoin transaction failed'
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'confirmed':
      case 'repaid':
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
              label: 'Sign Escrow Transaction',
              action: () => handleBitcoinTransaction('escrow'),
              type: 'bitcoin' as const
            })
          }
          break
        case 'offered':
          actions.push({
            label: 'Accept Loan Offer',
            action: () => handleEVMTransaction('acceptLoanOffer', [loan.evmContractId, '0x0']),
            type: 'evm' as const
          })
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
            Amount: {formatEther(BigInt(loan.amount))} ETH
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(loan.status)}`}>
          {loan.status.replace('_', ' ').toUpperCase()}
        </div>
      </div>

      {/* Cross-Chain Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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

      {/* Wallet Status */}
      <div className="flex items-center space-x-4 mb-4">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${address ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-600">EVM Wallet</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isBitcoinConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-600">Bitcoin Wallet</span>
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

      {/* Bitcoin Transaction Modal */}
      {bitcoinTransaction && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Sign Bitcoin Transaction
              </h3>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Please review and sign the Bitcoin transaction in your wallet.
                </p>
                <div className="bg-gray-50 p-3 rounded text-xs font-mono break-all">
                  {bitcoinTransaction.rawTx}
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setBitcoinTransaction(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleBitcoinTransaction('escrow')}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Signing...' : 'Sign Transaction'}
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
              disabled={isLoading || (action.type === 'bitcoin' && !isBitcoinConnected)}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                action.type === 'evm'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-orange-600 text-white hover:bg-orange-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isLoading ? 'Processing...' : action.label}
              {action.type === 'bitcoin' && ' (Bitcoin)'}
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
