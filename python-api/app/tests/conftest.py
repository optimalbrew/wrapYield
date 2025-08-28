"""
Pytest configuration and fixtures for BTC Yield Python API tests.
"""

import pytest
import asyncio

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
def sample_escrow_request():
    """Sample escrow request data for testing."""
    return {
        "loan_id": "test-loan-123",
        "borrower_pubkey": "a" * 64,  # Mock 64-char pubkey
        "preimage_hash_borrower": "b" * 64,  # Mock 64-char hash
        "borrower_timelock": 144,
        "amount": "0.001",
        "origination_fee": "0.0001"
    }

@pytest.fixture
def sample_collateral_request():
    """Sample collateral request data for testing."""
    return {
        "loan_id": "test-loan-123",
        "escrow_txid": "c" * 64,  # Mock 64-char txid
        "escrow_vout": 0,
        "borrower_pubkey": "a" * 64,  # Mock 64-char pubkey
        "preimage_hash_lender": "d" * 64,  # Mock 64-char hash
        "lender_timelock": 144,
        "collateral_amount": "0.001",
        "origination_fee": "0.0001"
    }

@pytest.fixture
def mock_bitcoin_rpc_response():
    """Mock Bitcoin RPC response for testing."""
    return {
        "chain": "regtest",
        "blocks": 100,
        "bestblockhash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "verificationprogress": 1.0
    }
