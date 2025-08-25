# BTC Yield Python API Service

Python FastAPI service that wraps `btc-vaultero` functionality to provide Bitcoin transaction operations for the BTC Yield Protocol lender/platform operator.

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

### Development Mode

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables (see Configuration section)
export PYTHON_API_BITCOIN_NETWORK=testnet
export PYTHON_API_VAULTERO_PATH=/path/to/btc-vaultero

# Run development server
python start.py

# Or using uvicorn directly
uvicorn app.main:app --reload --port 8001
```

### Production Mode (Docker)

```bash
# From backend-service directory
docker-compose up python-api

# Check health
curl http://localhost:8001/health
```

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
| `GET` | `/loans/{loan_id}/status` | Get Bitcoin status for loan |
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
PYTHON_API_BITCOIN_NETWORK=testnet  # testnet|mainnet|regtest

# BTC-Vaultero Integration  
PYTHON_API_VAULTERO_PATH=/app/btc-vaultero

# Lender Keys (SECURE THESE IN PRODUCTION!)
PYTHON_API_LENDER_PRIVATE_KEY=your_wif_or_hex_key
PYTHON_API_LENDER_PUBKEY=your_x_only_pubkey

# Bitcoin RPC (for broadcasting)
PYTHON_API_BITCOIN_RPC_HOST=localhost
PYTHON_API_BITCOIN_RPC_PORT=18332
PYTHON_API_BITCOIN_RPC_USER=rpc_user
PYTHON_API_BITCOIN_RPC_PASSWORD=rpc_password
```

### Key Management Security

**⚠️ CRITICAL: Lender Key Security**

In production, lender private keys should be:
- Stored in secure key management systems (AWS KMS, HashiCorp Vault, etc.)
- Never logged or exposed in configuration
- Rotated regularly
- Protected with hardware security modules (HSM) if possible

For development/testing:
```bash
# Testnet example (safe for development)
PYTHON_API_LENDER_PRIVATE_KEY=cVt4o7BGAig1UXywgGSmARhxMBkTdBNh2TdU2Rk8QmJKFKRmyBAB
PYTHON_API_LENDER_PUBKEY=1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

## 🔌 Integration with BTC-Vaultero

This service integrates with your existing `btc-vaultero` package:

```python
# In vaultero_service.py
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../btc-vaultero'))

# Import your btc-vaultero functions
from your_vaultero_modules import (
    create_escrow_transaction,
    create_collateral_transaction,
    sign_transaction,
    broadcast_transaction
)
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

## 🐳 Docker Integration

### Build and Run
```bash
# Build the Python API service
docker build -t btc-yield-python-api .

# Run standalone
docker run -p 8001:8001 \
  -e PYTHON_API_BITCOIN_NETWORK=testnet \
  -e PYTHON_API_LENDER_PUBKEY=your_pubkey \
  btc-yield-python-api

# Or use docker-compose (recommended)
docker-compose up python-api
```

### Health Checks
The service includes Docker health checks:
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:8001/health || exit 1
```

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

### Automated Testing
```bash
# Install test dependencies
pip install pytest pytest-asyncio

# Run tests
pytest tests/

# Run with coverage
pytest --cov=app tests/
```

## 📊 Monitoring & Logging

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

### Health Monitoring
- **Health endpoint**: `/health` - Returns service status
- **Docker health checks**: Automatic container monitoring
- **Bitcoin network status**: Checks btc-vaultero availability

### Error Handling
- Global exception handler with structured error responses
- Proper HTTP status codes
- Detailed error messages for debugging
- Security-conscious error messages in production

## 🔄 Development Workflow

### Local Development
1. **Set up environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Configure environment**:
   ```bash
   export PYTHON_API_BITCOIN_NETWORK=testnet
   export PYTHON_API_VAULTERO_PATH=/path/to/btc-vaultero
   ```

3. **Run development server**:
   ```bash
   python start.py
   ```

4. **Test API**:
   ```bash
   curl http://localhost:8001/health
   ```

### Production Deployment
1. **Use Docker Compose** (recommended)
2. **Secure key management** (never use example keys!)
3. **Monitor service health** and Bitcoin network status
4. **Set up proper logging** and alerting
5. **Configure firewalls** (only allow Node.js service access)

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

## 📚 Related Services

- **[backend-service](../backend-service/)** - Node.js API and database layer
- **[btc-vaultero](../btc-vaultero/)** - Bitcoin transaction logic package
- **[evm-dapp](../evm-dapp/)** - Frontend application (borrower interface)
- **[evmchain](../evmchain/)** - Solidity smart contracts

## 🛣️ Future Enhancements

### Planned Features
- [ ] Real btc-vaultero integration (replace mocks)
- [ ] Bitcoin RPC broadcasting
- [ ] Transaction confirmation monitoring
- [ ] Automated key rotation
- [ ] Multi-signature support
- [ ] Hardware security module (HSM) integration
- [ ] Rate limiting and authentication
- [ ] Comprehensive test suite
- [ ] Prometheus metrics
- [ ] OpenAPI/Swagger documentation

### Security Enhancements
- [ ] API authentication (JWT/API keys)
- [ ] Request validation and sanitization
- [ ] Audit logging for all operations
- [ ] Key derivation and rotation
- [ ] IP whitelisting
- [ ] TLS termination and certificate management
