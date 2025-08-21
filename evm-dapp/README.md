# Bitcoin-Collateralized Loan DApp

A wagmi-based React application for interacting with Bitcoin-collateralized loan smart contracts on Ethereum-compatible chains.

## Features

- 💰 **BtcCollateralLoan**: Bitcoin-collateralized loan management
- 🔄 **EtherSwap**: Atomic swap functionality for Bitcoin-Ethereum
- 🧪 **Anvil Integration**: Local testing with reproducible accounts
- 🎨 **Modern UI**: Built with Tailwind CSS and wagmi

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Foundry (for contract compilation and deployment)
- Anvil (Foundry) for local blockchain testing

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Install Foundry (if not already installed)

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### 3. Start Anvil

Start a local Ethereum chain with reproducible accounts:

```bash
anvil --mnemonic-seed-unsafe 2
```

This will start anvil on `http://127.0.0.1:8545` with deterministic private keys.

### 4. Environment Configuration

The `.env.local` file is already configured with:
- Anvil RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Private keys from anvil seed 2
- Contract address placeholders

### 5. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Contract Deployment

### Deploy via Foundry

1. **Navigate to the Foundry project directory:**
   ```bash
   cd ../evmchain
   ```

2. **Compile the contracts:**
   ```bash
   forge build
   ```

3. **Deploy all contracts using the deployment script:**
   ```bash
   forge script script/DeployLoanContract.sol --rpc-url http://127.0.0.1:8545 --private-key 0xd6a036f561e03196779dd34bf3d141dec4737eec5ed0416e413985ca05dad51a --broadcast
   ```

   or without `broadcast` to simulate prior to actual deployment

4. **Update environment variables** with the deployed addresses:
   ```bash
   cd ../evm-dapp
   echo "NEXT_PUBLIC_ETHER_SWAP_ADDRESS=0x..." >> .env.local
   echo "NEXT_PUBLIC_BTC_COLLATERAL_LOAN_ADDRESS=0x..." >> .env.local
   ```

### Deployment Verification

On successful deployment, we should be able to see the txid and the contract addresses, for example on anvil
```@bash
##### anvil-hardhat
✅  [Success] Hash: 0x08a08734c739d24046990476b353ef48632f12e0d583d3edeb35ff1cd6f07ddc
Contract Address: 0xb1Abb3712310432A94766c2795784789926F7f92
Block: 5
Paid: 0.001423983591884532 ETH (1800093 gas * 0.791061124 gwei)


##### anvil-hardhat
✅  [Success] Hash: 0xffca1117f0b0e497aa274e3fac765b9534c60fce2a9cdbfc0749ede065468888
Contract Address: 0x49D2d2d6967FE41521Aa88514Db87d7b47746463
Block: 4
Paid: 0.0038888435438975 ETH (4485230 gas * 0.86703325 gwei)

```



## Usage

### 1. Connect Wallet

- Connect using MetaMask or any Web3 wallet
- Switch to the Anvil network (Chain ID: 31337)

### 2. Test Loan Functionality

#### As a Borrower:
1. **Request a loan** with desired amount and collateral
2. **Wait for lender offer** (or use a different account as lender)
3. **Accept the loan offer** when ready
4. **Attempt repayment** when the loan is due

#### As a Lender:
1. **Extend loan offers** to existing loan requests
2. **Accept loan repayments** from borrowers
3. **Manage loan parameters** and BTC public keys

### 3. Loan Lifecycle

```
Loan Request → Lender Offer → Loan Activation → Repayment → Completion
     ↓              ↓              ↓              ↓           ↓
  Borrower      Lender        Borrower      Borrower    Lender
  Requests     Offers         Accepts       Repays      Claims
```

## Contract Architecture

```
EtherSwap (atomic swaps)
BtcCollateralLoan (loan management)
LoanFactory (only for testing with Forge: deploys both contracts)
```

### Key Contracts

- **EtherSwap.sol**: Modified from Boltz Exchange for atomic swaps
- **BtcCollateralLoan.sol**: Bitcoin-collateralized loan logic

The main change to EtherSwap is the introduction of `authorized` caller (the Loan contract) to 
ensure that the core public method calls (`lock`, `claim`, `refund`) can only be 
called from the BtcCollateralLoan contract. Users (lenders, borrowers) should not be able to
interact using these methods directly.


### Contract Parameters

- **Loan Duration**: 6 months (3000 blocks/day × 180 days)
- **Timelock Loan Request (t_B)**: 100 blocks
- **Timelock BTC Escrow (t_0)**: 200 blocks
- **Timelock Repayment Accept (t_L)**: 150 blocks
- **Timelock BTC Collateral (t_1)**: 250 blocks

## Development

### Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run deploy`: Deploy contracts to anvil (placeholder)

### Project Structure

```
src/
├── app/           # Next.js app router
├── contracts.ts   # Contract ABIs and configuration
├── constants.ts   # Constants and account information
└── wagmi.ts      # Wagmi configuration
```

### Adding New Contracts

1. Add contract ABI to `src/contracts.ts`
2. Update environment variables in `.env.local`
3. Add contract interaction hooks in components

## Testing

The app is configured for testing with:
- **Anvil**: Local Ethereum chain
- **Deterministic Accounts**: Same addresses every time
- **Test ETH**: 10,000 ETH per account

### Test Accounts (Anvil Seed 2)

- **Deployer/Lender**: `0x8995E44a22e303A79bdD2E6e41674fb92d620863`
- **Borrower1**: `0xE9e05C9f02e10FA833D379CB1c7aC3a3f23B247e`
- **Borrower2**: `0x61Da7c7F97EBE53AD7c4E5eCD3d117E7Ab430eA7`
- **User 3**: `0x5b0248e30583CeD4F09726C547935552C469EB24`
- **User 4**: `0xcDbc8abb83E01BaE13ECE8853a5Ca84b2Ef6Ca86`


## Helper cast examples

```
cast call 0x02b8afd8146b7bc6bd4f02782c18bd4649be1605 "LENDER_BOND_PERCENTAGE()" --rpc-url http://127.0.0.1:8545
```

```
cast call 0x02b8afd8146b7bc6bd4f02782c18bd4649be1605 "getLoan(uint256)" 1 --rpc-url http://127.0.0.1:8545 | cut -c 193-256

# then convert
cast --to-dec 0x00000000000000000000000000000000000000000000000000002386f26fc100
```

mempool: 
```
cast rpc txpool_status --rpc-url http://127.0.0.1:8545
cast rpc txpool_inspect --rpc-url http://127.0.0.1:8545
```


## Deployment

### Local Development

1. Start anvil: `anvil --mnemonic-seed-unsafe 2`
2. Deploy contracts via Foundry or UI
3. Update `.env.local` with contract addresses
4. Start development server: `npm run dev`



### Debug Mode

Enable debug logging by setting:
```bash
NEXT_PUBLIC_DEBUG=true
```

## Preimage generation for testing
There are helper scripts to generate preimages and hashes for borrower and lenders in the `evmchain` directory.

```
# from evmchain directory
forge script script/preimageGenerator.sol
python3 misc/hasher.py
```

## License

MIT License - see LICENSE file for details

## Acknowledgments
- [Boltz Exchange](https://github.com/BoltzExchange/boltz-core) - Original EtherSwap implementation
