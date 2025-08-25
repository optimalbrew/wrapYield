# BTC Yield Protocol - Complete Architecture

This document describes the complete architecture of the BTC Yield Protocol with the new Python API service integration.

## 🏗️ **System Overview**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Borrower      │    │   Node.js API   │    │   Python API    │    │  btc-vaultero   │
│   Frontend      │    │   (Port 3001)   │    │   (Port 8001)   │    │   Package       │
│                 │    │                 │    │                 │    │                 │
│ • MetaMask      │◄──►│ • PostgreSQL    │◄──►│ • Lender Keys   │◄──►│ • Bitcoin TX    │
│ • Local Wallet  │    │ • Signature DB  │    │ • TX Creation   │    │ • Cryptography  │
│ • Client Sigs   │    │ • Loan Mgmt     │    │ • Broadcasting  │    │ • Network Ops   │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
        ▲                         ▲                         ▲
        │                         │                         │
        │ EVM Contracts            │ HTTP API                │ Python Calls
        ▼                         ▼                         ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   EVM Chain     │    │   PostgreSQL    │    │   Bitcoin       │
│   Contracts     │    │   Database      │    │   Network       │
│                 │    │                 │    │                 │
│ • Loan State    │    │ • Users/Loans   │    │ • Transactions  │
│ • Timelock      │    │ • Signatures    │    │ • Confirmation  │
│ • Events        │    │ • Events        │    │ • Broadcasting  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔐 **Security Architecture**

### **Lender (Platform Operator)**
```
🏦 LENDER OPERATIONS (Backend-Managed)
├── Private keys stored in Python API service
├── Automated transaction signing
├── Backend-to-backend communication
└── Full platform control
```

### **Borrower (End Users)**
```
👥 BORROWER OPERATIONS (Client-Side Only)
├── MetaMask for EVM transactions
├── Local btc-vaultero for Bitcoin signing
├── Browser wallet management
└── NO private keys touch the backend
```

## 🔄 **Complete Transaction Flow**

### **1. Loan Request**
```
Borrower → MetaMask → EVM Contract → Event → Node.js API → Database
```

### **2. Escrow Transaction Creation**
```
Node.js API → Python API → btc-vaultero → Raw TX → Database Storage
```

### **3. Borrower Signature (Client-Side)**
```
Borrower → Local btc-vaultero → Sign TX → Send Signature → Node.js API → Database
```

### **4. Lender Signature & Completion**
```
Node.js API → Python API → Sign with Lender Key → Complete Witness → Broadcast
```

### **5. Status Updates**
```
Bitcoin Network → Confirmations → Python API → Node.js API → Database → Frontend
```

## 📊 **Service Responsibilities**

### **Node.js Backend Service** (Port 3001)
- **Database Operations**: PostgreSQL for loans, users, signatures, events
- **API Coordination**: REST endpoints for frontend and signature workflows  
- **Signature Management**: Storage and coordination of multi-party signatures
- **EVM Integration**: Smart contract event monitoring and interaction
- **User Management**: Lender and borrower account management
- **Audit Trail**: Complete event logging and compliance

### **Python API Service** (Port 8001)  
- **Bitcoin Operations**: Wraps btc-vaultero package functionality
- **Lender Key Management**: Secure storage and usage of lender private keys
- **Transaction Creation**: Escrow, collateral, and settlement transactions
- **Transaction Signing**: Lender signatures for Bitcoin transactions
- **Broadcasting**: Transaction broadcast to Bitcoin network
- **Network Monitoring**: Bitcoin transaction status and confirmations

### **PostgreSQL Database**
- **Loan Lifecycle**: Complete loan state tracking and management
- **Signature Storage**: Bitcoin signatures for separate signing workflow
- **Transaction Records**: All Bitcoin and EVM transaction metadata
- **User Management**: Lender and borrower account information
- **Event Auditing**: Comprehensive audit trail for compliance

### **Frontend (evm-dapp)**
- **Borrower Interface**: Loan request and management interface
- **MetaMask Integration**: EVM transaction signing and broadcasting
- **Signature Coordination**: Interface for Bitcoin signature workflows
- **Status Monitoring**: Real-time loan and transaction status updates

## 🚀 **Deployment Architecture**

### **Development Setup**
```bash
# Start all services
cd backend-service
docker-compose up

# Services will be available at:
# - Node.js API: http://localhost:3001
# - Python API: http://localhost:8001  
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379
# - pgAdmin: http://localhost:8080 (with --profile dev)
```

### **Production Deployment**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   Container     │    │   Database      │
│                 │    │   Orchestration │    │   Cluster       │
│ • SSL/TLS       │    │                 │    │                 │
│ • Rate Limiting │    │ • Node.js API   │    │ • PostgreSQL    │
│ • Health Checks │    │ • Python API    │    │ • Redis         │
│                 │    │ • Auto-scaling  │    │ • Backups       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔗 **API Communication Patterns**

### **Frontend ↔ Node.js API**
```typescript
// Borrower creates signature client-side
const signature = await localWallet.signBitcoinTransaction(rawTx)

// Send only signature to backend
await fetch('/api/signatures', {
  method: 'POST',
  body: JSON.stringify({
    signatureData: signature,
    transactionHex: rawTx,
    signatureType: 'borrower'
  })
})
```

### **Node.js API ↔ Python API**
```typescript
// Node.js requests Bitcoin transaction creation
const response = await fetch('http://python-api:8001/transactions/escrow', {
  method: 'POST',
  body: JSON.stringify({
    loan_id: loanId,
    borrower_pubkey: borrowerPubkey,
    amount: amount.toString()
  })
})
```

