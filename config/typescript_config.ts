/**
 * BTC Yield Protocol Configuration Module for TypeScript/JavaScript
 * 
 * This module provides access to shared configuration parameters from the base JSON file.
 * It includes utility functions and type definitions for use in React, wagmi, and other TS/JS code.
 * 
 * Usage:
 *   import { config, getTimelock, getFee, getNetworkConfig } from './config/typescript_config'
 *   
 *   const processingFee = config.fees.processingFee
 *   const loanDuration = config.timelocks.loanDuration
 *   
 *   // Utility functions
 *   const btcBlocks = getTimelock('btcEscrow', true) // Convert to Bitcoin blocks
 *   const feeAmount = getFee('origination', 1.0) // Calculate fee amount
 */

import configData from './parameters.json'

// Type definitions
export interface FeeConfig {
  value?: string
  percentage?: number
  divisor?: number
  unit?: string
  description: string
}

export interface TimelockConfig {
  blocks: number
  symbol: string
  description: string
}

export interface InterestRateConfig {
  annualPercentage: number
  description: string
}

export interface NetworkConfig {
  chainId?: number
  name?: string
  rpcUrl?: string
  network?: string
}

export interface ValidationConfig {
  length: number
  format: string
  description?: string
}

export interface BitcoinConfig {
  network: string
  addressTypes: {
    supported: string[]
    p2tr: {
      minLength: number
      maxLength: number
      description: string
    }
  }
  publicKeyFormat: {
    type: string
    length: number
    description: string
  }
}

export interface BlockchainConfig {
  btcToEvmBlockRatio: {
    ratio: string
    description: string
  }
  btcConfirmations: {
    required: number
    description: string
  }
  evmConfirmations: {
    required: number
    description: string
  }
}

export interface SecurityConfig {
  maxActiveLoansPerBorrower: number
  lenderSlashingEnabled: boolean
  emergencyPause: {
    enabled: boolean
    description: string
  }
}

export interface Config {
  version: string
  description: string
  lastUpdated: string
  fees: {
    processingFee: FeeConfig
    originationFee: FeeConfig
    lenderBondPercentage: FeeConfig
  }
  limits: {
    minLoanAmount: FeeConfig
    maxLoanAmount: FeeConfig
  }
  timelocks: {
    loanRequest: TimelockConfig
    btcEscrow: TimelockConfig
    repaymentAccept: TimelockConfig
    btcCollateral: TimelockConfig
    loanDuration: TimelockConfig
  }
  interestRates: {
    default: InterestRateConfig
    minimum: InterestRateConfig
    maximum: InterestRateConfig
  }
  blockchainConfig: BlockchainConfig
  bitcoin: BitcoinConfig
  validation: {
    preimageHash: ValidationConfig
    addresses: {
      ethereum: ValidationConfig
    }
  }
  networks: {
    development: {
      ethereum: NetworkConfig
      bitcoin: NetworkConfig
    }
    testnet: {
      ethereum: NetworkConfig
      bitcoin: NetworkConfig
    }
    mainnet: {
      ethereum: NetworkConfig
      bitcoin: NetworkConfig
    }
  }
  security: SecurityConfig
}

// Main configuration object
export const config: Config = configData as Config

// Utility functions

/**
 * Get timelock value in blocks
 * @param timelockName - Name of the timelock
 * @param forBitcoin - If true, convert to Bitcoin blocks using the ratio
 * @returns Number of blocks
 */
export function getTimelock(
  timelockName: keyof Config['timelocks'], 
  forBitcoin: boolean = false
): number {
  const timelock = config.timelocks[timelockName]
  
  if (!forBitcoin) {
    return timelock.blocks
  }
  
  // Convert to Bitcoin blocks using ratio
  const ratio = config.blockchainConfig.btcToEvmBlockRatio.ratio
  const [btcRatio, evmRatio] = ratio.split(':').map(Number)
  return Math.floor(timelock.blocks * btcRatio / evmRatio)
}

/**
 * Calculate fee amount based on type and principal amount
 * @param feeType - Type of fee
 * @param amount - Principal amount to calculate fee from
 * @returns Fee amount as number
 */
export function getFee(
  feeType: 'processing' | 'origination' | 'lenderBondPercentage', 
  amount: number = 1.0
): number {
  switch (feeType) {
    case 'processing':
      return parseFloat(config.fees.processingFee.value || '0')
      
    case 'origination':
      const origFee = config.fees.originationFee
      if (origFee.percentage && origFee.divisor) {
        return amount * origFee.percentage / origFee.divisor
      }
      return 0
      
    case 'lenderBondPercentage':
      const bondFee = config.fees.lenderBondPercentage
      if (bondFee.percentage) {
        return amount * bondFee.percentage / 100
      }
      return 0
      
    default:
      throw new Error(`Unknown fee type: ${feeType}`)
  }
}

/**
 * Get network configuration for specific environment and blockchain
 * @param environment - Environment name
 * @param blockchain - Blockchain name
 * @returns Network configuration
 */
export function getNetworkConfig(
  environment: keyof Config['networks'] = 'development',
  blockchain: 'ethereum' | 'bitcoin' = 'ethereum'
): NetworkConfig {
  const envConfig = config.networks[environment]
  if (!envConfig) {
    throw new Error(`Unknown environment: ${environment}`)
  }
  
  const networkConfig = envConfig[blockchain]
  if (!networkConfig) {
    throw new Error(`Unknown blockchain: ${blockchain}`)
  }
  
  return networkConfig
}

