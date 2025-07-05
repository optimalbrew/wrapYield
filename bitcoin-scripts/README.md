# Bitcoin Scripts - Rust Implementation

Note: This readme (like all the source and test files) was generated using cursor. 
The tests use the bitcoin backend.

A comprehensive Rust implementation for experimenting with complex Bitcoin scripts including multisig, timelocks, and Taproot using the Bitcoin regtest network.

## 🎯 Overview

This project demonstrates advanced Bitcoin scripting concepts using Rust with the `bitcoin` and `miniscript` crates. It provides a complete end-to-end testing framework for funding and spending from various Bitcoin script types.

## ✅ What We Built

### 1. Bitcoin RPC Client
- Robust client that communicates with Bitcoin regtest node
- Handles authentication, JSON-RPC calls, and error management
- Supports wallet creation, address generation, and transaction operations

### 2. 2-of-3 Multisig Address Creation
- Uses Miniscript to create classic multisig addresses
- Generates private/public key pairs
- Creates redeem scripts for spending

### 3. Funding Process
- Sends Bitcoin to multisig addresses
- Confirms transactions with block generation
- Tracks transaction details

### 4. Spending Process
- Creates raw transactions
- Signs with required private keys
- Broadcasts signed transactions
- Verifies successful spending

## 🚀 Key Features

- **Automated Testing** - Comprehensive tests that verify the entire flow
- **Real Bitcoin Transactions** - Uses actual Bitcoin Core RPC calls
- **Proper Error Handling** - Robust error handling throughout the process
- **Clean Code** - No warnings, well-structured code

## 📋 Prerequisites

1. **Docker & Docker Compose** - For running Bitcoin regtest node
2. **Rust** - Latest stable version
3. **Bitcoin Core** - Running in regtest mode

## 🛠️ Setup

### 1. Start Bitcoin Regtest Node

```bash
# Navigate to the parent directory containing docker-compose.yml
cd ..

# Start the Bitcoin regtest node
docker-compose up -d

# Verify the node is running
docker-compose ps
```

### 2. Build and Test

```bash
# Navigate to the bitcoin-scripts directory
cd bitcoin-scripts

# Build the project
cargo build

# Run all tests
cargo test

# Run specific test
cargo test test_fund_and_spend_classic_multisig
```

## 🧪 Test Results

### ✅ `test_rpc_connection`
- Verifies connection to Bitcoin regtest node
- Tests wallet creation and loading
- Confirms RPC functionality

### ✅ `test_fund_and_spend_classic_multisig`
- Creates a 2-of-3 multisig address
- Funds it with 0.1 BTC
- Signs with 2 private keys (2-of-3 requirement)
- Successfully spends from the multisig address

## 📁 Project Structure

```
bitcoin-scripts/
├── Cargo.toml          # Rust dependencies
├── src/
│   ├── main.rs         # Main application entry point
│   ├── classic_multisig.rs  # 2-of-3 multisig implementation
│   ├── timelock_cltv.rs     # Absolute timelock (CLTV) scripts
│   ├── timelock_csv.rs      # Relative timelock (CSV) scripts
│   ├── taproot_tree.rs      # Taproot script tree implementation
│   └── tests.rs             # End-to-end tests
└── README.md           # This file
```

## 🔧 Dependencies

```toml
[dependencies]
bitcoin = "0.32.0"
miniscript = "11.0.0"
secp256k1 = "0.29.0"
rand = "0.8.5"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1.0", features = ["full"] }
anyhow = "1.0"
reqwest = { version = "0.11", features = ["json"] }
tokio-test = "0.4"
hex = "0.4"
base64 = "0.21"
```

## 🎯 Next Steps

The foundation is solid and ready for more advanced Bitcoin scripting experiments:

- **Timelock scripts** (CLTV/CSV) - Absolute and relative time-based spending conditions
- **Taproot script trees** - Advanced Taproot implementations with script trees
- **More complex multisig configurations** - N-of-M multisigs with various key arrangements
- **Custom script conditions** - Building complex spending conditions

## 🔍 Example Usage

```rust
// Create a 2-of-3 multisig
let multisig_info = create_multisig().unwrap();
println!("Address: {}", multisig_info.address);

// Fund the address
let rpc = BitcoinRPC::new();
let txid = rpc.send_to_address(&multisig_info.address, 0.1).await.unwrap();

// Spend from the multisig (requires 2 signatures)
// ... implementation in tests.rs
```

## 🐛 Troubleshooting

### Common Issues

1. **Bitcoin node not running**
   ```bash
   docker-compose ps
   docker-compose logs bitcoin
   ```

2. **RPC connection failed**
   - Check if port 18443 is accessible
   - Verify credentials: `bitcoin:localtest`

3. **Wallet not loaded**
   - The tests automatically create/load the `testwallet`
   - Check wallet status: `bitcoin-cli -regtest listwallets`

## 📚 Resources

- [Bitcoin Core RPC Documentation](https://developer.bitcoin.org/reference/rpc/)
- [Miniscript Documentation](https://bitcoin.sipa.be/miniscript/)
- [Rust Bitcoin Documentation](https://docs.rs/bitcoin/)

## 🤝 Contributing

This project is designed for learning and experimentation with Bitcoin scripting. Feel free to extend it with additional script types and features.

---

**Note**: This project uses Bitcoin regtest network for safe experimentation. 

# 1. Start the Bitcoin container
cd ..  # Go to parent directory
docker-compose up -d

# 2. Verify it's running
docker-compose ps

# 3. Then run tests
cd bitcoin-scripts
cargo test 