### **Python API ↔ btc-vaultero**
```python
# Python API calls btc-vaultero functions
from btc_vaultero import create_escrow_transaction

result = create_escrow_transaction(
    borrower_pubkey=request.borrower_pubkey,
    lender_pubkey=self.lender_pubkey,
    preimage_hash=request.preimage_hash_borrower,
    timelock=request.borrower_timelock,
    amount=request.amount
)
```

## 🔧 **Configuration Management**

### **Shared Configuration** (`config/parameters.json`)
```json
{
  "timelocks": {
    "loanDuration": 1008,
    "btcEscrow": 144,
    "btcCollateral": 2016
  },
  "fees": {
    "processing": 0.001,
    "origination": 0.0001
  },
  "interestRates": {
    "default": 5.0
  }
}
```

### **Service-Specific Configuration**
- **Node.js**: Database, API keys, service URLs
- **Python**: Bitcoin network, lender keys, RPC configuration  
- **Frontend**: Contract addresses, API endpoints, wallet configuration

## 🔒 **Security Considerations**

### **Key Management**
- ✅ **Lender keys**: Managed by Python API (platform operator)
- ❌ **Borrower keys**: NEVER managed by backend services
- ✅ **API keys**: Secure communication between services
- ✅ **Database encryption**: Sensitive data encrypted at rest

### **Network Security**
- **TLS/HTTPS**: All API communication encrypted
- **VPC/Private Networks**: Services communicate on private networks
- **Firewall Rules**: Restricted access to database and internal APIs
- **Rate Limiting**: Protection against API abuse

### **Authentication & Authorization**
- **JWT Tokens**: Secure user session management
- **API Authentication**: Service-to-service authentication
- **Role-Based Access**: Lender vs borrower permissions
- **Audit Logging**: All sensitive operations logged

## 📈 **Scalability & Performance**

### **Horizontal Scaling**
- **Stateless Services**: Both Node.js and Python APIs are stateless
- **Database Clustering**: PostgreSQL read replicas for scaling
- **Redis Clustering**: Distributed caching and job queues
- **Container Orchestration**: Kubernetes for auto-scaling

### **Performance Optimization**
- **Database Indexing**: Optimized queries for loan and signature lookups
- **Connection Pooling**: Efficient database connection management
- **Caching Strategy**: Redis for frequently accessed data
- **API Response Caching**: Cacheable endpoints for static data

## 🧪 **Testing Strategy**

### **Unit Testing**
- **Node.js Services**: Jest for business logic testing
- **Python Services**: Pytest for Bitcoin operations testing
- **Database Models**: Automated schema validation
- **Configuration**: Shared parameter validation

### **Integration Testing**
- **API Communication**: End-to-end service communication tests
- **Database Operations**: Complete CRUD operation testing
- **Bitcoin Integration**: Mock and testnet transaction testing
- **Signature Workflows**: Multi-party signature coordination testing

### **End-to-End Testing**
- **Complete Loan Flow**: From request to settlement
- **Error Handling**: Failure scenarios and recovery
- **Security Testing**: Authentication and authorization
- **Performance Testing**: Load testing for scalability

## 🔄 **Development Workflow**

### **Local Development**
```bash
# 1. Start infrastructure
cd backend-service
docker-compose up postgres redis

# 2. Start Python API
cd ../python-api  
python start.py

# 3. Start Node.js API
cd ../backend-service
npm run dev

# 4. Start Frontend
cd ../evm-dapp
npm run dev
```

### **Code Organization**
```
btc-yield/
├── config/                 # Shared configuration system
├── btc-vaultero/          # Bitcoin transaction package  
├── evmchain/              # Solidity smart contracts
├── evm-dapp/              # Frontend React/Wagmi app
├── backend-service/       # Node.js API service
├── python-api/            # Python FastAPI service
└── ARCHITECTURE.md        # This document
```

## 🛣️ **Implementation Roadmap**

### **Phase 1: Foundation** ✅
- [x] Database schema design
- [x] Node.js API with signature workflows
- [x] Python API service creation
- [x] Docker container setup
- [x] Service integration architecture

### **Phase 2: Bitcoin Integration** 🔄
- [ ] Real btc-vaultero integration (replace mocks)
- [ ] Bitcoin network broadcasting
- [ ] Transaction confirmation monitoring
- [ ] Error handling and recovery

### **Phase 3: EVM Integration**
- [ ] Smart contract event monitoring
- [ ] Cross-chain state synchronization  
- [ ] Automated loan lifecycle management
- [ ] Frontend integration with new APIs

### **Phase 4: Production Ready**
- [ ] Authentication and authorization
- [ ] Comprehensive testing suite
- [ ] Performance optimization
- [ ] Security audit and hardening
- [ ] Production deployment guides

## 📚 **Documentation**

- **[Backend Service](backend-service/README.md)** - Node.js API documentation
- **[Python API](python-api/README.md)** - Python service documentation  
- **[Configuration](config/README.md)** - Shared configuration system
- **[BTC-Vaultero](btc-vaultero/)** - Bitcoin transaction package
- **[Frontend](evm-dapp/)** - React/Wagmi application

## 🤝 **Contributing**

1. **Follow architecture patterns** established in this document
2. **Maintain security model** (no borrower keys in backend)
3. **Test integrations thoroughly** before submitting changes
4. **Update documentation** when making architectural changes
5. **Use shared configuration** for consistent parameters across services

## 🎯 **Key Benefits**

✅ **Security**: Borrower keys never touch backend, lender has full control
✅ **Scalability**: Microservice architecture with independent scaling
✅ **Maintainability**: Clear separation of concerns and responsibilities  
✅ **Flexibility**: Easy to add new features and integrate with other systems
✅ **Reliability**: Robust error handling and recovery mechanisms
✅ **Auditability**: Complete transaction and event logging for compliance
