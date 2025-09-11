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
    "name": "timelockRepaymentAccept",
    "inputs": [],
    "outputs": [{"type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "timelockBtcCollateral",
    "inputs": [],
    "outputs": [{"type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "loanDuration",
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
  },
  {
    "type": "event",
    "name": "LenderPreimageHashAssociated",
    "inputs": [
      {
        "name": "loanId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "lender",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "preimageHashLender",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "LoanActivated",
    "inputs": [
      {
        "name": "loanId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "borrower",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "preimageBorrower",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RepaymentAccepted",
    "inputs": [
      {
        "name": "loanId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "lender",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "preimageLender",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  }
] as const
