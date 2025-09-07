#!/bin/bash

### OUTDATED SCRIPT .. works for some, but only for indexed fields, misses out on string fields

# Transaction Log Decoder for btcyield contracts
# Usage: ./decode_tx_logs.sh <transaction_hash> [rpc_url]
# Run from evmchain directory or use: ../evmchain/decode_tx_logs.sh <tx_hash>

set -e

# Default RPC URL for Anvil
DEFAULT_RPC="http://localhost:8545"

# Check arguments
if [ $# -lt 1 ]; then
    echo "Usage: $0 <transaction_hash> [rpc_url]"
    echo "Example: $0 0x60f346b24872e9098fc3275e74710c35cb47fc5de6a2eae485d819303bc9e1f8"
    exit 1
fi

TX_HASH=$1
RPC_URL=${2:-$DEFAULT_RPC}

echo "🔍 Decoding transaction logs for: $TX_HASH"
echo "🌐 Using RPC: $RPC_URL"
echo "=========================================="

# Function to lookup event by signature
lookup_event() {
    local sig=$1
    case "$sig" in
        # BTC Collateral Loan Events
        "0x26795e69df9082f94483500d4891539f4b4a34608ce4c5c0c74b4cf352af82d4")
            echo "LenderUpdated(address,string)|BTC Collateral Loan"
            ;;
        "0xfbba0893dd1f941cb4a7bb791aed3ce1ad2a008c20ef3254b2a2cf7752b199f1")
            echo "LoanRequested(uint256,address,uint256,string)|BTC Collateral Loan"
            ;;
        "0x9c30abd0e9d523017113f5d5e193a610ccac429f1148088cb393f58d547e3f57")
            echo "LoanOffered(uint256,address,uint256,uint256)|BTC Collateral Loan"
            ;;
        "0xb216471fd9f6603f8e30fcbd378e48877883311b038d782bfeebcd63e21dfb3c")
            echo "LoanActivated(uint256,address)|BTC Collateral Loan"
            ;;
        "0xb9ef98bab932353fb28a0f30e3f90e1c311a0e61097e9fea11d0251481e3590a")
            echo "LoanRefundedToLender(uint256,address)|BTC Collateral Loan"
            ;;
        "0x368fd7fbc6747fca625b6c17bc4cc007e96f59db5c1281da7bad20d400dca73c")
            echo "RepaymentAttempted(uint256,address,uint256)|BTC Collateral Loan"
            ;;
        "0xd18b04a30ef164410c71f521d675d031e294a611e62119f2b5b2d9bc5e5ba684")
            echo "RepaymentAccepted(uint256,address)|BTC Collateral Loan"
            ;;
        "0x33d7eaf890876918584d6c3e056a2239ac592e7564063a6b1ec715cea0b39f71")
            echo "RepaymentRefundedToBorrowerWithBond(uint256,address,uint256)|BTC Collateral Loan"
            ;;
        "0xd83cef869924c3f9f84c744735163b075c470a9725a528100c5350524e073ffd")
            echo "ParametersUpdated(uint256,uint256,uint256,uint256,uint256)|BTC Collateral Loan"
            ;;
        "0x2d6de712d035bfecc1593860af7eae0831e978cab3cd96f778478b1fdc443bc3")
            echo "LoanDefaulted(uint256,address,uint256)|BTC Collateral Loan"
            ;;
        "0x288b85c82fa2ee48d0c7a360f1a694e3d84e5b342c20997f4fd273a60a3fd854")
            echo "LoanDeleted(uint256,address)|BTC Collateral Loan"
            ;;
        "0x7aaab081253ef76918f4988658f9603cf0d1e382aecfd0d0c98c46fd7e0d241e")
            echo "EtherSwapAddressSet(address)|BTC Collateral Loan"
            ;;
        # Ether Swap Events
        "0x15b4b8206809535e547317cd5cedc86cff6e7d203551f93701786ddaf14fd9f9")
            echo "Lockup(bytes32,uint256,address,address,uint256)|Ether Swap"
            ;;
        "0x5664142af3dcfc3dc3de45a43f75c746bd1d8c11170a5037fdf98bdb35775137")
            echo "Claim(bytes32,bytes32)|Ether Swap"
            ;;
        "0x3fbd469ec3a5ce074f975f76ce27e727ba21c99176917b97ae2e713695582a12")
            echo "Refund(bytes32)|Ether Swap"
            ;;
        *)
            echo "Unknown|Unknown"
            ;;
    esac
}

