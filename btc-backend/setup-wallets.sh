#!/bin/bash

# Bitcoin Core Wallet Setup Script
# This script ensures that the required wallets exist, are loaded, and have sufficient funds

set -e

# Check if required tools are available
check_dependencies() {
    local missing_deps=()
    
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    
    if ! command -v bc &> /dev/null; then
        missing_deps+=("bc")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        echo "❌ Missing required dependencies: ${missing_deps[*]}"
        echo "Please install them and try again."
        exit 1
    fi
}

# Configuration
RPC_HOST="localhost"
RPC_PORT="18443"
RPC_USER="bitcoin"
RPC_PASSWORD="localtest"
RPC_URL="http://${RPC_USER}:${RPC_PASSWORD}@${RPC_HOST}:${RPC_PORT}"

# Wallet names
PYTHON_API_WALLET="python-api-test"
BORROWER_API_WALLET="borrower-api-test"

# Minimum balance required (in BTC)
MIN_BALANCE=1.0

echo "🔧 Bitcoin Core Wallet Setup Script"
echo "=================================="

# Function to make RPC calls
rpc_call() {
    local method="$1"
    local params="$2"
    local wallet_path="$3"
    
    if [ -n "$wallet_path" ]; then
        local url="${RPC_URL}/wallet/${wallet_path}"
    else
        local url="$RPC_URL"
    fi
    
    curl -s --user "${RPC_USER}:${RPC_PASSWORD}" \
         --data-binary "{\"jsonrpc\": \"1.0\", \"id\": \"setup\", \"method\": \"${method}\", \"params\": ${params}}" \
         -H 'content-type: text/plain;' \
         "$url"
}

# Function to check if Bitcoin Core is running and get blockchain info
check_bitcoin_core() {
    echo "📡 Checking Bitcoin Core connection..."
    local response=$(rpc_call "getblockchaininfo" "[]" "")
    if echo "$response" | jq -e '.error' > /dev/null; then
        echo "❌ Error: Cannot connect to Bitcoin Core"
        echo "Response: $response"
        exit 1
    fi
    
    local chain=$(echo "$response" | jq -r '.result.chain')
    local blocks=$(echo "$response" | jq -r '.result.blocks')
    local ibd=$(echo "$response" | jq -r '.result.initialblockdownload')
    
    echo "✅ Bitcoin Core is running"
    echo "📊 Chain: $chain, Blocks: $blocks, IBD: $ibd"
    
    # Store blockchain info for later use
    BLOCKCHAIN_BLOCKS="$blocks"
    BLOCKCHAIN_IBD="$ibd"
}

# Function to list existing wallets
list_wallets() {
    echo "📋 Checking existing wallets..."
    local response=$(rpc_call "listwallets" "[]" "")
    echo "$response" | jq -r '.result[]' 2>/dev/null || echo ""
}

# Function to create a wallet
create_wallet() {
    local wallet_name="$1"
    echo "🔨 Creating wallet: $wallet_name"
    local response=$(rpc_call "createwallet" "[\"$wallet_name\"]" "")
    
    if echo "$response" | jq -e '.error' > /dev/null; then
        local error_msg=$(echo "$response" | jq -r '.error.message')
        if [[ "$error_msg" == *"already exists"* ]]; then
            echo "ℹ️  Wallet $wallet_name already exists"
        else
            echo "❌ Error creating wallet $wallet_name: $error_msg"
            return 1
        fi
    else
        echo "✅ Wallet $wallet_name created successfully"
    fi
}

# Function to load a wallet
load_wallet() {
    local wallet_name="$1"
    echo "📂 Loading wallet: $wallet_name"
    local response=$(rpc_call "loadwallet" "[\"$wallet_name\"]" "")
    
    if echo "$response" | jq -e '.error' > /dev/null; then
        local error_msg=$(echo "$response" | jq -r '.error.message')
        if [[ "$error_msg" == *"already loaded"* ]] || [[ "$error_msg" == *"exclusive lock"* ]]; then
            echo "ℹ️  Wallet $wallet_name is already loaded"
        else
            echo "❌ Error loading wallet $wallet_name: $error_msg"
            return 1
        fi
    else
        echo "✅ Wallet $wallet_name loaded successfully"
    fi
}

