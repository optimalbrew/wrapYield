# API Examples

This directory contains example API responses and usage examples for the BTC Yield Python API.

## Examples

### Leaf Scripts Output 0

**File**: `leaf-scripts-output-0-response.json`

**Endpoint**: `POST /vaultero/leaf-scripts-output-0`

**Description**: Example response from the leaf scripts generation endpoint that creates Bitcoin scripts for escrow output 0.

**Usage**:
```bash
curl -X POST "http://localhost:8001/vaultero/leaf-scripts-output-0" \
  -H "Content-Type: application/json" \
  -d '{
    "borrower_pubkey": "02274903288d231552de4c2c270d1c3f71fe5c78315374830c3b12a6654ee03afa",
    "lender_pubkey": "0264b4b84f42da9bdb84f7eda2de12524516686e73849645627fb7a034c79c81c8",
    "preimage_hash_borrower": "3faa7c2aee84d26c241aa0f9a9718fde501a91c4a1f700ab37c1914f993242e3",
    "borrower_timelock": 100
  }' | jq
```

### Leaf Scripts Output 1

**File**: `leaf-scripts-output-1-response.json`

**Endpoint**: `POST /vaultero/leaf-scripts-output-1`

**Description**: Example response from the leaf scripts generation endpoint that creates Bitcoin scripts for escrow output 1.

**Usage**:
```bash
curl -X POST "http://localhost:8001/vaultero/leaf-scripts-output-1" \
  -H "Content-Type: application/json" \
  -d '{
    "borrower_pubkey": "02274903288d231552de4c2c270d1c3f71fe5c78315374830c3b12a6654ee03afa",
    "lender_pubkey": "0264b4b84f42da9bdb84f7eda2de12524516686e73849645627fb7a034c79c81c8",
    "preimage_hash_lender": "3faa7c2aee84d26c241aa0f9a9718fde501a91c4a1f700ab37c1914f993242e3",
    "lender_timelock": 27150
  }' | jq
```


Escrow Address: this must be funded before requesting a loan.
``` bash
curl -X POST "http://localhost:8001/vaultero/nums-p2tr-addr-0" \
  -H "Content-Type: application/json" \
  -d '{
    "borrower_pubkey": "02274903288d231552de4c2c270d1c3f71fe5c78315374830c3b12a6654ee03afa",
    "lender_pubkey": "0264b4b84f42da9bdb84f7eda2de12524516686e73849645627fb7a034c79c81c8",
    "preimage_hash_borrower": "3faa7c2aee84d26c241aa0f9a9718fde501a91c4a1f700ab37c1914f993242e3",
    "borrower_timelock": 100
  }' | jq
```

Funding arbitrary addresses: returns the `txid` and `vout`. This is useful to fund the escrow address (`nums_p2tr_addr_0`) and 
use the returned values when requesting a loan.

```bash
curl -X POST http://localhost:8001/bitcoin/fund-address \
  -H "Content-Type: application/json" \
  -d '{
    "address": "bcrt1qzr7gzh9t38pupar7vq977kmplykf4chwqzv2lp",
    "amount": 0.001,
    "label": "test-funding"
  }'
```
Response Format

```json
{
  "success": true,
  "data": {
    "txid": "847bc372d76011c07ba1642517f2a8ba98db4f37e585edb7fb67c813d008557a",
    "vout": 0,
    "address": "bcrt1qzr7gzh9t38pupar7vq977kmplykf4chwqzv2lp",
    "amount": 0.001,
    "label": "test-funding"
  },
  "error": null,
  "message": "Successfully funded address bcrt1qzr7gzh9t38pupar7vq977kmplykf4chwqzv2lp with 0.001 BTC"
}

```
The amount to send should account for origination fee (e.g. 1%) as well as bitcoin
transaction fee. If the amount is not enough for fees, the lender can use CPFP with the origination fee output as the child, since that
utxo is available to the lender once the escrow has been converted to collateral through the Collateral Transaction.

### Collateral Transaction Creation

**File**: `collateral-transaction-response.json`

**Endpoint**: `POST /transactions/collateral`

**Description**: Example response from the collateral transaction creation endpoint that creates a Bitcoin transaction moving funds from escrow to collateral lock. This transaction can be spent by the lender after timelock or by the borrower with preimage.