# Function to decode event data based on event type
decode_event_data() {
    local event_sig=$1
    local data=$2
    shift 2
    local topics=("$@")
    
    case $event_sig in
        "LenderUpdated(address,string)")
            # topics[1] = lender address, data = btc pubkey string
            if [ ${#topics[@]} -gt 1 ]; then
                local lender=$(printf "0x%s" "${topics[1]:26}")  # Remove leading zeros
                local btc_pubkey=$(cast --to-utf8 "${data:130}" 2>/dev/null || echo "Could not decode")
                echo "    📋 Lender: $lender"
                echo "    🔑 BTC Pubkey: $btc_pubkey"
            else
                echo "    ❌ Insufficient topic data for LenderUpdated event"
            fi
            ;;
        "LoanRequested(uint256,address,uint256,string)")
            if [ ${#topics[@]} -gt 2 ]; then
                local loan_id=$((16#${topics[1]:2}))
                local borrower=$(printf "0x%s" "${topics[2]:26}")
                echo "    📋 Loan ID: $loan_id"
                echo "    👤 Borrower: $borrower"
                # Decode amount from data if present
                if [ ${#data} -ge 66 ]; then
                    local amount=$(cast --to-dec "0x${data:2:64}" 2>/dev/null || echo "Could not decode")
                    echo "    💰 Amount: $amount wei"
                fi
            else
                echo "    ❌ Insufficient topic data for LoanRequested event"
            fi
            ;;
        "LoanOffered(uint256,address,uint256,uint256)")
            if [ ${#topics[@]} -gt 2 ]; then
                local loan_id=$((16#${topics[1]:2}))
                local lender=$(printf "0x%s" "${topics[2]:26}")
                echo "    📋 Loan ID: $loan_id"
                echo "    🏦 Lender: $lender"
                if [ ${#data} -ge 130 ]; then
                    local amount=$(cast --to-dec "0x${data:2:64}" 2>/dev/null || echo "Could not decode")
                    local bond_amount=$(cast --to-dec "0x${data:66:64}" 2>/dev/null || echo "Could not decode")
                    echo "    💰 Amount: $amount wei"
                    echo "    🔒 Bond Amount: $bond_amount wei"
                fi
            else
                echo "    ❌ Insufficient topic data for LoanOffered event"
            fi
            ;;
        "LoanActivated(uint256,address)")
            if [ ${#topics[@]} -gt 2 ]; then
                local loan_id=$((16#${topics[1]:2}))
                local borrower=$(printf "0x%s" "${topics[2]:26}")
                echo "    📋 Loan ID: $loan_id"
                echo "    👤 Borrower: $borrower"
            else
                echo "    ❌ Insufficient topic data for LoanActivated event"
            fi
            ;;
        "Lockup(bytes32,uint256,address,address,uint256)")
            # topics[1] = preimageHash, topics[2] = refundAddress, data = amount + claimAddress + timelock
            if [ ${#topics[@]} -gt 2 ]; then
                local preimage_hash="${topics[1]}"
                local refund_address=$(printf "0x%s" "${topics[2]:26}")
                echo "    🔒 Preimage Hash: $preimage_hash"
                echo "    🔄 Refund Address: $refund_address"
                # Decode data fields (amount, claimAddress, timelock)
                if [ ${#data} -ge 194 ]; then
                    local amount=$(cast --to-dec "0x${data:2:64}" 2>/dev/null || echo "Could not decode")
                    local claim_address="${data:90:40}"
                    local timelock=$(cast --to-dec "0x${data:130:64}" 2>/dev/null || echo "Could not decode")
                    echo "    💰 Amount: $amount wei"
                    echo "    📥 Claim Address: 0x$claim_address"
                    echo "    ⏰ Timelock: $timelock"
                fi
            else
                echo "    ❌ Insufficient topic data for Lockup event"
            fi
            ;;
        "Claim(bytes32,bytes32)")
            # topics[1] = preimageHash, data = preimage
            if [ ${#topics[@]} -gt 1 ]; then
                local preimage_hash="${topics[1]}"
                echo "    🔒 Preimage Hash: $preimage_hash"
                if [ ${#data} -ge 66 ]; then
                    local preimage="${data:2:64}"
                    echo "    🔑 Preimage: 0x$preimage"
                fi
            else
                echo "    ❌ Insufficient topic data for Claim event"
            fi
            ;;
        "Refund(bytes32)")
            # topics[1] = preimageHash
            if [ ${#topics[@]} -gt 1 ]; then
                local preimage_hash="${topics[1]}"
                echo "    🔒 Preimage Hash: $preimage_hash"
            else
                echo "    ❌ Insufficient topic data for Refund event"
            fi
            ;;
        *)
            echo "    📋 Event signature: $event_sig"
            echo "    📊 Raw data: $data"
            if [ ${#topics[@]} -gt 1 ]; then
                local i=1
                while [ $i -lt ${#topics[@]} ]; do
                    echo "    🏷️  Topic $i: ${topics[$i]}"
                    i=$((i + 1))
                done
            fi
            ;;
    esac
}

# Get transaction receipt
echo "📄 Getting transaction receipt..."
RECEIPT=$(cast receipt "$TX_HASH" --rpc-url "$RPC_URL" 2>/dev/null)

if [ $? -ne 0 ]; then
    echo "❌ Error: Could not fetch transaction receipt. Check transaction hash and RPC URL."
    exit 1
fi

# Extract basic transaction info
echo "📊 Transaction Info:"
echo "$(echo "$RECEIPT" | grep -E '^(status|from|to|gasUsed|blockNumber)')"
echo ""

# Check if any logs exist
LOGS=$(echo "$RECEIPT" | grep "^logs" | cut -d' ' -f2-)

if [ -z "$LOGS" ] || [ "$LOGS" = "[]" ]; then
    echo "ℹ️  No events emitted in this transaction."
    exit 0
fi

echo "🎯 Events detected! Decoding..."
echo ""

# Parse the receipt and extract event information using simple text processing
echo "$RECEIPT" | grep "^logs" | while IFS= read -r logs_line; do
    # Remove 'logs ' prefix
    logs_content=$(echo "$logs_line" | sed 's/^logs //')
    
    # Skip if empty logs
    if [ "$logs_content" = "[]" ]; then
        echo "ℹ️  No events in logs"
        exit 0
    fi
    
    # Extract individual log entries (this is a simplified approach)
    # In a more robust solution, you'd use a proper JSON parser
    echo "$logs_content" | sed 's/},{/}|{/g' | tr '|' '\n' | while IFS= read -r log_entry; do
        if [ -z "$log_entry" ] || [[ ! "$log_entry" =~ address ]]; then
            continue
        fi
        
        echo "🔍 Processing log entry..."
        
        # Extract contract address
        CONTRACT_ADDR=$(echo "$log_entry" | grep -o '"address":"[^"]*"' | cut -d'"' -f4)
        
        # Extract event data
        EVENT_DATA=$(echo "$log_entry" | grep -o '"data":"[^"]*"' | cut -d'"' -f4)
        
        # Extract topics - this is the tricky part without proper JSON parsing
        TOPICS_SECTION=$(echo "$log_entry" | sed 's/.*"topics":\[\([^]]*\)\].*/\1/')
        
        # Split topics into array
        TOPIC_ARRAY=()
        if [ "$TOPICS_SECTION" != "$log_entry" ]; then
            # We have topics
            OLD_IFS="$IFS"
            IFS=','
            for topic in $TOPICS_SECTION; do
                clean_topic=$(echo "$topic" | sed 's/^"//; s/"$//')
                TOPIC_ARRAY+=("$clean_topic")
            done
            IFS="$OLD_IFS"
        fi
        
        if [ ${#TOPIC_ARRAY[@]} -eq 0 ]; then
            echo "    ⚠️  Could not extract topics, skipping..."
            continue
        fi
        
        EVENT_TOPIC="${TOPIC_ARRAY[0]}"
        
        echo "🎯 Event Found:"
        echo "    📍 Contract: $CONTRACT_ADDR"
        echo "    🏷️  Topic 0: $EVENT_TOPIC"
        
        # Lookup event information
        EVENT_INFO=$(lookup_event "$EVENT_TOPIC")
        EVENT_NAME=$(echo "$EVENT_INFO" | cut -d'|' -f1)
        CONTRACT_NAME=$(echo "$EVENT_INFO" | cut -d'|' -f2)
        
        if [ "$EVENT_NAME" != "Unknown" ]; then
            echo "    📝 Event: $EVENT_NAME ($CONTRACT_NAME)"
            decode_event_data "$EVENT_NAME" "$EVENT_DATA" "${TOPIC_ARRAY[@]}"
        else
            echo "    ❓ Unknown event signature: $EVENT_TOPIC"
            echo "    📊 Raw data: $EVENT_DATA"
        fi
        
        echo ""
    done
done

echo "✅ Transaction log decoding complete!"
