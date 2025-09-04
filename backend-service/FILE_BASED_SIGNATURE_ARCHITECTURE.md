# File-Based Signature Architecture for BTC Yield Protocol

## 🎯 **Corrected Architecture Overview**

This document describes the **file-based signature workflow** that addresses the security and practical requirements of the BTC Yield Protocol in a regtest environment.

## 🔐 **Security Model**

### **Borrower (End User)**
- **Private Key**: NEVER transmitted over network
- **Local Signing**: Uses local Python API with private key
- **File Upload**: Uploads signature JSON file to frontend
- **No Network Exposure**: Private key stays on borrower's machine

### **Lender (Platform Operator)**
- **Backend Access**: Operates the backend service
- **Python API Integration**: Uses backend Python API with lender private key
- **Witness Completion**: Completes Bitcoin transactions using borrower's signature

## 🔄 **Complete Workflow**

### **1. Loan Request Phase**
```
Borrower → Frontend → Backend → Python API
    ↓
1. Borrower requests loan via EVM contract
2. Backend detects EVM event
3. Backend requests escrow transaction from Python API
4. Python API creates escrow transaction
5. Frontend displays escrow transaction details
6. Borrower downloads signature template
7. Borrower runs local Python API to sign
8. Borrower uploads signature JSON file
9. Backend stores signature and coordinates with lender
```

### **2. Loan Offer & Collateral Phase**
```
Lender → Backend → Python API
    ↓
1. Lender extends loan offer via EVM contract
2. Backend detects EVM event
3. Backend requests collateral transaction from Python API
4. Python API creates collateral transaction
5. Borrower downloads collateral signature template
6. Borrower signs locally and uploads signature
7. Lender completes witness using backend Python API
8. Transaction is broadcast to Bitcoin network
```

### **3. Loan Activation & Repayment**
```
Both Parties → Backend Coordination
    ↓
1. Borrower accepts loan offer via EVM
2. Backend coordinates cross-chain state
3. Loan becomes active
4. Borrower initiates repayment via EVM
5. Lender accepts repayment via EVM
6. Backend coordinates collateral release
7. Loan is completed
```

## 🛠️ **Technical Implementation**

### **Frontend Components**

#### **1. File-Based Signature Hook** (`useBitcoinSignatures.ts`)
```typescript
// Key functions:
- uploadSignature(loanId, file, transactionType)
- parseSignatureFile(file)
- downloadSignatureTemplate(loanId, transactionType)
- getSignatureStatus(loanId)
```

#### **2. File-Based Loan Card** (`FileBasedLoanCard.tsx`)
```typescript
// Features:
- Download signature templates
- Upload signature JSON files
- Display cross-chain status
- Handle EVM transactions
- Show signature upload progress
```

### **Backend API Endpoints**

#### **1. Signature Upload** (`POST /api/bitcoin/signatures/upload`)
```json
{
  "loanId": "uuid",
  "transactionType": "escrow|collateral",
  "signatureFile": "borrower_signature.json",
  "signatureData": {
    "sig_borrower": "signature_hex",
    "txid": "transaction_id",
    "tx_hex": "raw_transaction",
    "input_amount": 0.001,
    "leaf_index": 1,
    "tapleaf_script_hex": "script_hex",
    "control_block": "control_block_hex"
  }
}
```

#### **2. Witness Completion** (`POST /api/bitcoin/signatures/:id/complete-witness`)
```json
{
  "lenderPrivateKey": "lender_wif_key"
}
```

#### **3. Signature Management**
- `GET /api/bitcoin/signatures/loan/:loanId` - Get all signatures for loan
- `GET /api/bitcoin/signatures/:id` - Get signature details
- `GET /api/bitcoin/signatures/:id/export` - Export signature to JSON

### **Python API Integration**

#### **1. Borrower Signature Generation** (Local)
```bash
# Borrower runs locally with their private key
curl -X POST http://localhost:8001/transactions/borrower-signature \
  -H "Content-Type: application/json" \
  -d '{
    "loan_id": "uuid",
    "escrow_txid": "txid",
    "borrower_pubkey": "pubkey",
    "lender_pubkey": "lender_pubkey",
    "preimage_hash_borrower": "hash",
    "borrower_timelock": 144,
    "collateral_amount": "0.001",
    "borrower_private_key": "borrower_wif_key"
  }'
```

