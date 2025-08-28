"""
pytest configuration file for vaultero tests.
This file contains fixtures that are automatically available to all test files.
"""

import pytest
from bitcoinutils.setup import setup
from bitcoinutils.proxy import NodeProxy
from bitcoinutils.keys import PrivateKey, PublicKey
from vaultero.setup_utils import local_setup
import sys
import os
# Add project root to Python path to access config package
sys.path.append(os.path.join(os.path.dirname(__file__), '../..'))
from config.python_config import get_timelock, get_interest_rate

from pathlib import Path
import hashlib

@pytest.fixture(scope="session")
def bitcoin_setup(network: str = "regtest"):
    """Setup bitcoin utilities and proxy for the entire test session.
    
    This fixture runs once when pytest starts and provides the same
    bitcoin connection to all test files.
    """
    setup(network)
    proxy = NodeProxy("bitcoin", "localtest").get_proxy()
    addr, dest_address = local_setup(proxy)

    return {'proxy': proxy, 'addr': addr, 'dest_address': dest_address}

@pytest.fixture(scope="session")
def test_keys():
    """Setup test keys that will be reused across all test files.
    
    These are static test keys that don't change between tests.
    """
    borrower_priv = PrivateKey("cNwW6ne3j9jUDWC3qFG5Bw3jzWvSZjZ2vgyP5LsTVj4WrJkJqjuz")
    lender_priv = PrivateKey("cMrC8dGmStj3pz7mbY3vjwhXYcQwkcaWwV4QFCTF25WwVW1TCDkJ")
    
    # Computed public keys (hex format) for API testing:
    # borrower_pub_hex = "02274903288d231552de4c2c270d1c3f71fe5c78315374830c3b12a6654ee03afa"
    # lender_pub_hex = "0264b4b84f42da9bdb84f7eda2de12524516686e73849645627fb7a034c79c81c8"
    
    borrower_pub = borrower_priv.get_public_key()
    lender_pub = lender_priv.get_public_key()
    
    return {
        'borrower_priv': borrower_priv,
        'lender_priv': lender_priv,
        'borrower_pub': borrower_pub,
        'lender_pub': lender_pub
    }

 
@pytest.fixture(scope="session")
def test_data():
    """Common test data that can be used across all test files.
    This uses the dataclass in config/python_config.py to get the timelocks and convert them to bitcoin blocks.
    Add any other session-wide test data here.

    """
    return {
        'test_amount': 0.001,  # BTC in application, should be from the dapp
        'test_interest_rate': get_interest_rate('default'),  # percentage, not used yet.
        'test_duration': get_timelock('loanDuration', for_bitcoin=True),  # not needed. already "included" in lender_timelock
        'borrower_timelock': get_timelock('btcEscrow', for_bitcoin=True), # 
        'lender_timelock': get_timelock('btcCollateral', for_bitcoin=True), # set this to something smaller e.g. 100 for testing, increase timeout
        'test_origination_fee': 1000,  # satoshis in application, should be from the dapp
        'preimage_borrower': "hello_from_borrower",
        'preimage_lender': "hello_from_lender",
        'preimage_hash_borrower': hashlib.sha256("hello_from_borrower".encode()).hexdigest(),
        'preimage_hash_lender': hashlib.sha256("hello_from_lender".encode()).hexdigest()
    }
