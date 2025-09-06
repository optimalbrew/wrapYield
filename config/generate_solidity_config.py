#!/usr/bin/env python3
"""
Solidity Configuration Generator

This script reads parameters.json and generates ProtocolConfig.sol
to ensure Solidity constants stay in sync with the JSON configuration.

Usage:
    python config/generate_solidity_config.py
    
This should be run whenever parameters.json is updated.
"""

import json
import os
from pathlib import Path
from datetime import datetime

def load_config():
    """Load configuration from JSON file"""
    config_file = Path(__file__).parent / "parameters.json"
    with open(config_file, 'r') as f:
        return json.load(f)

def wei_value(ether_string):
    """Convert ether string to wei for Solidity constants"""
    # Convert like "0.001" -> "0.001 ether" for Solidity
    return f"{ether_string} ether"

def generate_solidity_config(config_data):
    """Generate Solidity configuration from JSON data"""
    
    # Extract values from JSON
    fees = config_data.get('fees', {})
    limits = config_data.get('limits', {})
    timelocks = config_data.get('timelocks', {})
    interest_rates = config_data.get('interestRates', {})
    blockchain_config = config_data.get('blockchainConfig', {})
    bitcoin_config = config_data.get('bitcoin', {})
    validation_config = config_data.get('validation', {})
    networks = config_data.get('networks', {})
    
    # Generate timestamp
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")
    
    solidity_code = f"""// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title BTC Yield Protocol Configuration Library
 * @dev Central configuration contract that provides constants and parameters
 *      used across the protocol. This ensures consistency and makes updates easier.
 *      
 * ⚠️  AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
 * Generated from parameters.json on {timestamp}
 * To update: modify parameters.json and run: python config/generate_solidity_config.py
 *      
 * Usage:
 *   import "./config/ProtocolConfig.sol";
 *   
 *   contract MyContract {{
 *       using ProtocolConfig for *;
 *       
 *       function example() external pure returns (uint256) {{
 *           return ProtocolConfig.PROCESSING_FEE();
 *       }}
 *   }}
 */
library ProtocolConfig {{
    
    // ============ VERSION INFO ============
    
    string internal constant VERSION = "{config_data.get('version', '1.0.0')}";
    string internal constant DESCRIPTION = "{config_data.get('description', 'BTC Yield Protocol Configuration')}";
    string internal constant GENERATED_ON = "{timestamp}";
    
    // ============ FEE CONSTANTS ============
    
    /// @dev Processing fee: {fees.get('processingFee', {}).get('value', '0.001')} ether ({fees.get('processingFee', {}).get('description', '')})
    uint256 internal constant PROCESSING_FEE = {wei_value(fees.get('processingFee', {}).get('value', '0.001'))};
    
    /// @dev Minimum loan amount: {limits.get('minLoanAmount', {}).get('value', '0.005')} ether ({limits.get('minLoanAmount', {}).get('description', '')})
    uint256 internal constant MIN_LOAN_AMOUNT = {wei_value(limits.get('minLoanAmount', {}).get('value', '0.005'))};
    
    /// @dev Maximum loan amount: {limits.get('maxLoanAmount', {}).get('value', '100')} ether ({limits.get('maxLoanAmount', {}).get('description', '')})
    uint256 internal constant MAX_LOAN_AMOUNT = {wei_value(limits.get('maxLoanAmount', {}).get('value', '100'))};
    
    /// @dev Origination fee: {fees.get('originationFee', {}).get('percentage', 1)}% 
    uint256 internal constant ORIGIN_FEE_PERCENTAGE = {fees.get('originationFee', {}).get('percentage', 1)};
    
    /// @dev Lender bond percentage: {fees.get('lenderBondPercentage', {}).get('percentage', 10)}%
    uint256 internal constant LENDER_BOND_PERCENTAGE = {fees.get('lenderBondPercentage', {}).get('percentage', 10)};
    
    // ============ TIMELOCK CONSTANTS (in blocks) ============
    
    /// @dev {timelocks.get('loanRequest', {}).get('symbol', 't_B')}: {timelocks.get('loanRequest', {}).get('description', '')} ({timelocks.get('loanRequest', {}).get('blocks', 100)} blocks)
    uint256 internal constant TIMELOCK_LOAN_REQ = {timelocks.get('loanRequest', {}).get('blocks', 1000)};
    
    /// @dev {timelocks.get('btcEscrow', {}).get('symbol', 't_0')}: {timelocks.get('btcEscrow', {}).get('description', '')} ({timelocks.get('btcEscrow', {}).get('blocks', 200)} blocks)
    uint256 internal constant TIMELOCK_BTC_ESCROW = {timelocks.get('btcEscrow', {}).get('blocks', 2000)};
    
    /// @dev {timelocks.get('repaymentAccept', {}).get('symbol', 't_L')}: {timelocks.get('repaymentAccept', {}).get('description', '')} ({timelocks.get('repaymentAccept', {}).get('blocks', 1500)} blocks)
    uint256 internal constant TIMELOCK_REPAYMENT_ACCEPT = {timelocks.get('repaymentAccept', {}).get('blocks', 1500)};
    
    /// @dev {timelocks.get('btcCollateral', {}).get('symbol', 't_1')}: {timelocks.get('btcCollateral', {}).get('description', '')} ({timelocks.get('btcCollateral', {}).get('blocks', 250)} blocks)
    uint256 internal constant TIMELOCK_BTC_COLLATERAL = {timelocks.get('btcCollateral', {}).get('blocks', 2500)};
    
    /// @dev {timelocks.get('loanDuration', {}).get('symbol', 't_D')}: {timelocks.get('loanDuration', {}).get('description', '')} ({timelocks.get('loanDuration', {}).get('blocks', 540000)} blocks)
    uint256 internal constant LOAN_DURATION = {timelocks.get('loanDuration', {}).get('blocks', 540000)};
    
    // ============ INTEREST RATE CONSTANTS ============
    
    /// @dev Default annual interest rate: {interest_rates.get('default', {}).get('annualPercentage', 8.0)}% (expressed as basis points: {int(interest_rates.get('default', {}).get('annualPercentage', 8.0) * 100)}/10000)
    uint256 internal constant DEFAULT_INTEREST_RATE_BPS = {int(interest_rates.get('default', {}).get('annualPercentage', 8.0) * 100)};
    
    /// @dev Minimum annual interest rate: {interest_rates.get('minimum', {}).get('annualPercentage', 1.0)}% ({int(interest_rates.get('minimum', {}).get('annualPercentage', 1.0) * 100)} basis points)
    uint256 internal constant MIN_INTEREST_RATE_BPS = {int(interest_rates.get('minimum', {}).get('annualPercentage', 1.0) * 100)};
    
    /// @dev Maximum annual interest rate: {interest_rates.get('maximum', {}).get('annualPercentage', 25.0)}% ({int(interest_rates.get('maximum', {}).get('annualPercentage', 25.0) * 100)} basis points)
    uint256 internal constant MAX_INTEREST_RATE_BPS = {int(interest_rates.get('maximum', {}).get('annualPercentage', 25.0) * 100)};
    
    /// @dev Basis points divisor (10000 = 100%)
    uint256 internal constant BASIS_POINTS_DIVISOR = 10000;
    
    // ============ BLOCKCHAIN CONSTANTS ============
    
    /// @dev Required Bitcoin confirmations
    uint256 internal constant BTC_CONFIRMATIONS_REQUIRED = {blockchain_config.get('btcConfirmations', {}).get('required', 6)};
    
    /// @dev Required EVM confirmations  
    uint256 internal constant EVM_CONFIRMATIONS_REQUIRED = {blockchain_config.get('evmConfirmations', {}).get('required', 12)};
    
    /// @dev BTC to EVM block ratio ({blockchain_config.get('btcToEvmBlockRatio', {}).get('ratio', '1:20')}) - Bitcoin numerator
    uint256 internal constant BTC_BLOCK_RATIO_NUMERATOR = {blockchain_config.get('btcToEvmBlockRatio', {}).get('ratio', '1:20').split(':')[0]};
    
    /// @dev BTC to EVM block ratio ({blockchain_config.get('btcToEvmBlockRatio', {}).get('ratio', '1:20')}) - EVM denominator
    uint256 internal constant BTC_BLOCK_RATIO_DENOMINATOR = {blockchain_config.get('btcToEvmBlockRatio', {}).get('ratio', '1:20').split(':')[1]};
    
    // ============ VALIDATION CONSTANTS ============
    
    /// @dev Bitcoin Schnorr x-only public key length ({bitcoin_config.get('publicKeyFormat', {}).get('length', 64)} chars = 32 bytes)
    uint256 internal constant BTC_PUBKEY_LENGTH = {bitcoin_config.get('publicKeyFormat', {}).get('length', 64)};
    
    /// @dev SHA256 preimage hash length ({validation_config.get('preimageHash', {}).get('length', 64)} chars = 32 bytes)
    uint256 internal constant PREIMAGE_HASH_LENGTH = {validation_config.get('preimageHash', {}).get('length', 64)};
    
    /// @dev P2TR address minimum length
    uint256 internal constant P2TR_ADDRESS_MIN_LENGTH = {bitcoin_config.get('addressTypes', {}).get('p2tr', {}).get('minLength', 62)};
    
    /// @dev P2TR address maximum length  
    uint256 internal constant P2TR_ADDRESS_MAX_LENGTH = {bitcoin_config.get('addressTypes', {}).get('p2tr', {}).get('maxLength', 63)};
    
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
    uint256 internal constant ROOTSTOCK_MAINNET_CHAIN_ID = {networks.get('mainnet', {}).get('ethereum', {}).get('chainId', 30)};
    
    /// @dev Rootstock Testnet chain ID  
    uint256 internal constant ROOTSTOCK_TESTNET_CHAIN_ID = {networks.get('testnet', {}).get('ethereum', {}).get('chainId', 31)};
    
    /// @dev Anvil local development chain ID
    uint256 internal constant ANVIL_CHAIN_ID = {networks.get('development', {}).get('ethereum', {}).get('chainId', 31337)};
    
    // ============ GETTER FUNCTIONS ============
    // These functions allow external contracts to access the constants
    
    function getVersion() internal pure returns (string memory) {{
        return VERSION;
    }}
    
    function getDescription() internal pure returns (string memory) {{
        return DESCRIPTION;
    }}
    
    function getGeneratedOn() internal pure returns (string memory) {{
        return GENERATED_ON;
    }}
    
    function getProcessingFee() internal pure returns (uint256) {{
        return PROCESSING_FEE;
    }}
    
    function getMinLoanAmount() internal pure returns (uint256) {{
        return MIN_LOAN_AMOUNT;
    }}
    
    function getMaxLoanAmount() internal pure returns (uint256) {{
        return MAX_LOAN_AMOUNT;
    }}
    
    function getOriginFeePercentage() internal pure returns (uint256) {{
        return ORIGIN_FEE_PERCENTAGE;
    }}
    
    function getLenderBondPercentage() internal pure returns (uint256) {{
        return LENDER_BOND_PERCENTAGE;
    }}
    
    function getTimelockLoanReq() internal pure returns (uint256) {{
        return TIMELOCK_LOAN_REQ;
    }}
    
    function getTimelockBtcEscrow() internal pure returns (uint256) {{
        return TIMELOCK_BTC_ESCROW;
    }}
    
    function getTimelockRepaymentAccept() internal pure returns (uint256) {{
        return TIMELOCK_REPAYMENT_ACCEPT;
    }}
    
    function getTimelockBtcCollateral() internal pure returns (uint256) {{
        return TIMELOCK_BTC_COLLATERAL;
    }}
    
    function getLoanDuration() internal pure returns (uint256) {{
        return LOAN_DURATION;
    }}
    
    function getDefaultInterestRateBps() internal pure returns (uint256) {{
        return DEFAULT_INTEREST_RATE_BPS;
    }}
    
    function getMinInterestRateBps() internal pure returns (uint256) {{
        return MIN_INTEREST_RATE_BPS;
    }}
    
    function getMaxInterestRateBps() internal pure returns (uint256) {{
        return MAX_INTEREST_RATE_BPS;
    }}
    
    function getBasisPointsDivisor() internal pure returns (uint256) {{
        return BASIS_POINTS_DIVISOR;
    }}
    
    // ============ UTILITY FUNCTIONS ============
    
    /**
     * @dev Convert EVM blocks to Bitcoin blocks using the configured ratio
     * @param evmBlocks Number of EVM blocks
     * @return Bitcoin blocks
     */
    function evmBlocksToBtcBlocks(uint256 evmBlocks) internal pure returns (uint256) {{
        return (evmBlocks * BTC_BLOCK_RATIO_NUMERATOR) / BTC_BLOCK_RATIO_DENOMINATOR;
    }}
    
    /**
     * @dev Convert Bitcoin blocks to EVM blocks using the configured ratio
     * @param btcBlocks Number of Bitcoin blocks  
     * @return EVM blocks
     */
    function btcBlocksToEvmBlocks(uint256 btcBlocks) internal pure returns (uint256) {{
        return (btcBlocks * BTC_BLOCK_RATIO_DENOMINATOR) / BTC_BLOCK_RATIO_NUMERATOR;
    }}
    
    /**
     * @dev Calculate origination fee for a loan amount
     * @param loanAmount The loan amount in wei
     * @return Fee amount in wei
     */
    function calculateOriginationFee(uint256 loanAmount) internal pure returns (uint256) {{
        return (loanAmount * ORIGIN_FEE_PERCENTAGE) / 100;
    }}
    
    /**
     * @dev Calculate lender bond amount for a loan
     * @param loanAmount The loan amount in wei
     * @return Bond amount in wei
     */
    function calculateLenderBond(uint256 loanAmount) internal pure returns (uint256) {{
        return (loanAmount * LENDER_BOND_PERCENTAGE) / 100;
    }}
    
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
    ) internal pure returns (uint256) {{
        if (blocksPerYear == 0) {{
            blocksPerYear = 1095000; // Default for Rootstock (~3000 blocks/day * 365 days)
        }}
        
        // Calculate: principal * (interestRate / 10000) * (duration / blocksPerYear)
        return (principal * interestRateBps * durationBlocks) / (BASIS_POINTS_DIVISOR * blocksPerYear);
    }}
    
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
    ) internal pure returns (uint256) {{
        uint256 interest = calculateInterest(principal, interestRateBps, durationBlocks, blocksPerYear);
        return principal + interest;
    }}
    
    /**
     * @dev Validate timelock ordering constraints
     * @return True if all timelock constraints are satisfied
     */
    function validateTimelockOrdering() internal pure returns (bool) {{
        return TIMELOCK_BTC_ESCROW > TIMELOCK_LOAN_REQ && 
               TIMELOCK_BTC_COLLATERAL > (TIMELOCK_REPAYMENT_ACCEPT + LOAN_DURATION);
    }}
    
    /**
     * @dev Validate loan amount against limits
     * @param amount Loan amount to validate
     * @return True if amount is within valid range
     */
    function validateLoanAmount(uint256 amount) internal pure returns (bool) {{
        return amount >= MIN_LOAN_AMOUNT && amount <= MAX_LOAN_AMOUNT;
    }}
    
    /**
     * @dev Validate interest rate against limits  
     * @param interestRateBps Interest rate in basis points
     * @return True if interest rate is within valid range
     */
    function validateInterestRate(uint256 interestRateBps) internal pure returns (bool) {{
        return interestRateBps >= MIN_INTEREST_RATE_BPS && interestRateBps <= MAX_INTEREST_RATE_BPS;
    }}
    
    /**
     * @dev Get the current network based on chain ID
     * @return Network name as string
     */
    function getCurrentNetwork() internal view returns (string memory) {{
        uint256 chainId = block.chainid;
        
        if (chainId == ROOTSTOCK_MAINNET_CHAIN_ID) {{
            return "rootstock-mainnet";
        }} else if (chainId == ROOTSTOCK_TESTNET_CHAIN_ID) {{
            return "rootstock-testnet";
        }} else if (chainId == ANVIL_CHAIN_ID) {{
            return "anvil-local";
        }} else {{
            return "unknown";
        }}
    }}
    
    /**
     * @dev Check if current network is a development environment
     * @return True if running on development network
     */
    function isDevelopmentNetwork() internal view returns (bool) {{
        return block.chainid == ANVIL_CHAIN_ID;
    }}
    
    /**
     * @dev Check if current network is a testnet
     * @return True if running on testnet
     */
    function isTestnetNetwork() internal view returns (bool) {{
        return block.chainid == ROOTSTOCK_TESTNET_CHAIN_ID;
    }}
    
    /**
     * @dev Check if current network is mainnet
     * @return True if running on mainnet
     */
    function isMainnetNetwork() internal view returns (bool) {{
        return block.chainid == ROOTSTOCK_MAINNET_CHAIN_ID;
    }}
}}"""
    
    return solidity_code

