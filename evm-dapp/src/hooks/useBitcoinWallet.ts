/**
 * Bitcoin Wallet Integration Hook
 * 
 * This hook provides Bitcoin wallet functionality for the unified frontend,
 * allowing users to connect Bitcoin wallets and sign Bitcoin transactions.
 */

import { useState, useEffect, useCallback } from 'react'

// Bitcoin wallet types
export type BitcoinWalletType = 'unisat' | 'xverse' | 'okx' | 'leather'

// Bitcoin account interface
export interface BitcoinAccount {
  address: string
  publicKey: string
  walletType: BitcoinWalletType
  connected: boolean
}

// Bitcoin transaction interface
export interface BitcoinTransaction {
  id: string
  rawTx: string
  inputs: Array<{
    txid: string
    vout: number
    amount: number
  }>
  outputs: Array<{
    address: string
    amount: number
  }>
  signingInstructions: {
    scriptPath: boolean
    leafIndex?: number
    tapleafScript?: string
    controlBlock?: string
  }
}

// Bitcoin signature interface
export interface BitcoinSignature {
  signature: string
  transactionId: string
  signerType: 'borrower' | 'lender'
  metadata: Record<string, any>
}

// Bitcoin wallet interface
interface BitcoinWallet {
  connect(): Promise<BitcoinAccount>
  signTransaction(transaction: BitcoinTransaction): Promise<BitcoinSignature>
  getPublicKey(): Promise<string>
  getAddress(): Promise<string>
  disconnect(): Promise<void>
}

// UniSat wallet implementation
class UniSatWallet implements BitcoinWallet {
  private account: BitcoinAccount | null = null

  async connect(): Promise<BitcoinAccount> {
    if (typeof window === 'undefined' || !window.unisat) {
      throw new Error('UniSat wallet not found. Please install UniSat wallet.')
    }

    try {
      const accounts = await window.unisat.requestAccounts()
      const publicKey = await window.unisat.getPublicKey()
      
      this.account = {
        address: accounts[0],
        publicKey,
        walletType: 'unisat',
        connected: true
      }

      return this.account
    } catch (error) {
      throw new Error(`Failed to connect UniSat wallet: ${error.message}`)
    }
  }

  async signTransaction(transaction: BitcoinTransaction): Promise<BitcoinSignature> {
    if (!this.account) {
      throw new Error('UniSat wallet not connected')
    }

    try {
      // Sign the transaction using UniSat's signing method
      const signature = await window.unisat.signPsbt(transaction.rawTx, {
        autoFinalized: false,
        toSignInputs: [{
          index: 0,
          publicKey: this.account.publicKey,
          sighashTypes: [0x01] // SIGHASH_ALL
        }]
      })

      return {
        signature,
        transactionId: transaction.id,
        signerType: 'borrower', // This would be determined by context
        metadata: {
          walletType: 'unisat',
          publicKey: this.account.publicKey,
          address: this.account.address
        }
      }
    } catch (error) {
      throw new Error(`Failed to sign transaction with UniSat: ${error.message}`)
    }
  }

  async getPublicKey(): Promise<string> {
    if (!this.account) {
      throw new Error('UniSat wallet not connected')
    }
    return this.account.publicKey
  }

  async getAddress(): Promise<string> {
    if (!this.account) {
      throw new Error('UniSat wallet not connected')
    }
    return this.account.address
  }

  async disconnect(): Promise<void> {
    this.account = null
  }
}

// Xverse wallet implementation
class XverseWallet implements BitcoinWallet {
  private account: BitcoinAccount | null = null

  async connect(): Promise<BitcoinAccount> {
    if (typeof window === 'undefined' || !window.XverseProviders) {
      throw new Error('Xverse wallet not found. Please install Xverse wallet.')
    }

    try {
      const provider = window.XverseProviders.BitcoinProvider
      const accounts = await provider.requestAccounts()
      const publicKey = await provider.getPublicKey()
      
      this.account = {
        address: accounts[0],
        publicKey,
        walletType: 'xverse',
        connected: true
      }

      return this.account
    } catch (error) {
      throw new Error(`Failed to connect Xverse wallet: ${error.message}`)
    }
  }

  async signTransaction(transaction: BitcoinTransaction): Promise<BitcoinSignature> {
    if (!this.account) {
      throw new Error('Xverse wallet not connected')
    }

    try {
      const provider = window.XverseProviders.BitcoinProvider
      const signature = await provider.signPsbt(transaction.rawTx, {
        autoFinalized: false
      })

      return {
        signature,
        transactionId: transaction.id,
        signerType: 'borrower',
        metadata: {
          walletType: 'xverse',
          publicKey: this.account.publicKey,
          address: this.account.address
        }
      }
    } catch (error) {
      throw new Error(`Failed to sign transaction with Xverse: ${error.message}`)
    }
  }

  async getPublicKey(): Promise<string> {
    if (!this.account) {
      throw new Error('Xverse wallet not connected')
    }
    return this.account.publicKey
  }

  async getAddress(): Promise<string> {
    if (!this.account) {
      throw new Error('Xverse wallet not connected')
    }
    return this.account.address
  }

  async disconnect(): Promise<void> {
    this.account = null
  }
}

