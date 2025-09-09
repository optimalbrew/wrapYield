import { pgTable, uuid, varchar, decimal, integer, timestamp, text, jsonb, boolean, bigint } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

// Users table - basic user management
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  evmAddress: varchar('evm_address', { length: 42 }).notNull().unique(),
  btcPubkey: varchar('btc_pubkey', { length: 64 }), // Schnorr x-only pubkey
  role: varchar('role', { length: 20 }).notNull().default('borrower'), // 'lender' | 'borrower'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
})

// Loan status enum values
export const loanStatuses = [
  'requested',           // Borrower submitted loan request
  'offered',            // Lender offered the loan
  'active',             // Loan is active (borrower claimed)
  'refunded_to_lender', // Loan setup failed, refunded to lender
  'repayment_in_progress', // Borrower initiated repayment
  'repaid',             // Loan fully repaid
  'refunded_to_borrower', // Lender didn't accept repayment
  'defaulted'           // Loan defaulted
] as const

// Loans table - main loan tracking
export const loans = pgTable('loans', {
  id: uuid('id').primaryKey().defaultRandom(),
  evmContractId: varchar('evm_contract_id', { length: 50 }).unique(), // Loan ID from smart contract (stored as string)
  borrowerId: uuid('borrower_id').notNull().references(() => users.id),
  lenderId: uuid('lender_id').references(() => users.id),
  
  // Loan parameters (stored as NUMERIC to avoid BigInt serialization issues)
  amount: decimal('amount', { precision: 78, scale: 0 }).notNull(), // Loan amount in BTC/ETH
  collateralAmount: decimal('collateral_amount', { precision: 78, scale: 0 }),
  bondAmount: decimal('bond_amount', { precision: 78, scale: 0 }),
  interestRate: decimal('interest_rate', { precision: 5, scale: 2 }), // Annual percentage
  durationBlocks: integer('duration_blocks').notNull(),
  
  // Status and lifecycle
  status: varchar('status', { length: 30 }).notNull().default('requested'),
  
  // Bitcoin addresses and keys
  borrowerBtcPubkey: varchar('borrower_btc_pubkey', { length: 66 }).notNull(),
  lenderBtcPubkey: varchar('lender_btc_pubkey', { length: 66 }),
  escrowAddress: varchar('escrow_address', { length: 63 }), // P2TR address
  collateralAddress: varchar('collateral_address', { length: 63 }),
  
  // Bitcoin transaction details
  btcTxid: varchar('btc_txid', { length: 66 }), // Bitcoin transaction ID of the escrow UTXO
  btcVout: integer('btc_vout'), // Output index of the escrow UTXO in the bitcoin transaction
  
  // Preimage hashes for HTLC
  preimageHashBorrower: varchar('preimage_hash_borrower', { length: 66 }),
  preimageHashLender: varchar('preimage_hash_lender', { length: 66 }),
  preimageBorrower: varchar('preimage_borrower', { length: 66 }), // Revealed preimage from loan acceptance
  preimageLender: varchar('preimage_lender', { length: 66 }), // Revealed preimage from repayment acceptance
  
  // Timelock parameters (in blocks)
  timelockLoanReq: integer('timelock_loan_req').notNull(),
  timelockBtcEscrow: integer('timelock_btc_escrow').notNull(),
  timelockRepaymentAccept: integer('timelock_repayment_accept').notNull(),
  timelockBtcCollateral: integer('timelock_btc_collateral').notNull(),
  
  // Block heights for tracking (stored as NUMERIC to avoid BigInt serialization issues)
  requestBlockHeight: decimal('request_block_height', { precision: 20, scale: 0 }),
  offerBlockHeight: decimal('offer_block_height', { precision: 20, scale: 0 }),
  activationBlockHeight: decimal('activation_block_height', { precision: 20, scale: 0 }),
  repaymentBlockHeight: decimal('repayment_block_height', { precision: 20, scale: 0 }),
  
  // Metadata
  metadata: jsonb('metadata'), // Additional loan-specific data
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
})

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users)
export const selectUserSchema = createSelectSchema(users)
export type User = z.infer<typeof selectUserSchema>
export type NewUser = z.infer<typeof insertUserSchema>

export const insertLoanSchema = createInsertSchema(loans)
export const selectLoanSchema = createSelectSchema(loans)
export type Loan = z.infer<typeof selectLoanSchema>
export type NewLoan = z.infer<typeof insertLoanSchema>

// Simple borrower signatures table - just what we need
export const borrowerSignatures = pgTable('borrower_signatures', {
  id: uuid('id').primaryKey().defaultRandom(),
  loanId: varchar('loan_id', { length: 50 }).notNull(),
  signatureData: jsonb('signature_data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
})

// Zod schemas for borrower signatures
export const selectBorrowerSignatureSchema = createSelectSchema(borrowerSignatures)
export const insertBorrowerSignatureSchema = createInsertSchema(borrowerSignatures)

export type BorrowerSignature = z.infer<typeof selectBorrowerSignatureSchema>
export type NewBorrowerSignature = z.infer<typeof insertBorrowerSignatureSchema>

