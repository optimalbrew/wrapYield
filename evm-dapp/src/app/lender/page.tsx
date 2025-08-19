'use client'

import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { BTC_COLLATERAL_LOAN_ABI, CONTRACTS } from '@/contracts'
import { ACCOUNTS, CONTRACT_CONFIG, BTC_PUBKEY_PLACEHOLDER } from '@/constants'
import Link from 'next/link'

export default function LenderPage() {
  const account = useAccount()
  const { connectors, connect, status, error } = useConnect()
  const { disconnect } = useDisconnect()

  // Type annotations for contract data
  type LenderBtcPubkeyResult = string | undefined
  type TotalLoansResult = bigint | undefined

  // Contract interaction functions
  const { writeContract: updateBtcPubkey, isPending: updatePubkeyLoading } = useWriteContract()
  const { writeContract: updateParameters, isPending: updateParamsLoading } = useWriteContract()
  const { writeContract: extendLoanOffer, isPending: offerLoading } = useWriteContract()
  const { writeContract: acceptRepayment, isPending: acceptRepaymentLoading } = useWriteContract()
  const { writeContract: markAsDefaulted, isPending: defaultLoading } = useWriteContract()

  // Contract data
  const { data: lenderBtcPubkey, refetch: refetchPubkey, error: pubkeyError } = useReadContract({
    address: CONTRACTS.BTC_COLLATERAL_LOAN,
    abi: BTC_COLLATERAL_LOAN_ABI,
    functionName: 'lenderBtcPubkey',
    query: {
      enabled: !!CONTRACTS.BTC_COLLATERAL_LOAN && account.status === 'connected',
    },
  }) as { data: LenderBtcPubkeyResult, refetch: () => void, error: Error | null }

  // Get total loans using the correct function
  const { data: totalLoans, refetch: refetchLoans, error: loanError } = useReadContract({
    address: CONTRACTS.BTC_COLLATERAL_LOAN,
    abi: BTC_COLLATERAL_LOAN_ABI,
    functionName: 'getTotalLoans',
    query: {
      enabled: !!CONTRACTS.BTC_COLLATERAL_LOAN && account.status === 'connected',
    },
  }) as { data: TotalLoansResult, refetch: () => void, error: Error | null }

  // Debug information
  const debugInfo = {
    contractAddress: CONTRACTS.BTC_COLLATERAL_LOAN,
    isConnected: account.status === 'connected',
    pubkeyError: pubkeyError?.message || null,
    loanError: loanError?.message || null,
    totalLoansData: totalLoans || null,
  }

  // Check for loans when component mounts or contract address changes
  useEffect(() => {
    if (CONTRACTS.BTC_COLLATERAL_LOAN && account.status === 'connected') {
      // The checkForLoans function is no longer needed as totalLoans is fetched directly.
      // Keeping it for now, but it can be removed if not used elsewhere.
      // checkForLoans() 
    }
  }, [CONTRACTS.BTC_COLLATERAL_LOAN, account.status]) // Removed totalLoans from dependency array

  // Form state
  const [newBtcPubkey, setNewBtcPubkey] = useState('')
  const [selectedLoanId, setSelectedLoanId] = useState('0')
  const [preimageHashBorrower, setPreimageHashBorrower] = useState<`0x${string}`>('0x1234567890123456789012345678901234567890123456789012345678901234')
  const [preimageHashLender, setPreimageHashLender] = useState<`0x${string}`>('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890')
  const [newLoanDuration, setNewLoanDuration] = useState('1000')
  const [newTimelockLoanReq, setNewTimelockLoanReq] = useState('100')
  const [newTimelockBtcEscrow, setNewTimelockBtcEscrow] = useState('200')
  const [newTimelockRepaymentAccept, setNewTimelockRepaymentAccept] = useState('150')
  const [newTimelockBtcCollateral, setNewTimelockBtcCollateral] = useState('250')

  // Handlers
  const handleUpdateBtcPubkey = () => {
    if (!updateBtcPubkey || !newBtcPubkey) return

    updateBtcPubkey({
      address: CONTRACTS.BTC_COLLATERAL_LOAN,
      abi: BTC_COLLATERAL_LOAN_ABI,
      functionName: 'updateLenderBtcPubkey',
      args: [newBtcPubkey],
    })
  }

  const handleUpdateParameters = () => {
    if (!updateParameters) return

    updateParameters({
      address: CONTRACTS.BTC_COLLATERAL_LOAN,
      abi: BTC_COLLATERAL_LOAN_ABI,
      functionName: 'updateParameters',
      args: [
        BigInt(newLoanDuration),
        BigInt(newTimelockLoanReq),
        BigInt(newTimelockBtcEscrow),
        BigInt(newTimelockRepaymentAccept),
        BigInt(newTimelockBtcCollateral),
      ],
    })
  }

  const handleExtendLoanOffer = () => {
    if (!extendLoanOffer) return

    extendLoanOffer({
      address: CONTRACTS.BTC_COLLATERAL_LOAN,
      abi: BTC_COLLATERAL_LOAN_ABI,
      functionName: 'extendLoanOffer',
      args: [
        BigInt(selectedLoanId),
        preimageHashBorrower,
        preimageHashLender,
      ],
      value: parseEther('0.01'), // bond amount
    })
  }

  const handleAcceptRepayment = () => {
    if (!acceptRepayment) return

    acceptRepayment({
      address: CONTRACTS.BTC_COLLATERAL_LOAN,
      abi: BTC_COLLATERAL_LOAN_ABI,
      functionName: 'acceptLoanRepayment',
      args: [
        BigInt(selectedLoanId),
        preimageHashLender,
      ],
    })
  }

  const handleMarkAsDefaulted = () => {
    if (!markAsDefaulted) return

    markAsDefaulted({
      address: CONTRACTS.BTC_COLLATERAL_LOAN,
      abi: BTC_COLLATERAL_LOAN_ABI,
      functionName: 'markAsDefaulted',
      args: [BigInt(selectedLoanId)],
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Lender Dashboard</h1>
          <p className="text-lg text-gray-600">Manage your Bitcoin-collateralized loans</p>
          <div className="mt-4 space-x-4">
            <Link href="/" className="text-blue-600 hover:text-blue-800 underline">
              ← Back to Home
            </Link>
            <Link href="/borrower" className="text-green-600 hover:text-green-800 underline">
              Borrower View →
            </Link>
          </div>
        </div>

        {/* Wallet Connection */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Wallet Connection</h2>
          
          <div className="mb-4">
            <div className="text-sm text-gray-700 mb-2">
              Status: <span className="font-medium text-blue-600">{account.status}</span>
            </div>
            {account.addresses && (
              <div className="text-sm text-gray-700 mb-2">
                Address: <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{account.addresses[0]}</span>
              </div>
            )}
            {account.chainId && (
              <div className="text-sm text-gray-700 mb-2">
                Chain ID: <span className="font-medium text-green-600">{account.chainId}</span>
              </div>
            )}
          </div>

          {account.status === 'connected' ? (
            <button
              onClick={() => disconnect()}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md transition-colors"
            >
              Disconnect
            </button>
          ) : (
            <div className="space-y-2">
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => connect({ connector })}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors"
                >
                  Connect {connector.name}
                </button>
              ))}
            </div>
          )}
          
          {status && <div className="mt-2 text-sm text-gray-600">{status}</div>}
          {error && <div className="mt-2 text-sm text-red-600">{error.message}</div>}
        </div>

        {/* Contract Status */}
        {account.status === 'connected' && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">Contract Status</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="font-medium text-blue-800">EtherSwap</div>
                <div className="text-blue-600">
                  {CONTRACTS.ETHER_SWAP ? (
                    <span className="text-blue-700">✅ Deployed</span>
                  ) : (
                    <span className="text-red-600">❌ Not Deployed</span>
                  )}
                </div>
              </div>
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="font-medium text-purple-800">BtcCollateralLoan</div>
                <div className="text-purple-600">
                  {CONTRACTS.BTC_COLLATERAL_LOAN ? (
                    <span className="text-purple-700">✅ Deployed</span>
                  ) : (
                    <span className="text-red-600">❌ Not Deployed</span>
                  )}
                </div>
              </div>
            </div>

            {/* Contract Addresses Display */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg mb-4">
              <h3 className="font-medium text-gray-800 mb-3">Deployed Contract Addresses</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">EtherSwap:</span>
                  <span className="font-mono text-xs bg-white px-2 py-1 rounded border text-gray-900">
                    {CONTRACTS.ETHER_SWAP || 'Not deployed'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">BtcCollateralLoan:</span>
                  <span className="font-mono text-xs bg-white px-2 py-1 rounded border text-gray-900">
                    {CONTRACTS.BTC_COLLATERAL_LOAN || 'Not deployed'}
                  </span>
                </div>
              </div>
            </div>

            {/* Loan Statistics */}
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
              <div className="text-sm text-indigo-800">
                <div className="font-medium">Total Loans: {totalLoans ? Number(totalLoans) : 0}</div>
                <div className="font-medium mt-1">Current BTC Public Key: {lenderBtcPubkey || 'Not set'}</div>
              </div>
              
              {/* Debug Information */}
              <div className="mt-4 p-3 bg-white border border-indigo-200 rounded-lg">
                <h4 className="font-medium text-indigo-800 mb-2">Debug Information</h4>
                <div className="text-xs text-indigo-600 space-y-1">
                  <div>Contract Address: {debugInfo.contractAddress || 'Not set'}</div>
                  <div>Wallet Connected: {debugInfo.isConnected ? 'Yes' : 'No'}</div>
                  {debugInfo.pubkeyError && <div>BTC Pubkey Error: {debugInfo.pubkeyError}</div>}
                  {debugInfo.loanError && <div>Loan Error: {debugInfo.loanError}</div>}
                  {debugInfo.totalLoansData !== null && <div>Total Loans Data: {typeof debugInfo.totalLoansData === 'bigint' ? Number(debugInfo.totalLoansData) : String(debugInfo.totalLoansData)}</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lender Functions */}
        {account.status === 'connected' && CONTRACTS.BTC_COLLATERAL_LOAN && (
          <div className="space-y-8">
            {/* Update BTC Public Key */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Update BTC Public Key</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">New BTC Schnorr Public Key (64 characters)</label>
                <input
                  type="text"
                  value={newBtcPubkey}
                  onChange={(e) => setNewBtcPubkey(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567"
                  maxLength={64}
                />
                <p className="text-xs text-gray-500 mt-1">Must be exactly 64 characters</p>
              </div>
              <button
                onClick={handleUpdateBtcPubkey}
                disabled={updatePubkeyLoading || !newBtcPubkey}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg transition-colors font-medium"
              >
                {updatePubkeyLoading ? 'Updating...' : 'Update BTC Public Key'}
              </button>
            </div>

            {/* Update Contract Parameters */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Update Contract Parameters</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Loan Duration (blocks)</label>
                  <input
                    type="number"
                    value={newLoanDuration}
                    onChange={(e) => setNewLoanDuration(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="1000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Timelock Loan Request (blocks)</label>
                  <input
                    type="number"
                    value={newTimelockLoanReq}
                    onChange={(e) => setNewTimelockLoanReq(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Timelock BTC Escrow (blocks)</label>
                  <input
                    type="number"
                    value={newTimelockBtcEscrow}
                    onChange={(e) => setNewTimelockBtcEscrow(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Timelock Repayment Accept (blocks)</label>
                  <input
                    type="number"
                    value={newTimelockRepaymentAccept}
                    onChange={(e) => setNewTimelockRepaymentAccept(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="150"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Timelock BTC Collateral (blocks)</label>
                  <input
                    type="number"
                    value={newTimelockBtcCollateral}
                    onChange={(e) => setNewTimelockBtcCollateral(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="250"
                  />
                </div>
              </div>
              <button
                onClick={handleUpdateParameters}
                disabled={updateParamsLoading}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg transition-colors font-medium"
              >
                {updateParamsLoading ? 'Updating...' : 'Update Parameters'}
              </button>
            </div>

            {/* Loan Management */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Loan Management</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Loan ID</label>
                <input
                  type="number"
                  value={selectedLoanId}
                  onChange={(e) => setSelectedLoanId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Borrower Preimage Hash</label>
                  <input
                    type="text"
                    value={preimageHashBorrower}
                    onChange={(e) => {
                      const value = e.target.value
                      if (value.startsWith('0x') && value.length === 66) {
                        setPreimageHashBorrower(value as `0x${string}`)
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0x..."
                  />
                  <p className="text-xs text-gray-500 mt-1">Must be 0x + 64 hex characters</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Lender Preimage Hash</label>
                  <input
                    type="text"
                    value={preimageHashLender}
                    onChange={(e) => {
                      const value = e.target.value
                      if (value.startsWith('0x') && value.length === 66) {
                        setPreimageHashLender(value as `0x${string}`)
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0x..."
                  />
                  <p className="text-xs text-gray-500 mt-1">Must be 0x + 64 hex characters</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={handleExtendLoanOffer}
                  disabled={offerLoading}
                  className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg transition-colors font-medium"
                >
                  {offerLoading ? 'Offering...' : 'Extend Loan Offer'}
                </button>
                <button
                  onClick={handleAcceptRepayment}
                  disabled={acceptRepaymentLoading}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg transition-colors font-medium"
                >
                  {acceptRepaymentLoading ? 'Accepting...' : 'Accept Repayment'}
                </button>
                <button
                  onClick={handleMarkAsDefaulted}
                  disabled={defaultLoading}
                  className="bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg transition-colors font-medium"
                >
                  {defaultLoading ? 'Processing...' : 'Mark as Defaulted'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 rounded-xl p-6 mt-8">
          <h2 className="text-xl font-semibold mb-4 text-blue-900">Lender Instructions</h2>
          <div className="text-blue-800 space-y-2">
            <div>1. <strong>Update BTC Public Key</strong>: Set your Bitcoin Schnorr public key for collateral management</div>
            <div>2. <strong>Configure Parameters</strong>: Adjust timelock values for loan management</div>
            <div>3. <strong>Extend Loan Offers</strong>: Offer loans to borrowers who have requested them</div>
            <div>4. <strong>Accept Repayments</strong>: Claim loan repayments from borrowers</div>
            <div>5. <strong>Handle Defaults</strong>: Mark loans as defaulted when borrowers fail to repay</div>
          </div>
        </div>
      </div>
    </div>
  )
}
