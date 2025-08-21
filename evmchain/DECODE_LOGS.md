# Transaction Log Decoder

A script to automatically decode transaction logs from your btcyield contracts using cast and the contract ABIs.

## Usage

```bash
cd evmchain
./decode_tx_logs.sh <transaction_hash> [rpc_url]
```

### Examples

```bash
# From the evmchain directory, using default Anvil RPC (http://localhost:8545)
cd evmchain
./decode_tx_logs.sh 0x60f346b24872e9098fc3275e74710c35cb47fc5de6a2eae485d819303bc9e1f8

# Using custom RPC URL
./decode_tx_logs.sh 0x60f346b24872e9098fc3275e74710c35cb47fc5de6a2eae485d819303bc9e1f8 http://localhost:8545

# Or run from project root
evmchain/decode_tx_logs.sh <transaction_hash>
```

## Supported Contracts

### BTC Collateral Loan Contract
- ✅ LenderUpdated(address,string)
- ✅ LoanRequested(uint256,address,uint256,string)
- ✅ LoanOffered(uint256,address,uint256,uint256)
- ✅ LoanActivated(uint256,address)
- ✅ LoanRefundedToLender(uint256,address)
- ✅ RepaymentAttempted(uint256,address,uint256)
- ✅ RepaymentAccepted(uint256,address)
- ✅ RepaymentRefundedToBorrowerWithBond(uint256,address,uint256)
- ✅ ParametersUpdated(uint256,uint256,uint256,uint256,uint256)
- ✅ LoanDefaulted(uint256,address,uint256)
- ✅ LoanDeleted(uint256,address)
- ✅ EtherSwapAddressSet(address)

### Ether Swap Contract
- ✅ Lockup(bytes32,uint256,address,address,uint256)
- ✅ Claim(bytes32,bytes32)
- ✅ Refund(bytes32)

## Requirements

- `cast` from Foundry toolchain
- Anvil running (for default RPC) or access to another Ethereum node
- Bash shell

## What it does

1. **Fetches transaction receipt** using `cast receipt`
2. **Extracts event logs** from the transaction
3. **Matches event signatures** against known contract events
4. **Decodes indexed parameters** (topics) and event data
5. **Displays human-readable output** with contract names and parameter values

## Sample Output

```
🔍 Decoding transaction logs for: 0x60f346b24872e9098fc3275e74710c35cb47fc5de6a2eae485d819303bc9e1f8
🌐 Using RPC: http://localhost:8545
==========================================
📄 Getting transaction receipt...
📊 Transaction Info:
blockNumber          4
from                 0x8995E44a22e303A79bdD2E6e41674fb92d620863
gasUsed              35816
status               1 (success)
to                   0x02b8aFd8146b7Bc6BD4F02782c18bd4649Be1605

🎯 Events detected! Decoding...

🔍 Processing log entry...
🎯 Event Found:
    📍 Contract: 0x02b8afd8146b7bc6bd4f02782c18bd4649be1605
    🏷️  Topic 0: 0x26795e69df9082f94483500d4891539f4b4a34608ce4c5c0c74b4cf352af82d4
    📝 Event: LenderUpdated(address,string) (BTC Collateral Loan)
    📋 Lender: 0x8995e44a22e303a79bdd2e6e41674fb92d620863
    🔑 BTC Pubkey: 1234567890123456789012345678901234567890123456789012345678901234

✅ Transaction log decoding complete!
```

## Manual Process (for reference)

If you want to decode logs manually, here's the process this script automates:

```bash
# 1. Get transaction receipt
cast receipt <tx_hash> --rpc-url http://localhost:8545

# 2. Get event signature hash
cast keccak "EventName(param1Type,param2Type)"

# 3. Match signature to identify event
# (compare with topic[0] in the logs)

# 4. Decode string data
cast --to-utf8 <hex_string>

# 5. Decode numeric data
cast --to-dec <hex_string>
```

## Adding New Events

To add support for new events:

1. **Get the event signature hash**: `cast keccak "EventName(param1,param2)"`
2. **Add case to lookup_event()** function with the signature hash
3. **Add decoding logic** in decode_event_data() function if needed

The script automatically handles:
- ✅ Event signature matching
- ✅ Topic extraction (indexed parameters)
- ✅ Data field parsing
- ✅ Address formatting
- ✅ Hex to decimal conversion
- ✅ Hex to UTF8 string conversion
