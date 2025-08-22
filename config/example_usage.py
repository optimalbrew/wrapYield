#!/usr/bin/env python3
"""
Example usage of the BTC Yield Protocol configuration system.

This script demonstrates how to use the configuration across different components
of the protocol and shows the consistency of parameters.

Run with: python config/example_usage.py
"""

import json
from decimal import Decimal
from python_config import Config, get_timelock, get_fee, get_network

def main():
    """Demonstrate configuration usage"""
    print("=" * 60)
    print("BTC Yield Protocol Configuration System Example")
    print("=" * 60)
    
    # Load configuration
    config = Config()
    
    # Display basic info
    print(f"\n📋 Configuration Info:")
    print(f"Version: {config.version}")
    print(f"Description: {config.description}")
    print(f"Last Updated: {config.last_updated}")
    
    # Show fee configurations
    print(f"\n💰 Fee Configuration:")
    print(f"Processing Fee: {config.processing_fee.get_decimal_value()} {config.processing_fee.unit}")
    print(f"Origination Fee: {config.origination_fee.percentage}% (1/{config.origination_fee.divisor})")
    print(f"Lender Bond: {config.lender_bond.percentage}%")
    
    # Show loan limits
    print(f"\n📊 Loan Limits:")
    print(f"Minimum: {config.min_loan_amount.get_decimal_value()} {config.min_loan_amount.unit}")
    print(f"Maximum: {config.max_loan_amount.get_decimal_value()} {config.max_loan_amount.unit}")
    
    # Show timelock values
    print(f"\n⏰ Timelock Configuration (EVM blocks):")
    print(f"Loan Request (t_B): {config.timelock_loan_request.blocks}")
    print(f"BTC Escrow (t_0): {config.timelock_btc_escrow.blocks}")
    print(f"Repayment Accept (t_L): {config.timelock_repayment_accept.blocks}")
    print(f"BTC Collateral (t_1): {config.timelock_btc_collateral.blocks}")
    print(f"Loan Duration (t_D): {config.timelock_loan_duration.blocks}")
    
    # Show Bitcoin timelock conversions
    print(f"\n₿ Bitcoin Timelock Conversion (using {config.btc_to_evm_ratio} ratio):")
    for timelock_name in ['loanRequest', 'btcEscrow', 'repaymentAccept', 'btcCollateral', 'loanDuration']:
        evm_blocks = config.get_timelock(timelock_name)
        btc_blocks = config.get_timelock(timelock_name, for_bitcoin=True)
        print(f"{timelock_name}: {evm_blocks} EVM → {btc_blocks} BTC blocks")
    
    # Show interest rates
    print(f"\n📈 Interest Rate Configuration:")
    print(f"Default: {config.default_interest_rate.annual_percentage}%")
    print(f"Minimum: {config.min_interest_rate.annual_percentage}%")
    print(f"Maximum: {config.max_interest_rate.annual_percentage}%")
    
    # Calculate example fees
    print(f"\n🧮 Fee Calculations (Example: 2.5 ETH loan):")
    loan_amount = Decimal('2.5')
    
    processing_fee = config.get_fee_amount('processing', loan_amount)
    origination_fee = config.get_fee_amount('origination', loan_amount)
    lender_bond = config.get_fee_amount('lender_bond', loan_amount)
    
    print(f"Loan Amount: {loan_amount} ETH")
    print(f"Processing Fee: {processing_fee} ETH")
    print(f"Origination Fee: {origination_fee} ETH")
    print(f"Lender Bond: {lender_bond} ETH")
    print(f"Total (Borrower): {loan_amount + processing_fee} ETH")
    print(f"Total (Lender): {loan_amount + lender_bond} ETH")
    
    # Show network configurations
    print(f"\n🌐 Network Configuration:")
    for env in ['development', 'testnet', 'mainnet']:
        eth_config = config.get_network_config(env, 'ethereum')
        btc_config = config.get_network_config(env, 'bitcoin')
        
        print(f"\n{env.title()}:")
        print(f"  Ethereum: {eth_config.name} (Chain ID: {eth_config.chain_id})")
        print(f"  Bitcoin: {btc_config.network}")
    
    # Show validation examples
    print(f"\n✅ Validation Examples:")
    
    # Valid examples
    valid_pubkey = "1234567890123456789012345678901234567890123456789012345678901234"
    valid_hash = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
    
    print(f"Valid Bitcoin Pubkey: {config.validate_bitcoin_pubkey(valid_pubkey)}")
    print(f"Valid Preimage Hash: {config.validate_preimage_hash(valid_hash)}")
    
    # Invalid examples
    invalid_pubkey = "123"  # Too short
    invalid_hash = "xyz123"  # Invalid hex
    
    print(f"Invalid Bitcoin Pubkey: {config.validate_bitcoin_pubkey(invalid_pubkey)}")
    print(f"Invalid Preimage Hash: {config.validate_preimage_hash(invalid_hash)}")
    
    # Demonstrate convenience functions
    print(f"\n🎯 Convenience Functions:")
    print(f"Quick timelock (btcEscrow): {get_timelock('btcEscrow')} blocks")
    print(f"Quick timelock (btcEscrow, Bitcoin): {get_timelock('btcEscrow', for_bitcoin=True)} blocks")
    print(f"Quick fee (origination, 1 ETH): {get_fee('origination', '1.0')} ETH")
    print(f"Quick network (development, ethereum): {get_network('development', 'ethereum').name}")
    
    # Show JSON structure for reference
    print(f"\n📄 Raw JSON structure preview:")
    with open(config.config_file, 'r') as f:
        data = json.load(f)
    
    print(f"JSON keys: {list(data.keys())}")
    print(f"Fee types: {list(data['fees'].keys())}")
    print(f"Timelock types: {list(data['timelocks'].keys())}")
    print(f"Network environments: {list(data['networks'].keys())}")
    
    print(f"\n✨ Configuration system ready for use across Python, TypeScript, and Solidity!")
    print("=" * 60)

if __name__ == "__main__":
    main()
