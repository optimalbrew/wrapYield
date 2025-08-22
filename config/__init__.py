"""
BTC Yield Protocol Configuration Package

This package provides centralized configuration management for the BTC Yield Protocol.
It serves as a single source of truth for parameters used across Python, TypeScript, and Solidity code.

Usage:
    from config import Config, get_timelock, get_fee
    
    config = Config()
    fee = config.get_fee_amount('processing', '1.0')
    timelock = get_timelock('loanDuration', for_bitcoin=True)
"""

__version__ = "1.0.0"
__author__ = "BTC Yield Protocol Team"
__license__ = "MIT"

from .python_config import (
    Config,
    get_config,
    get_timelock,
    get_fee,
    get_network,
    Fee,
    Timelock,
    InterestRate,
    NetworkConfig,
)

__all__ = [
    "Config",
    "get_config", 
    "get_timelock",
    "get_fee",
    "get_network",
    "Fee",
    "Timelock", 
    "InterestRate",
    "NetworkConfig",
]
