'use client'

import { useAccount, useConnect, useDisconnect, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { LOAN_FACTORY_ABI, ETHER_SWAP_ABI, BTC_COLLATERAL_LOAN_ABI, CONTRACTS } from '@/contracts'
import { ACCOUNTS, CONTRACT_CONFIG, BTC_PUBKEY_PLACEHOLDER } from '@/constants'
import { useState, useEffect } from 'react'
import Link from 'next/link'

function App() {
  const account = useAccount()
  const { connectors, connect, status, error } = useConnect()
  const { disconnect } = useDisconnect()

  // State to track if contracts are ready
  const [contractsReady, setContractsReady] = useState(false)
  
  // State to store contract addresses
  const [contractAddresses, setContractAddresses] = useState({
    LOAN_FACTORY: '',
    ETHER_SWAP: '',
    BTC_COLLATERAL_LOAN: ''
  })



  // Monitor CONTRACTS changes
  useEffect(() => {
    // Check if all contracts are available
    if (CONTRACTS.LOAN_FACTORY && CONTRACTS.ETHER_SWAP && CONTRACTS.BTC_COLLATERAL_LOAN) {
      setContractsReady(true)
      
      // Set contract addresses in state
      setContractAddresses({
        LOAN_FACTORY: CONTRACTS.LOAN_FACTORY,
        ETHER_SWAP: CONTRACTS.ETHER_SWAP,
        BTC_COLLATERAL_LOAN: CONTRACTS.BTC_COLLATERAL_LOAN
      })
    } else {
      setContractsReady(false)
    }
  }, [CONTRACTS.LOAN_FACTORY, CONTRACTS.ETHER_SWAP, CONTRACTS.BTC_COLLATERAL_LOAN])

  // Contract interactions
  const { data: loanFactoryData, isLoading: loanFactoryLoading } = useReadContract({
    address: contractAddresses.LOAN_FACTORY as `0x${string}`,
    abi: LOAN_FACTORY_ABI,
    functionName: 'getEtherSwapBytecode',
    args: [ACCOUNTS.LENDER],
    query: {
      enabled: !!contractAddresses.LOAN_FACTORY,
    },
  })

  const { writeContract: deployContracts, data: deployData, isPending: deployLoading } = useWriteContract()

  const { isLoading: deployPending, isSuccess: deploySuccess } = useWaitForTransactionReceipt({
    hash: deployData,
  })

  // Loan interaction functions
  const { writeContract: requestLoan, isPending: requestLoanLoading } = useWriteContract()
  const { writeContract: extendLoanOffer, isPending: offerLoading } = useWriteContract()
  const { writeContract: acceptLoanOffer, isPending: acceptLoading } = useWriteContract()
  const { writeContract: attemptRepayment, isPending: repaymentLoading } = useWriteContract()
  const { writeContract: acceptRepayment, isPending: acceptRepaymentLoading } = useWriteContract()

  // Loan data
  const { data: totalLoans, refetch: refetchLoans } = useReadContract({
    address: contractAddresses.BTC_COLLATERAL_LOAN as `0x${string}`,
    abi: BTC_COLLATERAL_LOAN_ABI,
    functionName: 'getTotalLoans',
    query: {
      enabled: !!contractAddresses.BTC_COLLATERAL_LOAN,
    },
  })

  const [loanAmount, setLoanAmount] = useState('0.01')
  const [collateralAmount, setCollateralAmount] = useState('0.02')
  const [selectedLoanId, setSelectedLoanId] = useState('0')
  const [preimageHashBorrower, setPreimageHashBorrower] = useState<`0x${string}`>('0x1234567890123456789012345678901234567890123456789012345678901234')
  const [preimageHashLender, setPreimageHashLender] = useState<`0x${string}`>('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890')

  const handleDeployContracts = () => {
    if (!deployContracts) return

    deployContracts({
      address: contractAddresses.LOAN_FACTORY as `0x${string}`,
      abi: LOAN_FACTORY_ABI,
      functionName: 'deployContracts',
      args: [
        BTC_PUBKEY_PLACEHOLDER,
        CONTRACT_CONFIG.LOAN_DURATION,
        CONTRACT_CONFIG.TIMELOCK_LOAN_REQ,
        CONTRACT_CONFIG.TIMELOCK_BTC_ESCROW,
        CONTRACT_CONFIG.TIMELOCK_REPAYMENT_ACCEPT,
        CONTRACT_CONFIG.TIMELOCK_BTC_COLLATERAL,
      ],
    })
  }

  const handleRequestLoan = () => {
    if (!requestLoan) return

    requestLoan({
      address: contractAddresses.BTC_COLLATERAL_LOAN as `0x${string}`,
      abi: BTC_COLLATERAL_LOAN_ABI,
      functionName: 'requestLoan',
      args: [
        parseEther(loanAmount), // amount
        BTC_PUBKEY_PLACEHOLDER, // btcAddress
        BTC_PUBKEY_PLACEHOLDER, // btcPubkey
        preimageHashBorrower, // preimageHashBorrower
      ],
      value: parseEther('0.001'), // PROCESSING_FEE
    })
  }

  const handleExtendLoanOffer = () => {
    if (!extendLoanOffer) return

    extendLoanOffer({
      address: contractAddresses.BTC_COLLATERAL_LOAN as `0x${string}`,
      abi: BTC_COLLATERAL_LOAN_ABI,
      functionName: 'extendLoanOffer',
      args: [
        BigInt(selectedLoanId), // loanId
        preimageHashBorrower, // preimageHashBorrower
        preimageHashLender, // preimageHashLender
      ],
      value: parseEther('0.01'), // bond amount (10% of loan)
    })
  }

  const handleAcceptLoanOffer = () => {
    if (!acceptLoanOffer) return

    acceptLoanOffer({
      address: contractAddresses.BTC_COLLATERAL_LOAN as `0x${string}`,
      abi: BTC_COLLATERAL_LOAN_ABI,
      functionName: 'acceptLoanOffer',
      args: [
        BigInt(selectedLoanId), // loanId
        preimageHashBorrower, // preimageBorrower
      ],
    })
  }

  const handleAttemptRepayment = () => {
    if (!attemptRepayment) return

    attemptRepayment({
      address: contractAddresses.BTC_COLLATERAL_LOAN as `0x${string}`,
      abi: BTC_COLLATERAL_LOAN_ABI,
      functionName: 'attemptRepayment',
      args: [
        BigInt(selectedLoanId), // loanId
        preimageHashLender, // preimageHashLender
      ],
      value: parseEther(loanAmount), // repayment amount
    })
  }

  const handleAcceptRepayment = () => {
    if (!acceptRepayment) return

    acceptRepayment({
      address: contractAddresses.BTC_COLLATERAL_LOAN as `0x${string}`,
      abi: BTC_COLLATERAL_LOAN_ABI,
      functionName: 'acceptLoanRepayment',
      args: [
        BigInt(selectedLoanId), // loanId
        preimageHashLender, // preimageLender
      ],
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-900">
          Bitcoin-Collateralized Loan DApp
        </h1>

        {/* Connection Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Wallet Connection</h2>
          
          <div className="mb-4">
            <div className="text-sm text-gray-600 mb-2">
              Status: <span className="font-medium">{account.status}</span>
            </div>
            {account.addresses && (
              <div className="text-sm text-gray-600 mb-2">
                Address: <span className="font-mono text-xs">{account.addresses[0]}</span>
              </div>
            )}
            {account.chainId && (
              <div className="text-sm text-gray-600 mb-2">
                Chain ID: <span className="font-medium">{account.chainId}</span>
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
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Contract Status</h2>
            

            

            




            {/* Contract Addresses Display */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg mb-4">
              <h3 className="font-medium text-gray-800 mb-3">Deployed Contract Addresses</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">LoanFactory:</span>
                  <span className="font-mono text-xs bg-white px-2 py-1 rounded border text-gray-900">
                    {contractAddresses.LOAN_FACTORY || 'Not deployed'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">EtherSwap:</span>
                  <span className="font-mono text-xs bg-white px-2 py-1 rounded border text-gray-900">
                    {contractAddresses.ETHER_SWAP || 'Not deployed'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">BtcCollateralLoan:</span>
                  <span className="font-mono text-xs bg-white px-2 py-1 rounded border text-gray-900">
                    {contractAddresses.BTC_COLLATERAL_LOAN || 'Not deployed'}
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation to Role-Specific Pages */}
            {contractAddresses.BTC_COLLATERAL_LOAN && (
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                <h3 className="font-medium text-indigo-800 mb-3">Ready to Interact?</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Link href="/lender" className="block">
                    <div className="p-4 bg-white border border-indigo-200 rounded-lg hover:border-indigo-400 transition-colors">
                      <h4 className="font-medium text-indigo-800 mb-2">🏦 Lender Dashboard</h4>
                      <p className="text-sm text-indigo-600">Manage loans, update parameters, and handle repayments</p>
                    </div>
                  </Link>
                  <Link href="/borrower" className="block">
                    <div className="p-4 bg-white border border-indigo-200 rounded-lg hover:border-indigo-400 transition-colors">
                      <h4 className="font-medium text-indigo-800 mb-2">💰 Borrower Dashboard</h4>
                      <p className="text-sm text-indigo-600">Request loans, accept offers, and manage repayments</p>
                    </div>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loan Interaction Section */}
        {contractAddresses.BTC_COLLATERAL_LOAN && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-lg font-medium mb-3">Loan Overview</h3>
            
            {/* Loan Statistics */}
            <div className="mb-4 p-3 bg-blue-50 rounded">
              <div className="text-sm text-blue-800">
                <div className="font-medium">Total Loans: {totalLoans ? Number(totalLoans) : 0}</div>
              </div>
            </div>






          </div>
        )}

        {/* Deploy Contracts */}
        {contractAddresses.LOAN_FACTORY && !contractAddresses.ETHER_SWAP && (
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">Deploy Contracts</h3>
            <div className="bg-blue-50 p-4 rounded-md mb-4">
              <div className="text-sm text-blue-800">
                <div className="font-medium mb-2">Configuration:</div>
                <div>• Loan Duration: {CONTRACT_CONFIG.LOAN_DURATION} blocks</div>
                <div>• Timelock Loan Request: {CONTRACT_CONFIG.TIMELOCK_LOAN_REQ} blocks</div>
                <div>• Timelock BTC Escrow: {CONTRACT_CONFIG.TIMELOCK_BTC_ESCROW} blocks</div>
                <div>• Timelock Repayment Accept: {CONTRACT_CONFIG.TIMELOCK_REPAYMENT_ACCEPT} blocks</div>
                <div>• Timelock BTC Collateral: {CONTRACT_CONFIG.TIMELOCK_BTC_COLLATERAL} blocks</div>
              </div>
            </div>
            
            <button
              onClick={handleDeployContracts}
              disabled={deployLoading || deployPending}
              className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-6 py-3 rounded-md transition-colors"
            >
              {deployLoading ? 'Preparing...' : deployPending ? 'Deploying...' : 'Deploy Contracts'}
            </button>
            
            {deploySuccess && (
              <div className="mt-3 text-sm text-green-600">
                ✅ Contracts deployed successfully!
              </div>
            )}
          </div>
        )}


      </div>
    </div>
  )
}

export default App
