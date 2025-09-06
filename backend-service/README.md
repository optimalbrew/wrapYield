# BTC Yield Backend Service

Backend API service for the BTC Yield Protocol, providing loan management, Bitcoin transaction orchestration, and signature workflow APIs.

## 🏗️ Architecture

```
backend-service/
├── src/
│   ├── api/                    # REST API endpoints
│   │   ├── signatures.ts       # Signature workflow API
│   │   └── bitcoin-transactions.ts  # Bitcoin transaction API
│   ├── services/               # Business logic
│   │   ├── signatureService.ts # Signature management
│   │   └── bitcoinTransactionService.ts # Bitcoin transaction handling
│   ├── db/                     # Database layer
│   │   ├── schema.ts          # Database schema (Drizzle ORM)
│   │   ├── connection.ts      # Database connection
│   │   └── init.sql          # Database initialization
│   ├── bitcoin/               # Bitcoin integration (future)
│   ├── types/                 # TypeScript definitions (future)
│   └── index.ts              # Express server
├── docker-compose.yml         # PostgreSQL + Redis setup
├── package.json              # Dependencies
└── tsconfig.json            # TypeScript configuration
```

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Access to `btc-vaultero` Python package

### 2. Installation

```bash
# Install dependencies
npm install

# Start databases
npm run docker:up


### 3. Development

```bash
# Start development server
npm run dev

# The API will be available at http://localhost:3001
```

## 📊 Database Schema

### Core Tables

- **`users`** - User management (lenders & borrowers)
- **`loans`** - Loan lifecycle tracking
- **`bitcoin_transactions`** - Bitcoin transaction records
- **`signatures`** - Bitcoin signature storage for separate signing workflow
- **`evm_transactions`** - EVM contract interaction tracking
- **`loan_events`** - Audit trail of loan state changes

### Key Features

- **UUID primary keys** for all tables
- **JSONB metadata** for flexible data storage
- **Decimal precision** for Bitcoin/Ethereum amounts
- **Comprehensive indexing** for performance
- **Foreign key relationships** for data integrity

## 🔗 API Endpoints

### Signature Management (`/api/signatures`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/` | Create new signature |
| `GET` | `/:id` | Get signature details |
| `GET` | `/loan/:loanId` | Get all signatures for loan |
| `POST` | `/:id/export` | Export signature to JSON file |
| `POST` | `/import` | Import signature from JSON file |
| `POST` | `/complete-witness` | Complete witness with both signatures |
| `POST` | `/transaction/:txId/sign` | Sign Bitcoin transaction |
| `DELETE` | `/:id` | Mark signature as expired |

### Bitcoin Transactions (`/api/bitcoin-transactions`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/escrow` | Create escrow transaction |
| `POST` | `/collateral` | Create collateral transaction |
| `POST` | `/:id/broadcast` | Broadcast transaction to network |
| `GET` | `/:id` | Get transaction details |
| `GET` | `/loan/:loanId` | Get all transactions for loan |
| `POST` | `/workflow/escrow-to-collateral` | Complete workflow |

### System (`/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Service health check |
| `GET` | `/` | API information |

## 🔐 Separate Signing Workflow

This service implements the secure signature workflow developed in the `btc-vaultero` tests:

### 1. Borrower Creates Signature

```bash
POST /api/signatures
{
  "loanId": "uuid",
  "signedBy": "borrower-user-id",
  "signatureType": "borrower",
  "signatureData": "hex-signature",
  "transactionHex": "raw-tx-hex",
  "inputAmount": "0.001",
  "tapleafScript": "script-hex",
  "controlBlock": "control-block-hex"
}
```

### 2. Export for Transmission

```bash
POST /api/signatures/{id}/export
{
  "outputDir": "./signatures"
}
# Returns: filepath to JSON file
```

### 3. Lender Completes Witness

```bash
POST /api/signatures/complete-witness
{
  "borrowerSignatureId": "uuid",
  "lenderSignatureId": "uuid", 
  "preimageHex": "preimage-hex"
}
# Returns: complete witness data ready for broadcast
```

## 🔧 Configuration

### Environment Variables

Create `.env` file from `.env.example`:

```env
# Server
NODE_ENV=development
PORT=3001

# Database  
DB_HOST=localhost
DB_PORT=5432
DB_USER=btc_yield_user
DB_PASSWORD=btc_yield_password
DB_NAME=btc_yield

# Bitcoin Integration
BITCOIN_NETWORK=regtest
VAULTERO_PYTHON_PATH=/path/to/btc-vaultero
```

### Shared Configuration

The service integrates with the shared configuration system:

```typescript
import { getTimelock, getFee } from '../../config/typescript_config'

const loanDuration = getTimelock('loanDuration', false) // EVM blocks
const btcEscrowTimelock = getTimelock('btcEscrow', true) // Bitcoin blocks
const processingFee = getFee('processing', loanAmount)
```

## 🐳 Docker Setup

```bash
# Start databases
docker-compose up -d

# View logs
docker-compose logs -f postgres

# Stop services
docker-compose down

# With pgAdmin (database management UI)
docker-compose --profile dev up -d
# Access pgAdmin at http://localhost:8080
```

## 🧪 Testing

```bash
# Run tests
npm test

# Test signature workflow
curl -X POST http://localhost:3001/api/signatures \
  -H "Content-Type: application/json" \
  -d '{...signature-data...}'
```

## 🔗 Integration Points

### With `btc-vaultero`

The service calls the Python `btc-vaultero` package for:

- Creating escrow/collateral transactions
- Generating Bitcoin signatures  
- Constructing witnesses
- Broadcasting transactions

### With EVM Contracts

Integration with `evmchain/` Solidity contracts:

- Monitoring contract events
- Tracking loan state changes
- Validating parameter consistency

### With Frontend `evm-dapp`

Provides APIs for the Wagmi frontend:

- Loan lifecycle management
- Bitcoin transaction coordination
- Signature workflow orchestration

## 📈 Monitoring

### Health Checks

```bash
GET /health
{
  "success": true,
  "database": "healthy",
  "uptime": 3600,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Statistics

```bash
GET /api/signatures/stats
GET /api/bitcoin-transactions/stats
```

## 🚧 Development Roadmap

### Phase 1: Core Infrastructure ✅
- [x] Database schema design
- [x] Signature workflow APIs
- [x] Bitcoin transaction APIs
- [x] Docker setup

### Phase 2: Bitcoin Integration
- [ ] `btc-vaultero` Python process integration
- [ ] Bitcoin network broadcasting
- [ ] Transaction confirmation monitoring
- [ ] Error handling & retries

### Phase 3: EVM Integration
- [ ] Smart contract event monitoring
- [ ] Cross-chain state synchronization
- [ ] Automated loan lifecycle management

### Phase 4: Production Features
- [ ] Authentication & authorization
- [ ] Rate limiting & security
- [ ] Comprehensive logging
- [ ] Performance optimization

## 🤝 Contributing

1. Follow existing code patterns
2. Add proper TypeScript types
3. Include error handling
4. Test signature workflows
5. Update documentation

## 📚 Related

- [`btc-vaultero/`](../btc-vaultero/) - Bitcoin transaction logic
- [`evmchain/`](../evmchain/) - Solidity smart contracts  
- [`evm-dapp/`](../evm-dapp/) - Frontend Wagmi application
- [`config/`](../config/) - Shared parameter configuration
