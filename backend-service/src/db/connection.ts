import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Client } from 'pg'
import * as schema from './schema'

// Database configuration
const dbConfig = process.env.DATABASE_URL || {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'btc_yield_user',
  password: process.env.DB_PASSWORD || 'btc_yield_password',
  database: process.env.DB_NAME || 'btc_yield',
}

// Create database client
const client = new Client(dbConfig)

// Connect to database
export async function connectDb() {
  try {
    await client.connect()
    console.log('✅ Connected to PostgreSQL database')
    return client
  } catch (error) {
    console.error('❌ Failed to connect to database:', error)
    process.exit(1)
  }
}

// Create Drizzle instance
export const db = drizzle(client, { schema })

// Run migrations
export async function runMigrations() {
  try {
    console.log('🔄 Running database migrations...')
    await migrate(db, { migrationsFolder: './src/db/migrations' })
    console.log('✅ Database migrations completed')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  }
}

// Close database connection
export async function closeDb() {
  try {
    await client.end()
    console.log('✅ Database connection closed')
  } catch (error) {
    console.error('❌ Error closing database:', error)
  }
}

// Health check
export async function healthCheck() {
  try {
    await client.query('SELECT 1')
    return true
  } catch (error) {
    console.error('❌ Database health check failed:', error)
    return false
  }
}
