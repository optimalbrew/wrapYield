# BTC Yield Backend Service - Detailed Architecture

## 🏗️ **Enhanced Backend Service Architecture**

The backend service is meant to be a comprehensive loan orchestration platform that manages the complete Bitcoin-collateralized lending lifecycle.

## 📊 **Core Service Components**

### 1. **Loan Orchestration Engine**
```
┌─────────────────────────────────────────────────────────────┐
│                Loan Orchestration Engine                    │
├─────────────────────────────────────────────────────────────┤
│ • Loan Lifecycle State Machine                             │
│ • Cross-Chain Event Coordination                           │
│ • Automated Workflow Triggers                              │
│ • Error Recovery & Retry Logic                             │
│ • Business Rule Validation                                 │
└─────────────────────────────────────────────────────────────┘
```

**Key Responsibilities:**
- **State Management**: Track loan progression through all lifecycle stages
- **Event Coordination**: Synchronize EVM and Bitcoin events
- **Workflow Automation**: Trigger appropriate actions based on state changes
- **Business Logic**: Enforce lending rules, timelocks, and conditions
- **Recovery**: Handle failures and retry operations

### 2. **EVM Contract Event Monitor**
```
┌─────────────────────────────────────────────────────────────┐
│              EVM Contract Event Monitor                     │
├─────────────────────────────────────────────────────────────┤
│ • Real-time Event Listening                                │
│ • Event Parsing & Validation                               │
│ • State Change Detection                                   │
│ • Event Queue Management                                   │
│ • Historical Event Replay                                  │
└─────────────────────────────────────────────────────────────┘
```

**Key Responsibilities:**
- **Event Listening**: Monitor `BtcCollateralLoan` and `EtherSwap` contracts
- **Event Processing**: Parse and validate contract events
- **State Updates**: Update loan status based on EVM events
- **Queue Management**: Handle event processing with retry logic
- **Historical Sync**: Replay missed events on startup

### 3. **Bitcoin Transaction Coordinator**
```
┌─────────────────────────────────────────────────────────────┐
│           Bitcoin Transaction Coordinator                   │
├─────────────────────────────────────────────────────────────┤
│ • Transaction Creation Requests                             │
│ • Signature Workflow Management                             │
│ • Transaction Broadcasting                                  │
│ • Confirmation Monitoring                                   │
│ • Fee Management                                            │
└─────────────────────────────────────────────────────────────┘
```

**Key Responsibilities:**
- **Transaction Creation**: Coordinate with Python API for Bitcoin transactions
- **Signature Management**: Handle multi-party signature workflows
- **Broadcasting**: Submit transactions to Bitcoin network
- **Monitoring**: Track transaction confirmations and status
- **Fee Optimization**: Manage transaction fees and priority

### 4. **Cross-Chain State Synchronizer**
```
┌─────────────────────────────────────────────────────────────┐
│           Cross-Chain State Synchronizer                    │
├─────────────────────────────────────────────────────────────┤
│ • EVM ↔ Bitcoin State Validation                           │
│ • Timelock Enforcement                                     │
│ • Dispute Resolution Logic                                 │
│ • State Reconciliation                                     │
│ • Audit Trail Management                                   │
└─────────────────────────────────────────────────────────────┘
```

**Key Responsibilities:**
- **State Validation**: Ensure EVM and Bitcoin states are consistent
- **Timelock Management**: Enforce Bitcoin and EVM timelocks
- **Dispute Handling**: Manage borrower/lender disputes
- **Reconciliation**: Detect and resolve state inconsistencies
- **Audit Trail**: Maintain complete transaction history

## 🔄 **Enhanced Loan Lifecycle Flow**

### **Phase 1: Loan Request & Setup**
```
1. Borrower submits loan request via frontend
   ↓
2. EVM Event Monitor detects LoanRequested event
   ↓
3. Loan Orchestration Engine creates loan record
   ↓
4. Bitcoin Transaction Coordinator requests escrow transaction
   ↓
5. Python API creates escrow transaction
   ↓
6. Backend stores transaction details
   ↓
7. Frontend receives escrow transaction for borrower signing
```

