# BTC Loan Protocol -  Architecture

This document describes the complete architecture of the Collateralized BTC Loan system


## Quick start for local testing

Clone the repo. I assume you have Foundry installed for smart contract development. This may require you
to install rust first. Most services run in docker. The project requires node: we use WAGMI for the dApp front end, and express for backend. Python 3.10+ is required for the bitcoin taproot scripts, addresses, transaction construction, signing and signature
verification. Python api is built using `bitcoinutils` which requires 3.10.

1. Start a local anvil (Ethereum) from any terminal. For determinstic anvil accounts and testing, I use a fixed seed 

```bash
 anvil --mnemonic-seed-unsafe 2
```
2. Deploy the smart contracts (`BtcCollateralLoan` and `EtherSwap`). Do this from the `evmchain/` directory using the 
following script and the first anvil account's private key

```bash
forge script script/DeployLoanContract.sol --rpc-url http://127.0.0.1:8545 --private-key 0xd6a036f561e03196779dd34bf3d141dec4737eec5ed0416e413985ca05dad51a --broadcast
```
3. Start bitcoin core in `regtest` mode. This can be done from `btc-backend` with

```bash
docker compose up -d
```

In the same (`btc-backend/`) directory we have a script (make it executable) to fund a couple of wallets used for testing (one wallet for the borrower and one for lender). Unlike ethereum, we are not using browser-based wallets for bitcoin. We use 
bitcoin-core wallets.

```bash
./setup-wallets.sh
```

4. Start the Loan Dapp front end from `evm-dapp/`
```bash
npm run dev
```
this should start the dapp on `localhost:3000`


5. Start the backend service(s) from `backend-service`

```bash
docker compose up -d
```
this will start the backend service, two python-apis (for lender and one for borrower), and the postgres service.

If any of the containers are unhealthy or restartign then make sure bitcoin container is running and the wallets have been setup, also ensure anvil chain is up and contracts have been deployed.

If everything looks healthy, then go to the front end to test out the loan process. The forms have some default inputs that
should work to start with. On the bitcoin side, we need to interact with the python-api to send funds to the escrow address, 
and for the borrower to pre-sign a collateral commitment transaction. 

## The Loans Life Cycle

The flow is something like this. On the dapp (ocalhost:3000) there are two main views: borrower and lender. Start with the lender view
just to make sure the 

1. Prepare collateral: On the front end, before requesting a loan, a needs the borrower to fill in their preimage hash - which can be generated using the python-api. This hash is used along with borrower and lender pubkeys to generate the escrow address.
2. The borrower can use the python-api to send funds to this escrow address. The python-api can also be used to check that this is
the correct address. The amount suggested by the front end includes an origination fee on top of the loan and a small amount of sats for bitcoin network fees. The borrower can increase this further to allow for higher mining fees.
3. The txid and vout of the funding transaction are used to request a loan. 
4. Once a loan is requested, the lender will associate their own preimage hash with it. This is used by the python-api to
craft a transaction for the borrower to pre-sign. This pre-signed transaction will allow the lender to later spend the
escrow output and lock coins in a collateral output.
5. The borrower uses the lender's preimage hash to sign the transaction and uploads the signature on the front end.
6. The lender verifies that the signature is valid for that specific transaction. Only after that will the lender offer a loan.
7. Once a loan is offered the borrower can accept is using their secret preimage.
8. The lender uses the revealed preimage, and uses the python-api to complete the transaction to move the funds from the escrow to
the collateral output. This transaction also pays them the orgination fee.
9. Borrowers can repay the loan on the front end any time before the loan duration is over.
10. Once a repayment is in, the lender must accept it and reveal their secret preimage when doing so.
11. The borrower can use the python-api and the revealed preimage to retrieve their collateral - which completes the loan lifecycle

There are other ways that the escrow output and the collateral output can be spent. For example, in case of loan default, the lender gets the collateral output after a timelock. The python-api has methods to help with the construction of all necessary 
transations.



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
│ • Loan State    │    │ • Users         │    │ • Transactions  │
│ • Timelock      │    │ • Loans         │    │ • Confirmation  │
│ • Events        │    │ • Signatures    │    │ • Broadcasting  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
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
- **Loan Orchestration Engine**: Complete loan lifecycle state machine and workflow automation
- **EVM Event Monitor**: Real-time contract event listening, parsing, and state synchronization
- **Cross-Chain State Synchronizer**: EVM ↔ Bitcoin state validation, timelock enforcement, dispute resolution
- **Bitcoin Transaction Coordinator**: Transaction creation, signature workflow management, broadcasting
- **Error Recovery Service**: Comprehensive error handling, automatic recovery, and alerting
- **Monitoring & Alerting**: Performance metrics, health checks, and real-time alerting
- **Database Operations**: PostgreSQL for loans, users, signatures, events, workflows
- **API Coordination**: REST endpoints for frontend and signature workflows  
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


### **Frontend (evm-dapp)**
- **Borrower Interface**: Loan request and management interface
- **MetaMask Integration**: EVM transaction signing and broadcasting
- **Signature Coordination**: Interface for Bitcoin signature (borrower pre-signed TX) uploads and Schnorr verfication
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
# - Python API (Borrower): http://localhost:8002 
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379
# - pgAdmin: http://localhost:8080 (with --profile dev)
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

