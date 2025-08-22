"""
BTC Yield Protocol Configuration Module for Python

This module provides access to shared configuration parameters from the base JSON file.
It includes utility functions for working with the parameters in Python code.

Usage:
    from config.python_config import Config, get_timelock, get_fee
    
    config = Config()
    processing_fee = config.fees.processing_fee
    loan_duration = config.timelocks.loan_duration
    
    # Utility functions
    btc_blocks = get_timelock('btcEscrow', for_bitcoin=True)  # Converts EVM blocks to BTC blocks
    fee_amount = get_fee('processing', amount=1.0)  # Calculates fee amount
"""

import json
import os
from dataclasses import dataclass
from typing import Dict, Any, Optional, Union
from decimal import Decimal
from pathlib import Path

# Get the path to the JSON config file
CONFIG_DIR = Path(__file__).parent
CONFIG_FILE = CONFIG_DIR / "parameters.json"

@dataclass
class Fee:
    """Fee configuration"""
    value: Optional[str] = None
    percentage: Optional[int] = None
    divisor: Optional[int] = None
    unit: Optional[str] = None
    description: str = ""
    
    def get_decimal_value(self) -> Optional[Decimal]:
        """Get fee value as Decimal for precise calculations"""
        if self.value:
            return Decimal(self.value)
        return None
    
    def get_percentage_decimal(self) -> Optional[Decimal]:
        """Get fee percentage as decimal (e.g., 1% = 0.01)"""
        if self.percentage and self.divisor:
            return Decimal(self.percentage) / Decimal(self.divisor)
        return None

@dataclass
class Timelock:
    """Timelock configuration"""
    blocks: int
    symbol: str
    description: str
    
    def to_bitcoin_blocks(self, ratio: str = "1:20") -> int:
        """Convert EVM blocks to Bitcoin blocks using the ratio"""
        # Parse ratio like "1:20" 
        btc_ratio, evm_ratio = map(int, ratio.split(':'))
        return int(self.blocks * btc_ratio / evm_ratio)

@dataclass 
class InterestRate:
    """Interest rate configuration"""
    annual_percentage: float
    description: str
    
    def get_decimal(self) -> Decimal:
        """Get interest rate as decimal"""
        return Decimal(str(self.annual_percentage)) / Decimal('100')

@dataclass
class NetworkConfig:
    """Network configuration"""
    chain_id: Optional[int] = None
    name: Optional[str] = None
    rpc_url: Optional[str] = None
    network: Optional[str] = None