### **Phase 2: Lender Offer & Bitcoin Setup**
```
1. Lender extends loan offer via frontend
   ↓
2. EVM Event Monitor detects LoanOffered event
   ↓
3. Loan Orchestration Engine updates loan status
   ↓
4. Bitcoin Transaction Coordinator requests collateral transaction
   ↓
5. Python API creates collateral transaction
   ↓
6. Backend coordinates signature workflow
   ↓
7. Both parties sign Bitcoin transactions
   ↓
8. Transaction is broadcast to Bitcoin network
```

### **Phase 3: Loan Activation**
```
1. Borrower accepts loan offer via frontend
   ↓
2. EVM Event Monitor detects LoanActivated event
   ↓
3. Loan Orchestration Engine updates loan status
   ↓
4. Cross-Chain State Synchronizer validates Bitcoin collateral
   ↓
5. Loan becomes active with timelock enforcement
   ↓
6. Monitoring systems track loan status
```

### **Phase 4: Repayment & Settlement**
```
1. Borrower initiates repayment via frontend
   ↓
2. EVM Event Monitor detects RepaymentInProgress event
   ↓
3. Loan Orchestration Engine updates loan status
   ↓
4. Bitcoin Transaction Coordinator handles collateral release
   ↓
5. Lender accepts repayment via frontend
   ↓
6. EVM Event Monitor detects LoanRepaid event
   ↓
7. Cross-Chain State Synchronizer finalizes settlement
```

## 🛠️ **Technical Implementation**

### **Database Schema Enhancements**

```sql
-- Add workflow tracking
CREATE TABLE loan_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id),
    workflow_type VARCHAR(50) NOT NULL, -- 'escrow_setup', 'collateral_setup', 'repayment', etc.
    status VARCHAR(30) NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
    current_step VARCHAR(100),
    steps_completed JSONB,
    error_details JSONB,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add event processing tracking
CREATE TABLE evm_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID REFERENCES loans(id),
    contract_address VARCHAR(42) NOT NULL,
    event_name VARCHAR(100) NOT NULL,
    block_number BIGINT NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    log_index INTEGER NOT NULL,
    event_data JSONB NOT NULL,
    processed_at TIMESTAMP,
    processing_status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'processed', 'failed'
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add Bitcoin transaction monitoring
CREATE TABLE bitcoin_transaction_monitoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES bitcoin_transactions(id),
    txid VARCHAR(64) NOT NULL,
    monitoring_status VARCHAR(30) DEFAULT 'active', -- 'active', 'completed', 'failed'
    confirmation_target INTEGER DEFAULT 6,
    last_checked_at TIMESTAMP,
    confirmations INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### **Service Architecture**

```typescript
// Core service interfaces
interface LoanOrchestrationService {
  processLoanRequest(evmEvent: LoanRequestedEvent): Promise<void>
  processLoanOffer(evmEvent: LoanOfferedEvent): Promise<void>
  processLoanActivation(evmEvent: LoanActivatedEvent): Promise<void>
  processRepayment(evmEvent: RepaymentInProgressEvent): Promise<void>
  handleLoanCompletion(evmEvent: LoanRepaidEvent): Promise<void>
  handleLoanDefault(evmEvent: LoanDefaultedEvent): Promise<void>
}

interface EVMEventMonitorService {
  startMonitoring(): Promise<void>
  stopMonitoring(): Promise<void>
  processEvent(event: ContractEvent): Promise<void>
  replayHistoricalEvents(fromBlock: number): Promise<void>
  validateEvent(event: ContractEvent): boolean
}

interface BitcoinTransactionCoordinator {
  createEscrowTransaction(loanId: string): Promise<BitcoinTransaction>
  createCollateralTransaction(loanId: string): Promise<BitcoinTransaction>
  broadcastTransaction(txId: string): Promise<string>
  monitorTransaction(txId: string): Promise<TransactionStatus>
  handleSignatureWorkflow(loanId: string): Promise<void>
}

