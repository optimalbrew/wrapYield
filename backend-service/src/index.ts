import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import databaseService from './services/databaseService'
import evmEventMonitor from './services/evmEventMonitor'

// Import API routes
import bitcoinSignaturesRouter from './api/bitcoinSignatures'
import prepareCollateralRouter from './api/prepare-collateral'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3002

// Middleware
app.use(helmet()) // Security headers
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}))
app.use(express.json({ limit: '10mb' })) // Parse JSON bodies
app.use(express.urlencoded({ extended: true }))

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now()
  console.log(`🚀 ${req.method} ${req.path} - ${new Date().toISOString()}`)
  
  res.on('finish', () => {
    const duration = Date.now() - start
    const status = res.statusCode
    const emoji = status >= 400 ? '❌' : status >= 300 ? '⚠️' : '✅'
    console.log(`${emoji} ${req.method} ${req.path} - ${status} (${duration}ms)`)
  })
  
  next()
})

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const db = databaseService.getDatabase()
    const dbHealth = db ? true : false
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      service: 'btc-yield-backend',
      version: process.env.npm_package_version || '1.0.0',
      database: dbHealth ? 'healthy' : 'unhealthy',
      uptime: process.uptime()
    })
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Service unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
})

// Sync status endpoint
app.get('/api/sync/status', (req, res) => {
  try {
    const lastSyncTime = evmEventMonitor.getLastSyncTime()
    
    res.json({
      success: true,
      lastSyncTime: lastSyncTime ? lastSyncTime.toISOString() : null,
      lastSyncTimeFormatted: lastSyncTime ? lastSyncTime.toLocaleString() : 'Never',
      isMonitoring: true, // We know it's running since we're responding
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get sync status',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
})

// API routes
app.use('/api/bitcoin/signatures', bitcoinSignaturesRouter)
app.use('/api/prepare-collateral', prepareCollateralRouter)

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'BTC Yield Protocol Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      syncStatus: '/api/sync/status',
      bitcoinSignatures: '/api/bitcoin/signatures',
      prepareCollateral: '/api/prepare-collateral'
    },
    documentation: 'https://github.com/your-org/btc-yield-protocol'
  })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `The endpoint ${req.method} ${req.originalUrl} does not exist.`
  })
})

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('💥 Unhandled error:', err)
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  })
})

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🔄 Graceful shutdown initiated...')
  
  try {
    await databaseService.close()
    console.log('✅ Graceful shutdown completed')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error during shutdown:', error)
    process.exit(1)
  }
})

// Start server
async function startServer() {
  try {
    console.log('🚀 Starting BTC Yield Backend Service...')
    
    // Wait for database initialization to complete
    await databaseService.waitForInitialization()
    console.log('✅ Database service initialized')
    
    // Start EVM event monitoring
    await evmEventMonitor.startMonitoring()
    console.log('✅ EVM event monitoring started')
    
    // Start listening
    app.listen(PORT, () => {
      console.log(`\n✅ Server running on port ${PORT}`)
      console.log(`🌐 API available at: http://localhost:${PORT}`)
      console.log(`💊 Health check: http://localhost:${PORT}/health`)
      console.log(`📁 Bitcoin Signatures API: http://localhost:${PORT}/api/bitcoin/signatures`)
      console.log(`\n📚 Available endpoints:`)
      console.log(`  GET  /health - Service health check`)
      console.log(`  GET  /api/sync/status - Sync status and last sync time`)
      console.log(`  GET  / - API information`)
    })
    
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

// Only start server if this file is run directly
if (require.main === module) {
  startServer()
}

export default app
