# BTC Yield Python API Service

Python FastAPI service that wraps `btc-vaultero` functionality to provide Bitcoin transaction operations for the BTC Yield Protocol lender/platform operator.


## Illustrative Example

```bash
 curl -s http://localhost:8001/vaultero/nums-key | jq .
 {
  "success": true,
  "nums_key_hex": "0250929b74c1a04954b78b4b60c595c211f8b853e6e84bfa2be95712a7b0dd59e6",
  "message": "NUMS key retrieved successfully"
}

# To see all available endpoints
curl -s http://localhost:8001/ | jq .

# Get the tapscripts for escrow output
curl -X POST "http://localhost:8001/vaultero/leaf-scripts-output-0" \
  -H "Content-Type: application/json" \
  -d '{
    "borrower_pubkey": "02274903288d231552de4c2c270d1c3f71fe5c78315374830c3b12a6654ee03afa",
    "lender_pubkey": "0264b4b84f42da9bdb84f7eda2de12524516686e73849645627fb7a034c79c81c8",
    "preimage_hash_borrower": "3faa7c2aee84d26c241aa0f9a9718fde501a91c4a1f700ab37c1914f993242e3",
    "borrower_timelock": 144
  }' | jq

```

See [examples](./examples/README.md) of API call output for escrow tapscripts (for both borrower and lender to verify)


## 🏗️ Architecture Overview

```
┌─────────────────┐    HTTP API     ┌──────────────────────┐    Python      ┌─────────────────┐
│   Node.js API   │ ──────────────> │   Python API         │ ─────────────> │  btc-vaultero   │
│   (Port 3001)   │    Requests     │   (Port 8001)        │   Function     │   Package       │
│                 │                 │                      │   Calls        │                 │
│ • Loan DB       │                 │ • Lender Keys        │                │ • Bitcoin Logic │
│ • Signature     │                 │ • Transaction        │                │ • Cryptography  │  
│   Storage       │                 │   Creation           │                │ • Network Ops   │
│ • Coordination  │                 │ • Broadcasting       │                │                 │
└─────────────────┘                 └──────────────────────┘                └─────────────────┘
```

## 🔐 Security Model

### **Lender (Platform Operator)**
- ✅ **Private keys managed by Python API** (they control the infrastructure)
- ✅ **Automated signing operations**
- ✅ **Backend-to-backend communication**

### **Borrowers**
- ❌ **Private keys NEVER touch this service**
- ✅ **Sign transactions client-side** (local btc-vaultero, hardware wallets, etc.)
- ✅ **Send only signatures** to Node.js API for storage/coordination

## 🚀 Quick Start

### Build and Run
```bash
# Build the Python API service
docker build -t btc-yield-python-api . #from ./python-api
```

There is a compose file in the backend-services directory (also had postgres, redis, node api). The name of the container is `btc-yield-python-api` and the service is `python-api`

```bash
docker-compose up python-api #from ../backend-serices
```

This helps avoid creating a virtual environment. But it does mean we have to update the container each time we
make changes to the code.

``` bash
docker compose stop python-api && docker compose build python-api && docker compose up -d python-api #from ../backend-serices
```

Run tests with
```bash
docker 
```

### Current Status
- ✅ **Mock implementations** for development/testing
- 🔄 **Ready for btc-vaultero integration** (update imports in `vaultero_service.py`)
- ✅ **Full API interface** defined and working

### Integration Steps
1. Update imports in `app/services/vaultero_service.py`
2. Replace mock functions with actual btc-vaultero calls
3. Test with your existing transaction creation logic
4. Add proper error handling for Bitcoin operations


## 🔄 Communication with Node.js Service

The Node.js service communicates with this Python API via HTTP:

```typescript
// In bitcoinTransactionService.ts
const response = await fetch('http://python-api:8001/transactions/escrow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(escrowParams)
})
```

### Service Discovery
- **Docker**: Uses service names (`python-api:8001`)
- **Development**: Configure `PYTHON_API_URL=http://localhost:8001`
- **Production**: Use proper service discovery (Consul, Kubernetes, etc.)

## 🧪 Testing

### Prerequisites

**⚠️ IMPORTANT: Start the Docker container first!**

Before running any tests, you need to start the Python API service in Docker: and bitcoin RPC as well.

```bash
# From the backend-service directory
cd ../backend-service

# Start the Python API service
docker-compose up python-api -d

# Verify it's running
docker ps | grep python-api
```

### Stopping Containers

After you're done testing, you can stop the containers:

```bash
# From the backend-service directory
cd ../backend-service

# Stop all services
docker-compose down

# Or stop just the Python API service
docker-compose stop python-api

# To stop and remove containers (use with caution)
docker-compose down --remove-orphans
```

