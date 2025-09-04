/**
 * Unified Dashboard Component
 * 
 * This component provides a unified interface for managing both EVM and Bitcoin
 * operations in a single dashboard, showing cross-chain status and wallet connections.
 */

import React, { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useBitcoinWallet } from '@/hooks/useBitcoinWallet'
import { UnifiedLoanCard } from './UnifiedLoanCard'

// Wallet status component
function WalletStatus() {
  const { address, isConnected: isEVMConnected } = useAccount()
  const { bitcoinAccount, isConnected: isBitcoinConnected, getAvailableWallets } = useBitcoinWallet()
  const { connect } = useConnect()
  const { disconnect: disconnectEVM } = useDisconnect()

  const availableBitcoinWallets = getAvailableWallets()

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Wallet Status</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* EVM Wallet */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">EVM Wallet</h3>
            <div className={`w-3 h-3 rounded-full ${isEVMConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          </div>
          
          {isEVMConnected ? (
            <div>
              <div className="text-sm text-gray-600 mb-2">
                Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
              </div>
              <button
                onClick={() => disconnectEVM()}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div>
              <div className="text-sm text-gray-600 mb-3">
                Connect your EVM wallet to interact with smart contracts
              </div>
              <button
                onClick={() => connect()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Connect EVM Wallet
              </button>
            </div>
          )}
        </div>

        {/* Bitcoin Wallet */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">Bitcoin Wallet</h3>
            <div className={`w-3 h-3 rounded-full ${isBitcoinConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          </div>
          
          {isBitcoinConnected ? (
            <div>
              <div className="text-sm text-gray-600 mb-2">
                Connected: {bitcoinAccount?.address.slice(0, 6)}...{bitcoinAccount?.address.slice(-4)}
              </div>
              <div className="text-xs text-gray-500 mb-2">
                Wallet: {bitcoinAccount?.walletType}
              </div>
              <button
                onClick={() => disconnectBitcoinWallet()}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div>
              <div className="text-sm text-gray-600 mb-3">
                Connect your Bitcoin wallet to sign Bitcoin transactions
              </div>
              {availableBitcoinWallets.length > 0 ? (
                <div className="space-y-2">
                  {availableBitcoinWallets.map((walletType) => (
                    <button
                      key={walletType}
                      onClick={() => connectBitcoinWallet(walletType)}
                      className="block w-full px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700"
                    >
                      Connect {walletType.charAt(0).toUpperCase() + walletType.slice(1)}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">
                  No Bitcoin wallets detected. Please install UniSat, Xverse, or another compatible wallet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// System status component
function SystemStatus() {
  const [systemHealth, setSystemHealth] = useState({
    backend: 'unknown',
    pythonApi: 'unknown',
    evmNode: 'unknown',
    bitcoinNode: 'unknown'
  })

  useEffect(() => {
    const checkSystemHealth = async () => {
      try {
        const response = await fetch('/api/health')
        const health = await response.json()
        setSystemHealth(health.services || {})
      } catch (error) {
        console.error('Failed to check system health:', error)
      }
    }

    checkSystemHealth()
    const interval = setInterval(checkSystemHealth, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800'
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800'
      case 'unhealthy':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">System Status</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center">
          <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(systemHealth.backend)}`}>
            Backend
          </div>
        </div>
        <div className="text-center">
          <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(systemHealth.pythonApi)}`}>
            Python API
          </div>
        </div>
        <div className="text-center">
          <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(systemHealth.evmNode)}`}>
            EVM Node
          </div>
        </div>
        <div className="text-center">
          <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(systemHealth.bitcoinNode)}`}>
            Bitcoin Node
          </div>
        </div>
      </div>
    </div>
  )
}

// Loan statistics component
function LoanStatistics() {
  const [stats, setStats] = useState({
    totalLoans: 0,
    activeLoans: 0,
    completedLoans: 0,
    totalVolume: '0'
  })

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/loans/statistics')
        const data = await response.json()
        setStats(data)
      } catch (error) {
        console.error('Failed to fetch loan statistics:', error)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Loan Statistics</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.totalLoans}</div>
          <div className="text-sm text-gray-600">Total Loans</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.activeLoans}</div>
          <div className="text-sm text-gray-600">Active Loans</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{stats.completedLoans}</div>
          <div className="text-sm text-gray-600">Completed</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">{stats.totalVolume}</div>
          <div className="text-sm text-gray-600">Total Volume (ETH)</div>
        </div>
      </div>
    </div>
  )
}

// Main unified dashboard component
export function UnifiedDashboard() {
  const { address } = useAccount()
  const { bitcoinAccount } = useBitcoinWallet()
  const [loans, setLoans] = useState<any[]>([])
  const [userRole, setUserRole] = useState<'borrower' | 'lender'>('borrower')
  const [isLoading, setIsLoading] = useState(true)

  // Fetch user's loans
  useEffect(() => {
    const fetchLoans = async () => {
      if (!address) return

      setIsLoading(true)
      try {
        const response = await fetch(`/api/loans/user/${address}`)
        const data = await response.json()
        setLoans(data.loans || [])
      } catch (error) {
        console.error('Failed to fetch loans:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchLoans()
  }, [address])

  // Handle loan status updates
  const handleLoanStatusUpdate = (loanId: string, status: any) => {
    setLoans(prevLoans => 
      prevLoans.map(loan => 
        loan.id === loanId 
          ? { ...loan, crossChainStatus: status }
          : loan
      )
    )
  }

  // Determine user role based on loan data
  useEffect(() => {
    if (loans.length > 0) {
      const hasBorrowerLoans = loans.some(loan => loan.borrowerAddress === address)
      const hasLenderLoans = loans.some(loan => loan.lenderAddress === address)
      
      if (hasBorrowerLoans && !hasLenderLoans) {
        setUserRole('borrower')
      } else if (hasLenderLoans && !hasBorrowerLoans) {
        setUserRole('lender')
      } else {
        // User has both types of loans, default to borrower
        setUserRole('borrower')
      }
    }
  }, [loans, address])

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">BTC Yield Protocol</h1>
          <p className="mt-2 text-lg text-gray-600">
            Unified dashboard for Bitcoin-collateralized lending
          </p>
        </div>

        {/* Wallet Status */}
        <WalletStatus />

        {/* System Status */}
        <SystemStatus />

        {/* Loan Statistics */}
        <LoanStatistics />

        {/* User Role Toggle */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">My Loans</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setUserRole('borrower')}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  userRole === 'borrower'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                As Borrower
              </button>
              <button
                onClick={() => setUserRole('lender')}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  userRole === 'lender'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                As Lender
              </button>
            </div>
          </div>
        </div>

        {/* Loans List */}
        {isLoading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading loans...</p>
          </div>
        ) : loans.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No loans found</h3>
            <p className="text-gray-600">
              {userRole === 'borrower' 
                ? 'You haven\'t requested any loans yet.'
                : 'You haven\'t offered any loans yet.'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {loans
              .filter(loan => 
                userRole === 'borrower' 
                  ? loan.borrowerAddress === address
                  : loan.lenderAddress === address
              )
              .map(loan => (
                <UnifiedLoanCard
                  key={loan.id}
                  loan={loan}
                  userRole={userRole}
                  onStatusUpdate={handleLoanStatusUpdate}
                />
              ))
            }
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors">
              <div className="text-center">
                <div className="text-2xl mb-2">💰</div>
                <div className="font-medium text-gray-900">Request New Loan</div>
                <div className="text-sm text-gray-600">Create a new Bitcoin-collateralized loan</div>
              </div>
            </button>
            
            <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors">
              <div className="text-center">
                <div className="text-2xl mb-2">🏦</div>
                <div className="font-medium text-gray-900">Browse Loan Requests</div>
                <div className="text-sm text-gray-600">View and offer loans to borrowers</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
