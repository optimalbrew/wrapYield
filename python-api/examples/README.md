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

**Test Data Source**: These examples use test values from `btc-vaultero/tests/conftest.py`:
- **Borrower Private Key (WIF)**: `cNwW6ne3j9jUDWC3qFG5Bw3jzWvSZjZ2vgyP5LsTVj4WrJkJqjuz`
- **Lender Private Key (WIF)**: `cMrC8dGmStj3pz7mbY3vjwhXYcQwkcaWwV4QFCTF25WwVW1TCDkJ`
- **Preimage**: `"hello_from_lender"` (for output_1), `"hello_from_borrower"` (for output_0)

**Timelock Values** (derived from `config/parameters.json`):
- **Output 0 (btcEscrow)**: `100` Bitcoin blocks (2000 EVM blocks ÷ 20 ratio)
- **Output 1 (btcCollateral)**: `27150` Bitcoin blocks (543000 EVM blocks ÷ 20 ratio)

## Response Structure

The API returns a structured JSON response with:

- **`success`**: Boolean indicating if the operation succeeded
- **`scripts`**: Array of generated Bitcoin scripts with detailed information
- **`metadata`**: Information about the function call, parameters used, and generation timestamp

Each script includes:
- **`type`**: Script classification (csv_script_borrower/lender, hashlock_and_multisig_script)
- **`description`**: Human-readable explanation of the script's purpose
- **`raw_script`**: Array representation of the script operations
- **`hex`**: Hex-encoded script for Bitcoin transactions
- **`template`**: Code template showing how to recreate the script
- **`parameters`**: Input parameters used in script generation

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

## Generating Your Own Examples

To create your own example files from API responses:

### 1. Make the API Call
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

### 2. Make it Readable
Pipe the response through `jq` for pretty formatting:
```bash
curl -X POST "http://localhost:8001/vaultero/leaf-scripts-output-0" \
  -H "Content-Type: application/json" \
  -d '{"borrower_pubkey": "your_key", "lender_pubkey": "your_key", "preimage_hash_borrower": "your_hash", "borrower_timelock": 100}' | jq
```

### 3. Save to File
Save the formatted response to a file:
```bash
curl -X POST "http://localhost:8001/vaultero/leaf-scripts-output-0" \
  -H "Content-Type: application/json" \
  -d '{"borrower_pubkey": "your_key", "lender_pubkey": "your_key", "preimage_hash_borrower": "your_hash", "borrower_timelock": 100}' | jq > my-example.json
```

### 4. Manual Formatting (if jq not available)
If you don't have `jq` installed, you can use Python:
```bash
curl -X POST "http://localhost:8001/vaultero/leaf-scripts-output-0" \
  -H "Content-Type: application/json" \
  -d '{"borrower_pubkey": "your_key", "lender_pubkey": "your_key", "preimage_hash_borrower": "your_hash", "borrower_timelock": 100}' | python3 -m json.tool > my-example.json
```
