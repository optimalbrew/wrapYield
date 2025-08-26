'use client'

import { useState, useEffect } from 'react'
import { useConnect, useDisconnect, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { BTC_COLLATERAL_LOAN_ABI, CONTRACTS } from '@/contracts'
import { CONTRACT_CONFIG, NETWORK_CONFIG } from '@/constants'
import Link from 'next/link'
import { useWalletValidation } from '@/hooks/useWalletValidation'
import { switchToAnvil } from '@/utils/networkUtils'

export default function LenderPage() {
  // Helper function to safely serialize loan details
  const serializeLoanDetails = (data: any) => {
    try {
      return JSON.stringify(data, (key, value) => 
        typeof value === 'bigint' ? value.toString() : value
      , 2)
    } catch (e) {
      return 'Error serializing data'
    }
  }
  // All contract interaction functions are protected with wallet signature requirements:
  // - handleExtendLoanOffer: Extends loan offers (requires wallet signature)
  // - handleAcceptRepayment: Accepts loan repayments (requires wallet signature)
  // - handleMarkAsDefaulted: Marks loans as defaulted (requires wallet signature)
  // - handleUpdateBtcPubkey: Updates BTC public key (requires wallet signature)
  // - handleUpdateParameters: Updates contract parameters (requires wallet signature)
  
  const { validateWalletAndContracts, account } = useWalletValidation()
  const { connectors, connect, status, error } = useConnect()
  const { disconnect } = useDisconnect()



  // Type annotations for contract data
  type LenderBtcPubkeyResult = string | undefined
  type TotalLoansResult = bigint | undefined

  // Contract interaction functions
  const { writeContract: updateBtcPubkey, isPending: updatePubkeyLoading, data: updatePubkeyHash } = useWriteContract()
  const { writeContract: updateParameters, isPending: updateParamsLoading, data: updateParamsHash } = useWriteContract()
  const { writeContract: extendLoanOffer, isPending: offerLoading, data: extendOfferHash } = useWriteContract()
  const { writeContract: acceptRepayment, isPending: acceptRepaymentLoading, data: acceptRepaymentHash } = useWriteContract()
  const { writeContract: markAsDefaulted, isPending: defaultLoading, data: markAsDefaultedHash } = useWriteContract()

  // Transaction monitoring
  const { isLoading: isUpdatePubkeyConfirming, isSuccess: isUpdatePubkeySuccess } = useWaitForTransactionReceipt({
    hash: updatePubkeyHash,
    query: { enabled: !!updatePubkeyHash }
  })
  
  const { isLoading: isUpdateParamsConfirming, isSuccess: isUpdateParamsSuccess } = useWaitForTransactionReceipt({
    hash: updateParamsHash,
    query: { enabled: !!updateParamsHash }
  })
  
  const { isLoading: isExtendOfferConfirming, isSuccess: isExtendOfferSuccess } = useWaitForTransactionReceipt({
    hash: extendOfferHash,
    query: { enabled: !!extendOfferHash }
  })
  
  const { isLoading: isAcceptRepaymentConfirming, isSuccess: isAcceptRepaymentSuccess } = useWaitForTransactionReceipt({
    hash: acceptRepaymentHash,
    query: { enabled: !!acceptRepaymentHash }
  })
  
  const { isLoading: isMarkAsDefaultedConfirming, isSuccess: isMarkAsDefaultedSuccess } = useWaitForTransactionReceipt({
    hash: markAsDefaultedHash,
    query: { enabled: !!markAsDefaultedHash }
  })

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
  const [newBtcPubkey, setNewBtcPubkey] = useState('1234567890123456789012345678901234567890123456789012345678901234')
  const [selectedLoanId, setSelectedLoanId] = useState('0')
  const [preimageHashBorrower, setPreimageHashBorrower] = useState<`0x${string}`>('0x4534f8f303eb5fc7175946b1c46772fa31bca38f724c1a0be97b9b0289431ee1')
  const [preimageHashLender, setPreimageHashLender] = useState<`0x${string}`>('0x646e58c6fbea3ac4750a2279d4b711fed954e3cb48319c630570e3143e4553e3')
  const [preimageLender, setPreimageLender] = useState<`0x${string}`>('0x38f9fa6b463f6e37f2cf7286f1f3bbf2e1fe33296f95629d9c343511f9bd35d5')
  const [newLoanDuration, setNewLoanDuration] = useState(CONTRACT_CONFIG.LOAN_DURATION.toString())
  const [newTimelockLoanReq, setNewTimelockLoanReq] = useState(CONTRACT_CONFIG.TIMELOCK_LOAN_REQ.toString())
  const [newTimelockBtcEscrow, setNewTimelockBtcEscrow] = useState(CONTRACT_CONFIG.TIMELOCK_BTC_ESCROW.toString())
  const [newTimelockRepaymentAccept, setNewTimelockRepaymentAccept] = useState(CONTRACT_CONFIG.TIMELOCK_REPAYMENT_ACCEPT.toString())
  const [newTimelockBtcCollateral, setNewTimelockBtcCollateral] = useState(CONTRACT_CONFIG.TIMELOCK_BTC_COLLATERAL.toString())

  // Get loan details for bond calculation
  const { data: loanDetails, refetch: refetchLoanDetails } = useReadContract({
    address: CONTRACTS.BTC_COLLATERAL_LOAN,
    abi: BTC_COLLATERAL_LOAN_ABI,
    functionName: 'getLoan',
    args: [BigInt(selectedLoanId || '0')],
    query: {
      enabled: !!CONTRACTS.BTC_COLLATERAL_LOAN && account.status === 'connected' && !!selectedLoanId && selectedLoanId !== '0',
    },
  }) as { data: any, refetch: () => void, error: Error | null }

  // Get loan parameters for the selected loan ID
  const { data: loanParameters, refetch: refetchLoanParameters } = useReadContract({
    address: CONTRACTS.BTC_COLLATERAL_LOAN,
    abi: BTC_COLLATERAL_LOAN_ABI,
    functionName: 'getLoanParameters',
    args: [BigInt(selectedLoanId || '0')],
    query: {
      enabled: !!CONTRACTS.BTC_COLLATERAL_LOAN && account.status === 'connected' && !!selectedLoanId && selectedLoanId !== '0',
    },
  }) as { data: any, refetch: () => void, error: Error | null }

  // Monitor transaction success and log hashes
  useEffect(() => {
    // Log transaction hashes to console for debugging
    if (extendOfferHash) {
      console.log('🚀 Extend Loan Offer Transaction Hash:', extendOfferHash)
      console.log('Transaction Details:', {
        function: 'extendLoanOffer',
        loanId: selectedLoanId,
        bondAmount: loanDetails && loanDetails.amount ? formatEther((BigInt(loanDetails.amount) * BigInt(CONTRACT_CONFIG.LENDER_BOND_PERCENTAGE)) / BigInt(100)) + ' ETH' : '0.01 ETH (fallback)',
        amountToSend: loanDetails && loanDetails.amount ? formatEther(BigInt(loanDetails.amount) + ((BigInt(loanDetails.amount) * BigInt(CONTRACT_CONFIG.LENDER_BOND_PERCENTAGE)) / BigInt(100))) + ' ETH' : '0.01 ETH (fallback)',
        hash: extendOfferHash
      })
    }
    
    if (acceptRepaymentHash) {
      console.log('💰 Accept Repayment Transaction Hash:', acceptRepaymentHash)
    }
    
    if (markAsDefaultedHash) {
      console.log('⚠️ Mark As Defaulted Transaction Hash:', markAsDefaultedHash)
    }
    
    if (updatePubkeyHash) {
      console.log('🔑 Update BTC Pubkey Transaction Hash:', updatePubkeyHash)
    }
    
    if (updateParamsHash) {
      console.log('⚙️ Update Parameters Transaction Hash:', updateParamsHash)
    }
  }, [extendOfferHash, acceptRepaymentHash, markAsDefaultedHash, updatePubkeyHash, updateParamsHash, selectedLoanId, loanDetails])

  // Refetch loan details when selectedLoanId changes
  useEffect(() => {
    if (selectedLoanId && selectedLoanId !== '0' && CONTRACTS.BTC_COLLATERAL_LOAN) {
      console.log('🔄 Refetching loan details for loan ID:', selectedLoanId)
      refetchLoanDetails()
      refetchLoanParameters()
    }
  }, [selectedLoanId, CONTRACTS.BTC_COLLATERAL_LOAN, refetchLoanDetails, refetchLoanParameters])

  // Debug loan details when they change
  useEffect(() => {
    if (loanDetails) {
      console.log('📋 Loan Details Loaded:', {
        loanId: selectedLoanId,
        data: loanDetails,
        dataType: typeof loanDetails,
        isArray: Array.isArray(loanDetails),
        length: Array.isArray(loanDetails) ? loanDetails.length : 'N/A',
        hasAmount: !!loanDetails.amount,
        amount: loanDetails.amount
      })
    }
  }, [loanDetails, selectedLoanId])



  // Get current nonce for the connected account
  const { data: currentNonce, refetch: refetchNonce } = useReadContract({
    address: CONTRACTS.BTC_COLLATERAL_LOAN,
    abi: [{ inputs: [], name: 'nonce', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }],
    functionName: 'nonce',
    args: [],
    query: {
      enabled: !!CONTRACTS.BTC_COLLATERAL_LOAN && account.status === 'connected' && !!account.addresses?.[0],
    },
  }) as { data: bigint | undefined, refetch: () => void }

  // State for account transaction nonce
  const [accountNonce, setAccountNonce] = useState<number | null>(null)

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

  // Handlers
  const handleUpdateBtcPubkey = () => {
    if (!validateWalletAndContracts()) {
      return
    }

    if (!updateBtcPubkey || !newBtcPubkey) return

    console.log('🔐 Initiating updateBtcPubkey transaction - waiting for wallet signature...')

    updateBtcPubkey({
      address: CONTRACTS.BTC_COLLATERAL_LOAN,
      abi: BTC_COLLATERAL_LOAN_ABI,
      functionName: 'updateLenderBtcPubkey',
      args: [newBtcPubkey],
    })
  }

  const handleUpdateParameters = () => {
    if (!validateWalletAndContracts()) {
      return
    }

    if (!updateParameters) return

    console.log('🔐 Initiating updateParameters transaction - waiting for wallet signature...')

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

  const handleExtendLoanOffer = async () => {
    if (!validateWalletAndContracts()) {
      return
    }

    if (!extendLoanOffer) return

    // Check and sync nonce before sending transaction
    console.log('🔍 Checking nonce before sending transaction...')
    const blockchainNonce = await checkAndSyncNonce()
    if (blockchainNonce !== null) {
      console.log('✅ Nonce synced:', blockchainNonce)
    } else {
      console.log('⚠️ Could not verify nonce, proceeding anyway...')
    }

    console.log('🔐 Initiating extendLoanOffer transaction - waiting for wallet signature...')

    // Calculate the correct total amount to send (loan amount + bond amount)
    let totalAmountToSend: bigint
    if (loanDetails && loanDetails.amount) { // loanDetails.amount is the amount field
      const loanAmount = BigInt(loanDetails.amount)
      const bondAmount = (loanAmount * BigInt(CONTRACT_CONFIG.LENDER_BOND_PERCENTAGE)) / BigInt(100) // 10% of loan amount
      totalAmountToSend = loanAmount + bondAmount // Send loan amount + bond amount
      console.log('🔍 Extend Loan Offer - Calculated Amounts:', {
        loanId: selectedLoanId,
        loanAmount: loanAmount.toString(),
        loanAmountEth: formatEther(loanAmount),
        bondAmount: bondAmount.toString(),
        bondAmountEth: formatEther(bondAmount),
        totalAmountToSend: totalAmountToSend.toString(),
        totalAmountToSendEth: formatEther(totalAmountToSend),
        preimageHashBorrower,
        preimageHashLender,
        contractAddress: CONTRACTS.BTC_COLLATERAL_LOAN
      })
    } else {
      // Fallback to hardcoded amount if loan details not available
      totalAmountToSend = parseEther('0.01')
      console.log('⚠️ Extend Loan Offer - Using Fallback Amount:', {
        loanId: selectedLoanId,
        amountToSend: totalAmountToSend.toString(),
        amountToSendEth: '0.01 ETH (fallback)',
        preimageHashBorrower,
        preimageHashLender,
        contractAddress: CONTRACTS.BTC_COLLATERAL_LOAN
      })
    }

    extendLoanOffer({
      address: CONTRACTS.BTC_COLLATERAL_LOAN,
      abi: BTC_COLLATERAL_LOAN_ABI,
      functionName: 'extendLoanOffer',
      args: [
        BigInt(selectedLoanId),
        preimageHashBorrower,
        preimageHashLender,
      ],
      value: totalAmountToSend, // send loan amount + bond amount
    })
  }

  const handleAcceptRepayment = () => {
    if (!validateWalletAndContracts()) {
      return
    }

    if (!acceptRepayment) return

    // Validate that preimageLender is provided
    if (!preimageLender || preimageLender === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      alert('❌ Error: Please provide the Lender Preimage to accept repayment. This is the actual secret value, not the hash.')
      return
    }

    console.log('🔐 Initiating acceptRepayment transaction - waiting for wallet signature...')
    console.log('📋 Selected Loan ID:', selectedLoanId)
    console.log('🔑 Preimage Lender:', preimageLender)

    acceptRepayment({
      address: CONTRACTS.BTC_COLLATERAL_LOAN,
      abi: BTC_COLLATERAL_LOAN_ABI,
      functionName: 'acceptLoanRepayment',
      args: [
        BigInt(selectedLoanId),
        preimageLender, // Use actual preimage, not preimage hash
      ],
    })
  }

  const handleMarkAsDefaulted = () => {
    if (!validateWalletAndContracts()) {
      return
    }

    if (!markAsDefaulted) return

    console.log('🔐 Initiating markAsDefaulted transaction - waiting for wallet signature...')

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
                  placeholder="Enter 64-character BTC public key..."
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
                    placeholder={CONTRACT_CONFIG.LOAN_DURATION.toString()}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Timelock Loan Request (blocks)</label>
                  <input
                    type="number"
                    value={newTimelockLoanReq}
                    onChange={(e) => setNewTimelockLoanReq(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={CONTRACT_CONFIG.TIMELOCK_LOAN_REQ.toString()}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Timelock BTC Escrow (blocks)</label>
                  <input
                    type="number"
                    value={newTimelockBtcEscrow}
                    onChange={(e) => setNewTimelockBtcEscrow(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={CONTRACT_CONFIG.TIMELOCK_BTC_ESCROW.toString()}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Timelock Repayment Accept (blocks)</label>
                  <input
                    type="number"
                    value={newTimelockRepaymentAccept}
                    onChange={(e) => setNewTimelockRepaymentAccept(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={CONTRACT_CONFIG.TIMELOCK_REPAYMENT_ACCEPT.toString()}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Timelock BTC Collateral (blocks)</label>
                  <input
                    type="number"
                    value={newTimelockBtcCollateral}
                    onChange={(e) => setNewTimelockBtcCollateral(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={CONTRACT_CONFIG.TIMELOCK_BTC_COLLATERAL.toString()}
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
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={selectedLoanId}
                    onChange={(e) => setSelectedLoanId(e.target.value)}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                  <button
                    onClick={() => {
                      refetchLoanDetails()
                      refetchLoanParameters()
                    }}
                    disabled={!selectedLoanId || selectedLoanId === '0'}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium"
                  >
                    🔄 Refresh
                  </button>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Total Loans Available: {totalLoans ? Number(totalLoans) : 0}
                </div>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lender Preimage 
                    <span className="text-red-500 ml-1">*</span>
                    <span className="text-xs text-gray-500 ml-2">(Required for Accept Repayment)</span>
                  </label>
                  <input
                    type="text"
                    value={preimageLender}
                    onChange={(e) => {
                      const value = e.target.value
                      if (value.startsWith('0x') && value.length === 66) {
                        setPreimageLender(value as `0x${string}`)
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="0x... (actual preimage, not hash)"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    <strong>Important:</strong> This is the actual preimage (secret), not the hash. Required to accept loan repayments.
                  </p>
                </div>
              </div>

              {/* Loan Details Display */}
              {selectedLoanId && selectedLoanId !== '0' && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-3">📋 Loan Details (ID: {selectedLoanId})</h4>
                  
                  {loanDetails ? (
                    <div className="space-y-2 text-sm">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <div className="font-medium text-blue-700 mb-2">Basic Information</div>
                          <div className="space-y-1 text-xs text-blue-600">
                            <div>Borrower Address: <code className="bg-blue-100 px-1 rounded">{loanDetails.borrowerAddr || 'N/A'}</code></div>
                            <div>Borrower BTC Pubkey: <code className="bg-blue-100 px-1 rounded">{loanDetails.borrowerBtcPubkey || 'N/A'}</code></div>
                            <div>Loan Amount: <code className="bg-blue-100 px-1 rounded">{loanDetails.amount ? formatEther(BigInt(loanDetails.amount)) : 'N/A'} ETH</code></div>
                            <div>Collateral Amount: <code className="bg-blue-100 px-1 rounded">N/A (Set when collateral provided)</code></div>
                            <div>Bond Amount: <code className="bg-blue-100 px-1 rounded">{loanDetails.bondAmount ? formatEther(BigInt(loanDetails.bondAmount)) : 'N/A'} ETH</code></div>
                            <div>Status: <code className="bg-blue-100 px-1 rounded">{loanDetails.status || 'N/A'}</code></div>
                          </div>
                        </div>
                        <div>
                          <div className="font-medium text-blue-700 mb-2">Timelock & Hashes</div>
                          <div className="space-y-1 text-xs text-blue-600">
                            <div>Preimage Hash Borrower: <code className="bg-blue-100 px-1 rounded">{loanDetails.preimageHashBorrower || 'N/A'}</code></div>
                            <div>Preimage Hash Lender: <code className="bg-blue-100 px-1 rounded">{loanDetails.preimageHashLender || 'N/A'}</code></div>
                            <div>Offer Block: <code className="bg-blue-100 px-1 rounded">{loanDetails.offerBlockheight ? Number(loanDetails.offerBlockheight) : 'N/A'}</code></div>
                            <div>Activation Block: <code className="bg-blue-100 px-1 rounded">{loanDetails.activationBlockheight ? Number(loanDetails.activationBlockheight) : 'N/A'}</code></div>
                            <div>Repayment Block: <code className="bg-blue-100 px-1 rounded">{loanDetails.repaymentBlockheight ? Number(loanDetails.repaymentBlockheight) : 'N/A'}</code></div>
                          </div>
                        </div>
                        <div>
                          <div className="font-medium text-blue-700 mb-2">Bitcoin Transaction</div>
                          <div className="space-y-1 text-xs text-blue-600">
                            <div>Transaction ID: <code className="bg-blue-100 px-1 rounded">{loanDetails.txid_p2tr0 || 'N/A'}</code></div>
                            <div>Output Index: <code className="bg-blue-100 px-1 rounded">{loanDetails.vout_p2tr0 || 'N/A'}</code></div>
                          </div>
                        </div>
                      </div>
                      
                      {loanDetails.amount && (
                        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                          <div className="font-medium text-green-800 mb-2">💰 Amount Calculations</div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-green-700">
                            <div>
                              <div>Loan Amount: <code className="bg-green-100 px-1 rounded">{formatEther(BigInt(loanDetails.amount))} ETH</code></div>
                              <div className="text-gray-500">({loanDetails.amount} wei)</div>
                            </div>
                            <div>
                              <div>Bond Amount (10%): <code className="bg-green-100 px-1 rounded">{formatEther((BigInt(loanDetails.amount) * BigInt(CONTRACT_CONFIG.LENDER_BOND_PERCENTAGE)) / BigInt(100))} ETH</code></div>
                              <div className="text-gray-500">({((BigInt(loanDetails.amount) * BigInt(CONTRACT_CONFIG.LENDER_BOND_PERCENTAGE)) / BigInt(100)).toString()} wei)</div>
                            </div>
                            <div>
                              <div>Total to Send: <code className="bg-green-100 px-1 rounded">{formatEther(BigInt(loanDetails.amount)) + ((BigInt(loanDetails.amount) * BigInt(CONTRACT_CONFIG.LENDER_BOND_PERCENTAGE)) / BigInt(100))} ETH</code></div>
                              <div className="text-gray-500">({(BigInt(loanDetails.amount) + ((BigInt(loanDetails.amount) * BigInt(CONTRACT_CONFIG.LENDER_BOND_PERCENTAGE)) / BigInt(100))).toString()} wei)</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Loan Parameters */}
                      {loanParameters && (
                        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded">
                          <div className="font-medium text-purple-800 mb-2">⚙️ Fixed Loan Parameters</div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-purple-700">
                            <div>
                              <div>Interest Rate: <code className="bg-purple-100 px-1 rounded">{loanParameters.int_rate ? Number(loanParameters.int_rate) : 'N/A'}</code></div>
                              <div>Processing Fee: <code className="bg-purple-100 px-1 rounded">{loanParameters.proc_fee ? formatEther(BigInt(loanParameters.proc_fee)) : 'N/A'} ETH</code></div>
                            </div>
                            <div>
                              <div>Duration: <code className="bg-purple-100 px-1 rounded">{loanParameters.duration ? Number(loanParameters.duration) : 'N/A'} blocks</code></div>
                              <div>Borrower Timelock: <code className="bg-purple-100 px-1 rounded">{loanParameters.tl_borrower ? Number(loanParameters.tl_borrower) : 'N/A'} blocks</code></div>
                              <div>Lender Timelock: <code className="bg-purple-100 px-1 rounded">{loanParameters.tl_lender ? Number(loanParameters.tl_lender) : 'N/A'} blocks</code></div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-blue-600">
                      <div>Loading loan details...</div>
                      <div className="text-xs text-blue-500 mt-1">Make sure you're connected to the correct network and the loan ID exists.</div>
                    </div>
                  )}
                </div>
              )}

              {/* Contract Constants */}
              <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <h4 className="font-medium text-purple-800 mb-2">⚙️ Contract Constants</h4>
                <div className="text-xs text-purple-700 space-y-1">
                  <div>Contract Address: <code className="bg-purple-100 px-1 rounded">{CONTRACTS.BTC_COLLATERAL_LOAN}</code></div>
                  <div>Network: <code className="bg-purple-100 px-1 rounded">{account.chainId === NETWORK_CONFIG.ANVIL.chainId ? `Anvil (${NETWORK_CONFIG.ANVIL.chainId})` : `Chain ID: ${account.chainId}`}</code></div>
                  <div>Wallet Connected: <code className="bg-purple-100 px-1 rounded">{account.status === 'connected' ? '✅ Yes' : '❌ No'}</code></div>
                  <div>Total Loans: <code className="bg-purple-100 px-1 rounded">{totalLoans ? Number(totalLoans) : 'Loading...'}</code></div>
                  <div>Account Nonce: <code className="bg-purple-100 px-1 rounded">{accountNonce !== null ? accountNonce : 'Click Refresh'}</code></div>
                </div>
                <button
                  onClick={async () => {
                    const nonce = await checkAndSyncNonce()
                    if (nonce !== null && nonce !== false) {
                      setAccountNonce(nonce)
                      console.log('✅ Nonce refreshed:', nonce)
                    }
                  }}
                  className="mt-2 px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded transition-colors"
                >
                  🔄 Refresh Nonce
                </button>
              </div>

              {/* Debug Information */}
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-medium text-yellow-800 mb-2">🔍 Debug Information</h4>
                <div className="text-xs text-yellow-700 space-y-1">
                  <div>Selected Loan ID: <code className="bg-blue-100 px-1 rounded">{selectedLoanId}</code></div>
                  <div>Loan Details: {loanDetails ? '✅ Loaded' : '❌ Not loaded'}</div>
                  {loanDetails && (
                    <>
                      <div>Data Type: <code className="bg-yellow-100 px-1 rounded">{typeof loanDetails}</code></div>
                      <div>Is Array: <code className="bg-yellow-100 px-1 rounded">{Array.isArray(loanDetails) ? 'Yes' : 'No'}</code></div>
                      <div>Length: <code className="bg-yellow-100 px-1 rounded">{Array.isArray(loanDetails) ? loanDetails.length : 'N/A'}</code></div>
                      <div>Raw Data: <code className="bg-yellow-100 px-1 rounded text-xs break-all">{serializeLoanDetails(loanDetails)}</code></div>
                    </>
                  )}
                  {loanDetails && loanDetails.amount && (
                    <>
                      <div>Loan Amount: <code className="bg-yellow-100 px-1 rounded">{formatEther(BigInt(loanDetails.amount))} ETH</code></div>
                      <div>Calculated Bond: <code className="bg-yellow-100 px-1 rounded">{formatEther((BigInt(loanDetails.amount) * BigInt(CONTRACT_CONFIG.LENDER_BOND_PERCENTAGE)) / BigInt(100))} ETH</code> (10%)</div>
                      <div>Amount to Send: <code className="bg-yellow-100 px-1 rounded">{formatEther(BigInt(loanDetails.amount) + ((BigInt(loanDetails.amount) * BigInt(CONTRACT_CONFIG.LENDER_BOND_PERCENTAGE)) / BigInt(100)))} ETH</code> (loan + bond)</div>
                    </>
                  )}
                  <div>Contract Address: <code className="bg-blue-100 px-1 rounded">{CONTRACTS.BTC_COLLATERAL_LOAN}</code></div>
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
                  disabled={acceptRepaymentLoading || !preimageLender || preimageLender === '0x0000000000000000000000000000000000000000000000000000000000000000'}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg transition-colors font-medium"
                  title={!preimageLender || preimageLender === '0x0000000000000000000000000000000000000000000000000000000000000000' ? 'Please provide the Lender Preimage to accept repayment' : ''}
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

        {/* Transaction Status Display */}
        <div className="bg-white rounded-xl shadow-lg p-6 mt-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Transaction Status</h2>
          
          {/* Current Transaction States */}
          <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h3 className="font-medium text-gray-800 mb-3">Current Transaction States</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <div className={`p-2 rounded border ${offerLoading || isExtendOfferConfirming ? 'bg-yellow-100 border-yellow-300' : 'bg-gray-100 border-gray-300'}`}>
                <div className="font-medium text-gray-700">Extend Offer</div>
                <div className="text-xs text-gray-600">
                  {offerLoading ? 'Signing...' : isExtendOfferConfirming ? 'Mining...' : 'Ready'}
                </div>
              </div>
              <div className={`p-2 rounded border ${acceptRepaymentLoading || isAcceptRepaymentConfirming ? 'bg-yellow-100 border-yellow-300' : 'bg-gray-100 border-gray-300'}`}>
                <div className="font-medium text-gray-700">Accept Repayment</div>
                <div className="text-xs text-gray-600">
                  {acceptRepaymentLoading ? 'Signing...' : isAcceptRepaymentConfirming ? 'Mining...' : 'Ready'}
                </div>
              </div>
              <div className={`p-2 rounded border ${defaultLoading || isMarkAsDefaultedConfirming ? 'bg-yellow-100 border-yellow-300' : 'bg-gray-100 border-gray-300'}`}>
                <div className="font-medium text-gray-700">Mark Defaulted</div>
                <div className="text-xs text-gray-600">
                  {defaultLoading ? 'Signing...' : isMarkAsDefaultedConfirming ? 'Mining...' : 'Ready'}
                </div>
              </div>
              <div className={`p-2 rounded border ${updatePubkeyLoading || isUpdatePubkeyConfirming ? 'bg-yellow-100 border-yellow-300' : 'bg-gray-100 border-gray-300'}`}>
                <div className="font-medium text-gray-700">Update Pubkey</div>
                <div className="text-xs text-gray-600">
                  {updatePubkeyLoading ? 'Signing...' : isUpdatePubkeyConfirming ? 'Mining...' : 'Ready'}
                </div>
              </div>
              <div className={`p-2 rounded border ${updateParamsLoading || isUpdateParamsConfirming ? 'bg-yellow-100 border-yellow-300' : 'bg-gray-100 border-gray-300'}`}>
                <div className="font-medium text-gray-700">Update Params</div>
                <div className="text-xs text-gray-600">
                  {updateParamsLoading ? 'Signing...' : isUpdateParamsConfirming ? 'Mining...' : 'Ready'}
                </div>
              </div>
            </div>
          </div>

          {/* Transaction Hashes */}
          {(extendOfferHash || acceptRepaymentHash || markAsDefaultedHash || updatePubkeyHash || updateParamsHash) && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-800 mb-3">📝 Transaction Hashes</h3>
              <div className="text-xs text-blue-700 space-y-1">
                {extendOfferHash && <div>Extend Offer: <code className="bg-blue-100 px-1 rounded">{extendOfferHash}</code></div>}
                {acceptRepaymentHash && <div>Accept Repayment: <code className="bg-blue-100 px-1 rounded">{acceptRepaymentHash}</code></div>}
                {markAsDefaultedHash && <div>Mark Defaulted: <code className="bg-blue-100 px-1 rounded">{markAsDefaultedHash}</code></div>}
                {updatePubkeyHash && <div>Update Pubkey: <code className="bg-blue-100 px-1 rounded">{updatePubkeyHash}</code></div>}
                {updateParamsHash && <div>Update Params: <code className="bg-blue-100 px-1 rounded">{updateParamsHash}</code></div>}
              </div>
            </div>
          )}
        </div>

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
