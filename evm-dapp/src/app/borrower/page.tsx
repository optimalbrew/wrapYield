'use client'

import { useState, useEffect } from 'react'
import { useConnect, useDisconnect, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { BTC_COLLATERAL_LOAN_ABI, CONTRACTS } from '@/contracts'
import { ACCOUNTS, CONTRACT_CONFIG, BTC_PUBKEY_PLACEHOLDER, NETWORK_CONFIG } from '@/constants'
import Link from 'next/link'
import { useWalletValidation } from '@/hooks/useWalletValidation'
import { switchToAnvil } from '@/utils/networkUtils'

export default function BorrowerPage() {
  const { validateWalletAndContracts, account } = useWalletValidation()
  const { connectors, connect, status, error } = useConnect()
  const { disconnect } = useDisconnect()



  // Type annotations for contract data
  type TotalLoansResult = bigint | undefined

  // Contract interaction functions
  const { writeContract: requestLoan, isPending: requestLoanLoading, data: requestLoanHash } = useWriteContract()
  const { writeContract: acceptLoanOffer, isPending: acceptLoading, data: acceptLoanHash } = useWriteContract()
  const { writeContract: attemptRepayment, isPending: repaymentLoading, data: repaymentHash } = useWriteContract()
  const { writeContract: withdrawRepaymentAttempt, isPending: withdrawLoading, data: withdrawHash } = useWriteContract()

  // Transaction receipt tracking
  const { data: requestLoanReceipt, isSuccess: requestLoanSuccess, isError: requestLoanError } = useWaitForTransactionReceipt({
    hash: requestLoanHash,
    query: {
      enabled: !!requestLoanHash,
    },
  })

  const { data: acceptLoanReceipt, isSuccess: acceptLoanSuccess, isError: acceptLoanError } = useWaitForTransactionReceipt({
    hash: acceptLoanHash,
    query: {
      enabled: !!acceptLoanHash,
    },
  })

  const { data: repaymentReceipt, isSuccess: repaymentSuccess, isError: repaymentError } = useWaitForTransactionReceipt({
    hash: repaymentHash,
    query: {
      enabled: !!repaymentHash,
    },
  })

  const { data: withdrawReceipt, isSuccess: withdrawSuccess, isError: withdrawError } = useWaitForTransactionReceipt({
    hash: withdrawHash,
    query: {
      enabled: !!withdrawHash,
    },
  })

  // Contract data
  const { data: totalLoans, refetch: refetchLoans, error: loanError } = useReadContract({
    address: CONTRACTS.BTC_COLLATERAL_LOAN,
    abi: BTC_COLLATERAL_LOAN_ABI,
    functionName: 'getTotalLoans',
    query: {
      enabled: !!CONTRACTS.BTC_COLLATERAL_LOAN && account.status === 'connected',
    },
  }) as { data: TotalLoansResult, refetch: () => void, error: Error | null }

  // Test contract connection
  const { data: contractOwner, error: ownerError } = useReadContract({
    address: CONTRACTS.BTC_COLLATERAL_LOAN,
    abi: BTC_COLLATERAL_LOAN_ABI,
    functionName: 'owner',
    query: {
      enabled: !!CONTRACTS.BTC_COLLATERAL_LOAN && account.status === 'connected',
    },
  })

  // Get loan details for the borrower
  const { data: borrowerLoanDetails, refetch: refetchBorrowerLoan } = useReadContract({
    address: CONTRACTS.BTC_COLLATERAL_LOAN,
    abi: BTC_COLLATERAL_LOAN_ABI,
    functionName: 'getLoanIdByBorrower',
    args: [account.addresses?.[0] || '0x0000000000000000000000000000000000000000'],
    query: {
      enabled: !!CONTRACTS.BTC_COLLATERAL_LOAN && account.status === 'connected' && !!account.addresses?.[0],
    },
  }) as { data: bigint | undefined, refetch: () => void, error: Error | null }

  // Get the actual loan details if borrower has a loan
  const { data: borrowerLoan, refetch: refetchBorrowerLoanDetails } = useReadContract({
    address: CONTRACTS.BTC_COLLATERAL_LOAN,
    abi: BTC_COLLATERAL_LOAN_ABI,
    functionName: 'getLoan',
    args: [borrowerLoanDetails || BigInt(0)],
    query: {
      enabled: !!CONTRACTS.BTC_COLLATERAL_LOAN && account.status === 'connected' && !!borrowerLoanDetails && borrowerLoanDetails > BigInt(0),
    },
  }) as { data: any, refetch: () => void, error: Error | null }

  // State for account transaction nonce
  const [accountNonce, setAccountNonce] = useState<number | null>(null)

  // Monitor transaction hashes
  useEffect(() => {
    if (requestLoanHash) {
      console.log('📝 Request loan transaction hash generated:', requestLoanHash)
    }
  }, [requestLoanHash])

  // Function to check and sync nonce before sending transaction
  const checkAndSyncNonce = async () => {
    if (!account.addresses?.[0]) return false
    
    try {
      // Get current nonce from the blockchain
              const response = await fetch(NETWORK_CONFIG.ANVIL.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getTransactionCount',
          params: [account.addresses[0], 'latest'],
          id: 1
        })
      })
      
      const result = await response.json()
      if (result.result) {
        const blockchainNonce = parseInt(result.result, 16)
        console.log('🔍 Nonce Check:', {
          walletAddress: account.addresses[0],
          blockchainNonce,
          accountStatus: account.status,
          chainId: account.chainId
        })
        return blockchainNonce
      }
    } catch (error) {
      console.error('❌ Error checking nonce:', error)
    }
    return null
  }

  useEffect(() => {
    if (acceptLoanHash) {
      console.log('📝 Accept loan transaction hash generated:', acceptLoanHash)
    }
  }, [acceptLoanHash])

  useEffect(() => {
    if (repaymentHash) {
      console.log('📝 Repayment transaction hash generated:', repaymentHash)
    }
  }, [repaymentHash])

  useEffect(() => {
    if (withdrawHash) {
      console.log('📝 Withdraw transaction hash generated:', withdrawHash)
    }
  }, [withdrawHash])

  // Check for loans when component mounts or contract address changes
  useEffect(() => {
    if (CONTRACTS.BTC_COLLATERAL_LOAN && account.status === 'connected') {
      // The checkForLoans function is removed as totalLoans is now fetched directly.
      // If specific loan data is needed, it would require a different contract call.
    }
  }, [CONTRACTS.BTC_COLLATERAL_LOAN, account.status])

  // Form state
  const [loanAmount, setLoanAmount] = useState('0.1')
  const [collateralAmount, setCollateralAmount] = useState('0.12')
  const [selectedLoanId, setSelectedLoanId] = useState('0')
  const [borrowerBtcPubkey, setBorrowerBtcPubkey] = useState('12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678')
  const [btcAddress, setBtcAddress] = useState('bcrt1pxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlhd4ks9a2l7qj0m9s8n5v')
  const [preimageHashBorrower, setPreimageHashBorrower] = useState<`0x${string}`>('0x4534f8f303eb5fc7175946b1c46772fa31bca38f724c1a0be97b9b0289431ee1')
  const [preimageHashLender, setPreimageHashLender] = useState<`0x${string}`>('0x646e58c6fbea3ac4750a2279d4b711fed954e3cb48319c630570e3143e4553e3')
  const [preimageBorrower, setPreimageBorrower] = useState<`0x${string}`>('0x05e5cdc502cc641787db0383a01d4b6baec69b62b6dbf9d9d9600872bbbed741')

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
  const handleRequestLoan = async () => {
    console.log('🚀 handleRequestLoan called')
    console.log('Account status:', account.status)
    console.log('Chain ID:', account.chainId)
    console.log('Contract address:', CONTRACTS.BTC_COLLATERAL_LOAN)
    
    if (!validateWalletAndContracts()) {
      return
    }

    if (!requestLoan) {
      console.log('❌ requestLoan function not available')
      return
    }

    // Check and sync nonce before sending transaction
    console.log('🔍 Checking nonce before sending transaction...')
    const blockchainNonce = await checkAndSyncNonce()
    if (blockchainNonce !== null) {
      console.log('✅ Nonce synced:', blockchainNonce)
    } else {
      console.log('⚠️ Could not verify nonce, proceeding anyway...')
    }

    console.log('✅ All checks passed, calling requestLoan')
    console.log('Args:', {
      amount: parseEther(loanAmount),
      btcAddress,
      borrowerBtcPubkey,
      preimageHashBorrower,
      value: BigInt('1000000000000000') // PROCESSING_FEE (0.001 ETH in wei)
    })

    try {
      console.log('🔐 Initiating requestLoan transaction - waiting for wallet signature...')
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
        value: BigInt('1000000000000000'), // PROCESSING_FEE (0.001 ETH in wei)
      })
      console.log('✅ requestLoan transaction sent successfully')
    } catch (error) {
      console.error('❌ Error sending requestLoan transaction:', error)
      alert('Error sending transaction. Check console for details.')
    }
  }

  const handleAcceptLoanOffer = () => {
    if (!validateWalletAndContracts()) {
      return
    }

    if (!acceptLoanOffer) return

    // Check account balance before proceeding
    if (!account.addresses?.[0]) {
      alert('No account address found')
      return
    }

    console.log('💰 Account Check:', {
      address: account.addresses[0],
      chainId: account.chainId
    })

    console.log('🔐 Initiating acceptLoanOffer transaction - waiting for wallet signature...')
    console.log('📋 Transaction Details:', {
      loanId: selectedLoanId,
      preimageBorrower,
      contractAddress: CONTRACTS.BTC_COLLATERAL_LOAN,
      accountAddress: account.addresses?.[0]
    })
    console.log('⛽ Gas Settings:', {
      gas: '500,000',
      gasPrice: '1 gwei (1,000,000,000 wei)',
      estimatedCost: '0.0005 ETH (500,000 * 1 gwei)'
    })
    
    acceptLoanOffer({
      address: CONTRACTS.BTC_COLLATERAL_LOAN,
      abi: BTC_COLLATERAL_LOAN_ABI,
      functionName: 'acceptLoanOffer',
      args: [
        BigInt(selectedLoanId), // loanId
        preimageBorrower, // preimageBorrower
      ],
      // Add explicit gas settings for Anvil
      gas: BigInt(500000), // Set reasonable gas limit
      gasPrice: BigInt(1000000000), // 1 gwei (very low for Anvil)
    })
  }

  const handleAttemptRepayment = () => {
    if (!validateWalletAndContracts()) {
      return
    }

    if (!attemptRepayment) return

    console.log('🔐 Initiating attemptRepayment transaction - waiting for wallet signature...')
    
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
    if (!validateWalletAndContracts()) {
      return
    }

    if (!withdrawRepaymentAttempt) return

    console.log('🔐 Initiating withdrawRepaymentAttempt transaction - waiting for wallet signature...')
    
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
            <div className="space-y-3">
              {/* Network Status */}
              {account.chainId !== NETWORK_CONFIG.ANVIL.chainId && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="text-sm text-yellow-800 mb-2">
                    ⚠️ You are connected to the wrong network. Please switch to Anvil (Chain ID: {NETWORK_CONFIG.ANVIL.chainId})
                  </div>
                  <button
                    onClick={switchToAnvil}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-xs transition-colors"
                  >
                    Add & Switch to Anvil
                  </button>
                </div>
              )}
              
              <button
                onClick={() => disconnect()}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md transition-colors"
              >
                Disconnect
              </button>
            </div>
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="font-medium text-green-800">EtherSwap</div>
                <div className="text-green-600">
                  {CONTRACTS.ETHER_SWAP ? (
                    <span className="text-green-700">✅ Deployed</span>
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

            {/* Nonce Information */}
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="text-sm text-yellow-800">
                <div className="font-medium">🔍 Nonce Information</div>
                <div className="text-xs text-yellow-700 mt-1">
                  <div>Wallet Address: <code className="bg-yellow-100 px-1 rounded">{account.addresses?.[0] || 'Not connected'}</code></div>
                  <div>Current Nonce: <code className="bg-yellow-100 px-1 rounded">{accountNonce !== null ? accountNonce : 'Click button to check'}</code></div>
                </div>
                <button
                  onClick={async () => {
                    const nonce = await checkAndSyncNonce()
                    if (nonce !== null && nonce !== false) {
                      setAccountNonce(nonce)
                      console.log('✅ Nonce refreshed:', nonce)
                    }
                  }}
                  className="mt-2 px-3 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700 transition-colors"
                >
                  🔄 Check Nonce
                </button>
              </div>
            </div>

            {/* Transaction Status Display */}
            {(requestLoanHash || acceptLoanHash || repaymentHash || withdrawHash) && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-medium text-blue-800 mb-2">📊 Transaction Status</h4>
                <div className="text-xs text-blue-700 space-y-2">
                  {requestLoanHash && (
                    <div>
                      <strong>Request Loan:</strong> 
                      {requestLoanLoading ? ' Pending...' : 
                       requestLoanSuccess ? ' ✅ Success' : 
                       requestLoanError ? ' ❌ Failed' : ' Processing...'}
                      {requestLoanHash && <div className="font-mono text-xs mt-1">Hash: {requestLoanHash}</div>}
                    </div>
                  )}
                  {acceptLoanHash && (
                    <div>
                      <strong>Accept Loan:</strong> 
                      {acceptLoading ? ' Pending...' : 
                       acceptLoanSuccess ? ' ✅ Success' : 
                       acceptLoanError ? ' ❌ Failed' : ' Processing...'}
                      {acceptLoanHash && <div className="font-mono text-xs mt-1">Hash: {acceptLoanHash}</div>}
                    </div>
                  )}
                  {repaymentHash && (
                    <div>
                      <strong>Repayment:</strong> 
                      {repaymentLoading ? ' Pending...' : 
                       repaymentSuccess ? ' ✅ Success' : 
                       repaymentError ? ' ❌ Failed' : ' Processing...'}
                      {repaymentHash && <div className="font-mono text-xs mt-1">Hash: {repaymentHash}</div>}
                    </div>
                  )}
                  {withdrawHash && (
                    <div>
                      <strong>Withdraw:</strong> 
                      {withdrawLoading ? ' Pending...' : 
                       withdrawSuccess ? ' ✅ Success' : 
                       withdrawError ? ' ❌ Failed' : ' Processing...'}
                      {withdrawHash && <div className="font-mono text-xs mt-1">Hash: {withdrawHash}</div>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Debug Information */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="text-sm font-medium text-gray-800 mb-2">🐛 Debug Information</h4>
              <div className="text-xs text-gray-600 space-y-1">
                <div>Wallet Status: {account.status}</div>
                <div>Network: {account.chainId} {account.chainId === 31337 ? '(Anvil)' : '(Wrong Network)'}</div>
                <div>Contract Address: {CONTRACTS.BTC_COLLATERAL_LOAN || 'Not set'}</div>
                <div>Account Address: {account.addresses?.[0] || 'Not connected'}</div>
                <div>Total Loans Data: {totalLoans ? Number(totalLoans) : 'Loading...'}</div>
                <div>Contract Owner: {contractOwner || 'Loading...'}</div>
                <div>Owner Error: {ownerError ? ownerError.message : 'None'}</div>
                <div>Loan Error: {loanError ? loanError.message : 'None'}</div>
              </div>
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                💡 <strong>Debug Tip:</strong> Open browser console (F12) to see detailed transaction logs and any errors.
              </div>
              <div className="mt-2">
                <button
                  onClick={() => {
                    console.log('🔍 Testing contract connection...')
                    console.log('CONTRACTS:', CONTRACTS)
                    console.log('BTC_COLLATERAL_LOAN_ABI:', BTC_COLLATERAL_LOAN_ABI)
                    refetchLoans()
                  }}
                  className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                >
                  Test Contract Connection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Borrower's Loan Details */}
        {account.status === 'connected' && CONTRACTS.BTC_COLLATERAL_LOAN && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Your Loan Details</h3>
            
            {borrowerLoanDetails && borrowerLoanDetails > BigInt(0) ? (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm text-blue-800">
                    <div className="font-medium">Your Loan ID: {borrowerLoanDetails.toString()}</div>
                    <button
                      onClick={() => refetchBorrowerLoanDetails()}
                      className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                    >
                      🔄 Refresh Details
                    </button>
                  </div>
                </div>

                {borrowerLoan && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-3">📋 Loan Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="font-medium text-green-700 mb-2">Basic Details</div>
                        <div className="space-y-1 text-xs text-green-600">
                          <div>Borrower: <code className="bg-green-100 px-1 rounded">{borrowerLoan.borrowerAddr || 'N/A'}</code></div>
                          <div>BTC Pubkey: <code className="bg-green-100 px-1 rounded">{borrowerLoan.borrowerBtcPubkey || 'N/A'}</code></div>
                          <div>Loan Amount: <code className="bg-green-100 px-1 rounded">{borrowerLoan.amount ? formatEther(BigInt(borrowerLoan.amount)) : 'N/A'} ETH</code></div>
                          <div>Collateral: <code className="bg-green-100 px-1 rounded">{borrowerLoan.collateralAmount ? formatEther(BigInt(borrowerLoan.collateralAmount)) : 'N/A'} ETH</code></div>
                          <div>Bond Amount: <code className="bg-green-100 px-1 rounded">{borrowerLoan.bondAmount ? formatEther(BigInt(borrowerLoan.bondAmount)) : 'N/A'} ETH</code></div>
                          <div>Status: <code className="bg-green-100 px-1 rounded">{borrowerLoan.status || 'N/A'}</code></div>
                        </div>
                      </div>
                      <div>
                        <div className="font-medium text-green-700 mb-2">Timelock & Hashes</div>
                        <div className="space-y-1 text-xs text-green-600">
                          <div>Preimage Hash Borrower: <code className="bg-green-100 px-1 rounded">{borrowerLoan.preimageHashBorrower || 'N/A'}</code></div>
                          <div>Preimage Hash Lender: <code className="bg-green-100 px-1 rounded">{borrowerLoan.preimageHashLender || 'N/A'}</code></div>
                          <div>Request Block: <code className="bg-green-100 px-1 rounded">{borrowerLoan.requestBlockheight || 'N/A'}</code></div>
                          <div>Activation Block: <code className="bg-green-100 px-1 rounded">{borrowerLoan.activationBlockheight || 'N/A'}</code></div>
                          <div>Repayment Block: <code className="bg-green-100 px-1 rounded">{borrowerLoan.repaymentBlockheight || 'N/A'}</code></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="text-sm text-gray-600">
                  <div>No active loan found for your address.</div>
                  <div className="text-xs text-gray-500 mt-1">Request a new loan to get started.</div>
                </div>
              </div>
            )}
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Your BTC Schnorr Public Key (64 characters)</label>
                <input
                  type="text"
                  value={borrowerBtcPubkey}
                  onChange={(e) => setBorrowerBtcPubkey(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678"
                  maxLength={64}
                />
                <p className="text-xs text-gray-500 mt-1">Must be exactly 64 characters</p>
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
                <p className="text-xs text-gray-500 mt-1">Must be 0x + 64 characters</p>
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
                  <p className="text-xs text-gray-500 mt-1">Must be 0x + 64 characters</p>
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
                  <p className="text-xs text-gray-500 mt-1">Must be 0x + 64 characters</p>
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