# Function to get wallet balance
get_balance() {
    local wallet_name="$1"
    local response=$(rpc_call "getbalance" "[]" "$wallet_name")
    echo "$response" | jq -r '.result' 2>/dev/null || echo "0"
}

# Function to mine initial blocks for regtest
mine_initial_blocks() {
    local blocks_needed="$1"
    echo "⛏️  Mining $blocks_needed initial blocks for regtest network..."
    
    # Create a temporary mining wallet
    local mining_wallet="temp-mining-wallet"
    echo "🔨 Creating temporary mining wallet: $mining_wallet"
    create_wallet "$mining_wallet"
    load_wallet "$mining_wallet"
    
    # Get an address for mining
    local address_response=$(rpc_call "getnewaddress" "[\"mining\"]" "$mining_wallet")
    local address=$(echo "$address_response" | jq -r '.result')
    
    if [ "$address" = "null" ] || [ -z "$address" ]; then
        echo "❌ Error: Could not get address for mining"
        return 1
    fi
    
    echo "📍 Mining to address: $address"
    
    # Generate blocks
    local generate_response=$(rpc_call "generatetoaddress" "[$blocks_needed, \"$address\"]" "$mining_wallet")
    
    if echo "$generate_response" | jq -e '.error' > /dev/null; then
        echo "❌ Error generating blocks: $(echo "$generate_response" | jq -r '.error.message')"
        return 1
    fi
    
    echo "✅ Generated $blocks_needed blocks successfully"
    
    # Clean up temporary wallet if we created one
    if [ "$mining_wallet" = "temp-mining-wallet" ]; then
        echo "🧹 Cleaning up temporary mining wallet..."
        # Note: We can't unload wallets via RPC, so we'll just leave it
    fi
}

# Function to fund a wallet
fund_wallet() {
    local wallet_name="$1"
    echo "💰 Funding wallet: $wallet_name"
    
    # Get a new address from the wallet
    local address_response=$(rpc_call "getnewaddress" "[\"funding\"]" "$wallet_name")
    local address=$(echo "$address_response" | jq -r '.result')
    
    if [ "$address" = "null" ] || [ -z "$address" ]; then
        echo "❌ Error: Could not get address from wallet $wallet_name"
        return 1
    fi
    
    echo "📍 Generated address: $address"
    
    # Generate blocks to fund the address (need 101 blocks for coinbase maturity)
    echo "⛏️  Generating 101 blocks to fund the address (coinbase maturity)..."
    local generate_response=$(rpc_call "generatetoaddress" "[101, \"$address\"]" "$wallet_name")
    
    if echo "$generate_response" | jq -e '.error' > /dev/null; then
        echo "❌ Error generating blocks: $(echo "$generate_response" | jq -r '.error.message')"
        return 1
    fi
    
    echo "✅ Generated 101 blocks, wallet should now have spendable funds"
}

# Function to send funds from one wallet to another
send_funds() {
    local from_wallet="$1"
    local to_wallet="$2"
    local amount="$3"
    
    echo "💸 Sending $amount BTC from $from_wallet to $to_wallet"
    
    # Get address from destination wallet
    local to_address_response=$(rpc_call "getnewaddress" "[\"funding\"]" "$to_wallet")
    local to_address=$(echo "$to_address_response" | jq -r '.result')
    
    if [ "$to_address" = "null" ] || [ -z "$to_address" ]; then
        echo "❌ Error: Could not get address from wallet $to_wallet"
        return 1
    fi
    
    # Send funds
    local send_response=$(rpc_call "sendtoaddress" "[\"$to_address\", $amount]" "$from_wallet")
    
    if echo "$send_response" | jq -e '.error' > /dev/null; then
        echo "❌ Error sending funds: $(echo "$send_response" | jq -r '.error.message')"
        return 1
    fi
    
    local txid=$(echo "$send_response" | jq -r '.result')
    echo "✅ Sent $amount BTC, transaction ID: $txid"
    
    # Generate a block to confirm the transaction
    echo "⛏️  Generating block to confirm transaction..."
    local confirm_response=$(rpc_call "generatetoaddress" "[1, \"$to_address\"]" "$to_wallet")
    
    if echo "$confirm_response" | jq -e '.error' > /dev/null; then
        echo "⚠️  Warning: Could not confirm transaction: $(echo "$confirm_response" | jq -r '.error.message')"
    else
        echo "✅ Transaction confirmed"
    fi
}

