// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title BTC Yield Protocol Configuration Library
 * @dev Central configuration contract that provides constants and parameters
 *      used across the protocol. This ensures consistency and makes updates easier.
 *      
 * ⚠️  AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
 * Generated from parameters.json on 2025-08-21 17:38:28 UTC
 * To update: modify parameters.json and run: python config/generate_solidity_config.py
 *      
 * Usage:
 *   import "./config/ProtocolConfig.sol";
 *   
 *   contract MyContract {
 *       using ProtocolConfig for *;
 *       
 *       function example() external pure returns (uint256) {
 *           return ProtocolConfig.PROCESSING_FEE();
 *       }
 *   }
 */
library ProtocolConfig {
    
    // ============ VERSION INFO ============
    
    string internal constant VERSION = "1.0.0";
    string internal constant DESCRIPTION = "Shared configuration parameters for BTC Yield Protocol";
    string internal constant GENERATED_ON = "2025-08-21 17:38:28 UTC";
    
    // ============ FEE CONSTANTS ============
    
    /// @dev Processing fee: 0.001 ether (Refundable processing fee for spam prevention)
    uint256 internal constant PROCESSING_FEE = 0.001 ether;
    
    /// @dev Minimum loan amount: 0.005 ether (Minimum loan amount (approximately $500 in rBTC))
    uint256 internal constant MIN_LOAN_AMOUNT = 0.005 ether;
    
    /// @dev Maximum loan amount: 100 ether (Maximum loan amount (can be adjusted))
    uint256 internal constant MAX_LOAN_AMOUNT = 100 ether;
    
    /// @dev Origination fee: 1% (expressed as divisor: 1000)
    uint256 internal constant ORIGIN_FEE_PERCENTAGE_DIVISOR = 1000;
    
    /// @dev Lender bond percentage: 10%
    uint256 internal constant LENDER_BOND_PERCENTAGE = 10;
    
    // ============ TIMELOCK CONSTANTS (in blocks) ============
    
    /// @dev t_B: Timelock for loan request acceptance (shorter than t_0) (100 blocks)
    uint256 internal constant TIMELOCK_LOAN_REQ = 100;
    
    /// @dev t_0: Timelock for BTC escrow (enforced on Bitcoin side, must be > t_B) (200 blocks)
    uint256 internal constant TIMELOCK_BTC_ESCROW = 200;
    
    /// @dev t_L: Timelock for repayment acceptance (150 blocks)
    uint256 internal constant TIMELOCK_REPAYMENT_ACCEPT = 150;
    
    /// @dev t_1: Timelock for BTC collateral release (must be > t_L, enforced on Bitcoin side) (250 blocks)
    uint256 internal constant TIMELOCK_BTC_COLLATERAL = 250;
    
    /// @dev t_D: Total loan duration (6 months on Rootstock: 3000 blocks/day * 180 days) (540000 blocks)
    uint256 internal constant LOAN_DURATION = 540000;
    
    // ============ INTEREST RATE CONSTANTS ============
    
    /// @dev Default annual interest rate: 8.0% (expressed as basis points: 800/10000)
    uint256 internal constant DEFAULT_INTEREST_RATE_BPS = 800;
    
    /// @dev Minimum annual interest rate: 1.0% (100 basis points)
    uint256 internal constant MIN_INTEREST_RATE_BPS = 100;
    
    /// @dev Maximum annual interest rate: 25.0% (2500 basis points)
    uint256 internal constant MAX_INTEREST_RATE_BPS = 2500;
    
    /// @dev Basis points divisor (10000 = 100%)
    uint256 internal constant BASIS_POINTS_DIVISOR = 10000;
    
    // ============ BLOCKCHAIN CONSTANTS ============
    
    /// @dev Required Bitcoin confirmations
    uint256 internal constant BTC_CONFIRMATIONS_REQUIRED = 6;
    
    /// @dev Required EVM confirmations  
    uint256 internal constant EVM_CONFIRMATIONS_REQUIRED = 12;
    
    /// @dev BTC to EVM block ratio (1:20) - Bitcoin numerator
    uint256 internal constant BTC_BLOCK_RATIO_NUMERATOR = 1;
    
    /// @dev BTC to EVM block ratio (1:20) - EVM denominator
    uint256 internal constant BTC_BLOCK_RATIO_DENOMINATOR = 20;
    
    // ============ VALIDATION CONSTANTS ============
    
    /// @dev Bitcoin Schnorr x-only public key length (64 chars = 32 bytes)
    uint256 internal constant BTC_PUBKEY_LENGTH = 64;
    
    /// @dev SHA256 preimage hash length (64 chars = 32 bytes)
    uint256 internal constant PREIMAGE_HASH_LENGTH = 64;
    
    /// @dev P2TR address minimum length
    uint256 internal constant P2TR_ADDRESS_MIN_LENGTH = 62;
    
    /// @dev P2TR address maximum length  
    uint256 internal constant P2TR_ADDRESS_MAX_LENGTH = 63;
    
    /// @dev Ethereum address length (42 chars including 0x)
    uint256 internal constant ETH_ADDRESS_LENGTH = 42;
    
    // ============ SECURITY CONSTANTS ============
    
    /// @dev Maximum active loans per borrower
    uint256 internal constant MAX_ACTIVE_LOANS_PER_BORROWER = 1;
    
    /// @dev Emergency pause flag (can be modified by governance)
    bool internal constant EMERGENCY_PAUSE_ENABLED = false;
    
    /// @dev Lender slashing enabled
    bool internal constant LENDER_SLASHING_ENABLED = true;
    
    // ============ NETWORK CONSTANTS ============
    
    /// @dev Rootstock Mainnet chain ID
    uint256 internal constant ROOTSTOCK_MAINNET_CHAIN_ID = 30;
    
    /// @dev Rootstock Testnet chain ID  
    uint256 internal constant ROOTSTOCK_TESTNET_CHAIN_ID = 31;
    
    /// @dev Anvil local development chain ID
    uint256 internal constant ANVIL_CHAIN_ID = 31337;
    
    // ============ GETTER FUNCTIONS ============
    // These functions allow external contracts to access the constants
    
    function getVersion() internal pure returns (string memory) {
        return VERSION;
    }
    
    function getDescription() internal pure returns (string memory) {
        return DESCRIPTION;
    }
    
    function getGeneratedOn() internal pure returns (string memory) {
        return GENERATED_ON;
    }
    
    function getProcessingFee() internal pure returns (uint256) {
        return PROCESSING_FEE;
    }
    
    function getMinLoanAmount() internal pure returns (uint256) {
        return MIN_LOAN_AMOUNT;
    }
    
    function getMaxLoanAmount() internal pure returns (uint256) {
        return MAX_LOAN_AMOUNT;
    }
    
    function getOriginFeePercentageDivisor() internal pure returns (uint256) {
        return ORIGIN_FEE_PERCENTAGE_DIVISOR;
    }
    
    function getLenderBondPercentage() internal pure returns (uint256) {
        return LENDER_BOND_PERCENTAGE;
    }
    
    function getTimelockLoanReq() internal pure returns (uint256) {
        return TIMELOCK_LOAN_REQ;
    }
    
    function getTimelockBtcEscrow() internal pure returns (uint256) {
        return TIMELOCK_BTC_ESCROW;
    }
    
    function getTimelockRepaymentAccept() internal pure returns (uint256) {
        return TIMELOCK_REPAYMENT_ACCEPT;
    }
    
    function getTimelockBtcCollateral() internal pure returns (uint256) {
        return TIMELOCK_BTC_COLLATERAL;
    }
    
    function getLoanDuration() internal pure returns (uint256) {
        return LOAN_DURATION;
    }
    
    function getDefaultInterestRateBps() internal pure returns (uint256) {
        return DEFAULT_INTEREST_RATE_BPS;
    }
    
    function getMinInterestRateBps() internal pure returns (uint256) {
        return MIN_INTEREST_RATE_BPS;
    }
    
    function getMaxInterestRateBps() internal pure returns (uint256) {
        return MAX_INTEREST_RATE_BPS;
    }
    
    function getBasisPointsDivisor() internal pure returns (uint256) {
        return BASIS_POINTS_DIVISOR;
    }
    
    // ============ UTILITY FUNCTIONS ============
    
    /**
     * @dev Convert EVM blocks to Bitcoin blocks using the configured ratio
     * @param evmBlocks Number of EVM blocks
     * @return Bitcoin blocks
     */
    function evmBlocksToBtcBlocks(uint256 evmBlocks) internal pure returns (uint256) {
        return (evmBlocks * BTC_BLOCK_RATIO_NUMERATOR) / BTC_BLOCK_RATIO_DENOMINATOR;
    }
    
    /**
     * @dev Convert Bitcoin blocks to EVM blocks using the configured ratio
     * @param btcBlocks Number of Bitcoin blocks  
     * @return EVM blocks
     */
    function btcBlocksToEvmBlocks(uint256 btcBlocks) internal pure returns (uint256) {
        return (btcBlocks * BTC_BLOCK_RATIO_DENOMINATOR) / BTC_BLOCK_RATIO_NUMERATOR;
    }
    
    /**
     * @dev Calculate origination fee for a loan amount
     * @param loanAmount The loan amount in wei
     * @return Fee amount in wei
     */
    function calculateOriginationFee(uint256 loanAmount) internal pure returns (uint256) {
        return loanAmount / ORIGIN_FEE_PERCENTAGE_DIVISOR;
    }
    
    /**
     * @dev Calculate lender bond amount for a loan
     * @param loanAmount The loan amount in wei
     * @return Bond amount in wei
     */
    function calculateLenderBond(uint256 loanAmount) internal pure returns (uint256) {
        return (loanAmount * LENDER_BOND_PERCENTAGE) / 100;
    }
    
    /**
     * @dev Calculate interest for a loan
     * @param principal Principal amount in wei
     * @param interestRateBps Interest rate in basis points
     * @param durationBlocks Loan duration in blocks
     * @param blocksPerYear Blocks per year (default: 1095000 for Rootstock)
     * @return Interest amount in wei
     */
    function calculateInterest(
        uint256 principal,
        uint256 interestRateBps,
        uint256 durationBlocks,
        uint256 blocksPerYear
    ) internal pure returns (uint256) {
        if (blocksPerYear == 0) {
            blocksPerYear = 1095000; // Default for Rootstock (~3000 blocks/day * 365 days)
        }
        
        // Calculate: principal * (interestRate / 10000) * (duration / blocksPerYear)
        return (principal * interestRateBps * durationBlocks) / (BASIS_POINTS_DIVISOR * blocksPerYear);
    }
    
    /**
     * @dev Calculate total repayment amount (principal + interest)
     * @param principal Principal amount in wei
     * @param interestRateBps Interest rate in basis points
     * @param durationBlocks Loan duration in blocks
     * @param blocksPerYear Blocks per year
     * @return Total repayment amount in wei
     */
    function calculateTotalRepayment(
        uint256 principal,
        uint256 interestRateBps,
        uint256 durationBlocks,
        uint256 blocksPerYear
    ) internal pure returns (uint256) {
        uint256 interest = calculateInterest(principal, interestRateBps, durationBlocks, blocksPerYear);
        return principal + interest;
    }
    
    /**
     * @dev Validate timelock ordering constraints
     * @return True if all timelock constraints are satisfied
     */
    function validateTimelockOrdering() internal pure returns (bool) {
        return TIMELOCK_BTC_ESCROW > TIMELOCK_LOAN_REQ && 
               TIMELOCK_BTC_COLLATERAL > TIMELOCK_REPAYMENT_ACCEPT;
    }
    
    /**
     * @dev Validate loan amount against limits
     * @param amount Loan amount to validate
     * @return True if amount is within valid range
     */
    function validateLoanAmount(uint256 amount) internal pure returns (bool) {
        return amount >= MIN_LOAN_AMOUNT && amount <= MAX_LOAN_AMOUNT;
    }
    
    /**
     * @dev Validate interest rate against limits  
     * @param interestRateBps Interest rate in basis points
     * @return True if interest rate is within valid range
     */
    function validateInterestRate(uint256 interestRateBps) internal pure returns (bool) {
        return interestRateBps >= MIN_INTEREST_RATE_BPS && interestRateBps <= MAX_INTEREST_RATE_BPS;
    }
    
    /**
     * @dev Get the current network based on chain ID
     * @return Network name as string
     */
    function getCurrentNetwork() internal view returns (string memory) {
        uint256 chainId = block.chainid;
        
        if (chainId == ROOTSTOCK_MAINNET_CHAIN_ID) {
            return "rootstock-mainnet";
        } else if (chainId == ROOTSTOCK_TESTNET_CHAIN_ID) {
            return "rootstock-testnet";
        } else if (chainId == ANVIL_CHAIN_ID) {
            return "anvil-local";
        } else {
            return "unknown";
        }
    }
    
    /**
     * @dev Check if current network is a development environment
     * @return True if running on development network
     */
    function isDevelopmentNetwork() internal view returns (bool) {
        return block.chainid == ANVIL_CHAIN_ID;
    }
    
    /**
     * @dev Check if current network is a testnet
     * @return True if running on testnet
     */
    function isTestnetNetwork() internal view returns (bool) {
        return block.chainid == ROOTSTOCK_TESTNET_CHAIN_ID;
    }
    
    /**
     * @dev Check if current network is mainnet
     * @return True if running on mainnet
     */
    function isMainnetNetwork() internal view returns (bool) {
        return block.chainid == ROOTSTOCK_MAINNET_CHAIN_ID;
    }
}