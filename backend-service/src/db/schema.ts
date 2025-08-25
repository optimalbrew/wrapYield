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
  evmContractId: bigint('evm_contract_id', { mode: 'bigint' }), // Loan ID from smart contract
  borrowerId: uuid('borrower_id').notNull().references(() => users.id),
  lenderId: uuid('lender_id').references(() => users.id),
  
  // Loan parameters
  amount: decimal('amount', { precision: 18, scale: 8 }).notNull(), // Loan amount in BTC/ETH
  collateralAmount: decimal('collateral_amount', { precision: 18, scale: 8 }),
  bondAmount: decimal('bond_amount', { precision: 18, scale: 8 }),
  interestRate: decimal('interest_rate', { precision: 5, scale: 2 }), // Annual percentage
  durationBlocks: integer('duration_blocks').notNull(),
  
  // Status and lifecycle
  status: varchar('status', { length: 30 }).notNull().default('requested'),
  
  // Bitcoin addresses and keys
  borrowerBtcPubkey: varchar('borrower_btc_pubkey', { length: 64 }).notNull(),
  lenderBtcPubkey: varchar('lender_btc_pubkey', { length: 64 }),
  escrowAddress: varchar('escrow_address', { length: 63 }), // P2TR address
  collateralAddress: varchar('collateral_address', { length: 63 }),
  
  // Preimage hashes for HTLC
  preimageHashBorrower: varchar('preimage_hash_borrower', { length: 64 }),
  preimageHashLender: varchar('preimage_hash_lender', { length: 64 }),
  
  // Timelock parameters (in blocks)
  timelockLoanReq: integer('timelock_loan_req').notNull(),
  timelockBtcEscrow: integer('timelock_btc_escrow').notNull(),
  timelockRepaymentAccept: integer('timelock_repayment_accept').notNull(),
  timelockBtcCollateral: integer('timelock_btc_collateral').notNull(),
  
  // Block heights for tracking
  requestBlockHeight: bigint('request_block_height', { mode: 'bigint' }),
  offerBlockHeight: bigint('offer_block_height', { mode: 'bigint' }),
  activationBlockHeight: bigint('activation_block_height', { mode: 'bigint' }),
  repaymentBlockHeight: bigint('repayment_block_height', { mode: 'bigint' }),
  
  // Metadata
  metadata: jsonb('metadata'), // Additional loan-specific data
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
})

// Bitcoin transactions table - track all Bitcoin transactions
export const bitcoinTransactions = pgTable('bitcoin_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  loanId: uuid('loan_id').notNull().references(() => loans.id),
  
  // Transaction identifiers
  txid: varchar('txid', { length: 64 }), // Bitcoin transaction ID
  type: varchar('type', { length: 30 }).notNull(), // 'escrow' | 'collateral' | 'refund' | 'claim'
  
  // Transaction data
  rawTx: text('raw_tx'), // Raw transaction hex
  inputAmount: decimal('input_amount', { precision: 18, scale: 8 }),
  outputAmount: decimal('output_amount', { precision: 18, scale: 8 }),
  fee: decimal('fee', { precision: 18, scale: 8 }),
  
  // Status tracking
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'broadcast' | 'confirmed' | 'failed'
  confirmations: integer('confirmations').default(0),
  blockHeight: integer('block_height'),
  
  // Metadata
  metadata: jsonb('metadata'), // Additional transaction-specific data
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
})