/**
 * Validate Bitcoin public key format
 * @param pubkey - Public key string to validate
 * @returns True if valid format
 */
export function validateBitcoinPubkey(pubkey: string): boolean {
  const expectedLength = config.bitcoin.publicKeyFormat.length
  return pubkey.length === expectedLength && /^[0-9a-fA-F]+$/.test(pubkey)
}

/**
 * Validate preimage hash format
 * @param hash - Hash string to validate
 * @returns True if valid format
 */
export function validatePreimageHash(hash: string): boolean {
  const expectedLength = config.validation.preimageHash.length
  return hash.length === expectedLength && /^[0-9a-fA-F]+$/.test(hash)
}

/**
 * Validate Ethereum address format
 * @param address - Address string to validate
 * @returns True if valid format
 */
export function validateEthereumAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address)
}

/**
 * Convert Wei to Ether string
 * @param wei - Wei amount as string or bigint
 * @returns Ether amount as string
 */
export function weiToEther(wei: string | bigint): string {
  const weiPerEther = BigInt('1000000000000000000') // 10^18
  const weiBigInt = typeof wei === 'string' ? BigInt(wei) : wei
  
  const etherWhole = weiBigInt / weiPerEther
  const etherRemainder = weiBigInt % weiPerEther
  
  if (etherRemainder === BigInt(0)) {
    return etherWhole.toString()
  }
  
  // Handle decimal places
  const remainderStr = etherRemainder.toString().padStart(18, '0')
  const trimmedRemainder = remainderStr.replace(/0+$/, '')
  
  return `${etherWhole}.${trimmedRemainder}`
}

/**
 * Convert Ether to Wei
 * @param ether - Ether amount as string or number
 * @returns Wei amount as bigint
 */
export function etherToWei(ether: string | number): bigint {
  const etherStr = typeof ether === 'number' ? ether.toString() : ether
  const weiPerEther = BigInt('1000000000000000000') // 10^18
  
  if (etherStr.includes('.')) {
    const [whole, decimal] = etherStr.split('.')
    const wholeBigInt = BigInt(whole)
    const decimalPadded = decimal.padEnd(18, '0').slice(0, 18)
    const decimalBigInt = BigInt(decimalPadded)
    
    return wholeBigInt * weiPerEther + decimalBigInt
  }
  
  return BigInt(etherStr) * weiPerEther
}

/**
 * Get interest amount for a loan
 * @param principal - Principal loan amount
 * @param annualRate - Annual interest rate (as percentage)
 * @param durationBlocks - Loan duration in blocks
 * @param blocksPerYear - Approximate blocks per year (default: 1095000 for Rootstock)
 * @returns Interest amount
 */
export function calculateInterest(
  principal: number,
  annualRate: number = config.interestRates.default.annualPercentage,
  durationBlocks: number = config.timelocks.loanDuration.blocks,
  blocksPerYear: number = 1095000 // ~3000 blocks/day * 365 days
): number {
  const annualRateDecimal = annualRate / 100
  const loanDurationYears = durationBlocks / blocksPerYear
  return principal * annualRateDecimal * loanDurationYears
}

// Contract constants for easy access (matching Solidity constants)
export const CONSTANTS = {
  PROCESSING_FEE: etherToWei(config.fees.processingFee.value || '0'),
  MIN_LOAN_AMOUNT: etherToWei(config.limits.minLoanAmount.value || '0'),
  ORIGIN_FEE_PERCENTAGE_DIVISOR: config.fees.originationFee.divisor || 1000,
  LENDER_BOND_PERCENTAGE: config.fees.lenderBondPercentage.percentage || 10,
  
  // Timelock values
  TIMELOCK_LOAN_REQ: config.timelocks.loanRequest.blocks,
  TIMELOCK_BTC_ESCROW: config.timelocks.btcEscrow.blocks,
  TIMELOCK_REPAYMENT_ACCEPT: config.timelocks.repaymentAccept.blocks,
  TIMELOCK_BTC_COLLATERAL: config.timelocks.btcCollateral.blocks,
  LOAN_DURATION: config.timelocks.loanDuration.blocks,
  
  // Interest rates  
  DEFAULT_INTEREST_RATE: config.interestRates.default.annualPercentage,
  MIN_INTEREST_RATE: config.interestRates.minimum.annualPercentage,
  MAX_INTEREST_RATE: config.interestRates.maximum.annualPercentage,
} as const

// Legacy support - maintain compatibility with existing constants.ts
export const CONTRACT_CONFIG = {
  LOAN_DURATION: config.timelocks.loanDuration.blocks,
  TIMELOCK_LOAN_REQ: config.timelocks.loanRequest.blocks,
  TIMELOCK_BTC_ESCROW: config.timelocks.btcEscrow.blocks,
  TIMELOCK_REPAYMENT_ACCEPT: config.timelocks.repaymentAccept.blocks,
  TIMELOCK_BTC_COLLATERAL: config.timelocks.btcCollateral.blocks,
} as const

export const BTC_PUBKEY_PLACEHOLDER = '0x' + '1234567890123456789012345678901234567890123456789012345678901234'

export const NETWORK_CONFIG = {
  ANVIL: {
    chainId: config.networks.development.ethereum.chainId || 31337,
    chainIdHex: '0x7A69',
    name: config.networks.development.ethereum.name || 'Anvil Local',
    rpcUrl: config.networks.development.ethereum.rpcUrl || 'http://127.0.0.1:8545',
    blockExplorerUrl: 'http://localhost:8545',
  },
} as const

export default config