**Usage**:
```bash
curl -X POST "http://localhost:8001/transactions/collateral" \
  -H "Content-Type: application/json" \
  -d '{
    "loan_id": "api-test-loan-123",
    "escrow_txid": "c8a07558f3eddde7e95405e5a3b6becf055efbc29f4abca6d65d1cc5d4bbd335",
    "escrow_vout": 1,
    "borrower_pubkey": "274903288d231552de4c2c270d1c3f71fe5c78315374830c3b12a6654ee03afa",
    "lender_pubkey": "64b4b84f42da9bdb84f7eda2de12524516686e73849645627fb7a034c79c81c8",
    "preimage_hash_lender": "fdcaa91eae3da24f7298c2812b6926635daac1c16cb7aabc4c4ffec59207c75c",
    "lender_timelock": 144,
    "collateral_amount": "0.001",
    "origination_fee": "0.001"
  }' | jq
```

**Real Transaction Data**: This example uses actual transaction data from a successful test run:
- **Escrow TXID**: `c8a07558f3eddde7e95405e5a3b6becf055efbc29f4abca6d65d1cc5d4bbd335` (real Bitcoin transaction)
- **Escrow VOUT**: `1` (output index from the escrow transaction)
- **Input Amount**: `0.00210000` BTC (actual amount from the escrow transaction)
- **Collateral Address**: `bcrt1pjveh920sekrvpfqv4jwth53j9t9nu0kv2pcrfm9pgxudsahfcldq9xfxcs` (P2TR address)

**Transaction Workflow**: This collateral transaction is created after:
1. An escrow transaction has been created and confirmed on the Bitcoin network
2. The escrow transaction ID and output index are known
3. The lender wants to move funds from escrow to a collateral lock
4. The collateral transaction can be spent by the lender after timelock or by the borrower with preimage

**Test Data Source**: These examples use test values from `btc-vaultero/tests/conftest.py`:
- **Borrower Private Key (WIF)**: `cNwW6ne3j9jUDWC3qFG5Bw3jzWvSZjZ2vgyP5LsTVj4WrJkJqjuz`
- **Lender Private Key (WIF)**: `cMrC8dGmStj3pz7mbY3vjwhXYcQwkcaWwV4QFCTF25WwVW1TCDkJ`
- **Preimage**: `"hello_from_lender"` (for output_1), `"hello_from_borrower"` (for output_0)

**Timelock Values** (derived from `config/parameters.json`):
- **Output 0 (btcEscrow)**: `100` Bitcoin blocks (2000 EVM blocks ÷ 20 ratio)
- **Output 1 (btcCollateral)**: `27150` Bitcoin blocks (543000 EVM blocks ÷ 20 ratio)


### Leaf Scripts Endpoints
For leaf scripts endpoints (`/vaultero/leaf-scripts-output-*`), the `data` field contains:
- **`scripts`**: Array of generated Bitcoin scripts with detailed information
- **`metadata`**: Information about the function call, parameters used, and generation timestamp

Each script includes:
- **`type`**: Script classification (csv_script_borrower/lender, hashlock_and_multisig_script)
- **`description`**: Human-readable explanation of the script's purpose
- **`raw_script`**: Array representation of the script operations
- **`hex`**: Hex-encoded script for Bitcoin transactions
- **`template`**: Code template showing how to recreate the script
- **`parameters`**: Input parameters used in script generation

### Transaction Endpoints
For transaction endpoints (`/transactions/*`), the `data` field contains:
- **`transaction_id`**: Unique identifier for the transaction
- **`raw_tx`**: Hex-encoded Bitcoin transaction ready for signing/broadcasting
- **`collateral_address`** (for collateral transactions): P2TR address where collateral is locked
- **`fee`**: Transaction fee amount
- **`script_details`**: Detailed information about the transaction inputs, outputs, and parameters

## Key Differences Between Output 0 and Output 1
Both parties to the loan should inspect these scripts and to verify that - together with the NUMS internal pubkey - that the correspond to the
P2TR addresses used for escrow and collateral contracts.


### Output 0: Lender-Focused. Borrower creates this contract to allow lender to move funds from escrow to collateral for the loan.
- **Script 0**: CSV script for borrower escape hatch (borrower gets collateral after timelock)
- **Script 1**: Hashlock + multisig for lender spending path (lender can spend with preimage + multisig). Borrower pre-signs the transaction making it the only way for lender to spend the coin. Lender will still need to learn borrower's preimage - which they do if borrower accepts loan on EVM chain.

