# BTC Yield Protocol - Backend Development Setup

## 🎯 **Overview**

This guide sets up the backend service to work with your exact Anvil configuration and deployment process.

## 🚀 **Quick Start**

### **1. Start Anvil (Same as evm-dapp)**
```bash
# From backend-service directory
npm run anvil:start

# Or manually (same as evm-dapp)
anvil --mnemonic-seed-unsafe 2
```

### **2. Deploy Contracts**
```bash
# From backend-service directory
npm run anvil:deploy

# Or manually (same as evm-dapp)
cd ../evmchain
forge script script/DeployLoanContract.sol --rpc-url http://127.0.0.1:8545 --private-key 0xd6a036f561e03196779dd34bf3d141dec4737eec5ed0416e413985ca05dad51a --broadcast
```

once deployed, the contract addresses must be updated in `../evm-dapp/.env.local` for use by the loan dapp front end.


### **3. Start Backend Service**
```bash
npm run dev
```

### **4. Full Development Environment**
```bash
# Start both Anvil and backend service
npm run dev:full
```

## 🔧 **Configuration Details**

### **Anvil Configuration**
- **Command**: `anvil --mnemonic-seed-unsafe 2`
- **RPC URL**: `http://127.0.0.1:8545`
- **Chain ID**: `31337`
- **Deterministic Accounts**: Yes (seed = 2)

### **Deterministic Accounts**

Available Accounts
==================

(0) 0x8995E44a22e303A79bdD2E6e41674fb92d620863 (10000.000000000000000000 ETH)
(1) 0xE9e05C9f02e10FA833D379CB1c7aC3a3f23B247e (10000.000000000000000000 ETH)
(2) 0x61Da7c7F97EBE53AD7c4E5eCD3d117E7Ab430eA7 (10000.000000000000000000 ETH)
(3) 0x5b0248e30583CeD4F09726C547935552C469EB24 (10000.000000000000000000 ETH)
(4) 0xcDbc8abb83E01BaE13ECE8853a5Ca84b2Ef6Ca86 (10000.000000000000000000 ETH)
(5) 0xa683a3E33E07fb84ff33FcE753Da1d248298977f (10000.000000000000000000 ETH)
(6) 0x008099bFee75e832e1b93D4c023f646d99d4C90f (10000.000000000000000000 ETH)
(7) 0x38aDCae107e9aEd4C6dfFA317d651E80CCCE0857 (10000.000000000000000000 ETH)
(8) 0x7bef0107b506AE804789D613a0d89d74f8C6e3bB (10000.000000000000000000 ETH)
(9) 0x5a25Da550eF9737360a4eE4aCd6d212182006FcF (10000.000000000000000000 ETH)

Private Keys
==================

(0) 0xd6a036f561e03196779dd34bf3d141dec4737eec5ed0416e413985ca05dad51a
(1) 0xbe62250c9db006c67c1595ff1f019bc849e2aa5c092dea0bf00883b39e54e904
(2) 0xc3bae29d211b5523ccdc349e8275cc57a291a03558be6f6ec799c196702ef881
(3) 0x4bc19d3b0467a84723ad48118ed28884105526458d5a64a716ebea568318e3d0
(4) 0x07127c605875395527bccbc5c74afa9dc1712d83ba5b12207bab86d3b7fa8be6
(5) 0x309bc84a97ca76f0c15bc3a6c98d46d8fb2381c8bd63ba6cc7b0d25ff4a13332
(6) 0x3d4471ad1080f3c193b0a1f299ad78e3b9d7119c2bc841b17fa3317a627f2818
(7) 0xf583a7d3a6cfe88ea61f0d3ab3ef5dc167636defe2b6f8c8f06c8981267ba401
(8) 0xe4551109a4ac27b5a3b67f810ccf2db93d47858f9f0646a4959b8962b62254ec
(9) 0xfbb266b6672556e75e1870e79796f0004b66d2f3b1c132675e345dfcccd14114


# Deployed Contract Addresses: when deployed with anvil accounts with mnemonic seed 2
ETHER_SWAP_ADDRESS=0x9048077ab9aC4DEFf1444323887f23C422F15AAb
BTC_COLLATERAL_LOAN_ADDRESS=0x02b8aFd8146b7Bc6BD4F02782c18bd4649Be1605


## 📁 **Project Structure**

```
btcyield/
├── backend-service/          # Node.js backend
│   ├── scripts/
│   │   ├── start-anvil.sh    # Start Anvil (matches evm-dapp)
│   │   └── deploy-contracts.sh # Deploy contracts
│   ├── src/
│   │   └── services/
│   │       └── foundryEVMService.ts # Foundry Cast integration
│   └── package.json
├── evmchain/                 # Foundry project with loan and HTLC contracts
│   ├── script/
│   │   └── DeployLoanContract.sol
│   └── foundry.toml
├── evm-dapp/                 # Frontend
|    └── README.md
|
├── btc-vaultero # package for P2TR contracts (escrow and collateral outputs)
|
├── python-api # API built using btc-vaultero for txs to create and spend escrow and collateral outputs    
|
├── btc-backend # bitcoin-core service
    
```

