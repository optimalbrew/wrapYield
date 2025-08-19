# Bitcoin-Collateralized Loan DApp

A wagmi-based React application for interacting with Bitcoin-collateralized loan smart contracts on Ethereum-compatible chains.

## Features

- 🏦 **LoanFactory**: Deploy EtherSwap and BtcCollateralLoan contracts
- 🔄 **EtherSwap**: Atomic swap functionality for Bitcoin-Ethereum
- 💰 **BtcCollateralLoan**: Bitcoin-collateralized loan management
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

### Option 1: Deploy via Foundry (Recommended)

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
   forge script script/Deploy.sol --rpc-url http://127.0.0.1:8545 --private-key 0xd6a036f561e03196779dd34bf3d141dec4737eec5ed0416e413985ca05dad51a --broadcast
   ```

4. **Update environment variables** with the deployed addresses:
   ```bash
   cd ../evm-dapp
   echo "NEXT_PUBLIC_LOAN_FACTORY_ADDRESS=0x..." >> .env.local
   echo "NEXT_PUBLIC_ETHER_SWAP_ADDRESS=0x..." >> .env.local
   echo "NEXT_PUBLIC_BTC_COLLATERAL_LOAN_ADDRESS=0x..." >> .env.local
   ```

### Option 2: Deploy via DApp UI

1. **Start the development server** (`npm run dev`)
2. **Connect your wallet** to the Anvil network
3. **Use the "Deploy Contracts" button** in the UI
4. **Copy the deployed addresses** to your `.env.local` file

### Deployment Verification

After deployment, you should see:
- ✅ **LoanFactory**: `0x1b09Db46C1a4CcCc3454a3eF753594757D2183c7`
- ✅ **EtherSwap**: `0x5c1b83261330a5a73dE0837783B5cA057C646C9E`
- ✅ **BtcCollateralLoan**: `0x5B5e3BFfD8E8FD1294A5E6529d98B120dBCDc63D`

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
LoanFactory
├── EtherSwap (atomic swaps)
└── BtcCollateralLoan (loan management)
```

### Key Contracts

- **LoanFactory.sol**: Factory for deploying loan contracts
- **EtherSwap.sol**: Modified from Boltz Exchange for atomic swaps
- **BtcCollateralLoan.sol**: Bitcoin-collateralized loan logic
- **TransferHelper.sol**: Utility library for token transfers

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

- **Deployer**: `0x8995E44a22e303A79bdD2E6e41674fb92d620863`
- **Lender**: `0xE9e05C9f02e10FA833D379CB1c7aC3a3f23B247e`
- **Borrower**: `0x61Da7c7F97EBE53AD7c4E5eCD3d117E7Ab430eA7`
- **User 3**: `0x5b0248e30583CeD4F09726C547935552C469EB24`
- **User 4**: `0xcDbc8abb83E01BaE13ECE8853a5Ca84b2Ef6Ca86`

Example to see the accouts work, a simple send
```
cast send --from 0x8995E44a22e303A79bdD2E6e41674fb92d620863 0xE9e05C9f02e10FA833D379CB1c7aC3a3f23B247e --value 1000000000000000 --private-key 0xd6a036f561e03196779dd34bf3d141dec4737eec5ed0416e413985ca05dad51a --rpc-url http://127.0.0.1:8545
```


## Deployment

### Local Development

1. Start anvil: `anvil --mnemonic-seed-unsafe 2`
2. Deploy contracts via Foundry or UI
3. Update `.env.local` with contract addresses
4. Start development server: `npm run dev`

### Production

1. Update environment variables for target network
2. Deploy contracts to target chain
3. Update contract addresses in environment

## Troubleshooting

### Common Issues

1. **Anvil not running**: Make sure anvil is started on port 8545
2. **Wrong network**: Switch MetaMask to Anvil (Chain ID: 31337)
3. **Contract not deployed**: Deploy contracts first via Foundry or UI
4. **Contract size limit**: Some contracts may exceed size limits (warning only)

### Debug Mode

Enable debug logging by setting:
```bash
NEXT_PUBLIC_DEBUG=true
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- [Wagmi](https://wagmi.sh/) - React hooks for Ethereum
- [Foundry](https://getfoundry.sh/) - Ethereum development toolkit
- [Boltz Exchange](https://github.com/BoltzExchange/boltz-core) - Original EtherSwap implementation
