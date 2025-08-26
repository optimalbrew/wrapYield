import { privateKeyToAccount } from 'viem/accounts'
import { getTimelock, getFee } from '../../config/typescript_config'

// Helper function to ensure private key has 0x prefix
const ensureHexPrefix = (key: string): `0x${string}` => {
  if (key.startsWith('0x')) {
    return key as `0x${string}`
  }
  return `0x${key}` as `0x${string}`
}

// Private keys from anvil (seed 2) - these should be hex strings
export const privateKey1 = ensureHexPrefix(process.env.NEXT_PUBLIC_PRIVATE_KEY_1!)
export const privateKey2 = ensureHexPrefix(process.env.NEXT_PUBLIC_PRIVATE_KEY_2!)
export const privateKey3 = ensureHexPrefix(process.env.NEXT_PUBLIC_PRIVATE_KEY_3!)
export const privateKey4 = ensureHexPrefix(process.env.NEXT_PUBLIC_PRIVATE_KEY_4!)
export const privateKey5 = ensureHexPrefix(process.env.NEXT_PUBLIC_PRIVATE_KEY_5!)

// Account objects created from private keys
export const account1 = privateKeyToAccount(privateKey1)
export const account2 = privateKeyToAccount(privateKey2)
export const account3 = privateKeyToAccount(privateKey3)
export const account4 = privateKeyToAccount(privateKey4)
export const account5 = privateKeyToAccount(privateKey5)

// Account addresses: should not be really needed here, on-chain data.
export const ACCOUNTS = {
  LENDER: '0x8995E44a22e303A79bdD2E6e41674fb92d620863',
  BORROWER1: '0xE9e05C9f02e10FA833D379CB1c7aC3a3f23B247e',
  BORROWER2: '0x61Da7c7F97EBE53AD7c4E5eCD3d117E7Ab430eA7',
  BORROWER3: '0x5b0248e30583CeD4F09726C547935552C469EB24',
  BORROWER4: '0xcDbc8abb83E01BaE13ECE8853a5Ca84b2Ef6Ca86',
} as const

// Contract configuration: these can be changed by lender (who is the owner of the contract)
// get these from the config/parameters.json file
export const CONTRACT_CONFIG = {
  LOAN_DURATION: getTimelock('loanDuration', false), // 6 months on Rootstock (3000 blocks per day * 180 days)
  TIMELOCK_LOAN_REQ: getTimelock('loanRequest', false), // t_B: 100 blocks
  TIMELOCK_BTC_ESCROW: getTimelock('btcEscrow', false), // t_0: 200 blocks (must be > t_B)
  TIMELOCK_REPAYMENT_ACCEPT: getTimelock('repaymentAccept', false), // t_L: 150 blocks
  TIMELOCK_BTC_COLLATERAL: getTimelock('btcCollateral', false), // t_1: 250 blocks (must be > t_L)
  LENDER_BOND_PERCENTAGE: getFee('lenderBondPercentage'),
} as const

// Bitcoin public key placeholder: x_only pubkey (64 characters length - 32 bytes)
export const BTC_PUBKEY_PLACEHOLDER = '0x1234567890123456789012345678901234567890123456789012345678901234'

// Network configuration
export const NETWORK_CONFIG = {
  ANVIL: {
    chainId: 31337,
    chainIdHex: '0x7A69',
    name: 'Anvil Local',
    rpcUrl: process.env.NEXT_PUBLIC_ANVIL_RPC_URL || 'http://127.0.0.1:8545',
    blockExplorerUrl: 'http://localhost:8545',
  },
} as const