# Main execution
main() {
    echo "Starting wallet setup process..."
    echo
    
    # Check dependencies
    check_dependencies
    echo
    
    # Check Bitcoin Core connection
    check_bitcoin_core
    echo
    
    # Check if we need to mine initial blocks for regtest
    if [ "$BLOCKCHAIN_BLOCKS" -lt 100 ]; then
        echo "⚠️  Regtest network has only $BLOCKCHAIN_BLOCKS blocks (need at least 100 for proper operation)"
        local blocks_needed=$((100 - BLOCKCHAIN_BLOCKS))
        echo "⛏️  Mining $blocks_needed additional blocks..."
        mine_initial_blocks "$blocks_needed"
        echo
        
        # Update blockchain info
        check_bitcoin_core
        echo
    fi
    
    # List existing wallets
    local existing_wallets=$(list_wallets)
    echo "Existing wallets: $existing_wallets"
    echo
    
    # Create wallets if they don't exist
    if ! echo "$existing_wallets" | grep -q "$PYTHON_API_WALLET"; then
        create_wallet "$PYTHON_API_WALLET"
    fi
    
    if ! echo "$existing_wallets" | grep -q "$BORROWER_API_WALLET"; then
        create_wallet "$BORROWER_API_WALLET"
    fi
    echo
    
    # Load wallets
    load_wallet "$PYTHON_API_WALLET"
    load_wallet "$BORROWER_API_WALLET"
    echo
    
    # Check balances
    echo "💰 Checking wallet balances..."
    local python_balance=$(get_balance "$PYTHON_API_WALLET")
    local borrower_balance=$(get_balance "$BORROWER_API_WALLET")
    
    echo "📊 Current balances:"
    echo "  $PYTHON_API_WALLET: $python_balance BTC"
    echo "  $BORROWER_API_WALLET: $borrower_balance BTC"
    echo
    
    # Fund wallets if needed
    local python_needs_funding=$(echo "$python_balance < $MIN_BALANCE" | bc -l)
    local borrower_needs_funding=$(echo "$borrower_balance < $MIN_BALANCE" | bc -l)
    
    if [ "$python_needs_funding" = "1" ]; then
        echo "⚠️  $PYTHON_API_WALLET needs funding (balance: $python_balance BTC)"
        fund_wallet "$PYTHON_API_WALLET"
        echo
    fi
    
    if [ "$borrower_needs_funding" = "1" ]; then
        echo "⚠️  $BORROWER_API_WALLET needs funding (balance: $borrower_balance BTC)"
        
        # If python wallet has funds, send some to borrower wallet
        local python_balance_after=$(get_balance "$PYTHON_API_WALLET")
        if (( $(echo "$python_balance_after >= 5.0" | bc -l) )); then
            echo "💸 Sending 5 BTC from $PYTHON_API_WALLET to $BORROWER_API_WALLET"
            send_funds "$PYTHON_API_WALLET" "$BORROWER_API_WALLET" "5.0"
        else
            echo "⛏️  Funding $BORROWER_API_WALLET directly with block generation"
            fund_wallet "$BORROWER_API_WALLET"
        fi
        echo
    fi
    
    # Final balance check
    echo "📊 Final wallet balances:"
    local final_python_balance=$(get_balance "$PYTHON_API_WALLET")
    local final_borrower_balance=$(get_balance "$BORROWER_API_WALLET")
    
    echo "  $PYTHON_API_WALLET: $final_python_balance BTC"
    echo "  $BORROWER_API_WALLET: $final_borrower_balance BTC"
    echo
    
    # Verify both wallets have sufficient funds
    local python_sufficient=$(echo "$final_python_balance >= $MIN_BALANCE" | bc -l)
    local borrower_sufficient=$(echo "$final_borrower_balance >= $MIN_BALANCE" | bc -l)
    
    if [ "$python_sufficient" = "1" ] && [ "$borrower_sufficient" = "1" ]; then
        echo "✅ All wallets are properly set up and funded!"
        echo "🎉 Setup complete!"
    else
        echo "❌ Some wallets still need funding:"
        [ "$python_sufficient" = "0" ] && echo "  - $PYTHON_API_WALLET needs more funds"
        [ "$borrower_sufficient" = "0" ] && echo "  - $BORROWER_API_WALLET needs more funds"
        exit 1
    fi
}

# Run the main function
main "$@"
