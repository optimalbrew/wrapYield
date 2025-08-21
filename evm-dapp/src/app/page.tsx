'use client'

import { useConnect, useDisconnect, useReadContract } from 'wagmi'
import { BTC_COLLATERAL_LOAN_ABI, CONTRACTS } from '@/contracts'
import { NETWORK_CONFIG } from '@/constants'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useWalletValidation } from '@/hooks/useWalletValidation'
import { switchToAnvil } from '@/utils/networkUtils'

function App() {
  const { validateWalletAndContracts, account } = useWalletValidation()
  const { connectors, connect, status, error } = useConnect()
  const { disconnect } = useDisconnect()



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



  // Loan data
  const { data: totalLoans, refetch: refetchLoans } = useReadContract({
    address: contractAddresses.BTC_COLLATERAL_LOAN as `0x${string}`,
    abi: BTC_COLLATERAL_LOAN_ABI,
    functionName: 'getTotalLoans',
    query: {
      enabled: !!contractAddresses.BTC_COLLATERAL_LOAN,
    },
  })



  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-900">
          Bitcoin-Collateralized Loan DApp
        </h1>
        


        {/* Connection Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Wallet Connection</h2>
          
          {/* Network Instructions */}
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h3 className="text-sm font-medium text-blue-800 mb-2">📋 Setup Instructions</h3>
            <div className="text-xs text-blue-700 space-y-1">
              <div>1. Start Anvil: <code className="bg-blue-100 px-1 rounded">anvil --mnemonic-seed-unsafe 2</code></div>
              <div>2. Connect your wallet (MetaMask, etc.)</div>
              <div>3. Add Anvil network: RPC URL <code className="bg-blue-100 px-1 rounded">{NETWORK_CONFIG.ANVIL.rpcUrl}</code>, Chain ID <code className="bg-blue-100 px-1 rounded">{NETWORK_CONFIG.ANVIL.chainId}</code></div>
              <div>4. Switch to Anvil network in your wallet</div>
            </div>
          </div>




          
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
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Contract Status</h2>
            
            {/* Contract Addresses Display */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg mb-4">
              <h3 className="font-medium text-gray-800 mb-3">Deployed Contract Addresses</h3>
              <div className="space-y-2 text-sm">
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
      </div>
    </div>
  )
}

export default App
