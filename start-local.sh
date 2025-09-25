# start-local.sh improvements
#!/bin/bash
set -e  # Exit on any error

echo "🚀 Starting local development environment..."

# Start Anvil with proper parameters
echo "Starting Anvil chain..."
anvil --mnemonic-seed-unsafe 2 &

# Wait for Anvil to be ready
sleep 3

# Deploy contracts
echo "Deploying contracts..."
cd evmchain
forge build
forge script script/DeployLoanContract.sol --rpc-url http://127.0.0.1:8545 --private-key 0xd6a036f561e03196779dd34bf3d141dec4737eec5ed0416e413985ca05dad51a --broadcast

# Start Bitcoin Core
echo "Starting Bitcoin Core..."
cd ../btc-backend
docker compose up -d

sleep 3

# Fund wallets
echo "Funding wallets..."
./setup-wallets.sh

# Start backend service
echo "Starting backend service..."
cd ../backend-service
cp .env.local .env
docker compose up -d

sleep 5

# Start DApp in background
echo "Starting DApp..."
cd ../evm-dapp
cp .env.local.backup .env.local
npm install
npm run dev &

echo "✅ All services started! DApp should be available at http://localhost:3000"