// Signatures table - store Bitcoin transaction signatures for separate signing workflow
export const signatures = pgTable('signatures', {
  id: uuid('id').primaryKey().defaultRandom(),
  loanId: uuid('loan_id').notNull().references(() => loans.id),
  bitcoinTxId: uuid('bitcoin_tx_id').references(() => bitcoinTransactions.id),
  
  // Signature details
  signedBy: uuid('signed_by').notNull().references(() => users.id), // Who created this signature
  signatureType: varchar('signature_type', { length: 20 }).notNull(), // 'borrower' | 'lender'
  signatureData: text('signature_data').notNull(), // The actual signature hex
  
  // Transaction context (needed to reconstruct witness)
  transactionHex: text('transaction_hex').notNull(), // Raw transaction being signed
  inputAmount: decimal('input_amount', { precision: 18, scale: 8 }).notNull(),
  scriptPath: boolean('script_path').default(true), // Taproot script path vs key path
  leafIndex: integer('leaf_index'), // Which leaf in the Merkle tree
  tapleafScript: text('tapleaf_script'), // Script being executed
  controlBlock: text('control_block'), // Taproot control block
  
  // Additional context for witness construction
  witnessContext: jsonb('witness_context'), // Additional data needed to complete witness
  
  // Status and lifecycle
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'used' | 'expired'
  expiresAt: timestamp('expires_at'), // When this signature expires
  usedAt: timestamp('used_at'), // When this signature was used in a transaction
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
})

// EVM transactions table - track EVM contract interactions
export const evmTransactions = pgTable('evm_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  loanId: uuid('loan_id').notNull().references(() => loans.id),
  
  // Transaction identifiers
  txHash: varchar('tx_hash', { length: 66 }).notNull(), // 0x prefixed hash
  contractAddress: varchar('contract_address', { length: 42 }).notNull(),
  functionName: varchar('function_name', { length: 100 }), // Contract function called
  
  // Transaction data
  gasUsed: bigint('gas_used', { mode: 'bigint' }),
  gasPrice: bigint('gas_price', { mode: 'bigint' }),
  value: decimal('value', { precision: 18, scale: 18 }), // ETH value sent
  
  // Status tracking
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending' | 'confirmed' | 'failed'
  blockNumber: bigint('block_number', { mode: 'bigint' }),
  confirmations: integer('confirmations').default(0),
  
  // Event data
  eventData: jsonb('event_data'), // Parsed contract events from this transaction
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
})

// Loan events table - audit trail of all loan state changes
export const loanEvents = pgTable('loan_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  loanId: uuid('loan_id').notNull().references(() => loans.id),
  
  // Event details
  eventType: varchar('event_type', { length: 50 }).notNull(), // 'status_change' | 'signature_created' | 'transaction_broadcast' etc.
  fromStatus: varchar('from_status', { length: 30 }),
  toStatus: varchar('to_status', { length: 30 }),
  
  // Actor and context
  triggeredBy: uuid('triggered_by').references(() => users.id),
  relatedTxId: uuid('related_tx_id'), // Could be Bitcoin or EVM transaction
  
  // Event data
  eventData: jsonb('event_data'), // Detailed event information
  notes: text('notes'), // Human-readable description
  
  createdAt: timestamp('created_at').defaultNow().notNull()
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

export const insertSignatureSchema = createInsertSchema(signatures)
export const selectSignatureSchema = createSelectSchema(signatures)
export type Signature = z.infer<typeof selectSignatureSchema>
export type NewSignature = z.infer<typeof insertSignatureSchema>

export const insertBitcoinTransactionSchema = createInsertSchema(bitcoinTransactions)
export const selectBitcoinTransactionSchema = createSelectSchema(bitcoinTransactions)
export type BitcoinTransaction = z.infer<typeof selectBitcoinTransactionSchema>
export type NewBitcoinTransaction = z.infer<typeof insertBitcoinTransactionSchema>

export const insertEvmTransactionSchema = createInsertSchema(evmTransactions)
export const selectEvmTransactionSchema = createSelectSchema(evmTransactions)
export type EvmTransaction = z.infer<typeof selectEvmTransactionSchema>
export type NewEvmTransaction = z.infer<typeof insertEvmTransactionSchema>

export const insertLoanEventSchema = createInsertSchema(loanEvents)
export const selectLoanEventSchema = createSelectSchema(loanEvents)
export type LoanEvent = z.infer<typeof selectLoanEventSchema>
export type NewLoanEvent = z.infer<typeof insertLoanEventSchema>
