'use client'

import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { BTC_COLLATERAL_LOAN_ABI, CONTRACTS } from '@/contracts'
import { ACCOUNTS, CONTRACT_CONFIG, BTC_PUBKEY_PLACEHOLDER } from '@/constants'
import Link from 'next/link'

export default function BorrowerPage() {
  const account = useAccount()
  const { connectors, connect, status, error } = useConnect()
  const { disconnect } = useDisconnect()

  // Type annotations for contract data
  type TotalLoansResult = bigint | undefined

  // Contract interaction functions
  const { writeContract: requestLoan, isPending: requestLoanLoading } = useWriteContract()
  const { writeContract: acceptLoanOffer, isPending: acceptLoading } = useWriteContract()
  const { writeContract: attemptRepayment, isPending: repaymentLoading } = useWriteContract()
  const { writeContract: withdrawRepaymentAttempt, isPending: withdrawLoading } = useWriteContract()

  // Contract data
  const { data: totalLoans, refetch: refetchLoans, error: loanError } = useReadContract({
    address: CONTRACTS.BTC_COLLATERAL_LOAN,
    abi: BTC_COLLATERAL_LOAN_ABI,
    functionName: 'getTotalLoans',
    query: {
      enabled: !!CONTRACTS.BTC_COLLATERAL_LOAN && account.status === 'connected',
    },
  }) as { data: TotalLoansResult, refetch: () => void, error: Error | null }



  // Check for loans when component mounts or contract address changes
  useEffect(() => {
    if (CONTRACTS.BTC_COLLATERAL_LOAN && account.status === 'connected') {
      // The checkForLoans function is removed as totalLoans is now fetched directly.
      // If specific loan data is needed, it would require a different contract call.
    }
  }, [CONTRACTS.BTC_COLLATERAL_LOAN, account.status])

  // Form state
  const [loanAmount, setLoanAmount] = useState('0.01')
  const [collateralAmount, setCollateralAmount] = useState('0.02')
  const [selectedLoanId, setSelectedLoanId] = useState('0')
  const [borrowerBtcPubkey, setBorrowerBtcPubkey] = useState('12345678901234567890123456789012')
  const [btcAddress, setBtcAddress] = useState('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh')
  const [preimageHashBorrower, setPreimageHashBorrower] = useState<`0x${string}`>('0x1234567890123456789012345678901234567890123456789012345678901234')
  const [preimageHashLender, setPreimageHashLender] = useState<`0x${string}`>('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890')
  const [preimageBorrower, setPreimageBorrower] = useState<`0x${string}`>('0x1234567890123456789012345678901234567890123456789012345678901234')

  // Validation functions
  const isValidHexString = (value: string): value is `0x${string}` => {
    return value.startsWith('0x') && /^0x[0-9a-fA-F]+$/.test(value)
  }

  const setValidHexString = (value: string, setter: (value: `0x${string}`) => void) => {
    if (isValidHexString(value)) {
      setter(value)
    }
  }

  // Handlers
  const handleRequestLoan = () => {
    if (!requestLoan) return

    requestLoan({
      address: CONTRACTS.BTC_COLLATERAL_LOAN,
      abi: BTC_COLLATERAL_LOAN_ABI,
      functionName: 'requestLoan',
      args: [
        parseEther(loanAmount), // amount
        btcAddress, // btcAddress
        borrowerBtcPubkey, // btcPubkey
        preimageHashBorrower, // preimageHashBorrower
      ],
      value: parseEther('0.001'), // PROCESSING_FEE
    })
  }

  const handleAcceptLoanOffer = () => {
    if (!acceptLoanOffer) return

    acceptLoanOffer({
      address: CONTRACTS.BTC_COLLATERAL_LOAN,
      abi: BTC_COLLATERAL_LOAN_ABI,
      functionName: 'acceptLoanOffer',
      args: [
        BigInt(selectedLoanId), // loanId
        preimageBorrower, // preimageBorrower
      ],
    })
  }

  const handleAttemptRepayment = () => {
    if (!attemptRepayment) return

    attemptRepayment({
      address: CONTRACTS.BTC_COLLATERAL_LOAN,
      abi: BTC_COLLATERAL_LOAN_ABI,
      functionName: 'attemptRepayment',
      args: [
        BigInt(selectedLoanId), // loanId
        preimageHashLender, // preimageHashLender
      ],
      value: parseEther(loanAmount), // repayment amount
    })
  }

  const handleWithdrawRepaymentAttempt = () => {
    if (!withdrawRepaymentAttempt) return

    withdrawRepaymentAttempt({
      address: CONTRACTS.BTC_COLLATERAL_LOAN,
      abi: BTC_COLLATERAL_LOAN_ABI,
      functionName: 'withdrawRepaymentAttempt',
      args: [BigInt(selectedLoanId)], // loanId
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Borrower Dashboard</h1>
          <p className="text-lg text-gray-600">Request and manage your Bitcoin-collateralized loans</p>
          <div className="mt-4 space-x-4">
            <Link href="/" className="text-green-600 hover:text-green-800 underline">
              ← Back to Home
            </Link>
            <Link href="/lender" className="text-blue-600 hover:text-blue-800 underline">
              Lender View →
            </Link>
          </div>
        </div>

        {/* Wallet Connection */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Wallet Connection</h2>
          
          <div className="mb-4">
            <div className="text-sm text-gray-700 mb-2">
              Status: <span className="font-medium text-green-600">{account.status}</span>
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
                  className="w-full bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md transition-colors"
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
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="font-medium text-green-800">LoanFactory</div>
                <div className="text-green-600">
                  {CONTRACTS.LOAN_FACTORY ? (
                    <span className="text-green-700">✅ Deployed</span>
                  ) : (
                    <span className="text-red-600">❌ Not Deployed</span>
                  )}
                </div>
              </div>
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
                  <span className="font-medium text-gray-700">LoanFactory:</span>
                  <span className="font-mono text-xs bg-white px-2 py-1 rounded border text-gray-900">
                    {CONTRACTS.LOAN_FACTORY || 'Not deployed'}
                  </span>
                </div>
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
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="text-sm text-emerald-800">
                <div className="font-medium">Total Loans: {totalLoans ? Number(totalLoans) : 0}</div>
                <div className="font-medium mt-1">Processing Fee: 0.001 ETH</div>
                <div className="font-medium mt-1">Minimum Loan Amount: 0.005 ETH</div>
                <button
                  onClick={() => refetchLoans()}
                  className="mt-2 px-3 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 transition-colors"
                >
                  Refresh Loans
                </button>
              </div>
              

            </div>
          </div>
        )}

        {/* Borrower Functions */}
        {account.status === 'connected' && CONTRACTS.BTC_COLLATERAL_LOAN && (
          <div className="space-y-8">
            {/* Request Loan */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Request New Loan</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Loan Amount (ETH)</label>
                  <input
                    type="text"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="0.01"
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimum: 0.005 ETH</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Collateral Amount (ETH)</label>
                  <input
                    type="text"
                    value={collateralAmount}
                    onChange={(e) => setCollateralAmount(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="0.02"
                  />
                  <p className="text-xs text-gray-500 mt-1">Should be &gt; loan amount</p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">BTC Address</label>
                <input
                  type="text"
                  value={btcAddress}
                  onChange={(e) => setBtcAddress(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
                />
                <p className="text-xs text-gray-500 mt-1">Your Bitcoin address for collateral</p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Your BTC Schnorr Public Key (32 characters)</label>
                <input
                  type="text"
                  value={borrowerBtcPubkey}
                  onChange={(e) => setBorrowerBtcPubkey(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="12345678901234567890123456789012"
                  maxLength={32}
                />
                <p className="text-xs text-gray-500 mt-1">Must be exactly 32 characters</p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Preimage Hash</label>
                <input
                  type="text"
                  value={preimageHashBorrower}
                  onChange={(e) => setValidHexString(e.target.value, setPreimageHashBorrower)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="0x..."
                />
                <p className="text-xs text-gray-500 mt-1">Hash of your preimage for loan security</p>
              </div>

              <button
                onClick={handleRequestLoan}
                disabled={requestLoanLoading}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg transition-colors font-medium"
              >
                {requestLoanLoading ? 'Requesting...' : 'Request Loan'}
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Lender Preimage Hash</label>
                  <input
                    type="text"
                    value={preimageHashLender}
                    onChange={(e) => setValidHexString(e.target.value, setPreimageHashLender)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="0x..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your Preimage</label>
                  <input
                    type="text"
                    value={preimageBorrower}
                    onChange={(e) => setValidHexString(e.target.value, setPreimageBorrower)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="0x..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={handleAcceptLoanOffer}
                  disabled={acceptLoading}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg transition-colors font-medium"
                >
                  {acceptLoading ? 'Accepting...' : 'Accept Loan Offer'}
                </button>
                <button
                  onClick={handleAttemptRepayment}
                  disabled={repaymentLoading}
                  className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg transition-colors font-medium"
                >
                  {repaymentLoading ? 'Repaying...' : 'Attempt Repayment'}
                </button>
                <button
                  onClick={handleWithdrawRepaymentAttempt}
                  disabled={withdrawLoading}
                  className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg transition-colors font-medium"
                >
                  {withdrawLoading ? 'Withdrawing...' : 'Withdraw Repayment'}
                </button>
              </div>
            </div>

            {/* Loan Information */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Loan Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-800 mb-2">Current Configuration</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>• Loan Duration: {CONTRACT_CONFIG.LOAN_DURATION} blocks</div>
                    <div>• Timelock Loan Request: {CONTRACT_CONFIG.TIMELOCK_LOAN_REQ} blocks</div>
                    <div>• Timelock BTC Escrow: {CONTRACT_CONFIG.TIMELOCK_BTC_ESCROW} blocks</div>
                    <div>• Timelock Repayment Accept: {CONTRACT_CONFIG.TIMELOCK_REPAYMENT_ACCEPT} blocks</div>
                    <div>• Timelock BTC Collateral: {CONTRACT_CONFIG.TIMELOCK_BTC_COLLATERAL} blocks</div>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-800 mb-2">Loan Process</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>1. Request loan with BTC public key</div>
                    <div>2. Wait for lender offer</div>
                    <div>3. Accept offer to activate loan</div>
                    <div>4. Repay loan when due</div>
                    <div>5. Reclaim BTC collateral</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-green-50 rounded-xl p-6 mt-8">
          <h2 className="text-xl font-semibold mb-4 text-green-900">Borrower Instructions</h2>
          <div className="text-green-800 space-y-2">
            <div>1. <strong>Request Loan</strong>: Submit a loan request with your BTC public key and desired amounts</div>
            <div>2. <strong>Wait for Offer</strong>: Lenders will review and offer loans to your request</div>
            <div>3. <strong>Accept Offer</strong>: Accept a loan offer to activate the loan</div>
            <div>4. <strong>Manage Repayment</strong>: Attempt repayment when the loan is due</div>
            <div>5. <strong>Reclaim Collateral</strong>: Once repaid, reclaim your BTC collateral</div>
          </div>
        </div>
      </div>
    </div>
  )
}
