import type { Config } from 'drizzle-kit'

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: 'postgresql://btc_yield_user:btc_yield_password@postgres:5432/btc_yield'
  }
} satisfies Config