class Config:
    """Main configuration class that loads and provides access to all parameters"""
    
    def __init__(self, config_file: Optional[str] = None):
        """
        Initialize configuration
        
        Args:
            config_file: Optional path to config file. Defaults to parameters.json
        """
        if config_file:
            self.config_file = Path(config_file)
        else:
            self.config_file = CONFIG_FILE
            
        self._config_data = self._load_config()
        self._setup_attributes()
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from JSON file"""
        if not self.config_file.exists():
            raise FileNotFoundError(f"Configuration file not found: {self.config_file}")
        
        with open(self.config_file, 'r') as f:
            return json.load(f)
    
    def _setup_attributes(self):
        """Setup configuration attributes from loaded data"""
        # Version info
        self.version = self._config_data.get('version')
        self.description = self._config_data.get('description')
        self.last_updated = self._config_data.get('lastUpdated')
        
        # Fees
        fees_data = self._config_data.get('fees', {})
        self.processing_fee = Fee(**fees_data.get('processingFee', {}))
        self.origination_fee = Fee(**fees_data.get('originationFee', {}))
        self.lender_bond = Fee(**fees_data.get('lenderBondPercentage', {}))
        
        # Limits
        limits_data = self._config_data.get('limits', {})
        self.min_loan_amount = Fee(**limits_data.get('minLoanAmount', {}))
        self.max_loan_amount = Fee(**limits_data.get('maxLoanAmount', {}))
        
        # Timelocks
        timelocks_data = self._config_data.get('timelocks', {})
        self.timelock_loan_request = Timelock(**timelocks_data.get('loanRequest', {}))
        self.timelock_btc_escrow = Timelock(**timelocks_data.get('btcEscrow', {}))
        self.timelock_repayment_accept = Timelock(**timelocks_data.get('repaymentAccept', {}))
        self.timelock_btc_collateral = Timelock(**timelocks_data.get('btcCollateral', {}))
        self.timelock_loan_duration = Timelock(**timelocks_data.get('loanDuration', {}))
        
        # Interest rates
        rates_data = self._config_data.get('interestRates', {})
        self.default_interest_rate = InterestRate(
            annual_percentage=rates_data.get('default', {}).get('annualPercentage', 0.0),
            description=rates_data.get('default', {}).get('description', '')
        )
        self.min_interest_rate = InterestRate(
            annual_percentage=rates_data.get('minimum', {}).get('annualPercentage', 0.0),
            description=rates_data.get('minimum', {}).get('description', '')
        )
        self.max_interest_rate = InterestRate(
            annual_percentage=rates_data.get('maximum', {}).get('annualPercentage', 0.0),
            description=rates_data.get('maximum', {}).get('description', '')
        )
        
        # Blockchain config
        blockchain_data = self._config_data.get('blockchainConfig', {})
        self.btc_to_evm_ratio = blockchain_data.get('btcToEvmBlockRatio', {}).get('ratio', '1:20')
        self.btc_confirmations = blockchain_data.get('btcConfirmations', {}).get('required', 6)
        self.evm_confirmations = blockchain_data.get('evmConfirmations', {}).get('required', 12)
        
        # Bitcoin config
        bitcoin_data = self._config_data.get('bitcoin', {})
        self.bitcoin_network = bitcoin_data.get('network', 'regtest')
        self.supported_address_types = bitcoin_data.get('addressTypes', {}).get('supported', ['p2tr'])
        self.pubkey_format = bitcoin_data.get('publicKeyFormat', {})
        
        # Networks
        self.networks = {}
        networks_data = self._config_data.get('networks', {})
        for env, nets in networks_data.items():
            eth_data = nets.get('ethereum', {})
            btc_data = nets.get('bitcoin', {})
            
            self.networks[env] = {
                'ethereum': NetworkConfig(
                    chain_id=eth_data.get('chainId'),
                    name=eth_data.get('name'),
                    rpc_url=eth_data.get('rpcUrl'),
                    network=eth_data.get('network')
                ),
                'bitcoin': NetworkConfig(
                    chain_id=btc_data.get('chainId'),
                    name=btc_data.get('name'), 
                    rpc_url=btc_data.get('rpcUrl'),
                    network=btc_data.get('network')
                )
            }
    
    def get_timelock(self, timelock_name: str, for_bitcoin: bool = False) -> int:
        """
        Get timelock value in blocks
        
        Args:
            timelock_name: Name of the timelock ('loanRequest', 'btcEscrow', etc.)
            for_bitcoin: If True, convert to Bitcoin blocks using the ratio
            
        Returns:
            Number of blocks
        """
        timelock_attr_map = {
            'loanRequest': 'timelock_loan_request',
            'btcEscrow': 'timelock_btc_escrow', 
            'repaymentAccept': 'timelock_repayment_accept',
            'btcCollateral': 'timelock_btc_collateral',
            'loanDuration': 'timelock_loan_duration'
        }
        
        attr_name = timelock_attr_map.get(timelock_name)
        if not attr_name:
            raise ValueError(f"Unknown timelock: {timelock_name}")
            
        timelock = getattr(self, attr_name)
        if for_bitcoin:
            return timelock.to_bitcoin_blocks(self.btc_to_evm_ratio)
        return timelock.blocks
    
    def get_interest_rate(self, interest_rate_name: str) -> Decimal:
        """
        Get interest rate value in percentage
        
        Args:
            interest_rate_name: Name of the interest rate ('default', 'minimum', 'maximum')
        
        Returns:
            Interest rate as Decimal
        """
        interest_rate_attr_map = {
            'default': 'default_interest_rate',
            'minimum': 'min_interest_rate',
            'maximum': 'max_interest_rate'
        }
        
        attr_name = interest_rate_attr_map.get(interest_rate_name)
        if not attr_name:
            raise ValueError(f"Unknown interest rate: {interest_rate_name}")
            
        interest_rate = getattr(self, attr_name)
        
        return interest_rate.annual_percentage

    def get_fee_amount(self, fee_type: str, amount: Union[float, Decimal, str]) -> Decimal:
        """
        Calculate fee amount based on type and principal amount
        
        Args:
            fee_type: Type of fee ('processing', 'origination', 'lender_bond')
            amount: Principal amount to calculate fee from
            
        Returns:
            Fee amount as Decimal
        """
        amount_decimal = Decimal(str(amount))
        
        if fee_type == 'processing':
            return self.processing_fee.get_decimal_value()
        elif fee_type == 'origination':
            percentage = self.origination_fee.get_percentage_decimal()
            return amount_decimal * percentage if percentage else Decimal('0')
        elif fee_type == 'lender_bond':
            if self.lender_bond.percentage:
                return amount_decimal * Decimal(str(self.lender_bond.percentage)) / Decimal('100')
            return Decimal('0')
        else:
            raise ValueError(f"Unknown fee type: {fee_type}")
    
    def get_network_config(self, environment: str, blockchain: str) -> NetworkConfig:
        """
        Get network configuration for specific environment and blockchain
        
        Args:
            environment: 'development', 'testnet', or 'mainnet'
            blockchain: 'ethereum' or 'bitcoin'
            
        Returns:
            NetworkConfig object
        """
        if environment not in self.networks:
            raise ValueError(f"Unknown environment: {environment}")
        if blockchain not in self.networks[environment]:
            raise ValueError(f"Unknown blockchain: {blockchain}")
            
        return self.networks[environment][blockchain]
    
    def validate_bitcoin_pubkey(self, pubkey: str) -> bool:
        """Validate Bitcoin public key format"""
        expected_length = self.pubkey_format.get('length', 64)
        return len(pubkey) == expected_length and all(c in '0123456789abcdefABCDEF' for c in pubkey)
    
    def validate_preimage_hash(self, hash_str: str) -> bool:
        """Validate preimage hash format"""
        validation_data = self._config_data.get('validation', {}).get('preimageHash', {})
        expected_length = validation_data.get('length', 64)
        return len(hash_str) == expected_length and all(c in '0123456789abcdefABCDEF' for c in hash_str)

# Global config instance
_config_instance: Optional[Config] = None

def get_config() -> Config:
    """Get global configuration instance (singleton pattern)"""
    global _config_instance
    if _config_instance is None:
        _config_instance = Config()
    return _config_instance

# Convenience functions for common operations
def get_timelock(timelock_name: str, for_bitcoin: bool = False) -> int:
    """Get timelock value. Convenience function."""
    return get_config().get_timelock(timelock_name, for_bitcoin)

def get_interest_rate(interest_rate_name: str) -> Decimal:
    """Get interest rate value. Convenience function."""
    return get_config().get_interest_rate(interest_rate_name)

def get_fee(fee_type: str, amount: Union[float, str] = 1.0) -> Decimal:
    """Calculate fee amount. Convenience function.""" 
    return get_config().get_fee_amount(fee_type, amount)

def get_network(environment: str = 'development', blockchain: str = 'ethereum') -> NetworkConfig:
    """Get network configuration. Convenience function."""
    return get_config().get_network_config(environment, blockchain)

# Example usage
if __name__ == "__main__":
    config = Config()
    print(f"Config version: {config.version}")
    print(f"Processing fee: {config.processing_fee.get_decimal_value()} {config.processing_fee.unit}")
    print(f"Loan duration: {config.timelock_loan_duration.blocks} blocks")
    print(f"Loan duration (Bitcoin): {config.get_timelock('loanDuration', for_bitcoin=True)} blocks")
    print(f"Origination fee (1 ETH): {config.get_fee_amount('origination', '1.0')} ETH")
