import { type Address } from 'viem'

// Contract ABIs - these will be populated from the compiled contracts
export const LOAN_FACTORY_ABI = [
  // Basic contract functions
  'function deployContracts(string memory lenderBtcPubkey, uint256 loanDuration, uint256 timelockLoanReq, uint256 timelockBtcEscrow, uint256 timelockRepaymentAccept, uint256 timelockBtcCollateral) external returns (address etherSwapAddress, address loanAddress)',
  'function getEtherSwapBytecode(address loanContractAddress) external pure returns (bytes memory)',
  'function getLoanBytecode(string memory lenderBtcPubkey, uint256 timelockLoanReq, uint256 timelockBtcEscrow, uint256 timelockRepaymentAccept, uint256 timelockBtcCollateral) external pure returns (bytes memory)',
  // Events
  'event ContractsDeployed(address indexed etherSwap, address indexed loanContract, address indexed lender)',
] as const

export const ETHER_SWAP_ABI = [
  // Basic contract functions
  'function lock(bytes32 preimageHash, address claimAddress, uint256 timelock) external payable',
  'function lockPrepayMinerfee(bytes32 preimageHash, address payable claimAddress, uint256 timelock, uint256 prepayAmount) external payable',
  'function claim(bytes32 preimageHash, bytes32 preimage, uint256 amount, address refundAddress, uint256 timelock, address destination) external',
  'function refund(bytes32 preimageHash, uint256 amount, address claimAddress, uint256 timelock) external',
  // View functions
  'function swaps(bytes32) external view returns (bool)',
  'function authorizedContract() external view returns (address)',
  'function version() external view returns (uint8)',
  // Events
  'event Lockup(bytes32 indexed preimageHash, uint256 amount, address claimAddress, address indexed refundAddress, uint256 timelock)',
  'event Claim(bytes32 indexed preimageHash, bytes32 preimage)',
  'event Refund(bytes32 indexed preimageHash)',
] as const

export const BTC_COLLATERAL_LOAN_ABI = [
  {
    "type": "function",
    "name": "requestLoan",
    "inputs": [
      {"name": "amount", "type": "uint256"},
      {"name": "btcAddress", "type": "string"},
      {"name": "btcPubkey", "type": "string"},
      {"name": "preimageHashBorrower", "type": "bytes32"}
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "getTotalLoans",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "lenderBtcPubkey",
    "inputs": [],
    "outputs": [{"name": "", "type": "string"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "acceptLoanOffer",
    "inputs": [
      {"name": "loanId", "type": "uint256"},
      {"name": "preimageBorrower", "type": "bytes32"}
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "attemptRepayment",
    "inputs": [
      {"name": "loanId", "type": "uint256"},
      {"name": "preimageHashLender", "type": "bytes32"}
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "acceptLoanRepayment",
    "inputs": [
      {"name": "loanId", "type": "uint256"},
      {"name": "preimageLender", "type": "bytes32"}
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "markAsDefaulted",
    "inputs": [{"name": "loanId", "type": "uint256"}],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setEtherSwapAddress",
    "inputs": [{"name": "_etherSwapAddress", "type": "address"}],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "updateLenderBtcPubkey",
    "inputs": [{"name": "newBtcPubkey", "type": "string"}],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "updateParameters",
    "inputs": [
      {"name": "_loanDuration", "type": "uint256"},
      {"name": "_timelockLoanReq", "type": "uint256"},
      {"name": "_timelockBtcEscrow", "type": "uint256"},
      {"name": "_timelockRepaymentAccept", "type": "uint256"},
      {"name": "_timelockBtcCollateral", "type": "uint256"}
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "extendLoanOffer",
    "inputs": [
      {"name": "loanId", "type": "uint256"},
      {"name": "preimageHashBorrower", "type": "bytes32"},
      {"name": "preimageHashLender", "type": "bytes32"}
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "withdrawLoanOffer",
    "inputs": [{"name": "loanId", "type": "uint256"}],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "withdrawRepaymentAttempt",
    "inputs": [{"name": "loanId", "type": "uint256"}],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "deleteCompletedLoan",
    "inputs": [{"name": "loanId", "type": "uint256"}],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "emergencyWithdraw",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getLoan",
    "inputs": [{"name": "loanId", "type": "uint256"}],
    "outputs": [{
      "type": "tuple",
      "components": [
        {"name": "borrowerAddr", "type": "address"},
        {"name": "borrowerBtcPubkey", "type": "string"},
        {"name": "amount", "type": "uint256"},
        {"name": "collateralAmount", "type": "uint256"},
        {"name": "bondAmount", "type": "uint256"},
        {"name": "status", "type": "uint8"},
        {"name": "preimageHashBorrower", "type": "bytes32"},
        {"name": "preimageHashLender", "type": "bytes32"},
        {"name": "requestBlockheight", "type": "uint256"},
        {"name": "offerBlockheight", "type": "uint256"},
        {"name": "activationBlockheight", "type": "uint256"},
        {"name": "repaymentBlockheight", "type": "uint256"}
      ]
    }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getLoanIdByBorrower",
    "inputs": [{"name": "borrower", "type": "address"}],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "etherSwap",
    "inputs": [],
    "outputs": [{"name": "", "type": "address"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [{"name": "", "type": "address"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "timelockLoanReq",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "timelockBtcEscrow",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "timelockRepaymentAccept",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "timelockBtcCollateral",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "loanDuration",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "loanInterestRate",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MIN_LOAN_AMOUNT",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "PROCESSING_FEE",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "LENDER_BOND_PERCENTAGE",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ORIGIN_FEE_PERCENTAGE_DIVISOR",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  }
] as const

// Contract addresses (will be populated after deployment)
// For testing, you can hardcoded these addresses here
// For production, use environment variables as shown below



export const CONTRACTS = {
  // Environment variable approach (using .env.local)
  LOAN_FACTORY: process.env.NEXT_PUBLIC_LOAN_FACTORY_ADDRESS as Address,
  ETHER_SWAP: process.env.NEXT_PUBLIC_ETHER_SWAP_ADDRESS as Address,
  BTC_COLLATERAL_LOAN: process.env.NEXT_PUBLIC_BTC_COLLATERAL_LOAN_ADDRESS as Address,
  
  // Hardcoded addresses for testing (uncomment if you want to hardcode)
  // LOAN_FACTORY: '0x0000000000000000000000000000000000000000' as Address,
  // ETHER_SWAP: '0x0000000000000000000000000000000000000000' as Address,
  // BTC_COLLATERAL_LOAN: '0x0000000000000000000000000000000000000000' as Address,
} as const



// Contract types
export type LoanFactoryContract = {
  address: Address
  abi: typeof LOAN_FACTORY_ABI
}

export type EtherSwapContract = {
  address: Address
  abi: typeof ETHER_SWAP_ABI
}

export type BtcCollateralLoanContract = {
  address: Address
  abi: typeof BTC_COLLATERAL_LOAN_ABI
}
