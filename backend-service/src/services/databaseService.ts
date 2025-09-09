import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import * as schema from '../db/schema'

class DatabaseService {
  private db: any
  private client: any
  private initialized: Promise<void>

  constructor() {
    this.initialized = this.initializeDatabase()
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
      // Use Drizzle's migration system to create tables from schema
      await migrate(this.db, { migrationsFolder: './drizzle' })
      console.log('✅ Database tables initialized using Drizzle migrations')
      
    } catch (error) {
      console.error('❌ Database table initialization failed:', error)
      console.error('❌ Migrations folder not found or migration failed. Please ensure migrations are generated.')
      throw error
    }
  }


  async waitForInitialization() {
    await this.initialized
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
