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

# The API will be available at http://localhost:3002
```

## 📊 Database Schema

### Core Tables

- **`users`** - User management (lenders & borrowers)
- **`loans`** - Loan lifecycle tracking
- **`bitcoin_transactions`** - Bitcoin transaction records
- **`borrower_signatures`** - Simple borrower signature storage (id, loan_id, signature_data, created_at)

### Key Features

## 🔗 API Endpoints

### Bitcoin Signatures (`/api/bitcoin/signatures`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/test` | Test router connectivity |
| `GET` | `/db-test` | Test database connection |
| `GET` | `/debug` | List all stored signatures |
| `POST` | `/save` | Save borrower signature data |
| `GET` | `/loan/:loanId/borrower` | Get borrower signature for loan |

### System (`/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Service health check |
| `GET` | `/` | API information |

## 🔐 Bitcoin Signature Workflow

This service implements the file-based signature workflow where borrowers generate signatures locally and upload them to the backend.

### 1. Test Database Connection

```bash
curl http://localhost:3002/api/bitcoin/signatures/db-test
```

**Response:**
```json
{
  "success": true,
  "message": "Database connection works!",
  "result": { "test": 1 }
}
```

### 2. Save Borrower Signature

```bash
curl -X POST http://localhost:3002/api/bitcoin/signatures/save \
  -H "Content-Type: application/json" \
  -d '{
    "loanId": "1",
    "borrowerAddress": "0x1234567890123456789012345678901234567890",
    "signatureData": {
      "sig_borrower": "3e04583bfcddabc4ed67684b8aafe09136d735788d0f8ace92262b49e091502652f420e9e71c706579dbabb50c100e368ffeebf6b4ba415d52a5d1f9fed8d020",
      "txid": "02c8eeef945b48b27a056d4496ecc85c156dc789d0d5a81ef57e9880b14f0202",
      "vout": 1,
      "tx_hex": "0200000000010102024fb180987ef51ea8d5d089c76d155cc8ec96446d057ab2485b94efeec8020100000000fdffffff02a0860100000000001976a914021c4448dec19b0e498cc9f8631033ef512b606388ac40420f0000000000225120277a371b10778f98985ce09c4f9c86b9bae72e7d92a2bc48e1f5c3db9cf15c6500000000",
      "input_amount": 0.010102,
      "leaf_index": 1,
      "escrow_address_script": "5120ba3cf998e24c6e4167fdf0041c5dec25ac283e3dcee6e056862e409fc454a72e",
      "tapleaf_script_hex": "a8204534f8f303eb5fc7175946b1c46772fa31bca38f724c1a0be97b9b0289431ee1882064b4b84f42da9bdb84f7eda2de12524516686e73849645627fb7a034c79c81c8ac20274903288d231552de4c2c270d1c3f71fe5c78315374830c3b12a6654ee03afaba529d51",
      "escrow_is_odd": false,
      "loan_id": "test-loan-123",
      "borrower_pubkey": "274903288d231552de4c2c270d1c3f71fe5c78315374830c3b12a6654ee03afa",
      "lender_pubkey": "64b4b84f42da9bdb84f7eda2de12524516686e73849645627fb7a034c79c81c8",
      "preimage_hash_borrower": "4534f8f303eb5fc7175946b1c46772fa31bca38f724c1a0be97b9b0289431ee1",
      "borrower_timelock": 100,
      "collateral_amount": 0.01,
      "origination_fee": 0.001
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "signatureId": "95a304b0-1a49-429c-9824-e57a29b8f6c7",
    "loanId": "1",
    "transactionType": "collateral",
    "signatureData": { /* full signature object */ },
    "message": "Signature saved successfully"
  }
}
```

### 3. Retrieve Borrower Signature

```bash
curl http://localhost:3002/api/bitcoin/signatures/loan/1/borrower
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sig_borrower": "3e04583bfcddabc4ed67684b8aafe09136d735788d0f8ace92262b49e091502652f420e9e71c706579dbabb50c100e368ffeebf6b4ba415d52a5d1f9fed8d020",
    "txid": "02c8eeef945b48b27a056d4496ecc85c156dc789d0d5a81ef57e9880b14f0202",
    "vout": 1,
    "tx_hex": "0200000000010102024fb180987ef51ea8d5d089c76d155cc8ec96446d057ab2485b94efeec8020100000000fdffffff02a0860100000000001976a914021c4448dec19b0e498cc9f8631033ef512b606388ac40420f0000000000225120277a371b10778f98985ce09c4f9c86b9bae72e7d92a2bc48e1f5c3db9cf15c6500000000",
    "input_amount": 0.010102,
    "leaf_index": 1,
    "escrow_address_script": "5120ba3cf998e24c6e4167fdf0041c5dec25ac283e3dcee6e056862e409fc454a72e",
    "tapleaf_script_hex": "a8204534f8f303eb5fc7175946b1c46772fa31bca38f724c1a0be97b9b0289431ee1882064b4b84f42da9bdb84f7eda2de12524516686e73849645627fb7a034c79c81c8ac20274903288d231552de4c2c270d1c3f71fe5c78315374830c3b12a6654ee03afaba529d51",
    "escrow_is_odd": false,
    "loan_id": "test-loan-123",
    "borrower_pubkey": "274903288d231552de4c2c270d1c3f71fe5c78315374830c3b12a6654ee03afa",
    "lender_pubkey": "64b4b84f42da9bdb84f7eda2de12524516686e73849645627fb7a034c79c81c8",
    "preimage_hash_borrower": "4534f8f303eb5fc7175946b1c46772fa31bca38f724c1a0be97b9b0289431ee1",
    "borrower_timelock": 100,
    "collateral_amount": 0.01,
    "origination_fee": 0.001
  },
  "message": "Borrower signature found"
}
```

### 4. Debug All Signatures

```bash
curl http://localhost:3002/api/bitcoin/signatures/debug
```

**Response:**
```json
{
  "success": true,
  "count": 1,
  "signatures": [
    {
      "id": "95a304b0-1a49-429c-9824-e57a29b8f6c7",
      "loanId": "1",
      "createdAt": "2025-09-06T20:21:10.000Z"
    }
  ]
}
```

## 🔧 Configuration

### Environment Variables

Create `.env` file from `.env.example`:

```env
# Server
NODE_ENV=development
PORT=3002

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


## 📚 Related

- [`btc-vaultero/`](../btc-vaultero/) - Bitcoin transaction logic
- [`evmchain/`](../evmchain/) - Solidity smart contracts  
- [`evm-dapp/`](../evm-dapp/) - Frontend Wagmi application
- [`config/`](../config/) - Shared parameter configuration
