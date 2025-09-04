/**
 * Foundry-based EVM Service
 * 
 * This service uses Foundry's Cast tool for EVM interactions,
 * maintaining consistency with the existing Foundry development setup.
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

// Configuration
const FOUNDRY_PROJECT_PATH = path.join(__dirname, '../../../evmchain')
const RPC_URL = process.env.EVM_RPC_URL || 'http://127.0.0.1:8545' // Match evm-dapp setup
const CHAIN_ID = process.env.EVM_CHAIN_ID || '31337' // Anvil default

// Deterministic accounts from anvil --mnemonic-seed-unsafe 2
const DETERMINISTIC_ACCOUNTS = {
  // Account 0 (deployer)
  DEPLOYER: {
    address: '0x8995E44a22e303A79bdD2E6e41674fb92d620863',
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
  },
  // Account 1 (used in deployment script)
  DEPLOYER_ALT: {
    address: '0xE9e05C9f02e10FA833D379CB1c7aC3a3f23B247e',
    privateKey: '0xd6a036f561e03196779dd34bf3d141dec4737eec5ed0416e413985ca05dad51a'
  },
  // Account 2
  ACCOUNT_2: {
    address: '0x61Da7c7F97EBE53AD7c4E5eCD3d117E7Ab430eA7',
    privateKey: '0x5de4111daa5ba4a5b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
  },
  // Account 3
  ACCOUNT_3: {
    address: '0x5b0248e30583CeD4F09726C547935552C469EB24',
    privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6'
  }
}

// Contract configurations
const CONTRACTS = {
  BTC_COLLATERAL_LOAN: {
    address: process.env.BTC_COLLATERAL_LOAN_ADDRESS || '0x02b8aFd8146b7Bc6BD4F02782c18bd4649Be1605',
    abi: 'BtcCollateralLoan' // Reference to foundry artifact
  },
  ETHER_SWAP: {
    address: process.env.ETHER_SWAP_ADDRESS || '0x9048077ab9aC4DEFf1444323887f23C422F15AAb',
    abi: 'EtherSwap'
  }
}

export interface TransactionResult {
  transactionHash: string
  blockNumber: number
  gasUsed: string
  status: 'success' | 'failed'
  logs?: any[]
}

export interface EventLog {
  address: string
  topics: string[]
  data: string
  blockNumber: number
  transactionHash: string
  logIndex: number
}

export class FoundryEVMService {
  private rpcUrl: string
  private chainId: string

  constructor(rpcUrl: string = RPC_URL, chainId: string = CHAIN_ID) {
    this.rpcUrl = rpcUrl
    this.chainId = chainId
  }

  /**
   * Call a contract function (read-only)
   */
  async callContract(
    contractAddress: string,
    functionSignature: string,
    args: string[] = []
  ): Promise<string> {
    try {
      const argsStr = args.length > 0 ? args.join(' ') : ''
      const cmd = `cast call ${contractAddress} "${functionSignature}" ${argsStr} --rpc-url ${this.rpcUrl}`
      
      console.log(`🔍 Cast call: ${cmd}`)
      const { stdout, stderr } = await execAsync(cmd, { cwd: FOUNDRY_PROJECT_PATH })
      
      if (stderr) {
        console.warn(`Cast call warning: ${stderr}`)
      }
      
      return stdout.trim()
    } catch (error) {
      console.error(`❌ Cast call failed: ${error}`)
      throw new Error(`Contract call failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Send a transaction to a contract
   */
  async sendTransaction(
    privateKey: string,
    contractAddress: string,
    functionSignature: string,
    args: string[] = [],
    value: string = '0'
  ): Promise<TransactionResult> {
    try {
      const argsStr = args.length > 0 ? args.join(' ') : ''
      const valueStr = value !== '0' ? `--value ${value}` : ''
      
      const cmd = `cast send ${contractAddress} "${functionSignature}" ${argsStr} ${valueStr} --private-key ${privateKey} --rpc-url ${this.rpcUrl} --json`
      
      console.log(`📤 Cast send: ${cmd.replace(privateKey, '***')}`)
      const { stdout, stderr } = await execAsync(cmd, { cwd: FOUNDRY_PROJECT_PATH })
      
      if (stderr) {
        console.warn(`Cast send warning: ${stderr}`)
      }
      
      return this.parseTransactionResult(stdout)
    } catch (error) {
      console.error(`❌ Cast send failed: ${error}`)
      throw new Error(`Transaction failed: ${error.message}`)
    }
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash: string): Promise<any> {
    try {
      const cmd = `cast receipt ${txHash} --rpc-url ${this.rpcUrl} --json`
      
      const { stdout } = await execAsync(cmd, { cwd: FOUNDRY_PROJECT_PATH })
      return JSON.parse(stdout)
    } catch (error) {
      console.error(`❌ Failed to get transaction receipt: ${error}`)
      throw new Error(`Failed to get receipt: ${error.message}`)
    }
  }

  /**
   * Get logs for a contract
   */
  async getLogs(
    contractAddress: string,
    fromBlock: string = 'earliest',
    toBlock: string = 'latest',
    topics: string[] = []
  ): Promise<EventLog[]> {
    try {
      const topicsStr = topics.length > 0 ? `--topics ${topics.join(',')}` : ''
      const cmd = `cast logs --address ${contractAddress} --from-block ${fromBlock} --to-block ${toBlock} ${topicsStr} --rpc-url ${this.rpcUrl} --json`
      
      const { stdout } = await execAsync(cmd, { cwd: FOUNDRY_PROJECT_PATH })
      
      if (!stdout.trim()) {
        return []
      }
      
      // Parse logs (cast logs returns one JSON object per line)
      const logLines = stdout.trim().split('\n')
      return logLines.map(line => JSON.parse(line))
    } catch (error) {
      console.error(`❌ Failed to get logs: ${error}`)
      throw new Error(`Failed to get logs: ${error.message}`)
    }
  }

  /**
   * Get current block number
   */
  async getCurrentBlockNumber(): Promise<number> {
    try {
      const cmd = `cast block-number --rpc-url ${this.rpcUrl}`
      
      const { stdout } = await execAsync(cmd, { cwd: FOUNDRY_PROJECT_PATH })
      return parseInt(stdout.trim())
    } catch (error) {
      console.error(`❌ Failed to get block number: ${error}`)
      throw new Error(`Failed to get block number: ${error.message}`)
    }
  }

  /**
   * Get contract ABI from Foundry artifacts
   */
  async getContractABI(contractName: string): Promise<any[]> {
    try {
      const artifactPath = path.join(FOUNDRY_PROJECT_PATH, 'out', `${contractName}.sol`, `${contractName}.json`)
      const cmd = `cat "${artifactPath}" | jq '.abi'`
      
      const { stdout } = await execAsync(cmd)
      return JSON.parse(stdout)
    } catch (error) {
      console.error(`❌ Failed to get contract ABI: ${error}`)
      throw new Error(`Failed to get ABI for ${contractName}: ${error.message}`)
    }
  }

  /**
   * Deploy a contract using Foundry
   */
  async deployContract(
    contractName: string,
    constructorArgs: string[] = [],
    privateKey: string
  ): Promise<{ address: string; transactionHash: string }> {
    try {
      const argsStr = constructorArgs.length > 0 ? `--constructor-args ${constructorArgs.join(' ')}` : ''
      const cmd = `forge create src/${contractName}.sol:${contractName} ${argsStr} --private-key ${privateKey} --rpc-url ${this.rpcUrl} --json`
      
      console.log(`🚀 Deploying contract: ${contractName}`)
      const { stdout } = await execAsync(cmd, { cwd: FOUNDRY_PROJECT_PATH })
      
      const result = JSON.parse(stdout)
      return {
        address: result.deployedTo,
        transactionHash: result.transactionHash
      }
    } catch (error) {
      console.error(`❌ Contract deployment failed: ${error}`)
      throw new Error(`Failed to deploy ${contractName}: ${error.message}`)
    }
  }

  /**
   * Parse transaction result from cast send output
   */
  private parseTransactionResult(output: string): TransactionResult {
    try {
      const result = JSON.parse(output)
      
      return {
        transactionHash: result.transactionHash,
        blockNumber: parseInt(result.blockNumber, 16),
        gasUsed: result.gasUsed,
        status: result.status === '0x1' ? 'success' : 'failed',
        logs: result.logs || []
      }
    } catch (error) {
      // Fallback parsing for non-JSON output
      const lines = output.split('\n')
      const txHashLine = lines.find(line => line.includes('transactionHash'))
      const blockLine = lines.find(line => line.includes('blockNumber'))
      
      if (txHashLine) {
        const txHash = txHashLine.split(':')[1]?.trim()
        const blockNumber = blockLine ? parseInt(blockLine.split(':')[1]?.trim()) : 0
        
        return {
          transactionHash: txHash,
          blockNumber,
          gasUsed: '0',
          status: 'success'
        }
      }
      
      throw new Error(`Failed to parse transaction result: ${output}`)
    }
  }

  /**
   * Monitor contract events (polling-based)
   */
  async monitorContractEvents(
    contractAddress: string,
    eventSignature: string,
    fromBlock: number,
    callback: (log: EventLog) => void
  ): Promise<void> {
    const topic0 = await this.getEventTopic(eventSignature)
    
    setInterval(async () => {
      try {
        const currentBlock = await this.getCurrentBlockNumber()
        const logs = await this.getLogs(
          contractAddress,
          fromBlock.toString(),
          currentBlock.toString(),
          [topic0]
        )
        
        for (const log of logs) {
          callback(log)
        }
        
        fromBlock = currentBlock + 1
      } catch (error) {
        console.error(`❌ Event monitoring error: ${error}`)
      }
    }, 5000) // Poll every 5 seconds
  }

  /**
   * Get event topic hash
   */
  private async getEventTopic(eventSignature: string): Promise<string> {
    try {
      const cmd = `cast keccak "${eventSignature}"`
      const { stdout } = await execAsync(cmd, { cwd: FOUNDRY_PROJECT_PATH })
      return stdout.trim()
    } catch (error) {
      throw new Error(`Failed to get event topic: ${error.message}`)
    }
  }

  // ===== ANVIL-SPECIFIC METHODS =====

  /**
   * Mine blocks on demand (Anvil specific)
   */
  async mineBlocks(count: number = 1): Promise<void> {
    try {
      const cmd = `cast rpc anvil_mine ${count} --rpc-url ${this.rpcUrl}`
      await execAsync(cmd, { cwd: FOUNDRY_PROJECT_PATH })
      console.log(`⛏️ Mined ${count} block(s)`)
    } catch (error) {
      console.error(`❌ Failed to mine blocks: ${error}`)
      throw new Error(`Failed to mine blocks: ${error.message}`)
    }
  }

  /**
   * Set gas price (Anvil specific)
   */
  async setGasPrice(gasPrice: string): Promise<void> {
    try {
      const cmd = `cast rpc anvil_setGasPrice ${gasPrice} --rpc-url ${this.rpcUrl}`
      await execAsync(cmd, { cwd: FOUNDRY_PROJECT_PATH })
      console.log(`⛽ Gas price set to ${gasPrice} wei`)
    } catch (error) {
      console.error(`❌ Failed to set gas price: ${error}`)
      throw new Error(`Failed to set gas price: ${error.message}`)
    }
  }

  /**
   * Impersonate account (Anvil specific)
   */
  async impersonateAccount(address: string): Promise<void> {
    try {
      const cmd = `cast rpc anvil_impersonateAccount ${address} --rpc-url ${this.rpcUrl}`
      await execAsync(cmd, { cwd: FOUNDRY_PROJECT_PATH })
      console.log(`🎭 Impersonating account: ${address}`)
    } catch (error) {
      console.error(`❌ Failed to impersonate account: ${error}`)
      throw new Error(`Failed to impersonate account: ${error.message}`)
    }
  }

  /**
   * Stop impersonating account (Anvil specific)
   */
  async stopImpersonatingAccount(address: string): Promise<void> {
    try {
      const cmd = `cast rpc anvil_stopImpersonatingAccount ${address} --rpc-url ${this.rpcUrl}`
      await execAsync(cmd, { cwd: FOUNDRY_PROJECT_PATH })
      console.log(`🚫 Stopped impersonating account: ${address}`)
    } catch (error) {
      console.error(`❌ Failed to stop impersonating account: ${error}`)
      throw new Error(`Failed to stop impersonating account: ${error.message}`)
    }
  }

  /**
   * Set account balance (Anvil specific)
   */
  async setBalance(address: string, balance: string): Promise<void> {
    try {
      const cmd = `cast rpc anvil_setBalance ${address} ${balance} --rpc-url ${this.rpcUrl}`
      await execAsync(cmd, { cwd: FOUNDRY_PROJECT_PATH })
      console.log(`💰 Set balance for ${address} to ${balance} wei`)
    } catch (error) {
      console.error(`❌ Failed to set balance: ${error}`)
      throw new Error(`Failed to set balance: ${error.message}`)
    }
  }

  /**
   * Get Anvil-specific account info
   */
  async getAnvilAccounts(): Promise<string[]> {
    try {
      const cmd = `cast rpc anvil_accounts --rpc-url ${this.rpcUrl}`
      const { stdout } = await execAsync(cmd, { cwd: FOUNDRY_PROJECT_PATH })
      return JSON.parse(stdout)
    } catch (error) {
      console.error(`❌ Failed to get Anvil accounts: ${error}`)
      throw new Error(`Failed to get Anvil accounts: ${error.message}`)
    }
  }

  /**
   * Check if we're connected to Anvil
   */
  async isAnvil(): Promise<boolean> {
    try {
      const cmd = `cast rpc anvil_accounts --rpc-url ${this.rpcUrl}`
      await execAsync(cmd, { cwd: FOUNDRY_PROJECT_PATH })
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Get deterministic accounts (from anvil --mnemonic-seed-unsafe 2)
   */
  getDeterministicAccounts() {
    return DETERMINISTIC_ACCOUNTS
  }

  /**
   * Get the deployer account used in the deployment script
   */
  getDeployerAccount() {
    return DETERMINISTIC_ACCOUNTS.DEPLOYER_ALT // This is the one used in the deployment script
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(
    contractAddress: string,
    functionSignature: string,
    args: string[] = [],
    value: string = '0'
  ): Promise<string> {
    try {
      const argsStr = args.length > 0 ? args.join(' ') : ''
      const valueStr = value !== '0' ? `--value ${value}` : ''
      
      const cmd = `cast estimate ${contractAddress} "${functionSignature}" ${argsStr} ${valueStr} --rpc-url ${this.rpcUrl}`
      
      const { stdout } = await execAsync(cmd, { cwd: FOUNDRY_PROJECT_PATH })
      return stdout.trim()
    } catch (error) {
      console.error(`❌ Gas estimation failed: ${error}`)
      throw new Error(`Gas estimation failed: ${error.message}`)
    }
  }
}

// Export singleton instance
export const foundryEVMService = new FoundryEVMService()
