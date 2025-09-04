#!/bin/bash

# Deploy contracts to Anvil for BTC Yield Protocol
# This script matches the exact deployment process from evm-dapp README

echo "🚀 Deploying contracts to Anvil..."

# Configuration
RPC_URL="http://127.0.0.1:8545"
PRIVATE_KEY="0xd6a036f561e03196779dd34bf3d141dec4737eec5ed0416e413985ca05dad51a"
EVMCHAIN_DIR="../evmchain"

# Check if Anvil is running
if ! curl -s ${RPC_URL} > /dev/null 2>&1; then
    echo "❌ Anvil is not running on ${RPC_URL}"
    echo "   Please start Anvil first:"
    echo "   anvil --mnemonic-seed-unsafe 2"
    exit 1
fi

# Check if evmchain directory exists
if [ ! -d "${EVMCHAIN_DIR}" ]; then
    echo "❌ evmchain directory not found at ${EVMCHAIN_DIR}"
    echo "   Please ensure you're running this from the backend-service directory"
    exit 1
fi

# Navigate to evmchain directory
cd "${EVMCHAIN_DIR}"

echo "📋 Deployment Configuration:"
echo "   RPC URL: ${RPC_URL}"
echo "   Private Key: ${PRIVATE_KEY:0:10}..."
echo "   Directory: $(pwd)"
echo ""

# Compile contracts
echo "🔨 Compiling contracts..."
forge build

if [ $? -ne 0 ]; then
    echo "❌ Contract compilation failed"
    exit 1
fi

echo "✅ Contracts compiled successfully"
echo ""

# Deploy contracts using the exact command from evm-dapp README
echo "📤 Deploying contracts..."
forge script script/DeployLoanContract.sol \
    --rpc-url ${RPC_URL} \
    --private-key ${PRIVATE_KEY} \
    --broadcast

if [ $? -ne 0 ]; then
    echo "❌ Contract deployment failed"
    exit 1
fi

echo ""
echo "✅ Contracts deployed successfully!"
echo ""
echo "📋 Next steps:"
echo "   1. Copy the deployed contract addresses from the output above"
echo "   2. Update your .env files with the new addresses:"
echo "      - backend-service/.env"
echo "      - evm-dapp/.env.local"
echo ""
echo "🔍 To verify deployment, you can run:"
echo "   cast call <CONTRACT_ADDRESS> <FUNCTION_SIGNATURE> --rpc-url ${RPC_URL}"
echo ""
echo "📚 Example verification commands:"
echo "   # Get contract code"
echo "   cast code <CONTRACT_ADDRESS> --rpc-url ${RPC_URL}"
echo ""
echo "   # Get contract balance"
echo "   cast balance <CONTRACT_ADDRESS> --rpc-url ${RPC_URL}"