### Output 1: Borrower-Focused. Lender creates this contract to enable borrower to reclaim collateral after loan is repaid.
- **Script 0**: CSV script for lender to get collateral after timelock - typically in case of borrower defaulting on the loan (unless lender turns rouge and does not accept borrower's repayment and siezes collateral).
- **Script 1**: Hashlock + borrower signature for borrower spending path (borrower regains custody of collateral with preimage revealed by lender when they accept the borrower's loan repayment on EVM chain.

## Use Cases

These examples are useful for:
- **Frontend Development**: Understanding the API response structure
- **Testing**: Validating API behavior with known inputs
- **Documentation**: Reference for developers integrating with the API
- **Debugging**: Comparing expected vs actual responses
- **Transaction Creation**: Understanding how to create Bitcoin transactions for escrow and collateral
- **Integration Testing**: Using real transaction data to test end-to-end workflows

## Generating Your Own Examples

To create your own example files from API responses:

### 1. Make the API Call

**For Leaf Scripts:**
```bash
curl -X POST "http://localhost:8001/vaultero/leaf-scripts-output-0" \
  -H "Content-Type: application/json" \
  -d '{
    "borrower_pubkey": "your_borrower_pubkey_here",
    "lender_pubkey": "your_lender_pubkey_here",
    "preimage_hash_borrower": "your_preimage_hash_here",
    "borrower_timelock": 100
  }'
```

**For Collateral Transactions:**
```bash
curl -X POST "http://localhost:8001/transactions/collateral" \
  -H "Content-Type: application/json" \
  -d '{
    "loan_id": "your-loan-id",
    "escrow_txid": "your_escrow_transaction_id",
    "escrow_vout": 0,
    "borrower_pubkey": "your_borrower_pubkey_here",
    "lender_pubkey": "your_lender_pubkey_here",
    "preimage_hash_lender": "your_preimage_hash_here",
    "lender_timelock": 144,
    "collateral_amount": "0.001",
    "origination_fee": "0.0001"
  }'
```

### 2. Make it Readable
Pipe the response through `jq` for pretty formatting:
```bash
# For leaf scripts
curl -X POST "http://localhost:8001/vaultero/leaf-scripts-output-0" \
  -H "Content-Type: application/json" \
  -d '{"borrower_pubkey": "your_key", "lender_pubkey": "your_key", "preimage_hash_borrower": "your_hash", "borrower_timelock": 100}' | jq

# For collateral transactions
curl -X POST "http://localhost:8001/transactions/collateral" \
  -H "Content-Type: application/json" \
  -d '{"loan_id": "test", "escrow_txid": "your_txid", "escrow_vout": 0, "borrower_pubkey": "your_key", "lender_pubkey": "your_key", "preimage_hash_lender": "your_hash", "lender_timelock": 144, "collateral_amount": "0.001", "origination_fee": "0.0001"}' | jq
```

### 3. Save to File
Save the formatted response to a file:
```bash
# For leaf scripts
curl -X POST "http://localhost:8001/vaultero/leaf-scripts-output-0" \
  -H "Content-Type: application/json" \
  -d '{"borrower_pubkey": "your_key", "lender_pubkey": "your_key", "preimage_hash_borrower": "your_hash", "borrower_timelock": 100}' | jq > my-leaf-scripts-example.json

# For collateral transactions
curl -X POST "http://localhost:8001/transactions/collateral" \
  -H "Content-Type: application/json" \
  -d '{"loan_id": "test", "escrow_txid": "your_txid", "escrow_vout": 0, "borrower_pubkey": "your_key", "lender_pubkey": "your_key", "preimage_hash_lender": "your_hash", "lender_timelock": 144, "collateral_amount": "0.001", "origination_fee": "0.0001"}' | jq > my-collateral-example.json
```

### 4. Manual Formatting (if jq not available)
If you don't have `jq` installed, you can use Python:
```bash
# For leaf scripts
curl -X POST "http://localhost:8001/vaultero/leaf-scripts-output-0" \
  -H "Content-Type: application/json" \
  -d '{"borrower_pubkey": "your_key", "lender_pubkey": "your_key", "preimage_hash_borrower": "your_hash", "borrower_timelock": 100}' | python3 -m json.tool > my-example.json

# For collateral transactions
curl -X POST "http://localhost:8001/transactions/collateral" \
  -H "Content-Type: application/json" \
  -d '{"loan_id": "test", "escrow_txid": "your_txid", "escrow_vout": 0, "borrower_pubkey": "your_key", "lender_pubkey": "your_key", "preimage_hash_lender": "your_hash", "lender_timelock": 144, "collateral_amount": "0.001", "origination_fee": "0.0001"}' | python3 -m json.tool > my-example.json
```
