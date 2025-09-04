# Anvil Integration for BTC Yield Protocol

## 🎯 **Anvil + Foundry Cast Integration**

Using **Anvil** as the local Ethereum chain makes our Foundry Cast approach even more powerful and consistent.

## 🚀 **Anvil Advantages for Development**

### **1. Native Foundry Integration**
```bash
# Start Anvil (part of Foundry)
anvil --host 0.0.0.0 --port 8545

# Cast commands work seamlessly
cast call 0x123... "functionName()" --rpc-url http://localhost:8545
cast send 0x123... "functionName()" --private-key 0xac0974... --rpc-url http://localhost:8545
```

### **2. Fork Testing Capabilities**
```bash
# Fork mainnet for realistic testing
anvil --fork-url https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

# Fork specific block
anvil --fork-url https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY --fork-block-number 18500000
```

### **3. Gas and Mining Control**
```bash
# Control gas prices
anvil --gas-price 1000000000  # 1 gwei

# Mine blocks on demand
cast rpc anvil_mine 10 --rpc-url http://localhost:8545

# Set block time
anvil --block-time 2  # 2 second blocks
```

## 🔧 **Updated Configuration**

### **Environment Variables**
```bash
# Anvil Configuration
EVM_RPC_URL=http://localhost:8545
EVM_CHAIN_ID=31337  # Anvil default
ANVIL_HOST=0.0.0.0
ANVIL_PORT=8545

# Contract Addresses (deployed to Anvil)
BTC_COLLATERAL_LOAN_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
LOAN_FACTORY_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512

# Foundry Project Path
FOUNDRY_PROJECT_PATH=../evmchain
```

### **Anvil Startup Script**
```bash
#!/bin/bash
# scripts/start-anvil.sh

# Start Anvil with custom configuration
anvil \
  --host 0.0.0.0 \
  --port 8545 \
  --chain-id 31337 \
  --gas-price 1000000000 \
  --block-time 2 \
  --accounts 10 \
  --balance 10000 \
  --mnemonic "test test test test test test test test test test test junk"
```

## 🛠️ **Enhanced Foundry EVM Service for Anvil**

### **Anvil-Specific Features**
```typescript
export class FoundryEVMService {
  // ... existing methods ...

  /**
   * Mine blocks on demand (Anvil specific)
   */
  async mineBlocks(count: number = 1): Promise<void> {
    try {
      const cmd = `cast rpc anvil_mine ${count} --rpc-url ${this.rpcUrl}`
      await execAsync(cmd, { cwd: FOUNDRY_PROJECT_PATH })
      console.log(`⛏️ Mined ${count} block(s)`)
    } catch (error) {
      console.error(`❌ Failed to mine blocks: ${error}`)
      throw new Error(`Failed to mine blocks: ${error.message}`)
    }
  }

  /**
   * Set gas price (Anvil specific)
   */
  async setGasPrice(gasPrice: string): Promise<void> {
    try {
      const cmd = `cast rpc anvil_setGasPrice ${gasPrice} --rpc-url ${this.rpcUrl}`
      await execAsync(cmd, { cwd: FOUNDRY_PROJECT_PATH })
      console.log(`⛽ Gas price set to ${gasPrice} wei`)
    } catch (error) {
      console.error(`❌ Failed to set gas price: ${error}`)
      throw new Error(`Failed to set gas price: ${error.message}`)
    }
  }

  /**
   * Impersonate account (Anvil specific)
   */
  async impersonateAccount(address: string): Promise<void> {
    try {
      const cmd = `cast rpc anvil_impersonateAccount ${address} --rpc-url ${this.rpcUrl}`
      await execAsync(cmd, { cwd: FOUNDRY_PROJECT_PATH })
      console.log(`🎭 Impersonating account: ${address}`)
    } catch (error) {
      console.error(`❌ Failed to impersonate account: ${error}`)
      throw new Error(`Failed to impersonate account: ${error.message}`)
    }
  }

  /**
   * Stop impersonating account (Anvil specific)
   */
  async stopImpersonatingAccount(address: string): Promise<void> {
    try {
      const cmd = `cast rpc anvil_stopImpersonatingAccount ${address} --rpc-url ${this.rpcUrl}`
      await execAsync(cmd, { cwd: FOUNDRY_PROJECT_PATH })
      console.log(`🚫 Stopped impersonating account: ${address}`)
    } catch (error) {
      console.error(`❌ Failed to stop impersonating account: ${error}`)
      throw new Error(`Failed to stop impersonating account: ${error.message}`)
    }
  }

  /**
   * Set account balance (Anvil specific)
   */
  async setBalance(address: string, balance: string): Promise<void> {
    try {
      const cmd = `cast rpc anvil_setBalance ${address} ${balance} --rpc-url ${this.rpcUrl}`
      await execAsync(cmd, { cwd: FOUNDRY_PROJECT_PATH })
      console.log(`💰 Set balance for ${address} to ${balance} wei`)
    } catch (error) {
      console.error(`❌ Failed to set balance: ${error}`)
      throw new Error(`Failed to set balance: ${error.message}`)
    }
  }

  /**
   * Get Anvil-specific account info
   */
  async getAnvilAccounts(): Promise<string[]> {
    try {
      const cmd = `cast rpc anvil_accounts --rpc-url ${this.rpcUrl}`
      const { stdout } = await execAsync(cmd, { cwd: FOUNDRY_PROJECT_PATH })
      return JSON.parse(stdout)
    } catch (error) {
      console.error(`❌ Failed to get Anvil accounts: ${error}`)
      throw new Error(`Failed to get Anvil accounts: ${error.message}`)
    }
  }
}
```

