#!/bin/bash

echo "🛑 Stopping local development environment..."

# Stop the DApp (non-critical)
echo "Stopping DApp..."
pkill -f "npm run dev" 2>/dev/null || pkill -f "next dev" 2>/dev/null || echo "DApp not running"

# Stop backend service (critical)
echo "Stopping backend service..."
cd backend-service
if ! docker compose down; then
    echo "❌ Failed to stop backend service"
    exit 1
fi

# Delete PostgreSQL data volume
echo "Deleting PostgreSQL data volume..."
if ! docker volume rm backend-service_postgres_data 2>/dev/null; then
    echo "⚠️ PostgreSQL volume not found or already deleted"
fi

cd ..

# Stop Bitcoin Core (critical)
echo "Stopping Bitcoin Core..."
cd btc-backend
if ! docker compose down; then
    echo "❌ Failed to stop Bitcoin Core"
    exit 1
fi
cd ..

# Stop Anvil chain : can check if anvil is running with `curl -s http://127.0.0.1:8545 > /dev/null 2>&1`
# ps aux | grep anvil | grep -v grep
echo "Stopping Anvil chain..."
pkill -f anvil 2>/dev/null || echo "Anvil not running"

# Optional: Clean up Docker volumes (uncomment if you want a fresh start)
# echo "Cleaning up Docker volumes..."
# docker volume prune -f

echo "✅ All services stopped!"
