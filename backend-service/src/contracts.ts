import { type Address } from 'viem'

// Contract addresses - these should match the deployed contracts
export const CONTRACTS = {
  ETHER_SWAP: process.env.ETHER_SWAP_ADDRESS as Address,
  BTC_COLLATERAL_LOAN: process.env.BTC_COLLATERAL_LOAN_ADDRESS as Address,
} as const

// Contract ABIs - simplified version for backend use
export const BTC_COLLATERAL_LOAN_ABI = [
  {
    "type": "function",
    "name": "ORIGIN_FEE_PERCENTAGE",
    "inputs": [],
    "outputs": [{"type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function", 
    "name": "timelockLoanReq",
    "inputs": [],
    "outputs": [{"type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function", 
    "name": "timelockBtcEscrow",
    "inputs": [],
    "outputs": [{"type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "lenderBtcPubkey", 
    "inputs": [],
    "outputs": [{"type": "string"}],
    "stateMutability": "view"
  }
] as const
