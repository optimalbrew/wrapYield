# API Examples

This directory contains example API responses and usage examples for the BTC Yield Python API.

## Examples

What is available
```bash
curl -s http://localhost:8002/openapi.json | jq '.paths | keys' | head -20
```


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
    "preimage_hash_borrower": "114810e3c12909f2fb9cbf59c11ee5c9d107556476685f7e14205eab094d4927",
    "borrower_timelock": 2000
  }' | jq
```

Funding arbitrary addresses: returns the `txid` and `vout`. This is useful to fund the escrow address (`nums_p2tr_addr_0`) and 
use the returned values when requesting a loan. Sometimes lazy loading of bitcoin core wallet leads to failures. 

localhost:8002 for borrower python-api

```bash
curl -X POST http://localhost:8002/bitcoin/fund-address \
  -H "Content-Type: application/json" \
  -d '{
    "address": "bcrt1pjffezpv29u3dgm3vxv8mv3pwxmy24n5y8d030795tzuce63ugc0q6ln2hx",
    "amount": 0.0102,
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

### Borrower signature generation

**Endpoint**: `POST /transactions/borrower-signature`

**Description**: Generate borrower's signature for collateral transaction and save to JSON file. This endpoint allows the borrower to sign the collateral transaction offline and save their signature to a JSON file that can be shared with the lender.

**Usage**:
```bash
curl -X POST "http://localhost:8002/transactions/borrower-signature" \
  -H "Content-Type: application/json" \
  -d '{
    "loan_id": "test-loan-example-012",
    "escrow_txid": "09e23cb9290d340b6f848c6c18308eafa311be51246ae4935ba2f17913ccb64a",
    "escrow_vout": 0,
    "borrower_pubkey": "274903288d231552de4c2c270d1c3f71fe5c78315374830c3b12a6654ee03afa",
    "lender_pubkey": "64b4b84f42da9bdb84f7eda2de12524516686e73849645627fb7a034c79c81c8",
    "preimage_hash_borrower": "114810e3c12909f2fb9cbf59c11ee5c9d107556476685f7e14205eab094d4927",
    "preimage_hash_lender": "646e58c6fbea3ac4750a2279d4b711fed954e3cb48319c630570e3143e4553e3",
    "borrower_timelock": 2000,
    "lender_timelock": 1500,
    "collateral_amount": "0.01",
    "origination_fee": "0.0001",
    "borrower_private_key": "cNwW6ne3j9jUDWC3qFG5Bw3jzWvSZjZ2vgyP5LsTVj4WrJkJqjuz"
  }' | jq
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "signature_file_path": "/app/examples/borrower_signature_test-loan-example-456.json",
    "loan_id": "test-loan-example-456",
    "message": "Borrower signature saved to file"
  },
  "error": null,
  "message": "Borrower signature generated and saved successfully"
}
```

**Generated Signature File Content**:
```json
{
  "sig_borrower": "609949b34f2a68d87acbee29dfacf1a9d455f7f4595f120a5ade3e901c9ba76c1256445c6a6dd06729eccbe730ec3555865abdcbea0071fd14afe192c8b07d82",
  "txid": "d6f954878b9ef4b8dc9c21dae1f093e3f2d01b4388f2af6c666f5c1c10eae051",
  "vout": 1,
  "tx_hex": "0200000000010151e0ea101c5c6f666caff288431bd0f2e393f0e1da219cdcb8f49e8b8754f9d60100000000fdffffff02a0860100000000001976a914021c4448dec19b0e498cc9f8631033ef512b606388ac40420f0000000000225120ebd5034917da3723364473e1f08828523384f8ba28948f8cc9fae1569d12c66f00000000",
  "input_amount": 0.0111,
  "leaf_index": 1,
  "escrow_address_script": "51205011619088ddb5a08d38c2c0f5026ecc285cabb3ec9fdc623d1c5fdc380c638c",
  "tapleaf_script_hex": "a8203faa7c2aee84d26c241aa0f9a9718fde501a91c4a1f700ab37c1914f993242e3882064b4b84f42da9bdb84f7eda2de12524516686e73849645627fb7a034c79c81c8ac20274903288d231552de4c2c270d1c3f71fe5c78315374830c3b12a6654ee03afaba529d51",
  "escrow_is_odd": false,
  "loan_id": "test-loan-example-456",
  "borrower_pubkey": "274903288d231552de4c2c270d1c3f71fe5c78315374830c3b12a6654ee03afa",
  "lender_pubkey": "64b4b84f42da9bdb84f7eda2de12524516686e73849645627fb7a034c79c81c8",
  "preimage_hash_borrower": "3faa7c2aee84d26c241aa0f9a9718fde501a91c4a1f700ab37c1914f993242e3",
  "borrower_timelock": 100,
  "collateral_amount": 0.01,
  "origination_fee": 0.0001
}
```

### Signature Verification

**Endpoint**: `POST /transactions/verify-signature`

**Description**: Verify the validity of a borrower's signature using bitcoinutils. This endpoint reconstructs the transaction digest and uses schnorr signature verification to validate the signature.

**Usage**:
```bash
curl -X POST "http://localhost:8001/transactions/verify-signature" \
  -H "Content-Type: application/json" \
  -d '{
    "signature_data": {
      "sig_borrower": "9ce3210b3b1b657a9d4f33ec0c3cd8f92155952ef6d6bae1c582df762c0298ad0d6c52d7d8efa8882906aef4c0c8e5c8e641f77ba0b09c20855b075bd26a56d6",
      "tx_hex": "02000000000101f3f45bc999ab6484d45798e1c8ba926a81a6323b5035b6088ccc46fa10c8e7ff0000000000fdffffff02a0860100000000001976a914021c4448dec19b0e498cc9f8631033ef512b606388ac40420f000000000022512011c3194cb67847eef5f83e7d4816b1b788e4e556a13e00cbe9e27a175f5543e600000000",
      "input_amount": 0.0111,
      "escrow_address_script": "51205011619088ddb5a08d38c2c0f5026ecc285cabb3ec9fdc623d1c5fdc380c638c",
      "tapleaf_script_hex": "a8203faa7c2aee84d26c241aa0f9a9718fde501a91c4a1f700ab37c1914f993242e3882064b4b84f42da9bdb84f7eda2de12524516686e73849645627fb7a034c79c81c8ac20274903288d231552de4c2c270d1c3f71fe5c78315374830c3b12a6654ee03afaba529d51",
      "escrow_is_odd": false
    },
    "borrower_pubkey": "274903288d231552de4c2c270d1c3f71fe5c78315374830c3b12a6654ee03afa"
  }' | jq
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "is_valid": true,
    "borrower_pubkey": "274903288d231552de4c2c270d1c3f71fe5c78315374830c3b12a6654ee03afa",
    "message": "Signature is valid"
  },
  "error": null,
  "message": "Signature verification completed successfully"
}
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



# For completing the witneee

```bash
curl -X POST http://localhost:8001/transactions/complete-witness \
  -H "Content-Type: application/json" \
  -d '{
    "signature_file_path": "/tmp/test_signature.json",
    "lender_private_key": "cMrC8dGmStj3pz7mbY3vjwhXYcQwkcaWwV4QFCTF25WwVW1TCDkJ",
    "preimage": "0x1234567890abcdef",
    "mine_block": true
  }'
```