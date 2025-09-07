"""
Pytest configuration and fixtures for BTC Yield Python API tests.
"""

import pytest
import asyncio
import hashlib
from bitcoinutils.keys import PrivateKey, PublicKey

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
def test_keys():
    """Setup test keys that will be reused across all test files.
    
    These are the same static test keys used by btc-vaultero tests.
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
        'lender_pub': lender_pub,
        'borrower_pubkey_hex': borrower_pub.to_hex(),
        'lender_pubkey_hex': lender_pub.to_hex(),
        'borrower_pubkey_xonly': borrower_pub.to_hex()[2:],  # Remove '02' or '03' prefix
        'lender_pubkey_xonly': lender_pub.to_hex()[2:]  # Remove '02' or '03' prefix
    }

@pytest.fixture(scope="session")
def test_data():
    """Common test data that can be used across all test files.
    This matches the pattern used by btc-vaultero tests.
    """
    return {
        'test_amount': 0.01,  # BTC
        'borrower_timelock': 100,  # Bitcoin blocks (smaller for testing)
        'lender_timelock': 100,  # Bitcoin blocks (smaller for testing)
        'test_origination_fee': 0.001,  # BTC
        'preimage_borrower': "hello_from_borrower",
        'preimage_lender': "hello_from_lender",
        'preimage_hash_borrower': hashlib.sha256("hello_from_borrower".encode()).hexdigest(),
        'preimage_hash_lender': hashlib.sha256("hello_from_lender".encode()).hexdigest()
    }



@pytest.fixture
def sample_collateral_request(test_keys, test_data):
    """Sample collateral request data for testing using real test data."""
    return {
        "loan_id": "test-loan-123",
        "escrow_txid": "", #update with real escrow txid
        "escrow_vout": None, #update with real escrow vout
        "borrower_pubkey": test_keys['borrower_pub'],
        "preimage_hash_lender": test_data['preimage_hash_lender'],
        "lender_timelock": test_data['lender_timelock'],
        "collateral_amount": str(test_data['test_amount']),
        "origination_fee": str(test_data['test_origination_fee'])
    }

@pytest.fixture(scope="session")
def bitcoin_rpc_setup():
    """Setup Bitcoin RPC connection and wallet for testing.
    
    This fixture handles:
    - Bitcoin RPC connection initialization
    - Wallet creation/loading
    - Initial block generation for regtest
    - Returns the configured bitcoin_rpc service
    """
    import asyncio
    from app.services.bitcoin_rpc_service import bitcoin_rpc
    
    print("Setting up Bitcoin RPC connection and wallet...")
    
    # Initialize RPC connection
    rpc_conn = bitcoin_rpc.rpc
    print("Bitcoin RPC connection established")
    
    # Handle wallet initialization
    try:
        wallets = rpc_conn.listwallets()
        print(f"Existing wallets: {wallets}")
        
        wallet_name = "python-api-test"  # Use the same wallet name as the service
        if not wallets or wallet_name not in wallets:
            print(f"Creating {wallet_name} wallet...")
            try:
                rpc_conn.createwallet(wallet_name)
                print("Wallet created successfully")
            except Exception as create_error:
                if "Database already exists" in str(create_error):
                    print("Wallet database exists, loading it...")
                    rpc_conn.loadwallet(wallet_name)
                    print("Wallet loaded successfully")
                else:
                    raise create_error
        else:
            print(f"Loading existing {wallet_name} wallet...")
            try:
                rpc_conn.loadwallet(wallet_name)
                print("Wallet loaded successfully")
            except Exception as load_error:
                if "Unable to obtain an exclusive lock" in str(load_error):
                    print("Wallet already loaded by another process, continuing...")
                else:
                    raise load_error
                    
    except Exception as e:
        print(f"Wallet initialization warning: {e}")
        # Continue anyway - wallet might already be loaded
    
    # Generate initial blocks if we're in regtest and have no blocks
    try:
        loop = asyncio.get_event_loop()
        block_count = loop.run_until_complete(bitcoin_rpc.get_block_count())
        if block_count < 100:  # Generate some initial blocks for testing
            print(f"Generating initial blocks (current: {block_count})...")
            loop.run_until_complete(bitcoin_rpc.generate_blocks(100))
            print("Initial blocks generated")
    except Exception as e:
        print(f"Block generation warning: {e}")
    
    print("Bitcoin RPC setup complete")
    return bitcoin_rpc

@pytest.fixture(scope="function")
def funded_wallet(bitcoin_rpc_setup):
    """Ensure the wallet has sufficient funds for testing.
    
    This fixture:
    - Generates 101 blocks to get mature coins (required for spending)
    - Verifies wallet balance
    - Returns the bitcoin_rpc service with funded wallet
    """
    import asyncio
    
    loop = asyncio.get_event_loop()
    
    # Generate 101 blocks to get mature coins (required for spending)
    print("💰 Generating 101 blocks to get mature coins...")
    loop.run_until_complete(bitcoin_rpc_setup.generate_blocks(101))
    
    # Check wallet balance
    balance = loop.run_until_complete(bitcoin_rpc_setup.get_balance())
    print(f"💰 Wallet balance: {balance} BTC")
    
    return bitcoin_rpc_setup

@pytest.fixture(scope="function")
def funded_escrow_address(bitcoin_rpc_setup, test_keys, test_data):
    """Create a funded escrow address for testing.
    
    This fixture:
    - Creates an escrow address using get_nums_p2tr_addr_0
    - Funds it with sufficient BTC
    - Generates blocks to confirm the transaction
    - Returns the escrow address, transaction ID, and vout
    """
    import asyncio
    from app.services.vaultero_service import VaulteroService
    
    vaultero_service = VaulteroService()
    
    # Convert pubkey objects to the format needed by the API
    borrower_pubkey_hex = test_keys['borrower_pub'].to_hex()
    lender_pubkey_hex = test_keys['lender_pub'].to_hex()
    
    # Create escrow address
    loop = asyncio.get_event_loop()
    escrow_address = loop.run_until_complete(vaultero_service.get_nums_p2tr_addr_0(
        borrower_pubkey=borrower_pubkey_hex,
        lender_pubkey=lender_pubkey_hex,
        preimage_hash_borrower=test_data['preimage_hash_borrower'],
        borrower_timelock=test_data['borrower_timelock']
    ))
    
    print(f"Created escrow address: {escrow_address}")
    
    # Fund the escrow address using Decimal for precise arithmetic
    from decimal import Decimal
    funding_amount = Decimal(str(test_data['test_amount'])) + Decimal(str(test_data['test_origination_fee'])) + Decimal('0.0001')
    funding_amount_float = float(funding_amount)
    print(f"Funding escrow address with {funding_amount_float} BTC")
    
    funding_txid = bitcoin_rpc_setup.rpc.sendtoaddress(escrow_address, funding_amount_float)
    print(f"Funding transaction ID: {funding_txid}")
    
    # Generate blocks to confirm the funding transaction
    loop.run_until_complete(bitcoin_rpc_setup.generate_blocks(10, escrow_address))
    print("Generated 10 blocks to confirm funding transaction")
    
    # Get transaction details to find the UTXO
    tx_details = loop.run_until_complete(bitcoin_rpc_setup.get_transaction_info(funding_txid))
    
    # Find the output that went to our escrow address
    escrow_vout = None
    for detail in tx_details.get('details', []):
        if detail.get('address') == escrow_address:
            escrow_vout = detail.get('vout')
            break
    
    if escrow_vout is None:
        raise Exception("Error: Could not find the correct output to escrow address")
    
    print(f"Found UTXO at vout: {escrow_vout}")
    
    return {
        'address': escrow_address,
        'txid': funding_txid,
        'vout': escrow_vout,
        'amount': funding_amount_float
    }