#### **2. Lender Witness Completion** (Backend)
```bash
# Backend calls Python API with lender private key
curl -X POST http://python-api:8001/transactions/complete-witness \
  -H "Content-Type: application/json" \
  -d '{
    "loan_id": "uuid",
    "signature_file_path": "path/to/signature.json",
    "lender_private_key": "lender_wif_key",
    "mine_block": true
  }'
```

## 📱 **User Experience Flow**

### **Borrower Experience**
```
1. Connect MetaMask wallet ✅
2. Request loan through frontend ✅
3. Download signature template ✅
4. Run local Python API with private key ✅
5. Upload signature JSON file ✅
6. View loan status updates ✅
7. Accept loan offer when ready ✅
8. Repeat signature process for collateral ✅
9. Monitor loan status ✅
10. Initiate repayment when due ✅
```

### **Lender Experience**
```
1. Connect MetaMask wallet ✅
2. View loan requests in dashboard ✅
3. Extend loan offers ✅
4. Backend automatically completes Bitcoin transactions ✅
5. Monitor loan status ✅
6. Accept repayments ✅
7. Handle defaults if needed ✅
```

## 🔧 **Development Setup**

### **1. Backend Service**
```bash
cd backend-service
npm install
npm run dev
# Runs on http://localhost:3001
```

### **2. Python API**
```bash
cd python-api
pip install -r requirements.txt
python start.py
# Runs on http://localhost:8001
```

### **3. Bitcoin Core (Regtest)**
```bash
cd btc-backend
docker-compose up
# Runs Bitcoin Core in regtest mode
```

### **4. Frontend**
```bash
cd evm-dapp
npm install
npm run dev
# Runs on http://localhost:3000
```

## 📊 **Database Schema Extensions**

### **Signatures Table**
```sql
CREATE TABLE signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id),
    signed_by UUID NOT NULL REFERENCES users(id),
    signature_type VARCHAR(20) NOT NULL, -- 'borrower' | 'lender'
    signature_data TEXT NOT NULL,
    transaction_hex TEXT NOT NULL,
    input_amount DECIMAL(18,8) NOT NULL,
    script_path BOOLEAN DEFAULT TRUE,
    leaf_index INTEGER,
    tapleaf_script TEXT,
    control_block TEXT,
    witness_context JSONB,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'used' | 'expired'
    created_at TIMESTAMP DEFAULT NOW(),
    used_at TIMESTAMP
);
```

## 🚨 **Error Handling**

### **Signature Upload Errors**
- Invalid JSON format
- Missing required fields
- File size limits (1MB)
- Duplicate signature uploads
- Loan not found

### **Witness Completion Errors**
- Signature already used
- Invalid lender private key
- Python API unavailable
- Bitcoin network errors
- Transaction broadcast failures

## 🔒 **Security Considerations**

### **File Upload Security**
- File type validation (JSON only)
- File size limits
- Content validation
- Malicious file detection

### **Private Key Security**
- Borrower keys never transmitted
- Lender keys stored securely in backend
- Environment variable protection
- Key rotation capabilities

### **Network Security**
- HTTPS in production
- API authentication
- Rate limiting
- Input validation

## 📈 **Monitoring & Observability**

### **Signature Tracking**
- Upload success rates
- Processing times
- Error rates by type
- File size distributions

### **Cross-Chain Coordination**
- EVM event processing
- Bitcoin transaction status
- State synchronization
- Workflow completion rates

## 🎯 **Key Benefits**

✅ **Security**: Borrower private keys never leave their machine
✅ **Simplicity**: No complex wallet integrations needed
✅ **Flexibility**: Works with any Bitcoin Core setup
✅ **Regtest Compatible**: Perfect for development and testing
✅ **Scalable**: Easy to extend for production use
✅ **Auditable**: Complete signature and transaction logging

## 🚀 **Production Considerations**

### **File Storage**
- Use cloud storage (S3, GCS) for signature files
- Implement file retention policies
- Add encryption for sensitive data

### **Key Management**
- Use HSM for lender private keys
- Implement key rotation
- Add multi-signature support

### **Monitoring**
- Add comprehensive logging
- Implement alerting for failures
- Monitor cross-chain state consistency

This architecture provides a **secure, practical, and scalable** solution for Bitcoin-collateralized lending while maintaining the security model where borrower private keys never touch the backend infrastructure.