// Wallet factory
function createBitcoinWallet(walletType: BitcoinWalletType): BitcoinWallet {
  switch (walletType) {
    case 'unisat':
      return new UniSatWallet()
    case 'xverse':
      return new XverseWallet()
    case 'okx':
      // TODO: Implement OKX wallet
      throw new Error('OKX wallet not implemented yet')
    case 'leather':
      // TODO: Implement Leather wallet
      throw new Error('Leather wallet not implemented yet')
    default:
      throw new Error(`Unsupported wallet type: ${walletType}`)
  }
}

// Main hook
export function useBitcoinWallet() {
  const [bitcoinAccount, setBitcoinAccount] = useState<BitcoinAccount | null>(null)
  const [bitcoinWallet, setBitcoinWallet] = useState<BitcoinWallet | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if wallet is available
  const isWalletAvailable = useCallback((walletType: BitcoinWalletType): boolean => {
    if (typeof window === 'undefined') return false

    switch (walletType) {
      case 'unisat':
        return !!window.unisat
      case 'xverse':
        return !!window.XverseProviders
      case 'okx':
        return !!window.okxwallet
      case 'leather':
        return !!window.leather
      default:
        return false
    }
  }, [])

  // Get available wallets
  const getAvailableWallets = useCallback((): BitcoinWalletType[] => {
    const availableWallets: BitcoinWalletType[] = []
    
    if (isWalletAvailable('unisat')) availableWallets.push('unisat')
    if (isWalletAvailable('xverse')) availableWallets.push('xverse')
    if (isWalletAvailable('okx')) availableWallets.push('okx')
    if (isWalletAvailable('leather')) availableWallets.push('leather')
    
    return availableWallets
  }, [isWalletAvailable])

  // Connect to Bitcoin wallet
  const connectBitcoinWallet = useCallback(async (walletType: BitcoinWalletType) => {
    if (!isWalletAvailable(walletType)) {
      throw new Error(`${walletType} wallet not available`)
    }

    setIsConnecting(true)
    setError(null)

    try {
      const wallet = createBitcoinWallet(walletType)
      const account = await wallet.connect()
      
      setBitcoinWallet(wallet)
      setBitcoinAccount(account)
      
      return account
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect wallet'
      setError(errorMessage)
      throw err
    } finally {
      setIsConnecting(false)
    }
  }, [isWalletAvailable])

  // Disconnect Bitcoin wallet
  const disconnectBitcoinWallet = useCallback(async () => {
    if (bitcoinWallet) {
      await bitcoinWallet.disconnect()
    }
    
    setBitcoinWallet(null)
    setBitcoinAccount(null)
    setError(null)
  }, [bitcoinWallet])

  // Sign Bitcoin transaction
  const signBitcoinTransaction = useCallback(async (transaction: BitcoinTransaction): Promise<BitcoinSignature> => {
    if (!bitcoinWallet) {
      throw new Error('Bitcoin wallet not connected')
    }

    try {
      return await bitcoinWallet.signTransaction(transaction)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign transaction'
      setError(errorMessage)
      throw err
    }
  }, [bitcoinWallet])

  // Get Bitcoin public key
  const getBitcoinPublicKey = useCallback(async (): Promise<string> => {
    if (!bitcoinWallet) {
      throw new Error('Bitcoin wallet not connected')
    }

    return await bitcoinWallet.getPublicKey()
  }, [bitcoinWallet])

  // Get Bitcoin address
  const getBitcoinAddress = useCallback(async (): Promise<string> => {
    if (!bitcoinWallet) {
      throw new Error('Bitcoin wallet not connected')
    }

    return await bitcoinWallet.getAddress()
  }, [bitcoinWallet])

  // Auto-connect on mount if previously connected
  useEffect(() => {
    const connectOnMount = async () => {
      const savedWalletType = localStorage.getItem('bitcoin-wallet-type') as BitcoinWalletType
      if (savedWalletType && isWalletAvailable(savedWalletType)) {
        try {
          await connectBitcoinWallet(savedWalletType)
        } catch (error) {
          // Silently fail auto-connect
          console.warn('Failed to auto-connect Bitcoin wallet:', error)
        }
      }
    }

    connectOnMount()
  }, [connectBitcoinWallet, isWalletAvailable])

  // Save wallet type when connected
  useEffect(() => {
    if (bitcoinAccount) {
      localStorage.setItem('bitcoin-wallet-type', bitcoinAccount.walletType)
    } else {
      localStorage.removeItem('bitcoin-wallet-type')
    }
  }, [bitcoinAccount])

  return {
    // State
    bitcoinAccount,
    bitcoinWallet,
    isConnecting,
    error,
    
    // Wallet availability
    isWalletAvailable,
    getAvailableWallets,
    
    // Actions
    connectBitcoinWallet,
    disconnectBitcoinWallet,
    signBitcoinTransaction,
    getBitcoinPublicKey,
    getBitcoinAddress,
    
    // Computed
    isConnected: !!bitcoinAccount,
    walletType: bitcoinAccount?.walletType || null
  }
}

// Type declarations for window object
declare global {
  interface Window {
    unisat?: {
      requestAccounts(): Promise<string[]>
      getPublicKey(): Promise<string>
      signPsbt(psbt: string, options?: any): Promise<string>
    }
    XverseProviders?: {
      BitcoinProvider: {
        requestAccounts(): Promise<string[]>
        getPublicKey(): Promise<string>
        signPsbt(psbt: string, options?: any): Promise<string>
      }
    }
    okxwallet?: any
    leather?: any
  }
}
