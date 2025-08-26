// TypeScript types for the BTC Collateral Loan contract
// These types match the Solidity structs exactly

export interface Loan {
  borrowerAddr: string
  borrowerBtcPubkey: string
  amount: bigint
  bondAmount: bigint
  status: number // LoanStatus enum
  preimageHashBorrower: string
  preimageHashLender: string
  txid_p2tr0: string // Bitcoin transaction ID of the escrow UTXO
  vout_p2tr0: number // Output index of the escrow UTXO in the bitcoin transaction
  offerBlockheight: bigint
  activationBlockheight: bigint
  repaymentBlockheight: bigint
}

export interface LoanParameters {
  int_rate: bigint // Interest rate - fixed at loan creation to prevent manipulation
  proc_fee: bigint // Processing fee - fixed at loan creation to prevent manipulation
  duration: bigint // Loan duration - fixed at loan creation to prevent manipulation
  tl_borrower: bigint // Borrower timelock t_B - fixed at loan creation to prevent manipulation
  tl_lender: bigint // Lender timelock t_L - fixed at loan creation to prevent manipulation
}

// Combined interface for when you need both loan data and parameters
export interface LoanWithParameters {
  loan: Loan
  parameters: LoanParameters
}

// Loan status enum values (matching Solidity)
export enum LoanStatus {
  Requested = 0,
  Offered = 1,
  Activated = 2,
  Repaid = 3,
  Defaulted = 4,
  Deleted = 5
}

// Helper function to convert raw contract data to typed interfaces
export function parseLoan(rawData: any[]): Loan {
  return {
    borrowerAddr: rawData[0],
    borrowerBtcPubkey: rawData[1],
    amount: rawData[2],
    bondAmount: rawData[3],
    status: Number(rawData[4]),
    preimageHashBorrower: rawData[5],
    preimageHashLender: rawData[6],
    txid_p2tr0: rawData[7],
    vout_p2tr0: Number(rawData[8]),
    offerBlockheight: rawData[9],
    activationBlockheight: rawData[10],
    repaymentBlockheight: rawData[11]
  }
}

export function parseLoanParameters(rawData: any[]): LoanParameters {
  return {
    int_rate: rawData[0],
    proc_fee: rawData[1],
    duration: rawData[2],
    tl_borrower: rawData[3],
    tl_lender: rawData[4]
  }
}
