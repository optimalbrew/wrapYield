import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../db/schema'

class DatabaseService {
  private db: any
  private client: any

  constructor() {
    this.initializeDatabase()
  }

  private async initializeDatabase() {
    try {
      const connectionString = process.env.DATABASE_URL || 'postgresql://btc_yield_user:btc_yield_password@postgres:5432/btc_yield'
      
      this.client = postgres(connectionString)
      this.db = drizzle(this.client, { schema })

      console.log('✅ Database connection established')
      
      // Initialize tables if they don't exist
      await this.initializeTables()
      
    } catch (error) {
      console.error('❌ Database connection failed:', error)
      throw error
    }
  }

  private async initializeTables() {
    try {
      // Create tables using raw SQL for now
      const createTablesSQL = `
        -- Users table
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          evm_address VARCHAR(42) NOT NULL UNIQUE,
          btc_pubkey VARCHAR(64),
          role VARCHAR(20) NOT NULL DEFAULT 'borrower',
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        );

        -- Loans table
        CREATE TABLE IF NOT EXISTS loans (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          evm_contract_id VARCHAR(50),
          borrower_id UUID NOT NULL,
          lender_id UUID,
          amount NUMERIC(78,0) NOT NULL,
          collateral_amount NUMERIC(78,0),
          bond_amount NUMERIC(78,0),
          interest_rate NUMERIC(5,2),
          duration_blocks INTEGER NOT NULL,
          status VARCHAR(30) NOT NULL DEFAULT 'requested',
          btc_txid VARCHAR(64),
          btc_vout INTEGER,
          btc_address VARCHAR(100),
          btc_pubkey VARCHAR(64),
          preimage_hash_borrower VARCHAR(66),
          preimage_borrower VARCHAR(66),
          preimage_lender VARCHAR(66),
          request_block_height NUMERIC(20,0),
          offer_block_height NUMERIC(20,0),
          activation_block_height NUMERIC(20,0),
          repayment_block_height NUMERIC(20,0),
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        );

        -- Signatures table
        CREATE TABLE IF NOT EXISTS signatures (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          loan_id UUID REFERENCES loans(id),
          signature_type VARCHAR(50) NOT NULL,
          signature_data JSONB NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        );

        -- Simple borrower signatures table
        CREATE TABLE IF NOT EXISTS borrower_signatures (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          loan_id VARCHAR(50) NOT NULL,
          signature_data JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
      `

      await this.client.unsafe(createTablesSQL)
      console.log('✅ Database tables initialized')
      
    } catch (error) {
      console.error('❌ Database table initialization failed:', error)
      throw error
    }
  }

  getDatabase() {
    return this.db
  }

  getClient() {
    return this.client
  }

  async close() {
    if (this.client) {
      await this.client.end()
    }
  }
}

export default new DatabaseService()
