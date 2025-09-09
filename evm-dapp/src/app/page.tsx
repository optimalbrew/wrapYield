'use client'

import { useReadContract } from 'wagmi'
import { BTC_COLLATERAL_LOAN_ABI, ETHER_SWAP_ABI, CONTRACTS } from '@/contracts'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useWalletValidation } from '@/hooks/useWalletValidation'

function App() {
  const { account } = useWalletValidation()

  // State to track if contracts are ready
  const [contractsReady, setContractsReady] = useState(false)
  
  // State to store contract addresses
  const [contractAddresses, setContractAddresses] = useState({
    ETHER_SWAP: '',
    BTC_COLLATERAL_LOAN: ''
  })

  // Monitor CONTRACTS changes
  useEffect(() => {
    // Check if all contracts are available
    if (CONTRACTS.ETHER_SWAP && CONTRACTS.BTC_COLLATERAL_LOAN) {
      setContractsReady(true)
      
      // Set contract addresses in state
      setContractAddresses({
        ETHER_SWAP: CONTRACTS.ETHER_SWAP,
        BTC_COLLATERAL_LOAN: CONTRACTS.BTC_COLLATERAL_LOAN
      })
    } else {
      setContractsReady(false)
    }
  }, [CONTRACTS.ETHER_SWAP, CONTRACTS.BTC_COLLATERAL_LOAN])



  // Contract verification - check if contracts are actually deployed
  const { data: totalLoans, error: btcLoanError } = useReadContract({
    address: contractAddresses.BTC_COLLATERAL_LOAN as `0x${string}`,
    abi: BTC_COLLATERAL_LOAN_ABI,
    functionName: 'getTotalLoans',
    query: {
      enabled: !!contractAddresses.BTC_COLLATERAL_LOAN,
    },
  })

  // Fetch loan parameters from the contract
  const { data: loanDuration } = useReadContract({
    address: contractAddresses.BTC_COLLATERAL_LOAN as `0x${string}`,
    abi: BTC_COLLATERAL_LOAN_ABI,
    functionName: 'loanDuration',
    query: {
      enabled: !!contractAddresses.BTC_COLLATERAL_LOAN,
    },
  })

  const { data: loanInterestRate } = useReadContract({
    address: contractAddresses.BTC_COLLATERAL_LOAN as `0x${string}`,
    abi: BTC_COLLATERAL_LOAN_ABI,
    functionName: 'loanInterestRate',
    query: {
      enabled: !!contractAddresses.BTC_COLLATERAL_LOAN,
    },
  })

  const { data: minLoanAmount } = useReadContract({
    address: contractAddresses.BTC_COLLATERAL_LOAN as `0x${string}`,
    abi: BTC_COLLATERAL_LOAN_ABI,
    functionName: 'MIN_LOAN_AMOUNT',
    query: {
      enabled: !!contractAddresses.BTC_COLLATERAL_LOAN,
    },
  })

  const { data: processingFee } = useReadContract({
    address: contractAddresses.BTC_COLLATERAL_LOAN as `0x${string}`,
    abi: BTC_COLLATERAL_LOAN_ABI,
    functionName: 'PROCESSING_FEE',
    query: {
      enabled: !!contractAddresses.BTC_COLLATERAL_LOAN,
    },
  })

  const { data: lenderBondPercentage } = useReadContract({
    address: contractAddresses.BTC_COLLATERAL_LOAN as `0x${string}`,
    abi: BTC_COLLATERAL_LOAN_ABI,
    functionName: 'LENDER_BOND_PERCENTAGE',
    query: {
      enabled: !!contractAddresses.BTC_COLLATERAL_LOAN,
    },
  })

  const { data: originFeePercentage } = useReadContract({
    address: contractAddresses.BTC_COLLATERAL_LOAN as `0x${string}`,
    abi: BTC_COLLATERAL_LOAN_ABI,
    functionName: 'ORIGIN_FEE_PERCENTAGE',
    query: {
      enabled: !!contractAddresses.BTC_COLLATERAL_LOAN,
    },
  })

  const { data: timelockLoanReq } = useReadContract({
    address: contractAddresses.BTC_COLLATERAL_LOAN as `0x${string}`,
    abi: BTC_COLLATERAL_LOAN_ABI,
    functionName: 'timelockLoanReq',
    query: {
      enabled: !!contractAddresses.BTC_COLLATERAL_LOAN,
    },
  })

  const { data: timelockBtcEscrow } = useReadContract({
    address: contractAddresses.BTC_COLLATERAL_LOAN as `0x${string}`,
    abi: BTC_COLLATERAL_LOAN_ABI,
    functionName: 'timelockBtcEscrow',
    query: {
      enabled: !!contractAddresses.BTC_COLLATERAL_LOAN,
    },
  })

  const { data: timelockRepaymentAccept } = useReadContract({
    address: contractAddresses.BTC_COLLATERAL_LOAN as `0x${string}`,
    abi: BTC_COLLATERAL_LOAN_ABI,
    functionName: 'timelockRepaymentAccept',
    query: {
      enabled: !!contractAddresses.BTC_COLLATERAL_LOAN,
    },
  })

  const { data: timelockBtcCollateral } = useReadContract({
    address: contractAddresses.BTC_COLLATERAL_LOAN as `0x${string}`,
    abi: BTC_COLLATERAL_LOAN_ABI,
    functionName: 'timelockBtcCollateral',
    query: {
      enabled: !!contractAddresses.BTC_COLLATERAL_LOAN,
    },
  })

  // Verify EtherSwap contract by calling a simple view function
  const { data: etherSwapVersion, error: etherSwapError } = useReadContract({
    address: contractAddresses.ETHER_SWAP as `0x${string}`,
    abi: ETHER_SWAP_ABI,
    functionName: 'version',
    query: {
      enabled: !!contractAddresses.ETHER_SWAP,
    },
  })

  // Alternative verification for EtherSwap - try authorizedContract function
  const { data: authorizedContract, error: authorizedContractError } = useReadContract({
    address: contractAddresses.ETHER_SWAP as `0x${string}`,
    abi: ETHER_SWAP_ABI,
    functionName: 'authorizedContract',
    query: {
      enabled: !!contractAddresses.ETHER_SWAP,
    },
  })

  // Debug: Log the error details
  useEffect(() => {
    if (etherSwapError) {
      console.log('EtherSwap Error:', etherSwapError)
    }
    if (btcLoanError) {
      console.log('BtcCollateralLoan Error:', btcLoanError)
    }
  }, [etherSwapError, btcLoanError])



  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-900">
          Bitcoin-Collateralized Loan DApp
        </h1>

        {/* Navigation to Role-Specific Pages */}
        {account.status === 'connected' && contractAddresses.BTC_COLLATERAL_LOAN && !btcLoanError && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
              <h3 className="font-medium text-indigo-800 mb-3">Ready to Interact?</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link href="/lender" className="block">
                  <div className="p-4 bg-white border border-indigo-200 rounded-lg hover:border-indigo-400 transition-colors">
                    <h4 className="font-medium text-indigo-800 mb-2">🏦 Lender Dashboard</h4>
                    <p className="text-sm text-indigo-600">Manage loans, update parameters</p>
                  </div>
                </Link>
                <Link href="/borrower" className="block">
                  <div className="p-4 bg-white border border-indigo-200 rounded-lg hover:border-indigo-400 transition-colors">
                    <h4 className="font-medium text-indigo-800 mb-2">💰 Borrower Dashboard</h4>
                    <p className="text-sm text-indigo-600">Request loans, accept loan offers, and repay loans</p>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Contract Status */}
        {account.status === 'connected' && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Contract Status</h2>
            
            {/* Contract Verification Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="font-medium text-purple-800">BtcCollateralLoan</div>
                <div className="text-purple-600">
                  {contractAddresses.BTC_COLLATERAL_LOAN ? (
                    btcLoanError ? (
                      <span className="text-red-600">❌ Not Deployed</span>
                    ) : (
                      <span className="text-purple-700">✅ Deployed</span>
                    )
                  ) : (
                    <span className="text-gray-500">⚠️ No Address Configured</span>
                  )}
                </div>
                {contractAddresses.BTC_COLLATERAL_LOAN && (
                  <div className="text-xs text-gray-500 mt-1 font-mono">
                    {contractAddresses.BTC_COLLATERAL_LOAN}
                  </div>
                )}
                {totalLoans !== undefined && (
                  <div className="text-xs text-purple-500 mt-1 font-mono">
                    Total Loans Applications: {Number(totalLoans)}
                  </div>
                )}
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="font-medium text-blue-800">EtherSwap</div>
                <div className="text-blue-600">
                  {contractAddresses.ETHER_SWAP ? (
                    (etherSwapError && authorizedContractError) ? (
                      <span className="text-red-600">❌ Not Deployed</span>
                    ) : (
                      <span className="text-blue-700">
                        ✅ Deployed 
                        {typeof etherSwapVersion === 'number' ? ` (v${etherSwapVersion})` : ''}
                      </span>
                    )
                  ) : (
                    <span className="text-gray-500">⚠️ No Address Configured</span>
                  )}
                </div>
                {contractAddresses.ETHER_SWAP && (
                  <div className="text-xs text-gray-500 mt-1 font-mono">
                    {contractAddresses.ETHER_SWAP}
                  </div>
                )}
                {authorizedContract && (
                  <div className="text-xs text-blue-500 mt-1 font-mono">
                    Authorized Contract (BtcCollateralLoan): {authorizedContract}
                  </div>
                )}
              </div>
            </div>

            {/* Error Details */}
            {(etherSwapError || btcLoanError || authorizedContractError) && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="font-medium text-red-800 mb-2">⚠️ Contract Verification Issues</h3>
                <div className="text-sm text-red-700 space-y-1">
                  {etherSwapError && (
                    <div>EtherSwap (version): {etherSwapError.message}</div>
                  )}
                  {authorizedContractError && (
                    <div>EtherSwap (authorizedContract): {authorizedContractError.message}</div>
                  )}
                  {btcLoanError && (
                    <div>BtcCollateralLoan: {btcLoanError.message}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loan Parameters Section */}
        {contractAddresses.BTC_COLLATERAL_LOAN && !btcLoanError && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Current Loan Parameters</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Basic Parameters */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-medium text-green-800 mb-3">Basic Parameters</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-700">Loan Duration:</span>
                    <span className="font-mono text-green-800">
                      {loanDuration ? `${Number(loanDuration)} blocks` : 'Loading...'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Interest Rate*:</span>
                    <span className="font-mono text-green-800">
                      {loanInterestRate !== undefined ? `${Number(loanInterestRate)} bps` : 'Loading...'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Min Loan Amount:</span>
                    <span className="font-mono text-green-800">
                      {minLoanAmount ? `${Number(minLoanAmount) / 1e18} rBTC` : 'Loading...'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Processing Fee (refundable):</span>
                    <span className="font-mono text-green-800">
                      {processingFee ? `${Number(processingFee) / 1e18} rBTC` : 'Loading...'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Lender Bond:</span>
                    <span className="font-mono text-green-800">
                      {lenderBondPercentage ? `${Number(lenderBondPercentage)}%` : 'Loading...'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Origination Fee:</span>
                    <span className="font-mono text-green-800">
                      {originFeePercentage ? `${Number(originFeePercentage)}%` : 'Loading...'}
                    </span>
                  </div>
                  <p className="text-green-700">* Interest Rate is currently disabled. But there
                    is an origination fee.
                  </p>
                </div>
              </div>

              {/* Timelock Parameters */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-medium text-blue-800 mb-3">Timelock Parameters</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-700">Loan Request:</span>
                    <span className="font-mono text-blue-800">
                      {timelockLoanReq ? `${Number(timelockLoanReq)} blocks` : 'Loading...'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">BTC Escrow:</span>
                    <span className="font-mono text-blue-800">
                      {timelockBtcEscrow ? `${Number(timelockBtcEscrow)} blocks` : 'Loading...'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Repayment Accept:</span>
                    <span className="font-mono text-blue-800">
                      {timelockRepaymentAccept ? `${Number(timelockRepaymentAccept)} blocks` : 'Loading...'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">BTC Collateral:</span>
                    <span className="font-mono text-blue-800">
                      {timelockBtcCollateral ? `${Number(timelockBtcCollateral)} blocks` : 'Loading...'}
                    </span>
                  </div>
                  <p className="text-blue-700">All block numbers refer to Rootstock blocks. 
                    For BTC escrow and BTC collateral P2TR scripts, the relative timelocks are implemented (OP_CSV) using a ratio of 1:20.
                  </p>
                </div>
              </div>

              {/* Summary */}
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <h3 className="font-medium text-purple-800 mb-3">Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="text-purple-700">
                    <div className="font-medium">Total Loan Applications:</div>
                    <div className="font-mono text-purple-800">
                      {totalLoans ? Number(totalLoans) : 0}
                    </div>
                  </div>
                  <div className="text-purple-700">
                    <div className="font-medium">Contract Status:</div>
                    <div className="text-green-600 font-medium">✅ Active</div>
                  </div>
                  <div className="text-purple-700">
                    <div className="font-medium">Last Updated:</div>
                    <div className="text-xs text-purple-600">Real-time from blockchain</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        
      </div>
    </div>
  )
}

export default App
