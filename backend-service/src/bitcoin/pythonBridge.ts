import { spawn } from 'child_process'
import path from 'path'
import { promisify } from 'util'
import fs from 'fs/promises'

export interface VaulteroBridgeConfig {
  pythonPath: string
  vaulteroPath: string  
  venvPath?: string | undefined
  timeout: number
}

export interface EscrowTransactionParams {
  borrowerPubkey: string
  lenderPubkey: string
  preimageHashBorrower: string
  borrowerTimelock: number
  amount: number
  originationFee?: number
}

export interface CollateralTransactionParams {
  escrowTxid: string
  escrowVout: number
  borrowerPubkey: string
  lenderPubkey: string
  preimageHashLender: string
  lenderTimelock: number
  collateralAmount: number
  originationFee?: number
}

export interface SignatureParams {
  rawTx: string
  inputAmount: number
  signerType: 'borrower' | 'lender'
  privateKey?: string // For testing only
}

export class VaulteroPythonBridge {
  private config: VaulteroBridgeConfig

  constructor(config: VaulteroBridgeConfig) {
    this.config = {
      ...config
    }
  }

  /**
   * Create escrow transaction using btc-vaultero Python package
   */
  async createEscrowTransaction(params: EscrowTransactionParams) {
    const command = 'create_escrow'
    const result = await this.executePythonCommand(command, params)
    
    return {
      rawTx: result.raw_tx,
      inputAmount: result.input_amount,
      fee: result.fee,
      escrowAddress: result.escrow_address,
      scriptDetails: result.script_details
    }
  }

  /**
   * Create collateral transaction using btc-vaultero Python package
   */
  async createCollateralTransaction(params: CollateralTransactionParams) {
    const command = 'create_collateral'
    const result = await this.executePythonCommand(command, params)
    
    return {
      rawTx: result.raw_tx,
      fee: result.fee,
      collateralAddress: result.collateral_address,
      scriptDetails: result.script_details
    }
  }

  /**
   * Sign transaction using btc-vaultero Python package
   */
  async signTransaction(params: SignatureParams) {
    const command = 'sign_transaction'
    const result = await this.executePythonCommand(command, params)
    
    return {
      signature: result.signature,
      leafIndex: result.leaf_index,
      tapleafScript: result.tapleaf_script,
      controlBlock: result.control_block,
      witnessContext: result.witness_context
    }
  }

  /**
   * Broadcast transaction to Bitcoin network
   */
  async broadcastTransaction(rawTx: string, witnessData: any) {
    const command = 'broadcast_transaction'
    const result = await this.executePythonCommand(command, {
      raw_tx: rawTx,
      witness_data: witnessData
    })
    
    return {
      txid: result.txid,
      success: result.success
    }
  }

  /**
   * Execute Python command with proper error handling and timeout
   */
  private async executePythonCommand(command: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const pythonExecutable = this.config.venvPath 
        ? path.join(this.config.venvPath, 'bin', 'python')
        : 'python3'
      
      const bridgeScript = path.join(__dirname, 'vaultero_bridge.py')
      const args = [bridgeScript, command, JSON.stringify(params)]
      
      console.log(`🐍 Executing: ${pythonExecutable} ${args.join(' ')}`)
      
      const python = spawn(pythonExecutable, args, {
        cwd: this.config.vaulteroPath,
        env: {
          ...process.env,
          PYTHONPATH: this.config.vaulteroPath
        }
      })
      
      let stdout = ''
      let stderr = ''
      
      python.stdout.on('data', (data) => {
        stdout += data.toString()
      })
      
      python.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      const timeout = setTimeout(() => {
        python.kill('SIGTERM')
        reject(new Error(`Python command timed out after ${this.config.timeout}ms`))
      }, this.config.timeout)
      
      python.on('close', (code) => {
        clearTimeout(timeout)
        
        if (code === 0) {
          try {
            const result = JSON.parse(stdout)
            if (result.success === false) {
              reject(new Error(result.error || 'Python command failed'))
            } else {
              resolve(result.data || result)
            }
          } catch (parseError) {
            reject(new Error(`Failed to parse Python output: ${stdout}`))
          }
        } else {
          reject(new Error(`Python script exited with code ${code}: ${stderr}`))
        }
      })
      
      python.on('error', (error) => {
        clearTimeout(timeout)
        reject(new Error(`Failed to spawn Python process: ${error.message}`))
      })
    })
  }

  /**
   * Test the connection to the Python environment
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.executePythonCommand('health_check', {})
      return result.status === 'ok'
    } catch (error) {
      console.error('Python bridge connection test failed:', error instanceof Error ? error.message : 'Unknown error')
      return false
    }
  }
}

// Singleton instance for the application
let bridgeInstance: VaulteroPythonBridge | null = null

export function createVaulteroBridge(config?: Partial<VaulteroBridgeConfig>): VaulteroPythonBridge {
  if (!bridgeInstance) {
    const defaultConfig: VaulteroBridgeConfig = {
      pythonPath: process.env.VAULTERO_PYTHON_PATH || '/usr/bin/python3',
      vaulteroPath: process.env.VAULTERO_PACKAGE_PATH || path.join(__dirname, '../../../btc-vaultero'),
      venvPath: process.env.VAULTERO_VENV_PATH,
      timeout: parseInt(process.env.PYTHON_TIMEOUT || '30000')
    }
    
    bridgeInstance = new VaulteroPythonBridge({ ...defaultConfig, ...config })
  }
  
  return bridgeInstance
}

export function getVaulteroBridge(): VaulteroPythonBridge {
  if (!bridgeInstance) {
    throw new Error('Vaultero bridge not initialized. Call createVaulteroBridge() first.')
  }
  
  return bridgeInstance
}