**Note**: The `pyapi-wallet` and any mined test coins will persist in your Bitcoin Core regtest node until you reset it.

### Test Structure

The test suite is organized into several categories:

```
python-api/tests/
├── __init__.py
├── conftest.py              # Test fixtures and configuration
├── test_config.py           # Configuration loading and validation tests
├── test_models.py           # Pydantic model validation tests
└── test_services.py         # Service layer functionality tests
```

### Running Tests

#### Option 1: Run from Host (Recommended for Development)

```bash
# Navigate to python-api directory
cd python-api

# Install test dependencies (if not already installed)
pip install pytest pytest-asyncio pytest-timeout

# Run all tests
pytest tests/

# Run specific test categories
pytest tests/test_services.py::TestBitcoinRPCService -v
pytest tests/test_services.py::TestVaulteroService -v
pytest tests/test_models.py -v
pytest tests/test_config.py -v

# Run with verbose output
pytest tests/ -v

# Run with coverage
pytest --cov=app tests/
```

#### Option 2: Run Inside Docker Container

```bash
# Execute tests inside the running container
docker exec btc-yield-python-api python -m pytest /app/tests/ -v

# Run specific test categories
docker exec btc-yield-python-api python -m pytest /app/tests/test_services.py::TestBitcoinRPCService -v

# Run with coverage
docker exec btc-yield-python-api python -m pytest --cov=app /app/tests/
```

### Test Categories

#### 1. Configuration Tests (`test_config.py`)
- **Purpose**: Validate configuration loading and environment variable handling
- **Tests**: 13 tests covering settings validation, Bitcoin RPC config, lender keys
- **Status**: ✅ All passing

#### 2. Model Validation Tests (`test_models.py`)
- **Purpose**: Test Pydantic model validation for API requests
- **Tests**: 7 tests covering escrow and collateral request validation
- **Status**: ✅ All passing

#### 3. Service Layer Tests (`test_services.py`)
- **Purpose**: Test core service functionality with real Bitcoin Core integration
- **Tests**: 12 tests covering VaulteroService and BitcoinRPCService

##### VaulteroService Tests (4 tests)
- Preimage generation
- Escrow transaction creation (mock)
- Transaction status checking (mock)
- Collateral transaction creation (mock)
- **Status**: ✅ All passing

##### BitcoinRPCService Tests (8 tests)
- **Real Bitcoin Core Integration** (no mocking!)
- Blockchain info retrieval
- Address generation
- Transaction info retrieval
- Block generation
- Transaction broadcasting (with error handling)
- Mempool info
- Balance retrieval
- Unspent outputs listing
- Connection health checks
- **Status**: ✅ All passing

### Test Environment Setup

#### Bitcoin Core Integration
The tests use a **real Bitcoin Core regtest node** for comprehensive testing:

```bash
# The tests automatically:
# 1. Connect to your Bitcoin Core regtest node
# 2. Use the 'pyapi-wallet' test wallet
# 3. Mine test coins for realistic testing
# 4. Test actual RPC calls instead of mocks
```

#### Test Wallet
- **Name**: `pyapi-wallet`
- **Network**: Regtest
- **Balance**: 0.001 BTC (automatically mined)
- **Purpose**: Comprehensive Bitcoin RPC testing

### Test Results

**Current Status**: 🎉 **32/32 tests passing (100%)**

```
======================== 32 passed, 2 warnings in 1.26s =======================
```

**Performance**:
- **Total Runtime**: ~1.26 seconds
- **Success Rate**: 100%
- **Warnings**: Only 2 deprecation warnings (non-critical)

### Troubleshooting Tests

#### Common Issues

1. **Container not running**:
   ```bash
   # Check if container is running
   docker ps | grep python-api
   
   # Start if needed
   cd ../backend-service
   docker-compose up python-api -d
   ```

2. **Bitcoin Core not accessible**:
   ```bash
   # Verify Bitcoin Core is running
   docker exec btc-yield-python-api python -c "
   from app.services.bitcoin_rpc_service import BitcoinRPCService
   import asyncio
   service = BitcoinRPCService()
   result = asyncio.run(service.get_blockchain_info())
   print('Bitcoin Core connection:', 'OK' if result else 'FAILED')
   "
   ```

3. **Test file sync issues**:
   ```bash
   # If tests aren't updated, copy files manually
   docker cp tests/test_services.py btc-yield-python-api:/app/tests/
   docker cp tests/conftest.py btc-yield-python-api:/app/tests/
   ```

