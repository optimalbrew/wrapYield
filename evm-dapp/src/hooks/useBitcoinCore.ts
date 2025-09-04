/**
 * Bitcoin Core Integration Hook
 * 
 * This hook provides Bitcoin Core RPC integration for regtest mode,
 * allowing the frontend to interact with the local Bitcoin node.
 */

import { useState, useCallback } from 'react'

// Bitcoin Core RPC configuration
const BITCOIN_RPC_CONFIG = {
  url: 'http://localhost:18443',
  username: 'bitcoin',
  password: 'localtest',
  network: 'regtest'
}

// Bitcoin account interface
export interface BitcoinAccount {
  address: string
  publicKey: string
  privateKey: string // WIF format for regtest
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

// Bitcoin Core RPC client
class BitcoinCoreRPC {
  private config: typeof BITCOIN_RPC_CONFIG

  constructor(config: typeof BITCOIN_RPC_CONFIG) {
    this.config = config
  }

  private async rpcCall(method: string, params: any[] = []): Promise<any> {
    const response = await fetch(this.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${this.config.username}:${this.config.password}`)}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params
      })
    })

    if (!response.ok) {
      throw new Error(`RPC call failed: ${response.statusText}`)
    }

    const data = await response.json()
    
    if (data.error) {
      throw new Error(`RPC error: ${data.error.message}`)
    }

    return data.result
  }

  async getBlockchainInfo(): Promise<any> {
    return this.rpcCall('getblockchaininfo')
  }

  async getWalletInfo(): Promise<any> {
    return this.rpcCall('getwalletinfo')
  }

  async getNewAddress(label?: string): Promise<string> {
    return this.rpcCall('getnewaddress', [label || 'default', 'bech32'])
  }

  async getAddressInfo(address: string): Promise<any> {
    return this.rpcCall('getaddressinfo', [address])
  }

  async getBalance(): Promise<number> {
    return this.rpcCall('getbalance')
  }

  async listUnspent(): Promise<any[]> {
    return this.rpcCall('listunspent')
  }

  async generateToAddress(blocks: number, address: string): Promise<string[]> {
    return this.rpcCall('generatetoaddress', [blocks, address])
  }

  async sendToAddress(address: string, amount: number): Promise<string> {
    return this.rpcCall('sendtoaddress', [address, amount])
  }

  async signRawTransactionWithWallet(hexstring: string): Promise<any> {
    return this.rpcCall('signrawtransactionwithwallet', [hexstring])
  }

  async sendRawTransaction(hexstring: string): Promise<string> {
    return this.rpcCall('sendrawtransaction', [hexstring])
  }

  async getTransaction(txid: string): Promise<any> {
    return this.rpcCall('gettransaction', [txid])
  }

  async getRawTransaction(txid: string, verbose: boolean = false): Promise<any> {
    return this.rpcCall('getrawtransaction', [txid, verbose])
  }

  async createWallet(walletName: string): Promise<void> {
    return this.rpcCall('createwallet', [walletName])
  }

  async loadWallet(walletName: string): Promise<void> {
    return this.rpcCall('loadwallet', [walletName])
  }

  async listWallets(): Promise<string[]> {
    return this.rpcCall('listwallets')
  }

  async dumpPrivateKey(address: string): Promise<string> {
    return this.rpcCall('dumpprivkey', [address])
  }

  async importPrivateKey(privateKey: string, label?: string): Promise<void> {
    return this.rpcCall('importprivkey', [privateKey, label || 'imported'])
  }
}

// Main hook
export function useBitcoinCore() {
  const [bitcoinAccount, setBitcoinAccount] = useState<BitcoinAccount | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rpcClient] = useState(() => new BitcoinCoreRPC(BITCOIN_RPC_CONFIG))

  // Check Bitcoin Core connection
  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      await rpcClient.getBlockchainInfo()
      return true
    } catch (error) {
      console.error('Bitcoin Core connection failed:', error)
      return false
    }
  }, [rpcClient])

  // Connect to Bitcoin Core and create/load wallet
  const connectBitcoinCore = useCallback(async (): Promise<BitcoinAccount> => {
    setIsConnecting(true)
    setError(null)

    try {
      // Check if Bitcoin Core is running
      const isConnected = await checkConnection()
      if (!isConnected) {
        throw new Error('Bitcoin Core is not running. Please start the regtest node.')
      }

      // Check if wallet exists, create if not
      const wallets = await rpcClient.listWallets()
      if (!wallets.includes('frontend_wallet')) {
        await rpcClient.createWallet('frontend_wallet')
      } else {
        await rpcClient.loadWallet('frontend_wallet')
      }

      // Get or create a new address
      let address: string
      try {
        // Try to get an existing address
        const walletInfo = await rpcClient.getWalletInfo()
        if (walletInfo.keypoolsize > 0) {
          address = await rpcClient.getNewAddress('frontend_address')
        } else {
          address = await rpcClient.getNewAddress('frontend_address')
        }
      } catch (error) {
        // If no addresses exist, create a new one
        address = await rpcClient.getNewAddress('frontend_address')
      }

      // Get address info to extract public key
      const addressInfo = await rpcClient.getAddressInfo(address)
      
      // Get private key for signing (regtest only!)
      const privateKey = await rpcClient.dumpPrivateKey(address)

      // Generate some test coins if balance is low
      const balance = await rpcClient.getBalance()
      if (balance < 1.0) {
        console.log('Generating test coins for regtest...')
        await rpcClient.generateToAddress(101, address)
      }

      const account: BitcoinAccount = {
        address,
        publicKey: addressInfo.pubkey || '', // May need to derive from private key
        privateKey,
        connected: true
      }

      setBitcoinAccount(account)
      return account

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to Bitcoin Core'
      setError(errorMessage)
      throw err
    } finally {
      setIsConnecting(false)
    }
  }, [rpcClient, checkConnection])

  // Disconnect from Bitcoin Core
  const disconnectBitcoinCore = useCallback(async () => {
    setBitcoinAccount(null)
    setError(null)
  }, [])

  // Sign Bitcoin transaction using Bitcoin Core
  const signBitcoinTransaction = useCallback(async (transaction: BitcoinTransaction): Promise<BitcoinSignature> => {
    if (!bitcoinAccount) {
      throw new Error('Bitcoin Core not connected')
    }

    try {
      // For regtest, we can use Bitcoin Core's signing capabilities
      // This is a simplified approach - in production you'd want more sophisticated signing
      
      // Import the private key if not already imported
      try {
        await rpcClient.importPrivateKey(bitcoinAccount.privateKey, 'temp_signing_key')
      } catch (error) {
        // Key might already be imported, ignore error
      }

      // Sign the raw transaction
      const signedResult = await rpcClient.signRawTransactionWithWallet(transaction.rawTx)
      
      if (!signedResult.complete) {
        throw new Error('Transaction signing incomplete')
      }

      return {
        signature: signedResult.hex, // The signed transaction hex
        transactionId: transaction.id,
        signerType: 'borrower', // This would be determined by context
        metadata: {
          address: bitcoinAccount.address,
          publicKey: bitcoinAccount.publicKey,
          network: 'regtest'
        }
      }
    } catch (error) {
      throw new Error(`Failed to sign transaction: ${error.message}`)
    }
  }, [bitcoinAccount, rpcClient])

  // Get Bitcoin public key (derive from private key if needed)
  const getBitcoinPublicKey = useCallback(async (): Promise<string> => {
    if (!bitcoinAccount) {
      throw new Error('Bitcoin Core not connected')
    }

    // For regtest, we can derive the public key from the private key
    // This is a simplified approach
    return bitcoinAccount.publicKey
  }, [bitcoinAccount])

  // Get Bitcoin address
  const getBitcoinAddress = useCallback(async (): Promise<string> => {
    if (!bitcoinAccount) {
      throw new Error('Bitcoin Core not connected')
    }

    return bitcoinAccount.address
  }, [bitcoinAccount])

  // Get Bitcoin balance
  const getBitcoinBalance = useCallback(async (): Promise<number> => {
    if (!bitcoinAccount) {
      throw new Error('Bitcoin Core not connected')
    }

    return await rpcClient.getBalance()
  }, [bitcoinAccount, rpcClient])

  // Generate test coins (regtest only)
  const generateTestCoins = useCallback(async (blocks: number = 1): Promise<void> => {
    if (!bitcoinAccount) {
      throw new Error('Bitcoin Core not connected')
    }

    await rpcClient.generateToAddress(blocks, bitcoinAccount.address)
  }, [bitcoinAccount, rpcClient])

  // Send Bitcoin to address
  const sendBitcoin = useCallback(async (toAddress: string, amount: number): Promise<string> => {
    if (!bitcoinAccount) {
      throw new Error('Bitcoin Core not connected')
    }

    return await rpcClient.sendToAddress(toAddress, amount)
  }, [bitcoinAccount, rpcClient])

  return {
    // State
    bitcoinAccount,
    isConnecting,
    error,
    
    // Actions
    connectBitcoinCore,
    disconnectBitcoinCore,
    signBitcoinTransaction,
    getBitcoinPublicKey,
    getBitcoinAddress,
    getBitcoinBalance,
    generateTestCoins,
    sendBitcoin,
    
    // Utilities
    checkConnection,
    
    // Computed
    isConnected: !!bitcoinAccount,
    network: 'regtest'
  }
}