## 🛠️ **Environment Variables**

### **Backend Service (.env)**
```bash
# EVM Configuration (matches evm-dapp)
EVM_RPC_URL=http://127.0.0.1:8545
EVM_CHAIN_ID=31337

# Contract Addresses (update after deployment)
BTC_COLLATERAL_LOAN_ADDRESS=0x...
LOAN_FACTORY_ADDRESS=0x...

# Python API
PYTHON_API_URL=http://localhost:8001

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/btcyield

# Bitcoin
BITCOIN_RPC_URL=http://localhost:18443
```

## 🔄 **Development Workflow**

### **1. Start Development Environment**
```bash
# Terminal 1: Start Anvil
cd backend-service
npm run anvil:start

# Terminal 2: Deploy contracts
npm run anvil:deploy

# Terminal 3: Start backend service
npm run dev

# Terminal 4: Start Python API
cd ../python-api
python start.py
```

### **2. Contract Development**
```bash
# Make changes to contracts in evmchain/
cd ../evmchain

# Compile
forge build

# Test
forge test

# Deploy to Anvil
forge script script/DeployLoanContract.sol --rpc-url http://127.0.0.1:8545 --private-key 0xd6a036f561e03196779dd34bf3d141dec4737eec5ed0416e413985ca05dad51a --broadcast
```

### **3. Backend Development**
```bash
# Make changes to backend service
cd backend-service

# The service will auto-reload with ts-node-dev
# Check logs for any errors
```

## 🧪 **Testing with Foundry Cast**

### **Contract Interactions**
```bash
# Call a function
cast call 0x123... "getLoanStatus(uint256)" 1 --rpc-url http://127.0.0.1:8545

# Send a transaction
cast send 0x123... "extendLoanOffer(uint256)" 1 --private-key 0xd6a036f561e03196779dd34bf3d141dec4737eec5ed0416e413985ca05dad51a --rpc-url http://127.0.0.1:8545

# Get contract code
cast code 0x123... --rpc-url http://127.0.0.1:8545
```

### **Anvil-Specific Commands**
```bash
# Mine blocks
cast rpc anvil_mine 10 --rpc-url http://127.0.0.1:8545

# Get accounts
cast rpc anvil_accounts --rpc-url http://127.0.0.1:8545

# Set gas price
cast rpc anvil_setGasPrice 20000000000 --rpc-url http://127.0.0.1:8545

# Impersonate account
cast rpc anvil_impersonateAccount 0x123... --rpc-url http://127.0.0.1:8545
```

## 🔍 **Debugging**

### **Check Anvil Status**
```bash
# Check if Anvil is running
curl -s http://127.0.0.1:8545

# Get chain ID
cast chain-id --rpc-url http://127.0.0.1:8545

# Get latest block
cast block latest --rpc-url http://127.0.0.1:8545
```

### **Check Contract Deployment**
```bash
# Get contract code
cast code <CONTRACT_ADDRESS> --rpc-url http://127.0.0.1:8545

# Get contract balance
cast balance <CONTRACT_ADDRESS> --rpc-url http://127.0.0.1:8545

# Get contract storage
cast storage <CONTRACT_ADDRESS> 0 --rpc-url http://127.0.0.1:8545
```

### **Backend Service Logs**
```bash
# Check backend service logs
npm run dev

# Look for these log messages:
# ✅ Server running on port 3001
# 🔍 Cast call: cast call 0x123...
# ⛏️ Mined 1 block(s)
# 🎭 Impersonating account: 0x123...
```

## 🚨 **Troubleshooting**

### **Common Issues**

#### **1. Anvil Not Running**
```bash
# Error: Failed to connect to Anvil
# Solution: Start Anvil first
npm run anvil:start
```

#### **2. Contracts Not Deployed**
```bash
# Error: Contract not found
# Solution: Deploy contracts first
npm run anvil:deploy
```

#### **3. Wrong Private Key**
```bash
# Error: Invalid private key
# Solution: Use the correct deterministic private key
# 0xd6a036f561e03196779dd34bf3d141dec4737eec5ed0416e413985ca05dad51a
```

#### **4. Port Already in Use**
```bash
# Error: Port 8545 already in use
# Solution: Kill existing Anvil process
pkill -f anvil
```

### **Reset Development Environment**
```bash
# Stop all services
pkill -f anvil
pkill -f "ts-node-dev"

# Start fresh
npm run anvil:start
npm run anvil:deploy
npm run dev
```

## 🎯 **Key Benefits**

✅ **Consistent with evm-dapp**: Same Anvil configuration and deployment process
✅ **Deterministic Testing**: Same accounts every time
✅ **Foundry Integration**: Uses Cast commands for all EVM interactions
✅ **Easy Development**: Simple scripts for common tasks
✅ **Full Stack**: Backend, contracts, and frontend all work together

## 🚀 **Next Steps**

1. **Deploy contracts** and update environment variables
2. **Test contract interactions** using the backend service
3. **Integrate with Python API** for Bitcoin operations
4. **Test the full loan workflow** end-to-end
5. **Add monitoring and logging** for production readiness

This setup ensures your backend service works seamlessly with your existing development workflow!