### **Phase 2: Enhanced Backend Services** 🔄
- [ ] **Loan Orchestration Engine**: Complete workflow automation and state management
- [ ] **EVM Event Monitor**: Real-time contract event processing and state synchronization
- [ ] **Cross-Chain State Synchronizer**: EVM ↔ Bitcoin consistency validation and dispute resolution
- [ ] **Error Recovery Service**: Comprehensive error handling and automatic recovery
- [ ] **Monitoring & Alerting**: Performance metrics, health checks, and real-time alerting
- [ ] Real btc-vaultero integration (replace mocks)
- [ ] Bitcoin network broadcasting
- [ ] Transaction confirmation monitoring

### **Phase 3: Production Integration**
- [ ] Frontend integration with enhanced APIs
- [ ] End-to-end testing and validation
- [ ] Performance optimization and scaling
- [ ] Security audit and hardening

### **Phase 4: Production Ready**
- [ ] Authentication and authorization
- [ ] Comprehensive testing suite
- [ ] Production deployment guides
- [ ] Documentation and training materials

## 🏗️ **Enhanced Backend Service Architecture**

The backend service has been significantly enhanced beyond basic scaffolding to provide comprehensive loan orchestration capabilities:

### **Core Service Components**

#### **1. Loan Orchestration Engine** (`src/services/loanOrchestration.ts`)
- **State Machine Management**: Tracks loan progression through all lifecycle stages
- **Workflow Automation**: Executes multi-step processes with dependency management
- **Event Coordination**: Synchronizes EVM and Bitcoin events
- **Business Logic**: Enforces lending rules, timelocks, and conditions
- **Recovery Mechanisms**: Handles failures and retry operations

#### **2. EVM Event Monitor** (`src/services/evmEventMonitor.ts`)
- **Real-time Event Listening**: Monitors `BtcCollateralLoan` and `EtherSwap` contracts
- **Event Processing**: Parses and validates contract events
- **State Updates**: Updates loan status based on EVM events
- **Queue Management**: Handles event processing with retry logic
- **Historical Sync**: Replays missed events on startup

#### **3. Cross-Chain State Synchronizer** (`src/services/crossChainSync.ts`)
- **State Validation**: Ensures EVM and Bitcoin states are consistent
- **Timelock Management**: Enforces Bitcoin and EVM timelocks
- **Dispute Handling**: Manages borrower/lender disputes
- **Reconciliation**: Detects and resolves state inconsistencies
- **Audit Trail**: Maintains complete transaction history

#### **4. Error Recovery Service** (`src/services/errorRecovery.ts`)
- **Error Classification**: Categorizes errors by type and severity
- **Automatic Recovery**: Implements recovery strategies for different error types
- **Retry Logic**: Configurable retry attempts with exponential backoff
- **Alerting**: Sends alerts for critical errors
- **Error Analytics**: Tracks error patterns and recovery success rates

#### **5. Monitoring & Alerting** (`src/services/monitoring.ts`)
- **Performance Metrics**: Tracks loan processing rates, transaction success rates, response times
- **Health Checks**: Monitors database, Python API, and EVM node health
- **Real-time Alerting**: Configurable alerts for critical conditions
- **System Observability**: Memory usage, CPU usage, uptime tracking
- **Alert Channels**: Console, email, Slack integration support

### **Enhanced Database Schema**

The database schema has been extended with additional tables for workflow tracking and event processing:

```sql
-- Workflow tracking
CREATE TABLE loan_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id),
    workflow_type VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    current_step VARCHAR(100),
    steps_completed JSONB,
    error_details JSONB,
    retry_count INTEGER DEFAULT 0
);

-- Event processing tracking
CREATE TABLE evm_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID REFERENCES loans(id),
    contract_address VARCHAR(42) NOT NULL,
    event_name VARCHAR(100) NOT NULL,
    block_number BIGINT NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    log_index INTEGER NOT NULL,
    event_data JSONB NOT NULL,
    processing_status VARCHAR(30) DEFAULT 'pending'
);

-- Bitcoin transaction monitoring
CREATE TABLE bitcoin_transaction_monitoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES bitcoin_transactions(id),
    txid VARCHAR(64) NOT NULL,
    monitoring_status VARCHAR(30) DEFAULT 'active',
    confirmation_target INTEGER DEFAULT 6,
    last_checked_at TIMESTAMP,
    confirmations INTEGER DEFAULT 0
);
```

### **Event-Driven Architecture**

The enhanced backend service implements a comprehensive event-driven architecture:

```typescript
// Event flow example
LoanRequested Event → Loan Orchestration Engine → Escrow Setup Workflow
    ↓
EVM Event Monitor → Cross-Chain State Sync → Bitcoin Transaction Coordinator
    ↓
Error Recovery Service → Monitoring & Alerting → Database Updates
```

### **Key Benefits of Enhanced Architecture**

✅ **Automated Loan Management**: Complete loan lifecycle automation with minimal manual intervention
✅ **Cross-Chain Consistency**: Ensures EVM and Bitcoin states remain synchronized
✅ **Robust Error Handling**: Automatic recovery from common failure scenarios
✅ **Real-time Monitoring**: Comprehensive observability and alerting
✅ **Scalable Design**: Microservice architecture with independent scaling
✅ **Audit Compliance**: Complete transaction and event logging for regulatory compliance

## 📚 **Documentation**

- **[Backend Service](backend-service/README.md)** - Node.js API documentation
- **[Backend Service Architecture](backend-service/ARCHITECTURE_DETAILED.md)** - Detailed backend service design
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
