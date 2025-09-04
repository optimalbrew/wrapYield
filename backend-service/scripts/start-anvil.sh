#!/bin/bash

# Start Anvil for BTC Yield Protocol Development
# This script starts Anvil with the exact same configuration as the frontend

echo "🚀 Starting Anvil for BTC Yield Protocol Development..."

# Use the same configuration as evm-dapp
HOST=${ANVIL_HOST:-"127.0.0.1"}
PORT=${ANVIL_PORT:-"8545"}
MNEMONIC_SEED=${ANVIL_MNEMONIC_SEED:-"2"}

# Check if Anvil is already running
if curl -s http://${HOST}:${PORT} > /dev/null 2>&1; then
    echo "⚠️  Anvil is already running on ${HOST}:${PORT}"
    echo "   To stop it, run: pkill -f anvil"
    echo "   Or use: cast rpc anvil_stop --rpc-url http://${HOST}:${PORT}"
    exit 1
fi

# Start Anvil with the exact same configuration as evm-dapp
echo "📋 Configuration (matching evm-dapp setup):"
echo "   Host: ${HOST}"
echo "   Port: ${PORT}"
echo "   Mnemonic Seed: ${MNEMONIC_SEED}"
echo "   This gives deterministic accounts for testing"
echo ""

# Start Anvil with the same command as evm-dapp
anvil --mnemonic-seed-unsafe ${MNEMONIC_SEED}

echo "✅ Anvil started successfully!"
echo "🌐 RPC URL: http://${HOST}:${PORT}"
echo "🔗 Chain ID: ${CHAIN_ID}"
echo ""
echo "📚 Useful commands:"
echo "   Get accounts: cast rpc anvil_accounts --rpc-url http://localhost:${PORT}"
echo "   Mine blocks: cast rpc anvil_mine 10 --rpc-url http://localhost:${PORT}"
echo "   Set gas price: cast rpc anvil_setGasPrice 20000000000 --rpc-url http://localhost:${PORT}"
echo "   Stop Anvil: cast rpc anvil_stop --rpc-url http://localhost:${PORT}"