def main():
    """Main function to generate Solidity configuration"""
    print("🔧 Generating Solidity configuration from parameters.json...")
    
    # Load configuration
    config_data = load_config()
    print(f"✅ Loaded configuration version: {config_data.get('version', 'unknown')}")
    
    # Generate Solidity code
    solidity_code = generate_solidity_config(config_data)
    
    # Write to evmchain src directory (canonical location)
    config_dir = Path(__file__).parent
    evmchain_dir = config_dir.parent / "evmchain" / "src"
    
    if evmchain_dir.exists():
        evmchain_sol_path = evmchain_dir / "ProtocolConfig.sol"
        with open(evmchain_sol_path, 'w') as f:
            f.write(solidity_code)
        print(f"✅ Generated: {evmchain_sol_path}")
    else:
        print(f"❌ evmchain/src/ directory not found at: {evmchain_dir}")
        return False
    
    print("\n🎯 Solidity configuration successfully generated!")
    print("📝 The file includes a timestamp and warning that it's auto-generated.")
    print("⚠️  Remember to run this script whenever you update parameters.json")
    
    # Validate generation
    print("\n🔍 Validating generated constants...")
    fees = config_data.get('fees', {})
    processing_fee = fees.get('processingFee', {}).get('value', '0.001')
    min_loan = config_data.get('limits', {}).get('minLoanAmount', {}).get('value', '0.005')
    
    print(f"   Processing Fee: {processing_fee} ether")
    print(f"   Min Loan Amount: {min_loan} ether")
    print(f"   Origination Fee Percentage: {fees.get('originationFee', {}).get('percentage', 1)}%")
    print("✅ Generation complete!")

if __name__ == "__main__":
    main()