interface CrossChainStateSynchronizer {
  validateEVMState(loanId: string): Promise<boolean>
  validateBitcoinState(loanId: string): Promise<boolean>
  reconcileStates(loanId: string): Promise<void>
  enforceTimelocks(loanId: string): Promise<void>
  handleDisputes(loanId: string): Promise<void>
}
```

### **Event-Driven Architecture**

```typescript
// Event types
interface LoanRequestedEvent {
  loanId: string
  borrowerAddress: string
  amount: string
  borrowerBtcPubkey: string
  preimageHashBorrower: string
  txidP2tr0: string
  voutP2tr0: number
  blockNumber: number
  transactionHash: string
}

interface LoanOfferedEvent {
  loanId: string
  lenderAddress: string
  bondAmount: string
  lenderBtcPubkey: string
  preimageHashLender: string
  blockNumber: number
  transactionHash: string
}

// Event handlers
class LoanEventHandlers {
  async handleLoanRequested(event: LoanRequestedEvent) {
    // 1. Create loan record
    // 2. Request escrow transaction from Python API
    // 3. Update loan status
    // 4. Trigger Bitcoin transaction workflow
  }

  async handleLoanOffered(event: LoanOfferedEvent) {
    // 1. Update loan with lender details
    // 2. Request collateral transaction from Python API
    // 3. Coordinate signature workflow
    // 4. Update loan status
  }
}
```

## 🔧 **Implementation Phases**

### **Phase 1: Core Orchestration (Weeks 1-2)**
- [ ] Implement `LoanOrchestrationService`
- [ ] Create loan lifecycle state machine
- [ ] Add workflow tracking tables
- [ ] Implement basic event handlers

### **Phase 2: EVM Integration (Weeks 3-4)**
- [ ] Implement `EVMEventMonitorService`
- [ ] Add contract event listening
- [ ] Create event processing queue
- [ ] Add historical event replay

### **Phase 3: Bitcoin Coordination (Weeks 5-6)**
- [ ] Enhance `BitcoinTransactionCoordinator`
- [ ] Implement signature workflow management
- [ ] Add transaction monitoring
- [ ] Create broadcasting service

### **Phase 4: Cross-Chain Sync (Weeks 7-8)**
- [ ] Implement `CrossChainStateSynchronizer`
- [ ] Add state validation logic
- [ ] Create timelock enforcement
- [ ] Add dispute resolution

### **Phase 5: Production Features (Weeks 9-10)**
- [ ] Add comprehensive error handling
- [ ] Implement monitoring and alerting
- [ ] Add authentication and authorization
- [ ] Create admin interfaces

## 🚨 **Error Handling & Recovery**

### **Error Categories**
1. **EVM Errors**: Contract call failures, event processing errors
2. **Bitcoin Errors**: Transaction failures, network issues
3. **Python API Errors**: Service unavailable, transaction creation failures
4. **Database Errors**: Connection issues, constraint violations
5. **Cross-Chain Errors**: State inconsistencies, timelock violations

### **Recovery Strategies**
```typescript
interface ErrorRecoveryService {
  handleEVMError(error: EVMError, context: LoanContext): Promise<void>
  handleBitcoinError(error: BitcoinError, context: LoanContext): Promise<void>
  handlePythonAPIError(error: PythonAPIError, context: LoanContext): Promise<void>
  handleDatabaseError(error: DatabaseError, context: LoanContext): Promise<void>
  handleCrossChainError(error: CrossChainError, context: LoanContext): Promise<void>
}
```

## 📊 **Monitoring & Observability**

### **Key Metrics**
- Loan lifecycle completion rates
- Transaction success rates
- Event processing latency
- Cross-chain state consistency
- Error rates by category
- System uptime and performance

### **Alerting**
- Critical loan state changes
- Transaction failures
- Cross-chain inconsistencies
- System performance degradation
- Security events

## 🔒 **Security Considerations**

### **Access Control**
- Role-based access for different user types
- API authentication and authorization
- Secure communication between services
- Private key management (lender keys only)

### **Audit Trail**
- Complete event logging
- State change tracking
- User action logging
- System operation logging

This enhanced architecture transforms the backend service from basic scaffolding into a comprehensive loan orchestration platform that can handle the full complexity of Bitcoin-collateralized lending with proper error handling, monitoring, and cross-chain coordination.