#### Debug Mode
```bash
# Run tests with maximum verbosity
pytest tests/ -vvv --tb=long

# Run single test with debug output
pytest tests/test_services.py::TestBitcoinRPCService::test_get_blockchain_info_real -vvv -s
```

### Manual API Testing
```bash
# Test health endpoint
curl http://localhost:8001/health

# Test mock transaction creation
curl -X POST http://localhost:8001/debug/mock-transaction

# Test escrow creation
curl -X POST http://localhost:8001/transactions/escrow \
  -H "Content-Type: application/json" \
  -d '{
    "loan_id": "test-loan-123",
    "borrower_pubkey": "a123456789abcdef123456789abcdef123456789abcdef123456789abcdef12",
    "preimage_hash_borrower": "b123456789abcdef123456789abcdef123456789abcdef123456789abcdef12",
    "borrower_timelock": 144,
    "amount": "0.001"
  }'
```

### Structured Logging
The service uses `structlog` for structured logging:

```python
logger.info(
    "Transaction created",
    loan_id=request.loan_id,
    transaction_type="escrow",
    amount=str(request.amount)
)
```



## 🤝 Integration Points

### With Node.js Backend
- HTTP API calls for transaction operations
- JSON request/response format
- Error handling and retries
- Health check integration

### With btc-vaultero Package
- Direct Python function calls
- Shared configuration from `config/parameters.json`
- Bitcoin network operations
- Transaction signing and broadcasting

### With Bitcoin Network
- RPC connections for broadcasting
- Mempool API for transaction status
- Network-specific configuration (testnet/mainnet)


## 📋 API Endpoints

### Core Transaction Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/transactions/escrow` | Create Bitcoin escrow transaction |
| `POST` | `/transactions/collateral` | Create collateral transaction |
| `POST` | `/transactions/sign` | Sign transaction with lender key |
| `POST` | `/transactions/broadcast` | Broadcast to Bitcoin network |
| `GET` | `/transactions/{txid}/status` | Get transaction status |

### Supporting Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/preimage/generate` | Generate preimage for HTLC |

| `GET` | `/health` | Service health check |

### Debug Endpoints (Development Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/debug/config` | View configuration (masked) |
| `POST` | `/debug/mock-transaction` | Test transaction creation |

## 🔄 Transaction Flow

### 1. Escrow Creation
```bash
POST /transactions/escrow
{
  "loan_id": "uuid",
  "borrower_pubkey": "64-char-hex",
  "preimage_hash_borrower": "sha256-hash",
  "borrower_timelock": 144,
  "amount": "0.001"
}

Response:
{
  "success": true,
  "data": {
    "raw_tx": "020000...",
    "escrow_address": "bc1p...",
    "transaction_id": "escrow_uuid"
  }
}
```

### 2. Lender Signing
```bash
POST /transactions/sign
{
  "loan_id": "uuid",
  "raw_tx": "020000...",
  "input_amount": "0.001",
  "signer_type": "lender",
  "transaction_type": "escrow"
}

Response:
{
  "success": true,
  "data": {
    "signature": "a0b1c2...",
    "tapleaf_script": "6382...",
    "control_block": "c1a2..."
  }
}
```

### 3. Broadcasting Complete Transaction
```bash
POST /transactions/broadcast
{
  "raw_tx": "020000...",
  "witness_data": {
    "borrower_signature": "...",
    "lender_signature": "...",
    "preimage_hex": "...",
    "tapleaf_script": "...",
    "control_block": "..."
  }
}

Response:
{
  "success": true,
  "data": {
    "txid": "abcd1234...",
    "success": true
  }
}
```

## ⚙️ Configuration

### Environment Variables

All settings use the `PYTHON_API_` prefix:

```bash
# Server Configuration
PYTHON_API_HOST=0.0.0.0
PYTHON_API_PORT=8001
PYTHON_API_LOG_LEVEL=info

# Bitcoin Network
PYTHON_API_BITCOIN_NETWORK=regtest  # testnet|mainnet|regtest

# BTC-Vaultero Integration  
PYTHON_API_VAULTERO_PATH=/app/btc-vaultero

# Lender Keys (SECURE THESE IN PRODUCTION!)
PYTHON_API_LENDER_PRIVATE_KEY=your_wif_or_hex_key
PYTHON_API_LENDER_PUBKEY=your_x_only_pubkey

# Bitcoin RPC (for broadcasting)
PYTHON_API_BITCOIN_RPC_HOST=localhost
PYTHON_API_BITCOIN_RPC_PORT=18332
PYTHON_API_BITCOIN_RPC_USER=bitcoin
PYTHON_API_BITCOIN_RPC_PASSWORD=localhost
```