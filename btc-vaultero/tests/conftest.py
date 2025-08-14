"""
pytest configuration file for vaultero tests.
This file contains fixtures that are automatically available to all test files.
"""

import pytest
from bitcoinutils.setup import setup
from bitcoinutils.proxy import NodeProxy
from bitcoinutils.keys import PrivateKey, PublicKey
from vaultero.setup_utils import local_setup

import os
import shutil
import subprocess
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
    
    Add any other session-wide test data here.
    """
    return {
        'test_amount': 0.001,  # BTC
        'test_interest_rate': 5.0,  # percentage
        'test_duration': 18,  # blocks
        'borrower_timelock': 10, # should be 144+ blocks
        'lender_timelock': 20, # should be 144*180+ blocks (but test is faster)
        'test_origination_fee': 1000,  # satoshis
        'preimage_borrower': "hello_from_borrower",
        'preimage_lender': "hello_from_lender",
        'preimage_hash_borrower': hashlib.sha256("hello_from_borrower".encode()).hexdigest(),
        'preimage_hash_lender': hashlib.sha256("hello_from_lender".encode()).hexdigest()
    }