## 🧪 **Testing with Anvil**

### **1. Fork Testing**
```typescript
// Test with mainnet fork
const anvilService = new FoundryEVMService(
  'http://localhost:8545',  // Anvil with mainnet fork
  pythonApiUrl,
  bitcoinRpcUrl
)

// Test with realistic gas prices and block times
await anvilService.setGasPrice('20000000000') // 20 gwei
await anvilService.mineBlocks(1) // Mine one block
```

### **2. Account Management**
```typescript
// Get test accounts
const accounts = await anvilService.getAnvilAccounts()
console.log('Available test accounts:', accounts)

// Impersonate any address for testing
await anvilService.impersonateAccount('0x123...')
await anvilService.setBalance('0x123...', '1000000000000000000') // 1 ETH
```

### **3. Block Mining Control**
```typescript
// Mine blocks to advance time
await anvilService.mineBlocks(10) // Mine 10 blocks

// This is useful for testing time-based features
// like loan expiration, timelocks, etc.
```

## 🔄 **Development Workflow**

### **1. Start Development Environment**
```bash
# Terminal 1: Start Anvil
cd evmchain
anvil --host 0.0.0.0 --port 8545 --accounts 10 --balance 10000

# Terminal 2: Deploy contracts
forge script script/DeployLoanContract.sol --rpc-url http://localhost:8545 --broadcast

# Terminal 3: Start backend service
cd backend-service
npm run dev

# Terminal 4: Start Python API
cd python-api
python start.py
```

### **2. Contract Deployment**
```bash
# Deploy to Anvil
forge create src/BtcCollateralLoan.sol:BtcCollateralLoan \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --rpc-url http://localhost:8545 \
  --broadcast
```

### **3. Testing Integration**
```bash
# Run tests against Anvil
forge test --rpc-url http://localhost:8545

# Test specific contract
forge test --match-contract BtcCollateralLoanTest --rpc-url http://localhost:8545
```

## 🎯 **Anvil-Specific Benefits for BTC Yield Protocol**

### **1. Realistic Testing**
- **Fork mainnet** for realistic gas prices and block times
- **Test with real tokens** and addresses
- **Simulate network conditions**

### **2. Time Control**
- **Mine blocks on demand** for testing timelocks
- **Control block time** for faster testing
- **Test loan expiration** scenarios

### **3. Account Management**
- **Impersonate any address** for testing
- **Set arbitrary balances** for testing
- **Test with multiple accounts**

### **4. Gas Control**
- **Set custom gas prices** for testing
- **Test gas optimization** scenarios
- **Simulate high gas conditions**

## 🚀 **Production Considerations**

### **When Moving to Production:**
1. **Replace Anvil** with real Ethereum node (Infura, Alchemy, etc.)
2. **Update RPC URLs** in environment variables
3. **Remove Anvil-specific methods** (mineBlocks, impersonateAccount, etc.)
4. **Add production error handling** and retry logic

### **Environment-Specific Configuration:**
```typescript
// Development (Anvil)
const isDevelopment = process.env.NODE_ENV === 'development'
const rpcUrl = isDevelopment 
  ? 'http://localhost:8545'  // Anvil
  : 'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY'  // Production
```

## 🎯 **Conclusion**

Using **Anvil** with **Foundry Cast** provides:

✅ **Perfect Integration**: Native Foundry tooling
✅ **Advanced Testing**: Fork testing, account impersonation
✅ **Time Control**: Mine blocks on demand
✅ **Gas Control**: Custom gas prices and limits
✅ **Realistic Development**: Fork mainnet for testing
✅ **Consistent Workflow**: Same tools for development and testing

This combination gives you the **best of both worlds**: powerful local development capabilities with production-ready tooling.
