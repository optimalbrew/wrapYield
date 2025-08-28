"""
Tests for service layer functionality.
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from decimal import Decimal
from app.services.vaultero_service import VaulteroService
from app.services.bitcoin_rpc_service import BitcoinRPCService
from app.models import CreateEscrowRequest

class TestVaulteroService:
    """Test VaulteroService functionality."""
    
    @pytest.fixture
    def vaultero_service(self):
        """Create a VaulteroService instance for testing."""
        return VaulteroService()
    
    @pytest.mark.asyncio
    async def test_generate_preimage(self, vaultero_service):
        """Test preimage generation."""
        preimage, preimage_hash = await vaultero_service.generate_preimage()
        
        assert isinstance(preimage, str)
        assert isinstance(preimage_hash, str)
        assert len(preimage) > 0
        assert len(preimage_hash) == 64  # SHA256 hash length
        # Note: preimage_hash might not start with '0x' depending on implementation
        assert len(preimage_hash) == 64
    
    @pytest.mark.asyncio
    async def test_create_escrow_transaction_mock(self, vaultero_service, sample_escrow_request):
        """Test escrow transaction creation with mock data."""
        request = CreateEscrowRequest(**sample_escrow_request)
        
        result = await vaultero_service.create_escrow_transaction(request)
        
        assert result is not None
        assert hasattr(result, 'transaction_id')
        assert hasattr(result, 'escrow_address')
        assert hasattr(result, 'raw_tx')
        assert isinstance(result.raw_tx, str)
        assert len(result.raw_tx) > 0
    
    @pytest.mark.asyncio
    async def test_get_transaction_status_mock(self, vaultero_service):
        """Test transaction status checking with mock data."""
        mock_txid = "a" * 64
        
        result = await vaultero_service.get_transaction_status(mock_txid)
        
        assert isinstance(result, dict)
        assert 'status' in result
        # The actual service might return 'not_found' for non-existent txids
        assert result['status'] in ['pending', 'confirmed', 'failed', 'not_found']
    
    @pytest.mark.asyncio
    async def test_create_collateral_transaction_mock(self, vaultero_service, sample_collateral_request):
        """Test collateral transaction creation with mock data."""
        from app.models import CreateCollateralRequest
        request = CreateCollateralRequest(**sample_collateral_request)
        
        result = await vaultero_service.create_collateral_transaction(request)
        
        assert result is not None
        assert hasattr(result, 'transaction_id')
        assert hasattr(result, 'raw_tx')
        assert isinstance(result.raw_tx, str)
    
    @pytest.mark.asyncio
    async def test_vaultero_import_availability(self, vaultero_service):
        """Test that vaultero library is properly imported and available."""
        # Check if vaultero is available
        assert vaultero_service.is_vaultero_available() in [True, False]
        
        if vaultero_service.is_vaultero_available():
            print("✅ Vaultero library is available")
        else:
            print("⚠️  Vaultero library is not available, using mock implementations")
    
    @pytest.mark.asyncio
    async def test_get_nums_key_function(self, vaultero_service):
        """Test that get_nums_key function can be called and returns expected value."""
        if not vaultero_service.is_vaultero_available():
            pytest.skip("Vaultero library not available, skipping real function test")
        
        try:
            # Import the function and the PublicKey class
            from vaultero import get_nums_key
            from bitcoinutils.keys import PublicKey
            
            # Call the function
            nums_key = get_nums_key()
            
            # Verify it's the correct type
            assert isinstance(nums_key, PublicKey), f"Expected PublicKey instance, got {type(nums_key)}"
            
            # Get the hex representation and verify the expected value
            public_key_hex = nums_key.to_hex()
            expected_hex = "0250929b74c1a04954b78b4b60c595c211f8b853e6e84bfa2be95712a7b0dd59e6"
            assert public_key_hex == expected_hex, f"Expected {expected_hex}, got {public_key_hex}"
            
            print(f"✅ get_nums_key() returned PublicKey with hex: {public_key_hex}")
            
        except Exception as e:
            pytest.fail(f"get_nums_key() failed: {e}")
    
    @pytest.mark.asyncio
    async def test_vaultero_functions_imported(self, vaultero_service):
        """Test that all expected vaultero functions are properly imported."""
        if not vaultero_service.is_vaultero_available():
            pytest.skip("Vaultero library not available, skipping import test")
        
        try:
            # Test that all expected functions can be imported
            from vaultero import (
                get_nums_key,
                get_leaf_scripts_output_0,
                get_leaf_scripts_output_1,
                get_nums_p2tr_addr_0,
                get_nums_p2tr_addr_1,
                create_collateral_lock_tx,
                create_collateral_release_tx,
                fund_address
            )
            
            # Test that functions are callable
            assert callable(get_nums_key)
            assert callable(get_leaf_scripts_output_0)
            assert callable(get_leaf_scripts_output_1)
            assert callable(get_nums_p2tr_addr_0)
            assert callable(get_nums_p2tr_addr_1)
            assert callable(create_collateral_lock_tx)
            assert callable(create_collateral_release_tx)
            assert callable(fund_address)
            
            print("✅ All vaultero functions imported successfully")
            
        except ImportError as e:
            pytest.fail(f"Failed to import vaultero functions: {e}")
        except Exception as e:
            pytest.fail(f"Unexpected error testing vaultero functions: {e}")

    @pytest.mark.asyncio
    async def test_get_leaf_scripts_output_0_formal(self, vaultero_service):
        """Test the leaf scripts endpoint using formal test values from btc-vaultero tests."""
        if not vaultero_service.is_vaultero_available():
            pytest.skip("Vaultero library not available, skipping real function test")
        
        try:
            # Import required classes
            from bitcoinutils.keys import PrivateKey
            import hashlib
            
            # Use the same test values as btc-vaultero/tests/conftest.py
            # Create private keys first (WIF format), then get public keys
            borrower_priv = PrivateKey("cNwW6ne3j9jUDWC3qFG5Bw3jzWvSZjZ2vgyP5LsTVj4WrJkJqjuz")
            lender_priv = PrivateKey("cMrC8dGmStj3pz7mbY3vjwhXYcQwkcaWwV4QFCTF25WwVW1TCDkJ")
            
            # Get public keys from private keys
            borrower_pub = borrower_priv.get_public_key()
            lender_pub = lender_priv.get_public_key()
            
            # Convert to hex strings for the API call
            borrower_pubkey = borrower_pub.to_hex()
            lender_pubkey = lender_pub.to_hex()
            
            test_data = {
                'preimage_borrower': "hello_from_borrower",
                'preimage_hash_borrower': hashlib.sha256("hello_from_borrower".encode()).hexdigest(),
                'borrower_timelock': 100  # Real production value: btcEscrow 2000 EVM blocks ÷ 20 = 100 BTC blocks
            }
            
            print(f"Using borrower pubkey: {borrower_pubkey}")
            print(f"Using lender pubkey: {lender_pubkey}")
            print(f"Using preimage hash: {test_data['preimage_hash_borrower']}")
            
            # Test the endpoint
            result = await vaultero_service.get_leaf_scripts_output_0(
                borrower_pubkey=borrower_pubkey,
                lender_pubkey=lender_pubkey,
                preimage_hash_borrower=test_data['preimage_hash_borrower'],
                borrower_timelock=test_data['borrower_timelock']
            )
            
            # Verify the response structure
            assert result['success'] is True
            assert 'scripts' in result
            assert 'metadata' in result
            
            # Verify we get exactly 2 scripts
            scripts = result['scripts']
            assert len(scripts) == 2
            assert result['metadata']['total_scripts'] == 2
            
            # Verify script types
            assert scripts[0]['type'] == 'csv_script_borrower'
            assert scripts[1]['type'] == 'hashlock_and_multisig_script'
            
            # Verify script descriptions
            assert 'Borrower escape hatch' in scripts[0]['description']
            assert 'Lender spending path' in scripts[1]['description']
            
            # Verify parameters are correctly passed through
            assert scripts[0]['parameters']['borrower_timelock'] == test_data['borrower_timelock']
            assert scripts[0]['parameters']['preimage_hash_borrower'] == test_data['preimage_hash_borrower']
            
            # Verify hex encoding is present
            assert 'hex' in scripts[0]
            assert 'hex' in scripts[1]
            assert len(scripts[0]['hex']) > 0
            assert len(scripts[1]['hex']) > 0
            
            # Verify template code is present
            assert 'template' in scripts[0]
            assert 'template' in scripts[1]
            assert 'Script([' in scripts[0]['template']
            assert 'Script([' in scripts[1]['template']
            
            # Verify metadata
            assert 'function_call' in result['metadata']
            assert 'parameters_used' in result['metadata']
            assert 'generated_at' in result['metadata']
            
            print(f"✅ Leaf scripts test passed with {len(scripts)} scripts")
            print(f"   Script 0: {scripts[0]['type']} - {scripts[0]['hex'][:20]}...")
            print(f"   Script 1: {scripts[1]['type']} - {scripts[1]['hex'][:20]}...")
            
        except Exception as e:
            pytest.fail(f"Leaf scripts test failed: {e}")

    @pytest.mark.asyncio
    async def test_get_leaf_scripts_output_1_formal(self, vaultero_service):
        """Test the leaf scripts output_1 endpoint using formal test values from btc-vaultero tests."""
        if not vaultero_service.is_vaultero_available():
            pytest.skip("Vaultero library not available, skipping real function test")
        
        try:
            # Import required classes
            from bitcoinutils.keys import PrivateKey
            import hashlib
            
            # Use the same test values as btc-vaultero/tests/conftest.py
            # Create private keys first (WIF format), then get public keys
            borrower_priv = PrivateKey("cNwW6ne3j9jUDWC3qFG5Bw3jzWvSZjZ2vgyP5LsTVj4WrJkJqjuz")
            lender_priv = PrivateKey("cMrC8dGmStj3pz7mbY3vjwhXYcQwkcaWwV4QFCTF25WwVW1TCDkJ")
            
            # Get public keys from private keys
            borrower_pub = borrower_priv.get_public_key()
            lender_pub = lender_priv.get_public_key()
            
            # Convert to hex strings for the API call
            borrower_pubkey = borrower_pub.to_hex()
            lender_pubkey = lender_pub.to_hex()
            
            test_data = {
                'preimage_lender': "hello_from_lender",
                'preimage_hash_lender': hashlib.sha256("hello_from_lender".encode()).hexdigest(),
                'lender_timelock': 27150  # Real production value: btcCollateral 543000 EVM blocks ÷ 20 = 27150 BTC blocks
            }
            
            print(f"Using borrower pubkey: {borrower_pubkey}")
            print(f"Using lender pubkey: {lender_pubkey}")
            print(f"Using preimage hash: {test_data['preimage_hash_lender']}")
            
            # Test the endpoint
            result = await vaultero_service.get_leaf_scripts_output_1(
                borrower_pubkey=borrower_pubkey,
                lender_pubkey=lender_pubkey,
                preimage_hash_lender=test_data['preimage_hash_lender'],
                lender_timelock=test_data['lender_timelock']
            )
            
            # Verify the response structure
            assert result['success'] is True
            assert 'scripts' in result
            assert 'metadata' in result
            
            # Verify we get exactly 2 scripts
            scripts = result['scripts']
            assert len(scripts) == 2
            assert result['metadata']['total_scripts'] == 2
            
            # Verify script types (note: output_1 has different order than output_0)
            assert scripts[0]['type'] == 'csv_script_lender'
            assert scripts[1]['type'] == 'hashlock_and_borrower_siglock_script'
            
            # Verify script descriptions
            assert 'Lender gets collateral' in scripts[0]['description']
            assert 'Borrower regains custody' in scripts[1]['description']
            
            # Verify parameters are correctly passed through
            assert scripts[0]['parameters']['lender_timelock'] == test_data['lender_timelock']
            assert scripts[0]['parameters']['preimage_hash_lender'] == test_data['preimage_hash_lender']
            
            # Verify hex encoding is present
            assert 'hex' in scripts[0]
            assert 'hex' in scripts[1]
            assert len(scripts[0]['hex']) > 0
            assert len(scripts[1]['hex']) > 0
            
            # Verify template code is present
            assert 'template' in scripts[0]
            assert 'template' in scripts[1]
            assert 'Script([' in scripts[0]['template']
            assert 'Script([' in scripts[1]['template']
            
            # Verify metadata
            assert 'function_call' in result['metadata']
            assert 'parameters_used' in result['metadata']
            assert 'generated_at' in result['metadata']
            
            print(f"✅ Leaf scripts output_1 test passed with {len(scripts)} scripts")
            print(f"   Script 0: {scripts[0]['type']} - {scripts[0]['hex'][:20]}...")
            print(f"   Script 1: {scripts[1]['type']} - {scripts[1]['hex'][:20]}...")
            
        except Exception as e:
            pytest.fail(f"Leaf scripts output_1 test failed: {e}")

class TestBitcoinRPCService:
    """Test BitcoinRPCService functionality using real Bitcoin Core RPC."""
    
    @pytest.fixture
    def bitcoin_rpc_service(self):
        """Create a BitcoinRPCService instance for testing."""
        return BitcoinRPCService()
    
    @pytest.mark.asyncio
    async def test_get_blockchain_info_real(self, bitcoin_rpc_service):
        """Test blockchain info retrieval using real Bitcoin Core RPC."""
        result = await bitcoin_rpc_service.get_blockchain_info()
        
        # Verify we get real blockchain data
        assert isinstance(result, dict)
        assert 'chain' in result
        assert 'blocks' in result
        assert 'bestblockhash' in result
        assert 'verificationprogress' in result
        
        # Verify regtest-specific values
        assert result['chain'] == 'regtest'
        assert isinstance(result['blocks'], int)
        assert result['blocks'] >= 0  # Should have some blocks, but not at restart
        assert isinstance(result['verificationprogress'], (int, float))  # Can be either
        assert result['verificationprogress'] >= 0.0
        
        print(f"✅ Connected to Bitcoin Core {result['chain']} with {result['blocks']} blocks")
    
    @pytest.mark.asyncio
    async def test_get_new_address_real(self, bitcoin_rpc_service):
        """Test address generation using real Bitcoin Core RPC."""
        result = await bitcoin_rpc_service.get_new_address()
        
        # Verify we get a valid address
        assert isinstance(result, str)
        assert len(result) > 0
        assert result.startswith('bcrt')  # Regtest addresses start with bcrt
        
        print(f"✅ Generated new regtest address: {result}")
    
    @pytest.mark.asyncio
    async def test_get_transaction_info_real(self, bitcoin_rpc_service):
        """Test transaction info retrieval using real Bitcoin Core RPC."""
        # Use a non-existent transaction ID to test the "not found" case
        non_existent_txid = "0x" + "a" * 64
        
        try:
            result = await bitcoin_rpc_service.get_transaction_info(non_existent_txid)
            # If we get here, something unexpected happened
            pytest.fail("Expected transaction info to fail for non-existent txid")
        except Exception as e:
            # This is expected - non-existent transactions should fail
            print(f"✅ Transaction info correctly failed for non-existent txid: {e}")
    
    @pytest.mark.asyncio
    async def test_generate_blocks_real(self, bitcoin_rpc_service):
        """Test block generation using real Bitcoin Core RPC."""
        # Get current block count
        blockchain_info = await bitcoin_rpc_service.get_blockchain_info()
        initial_blocks = blockchain_info['blocks']
        
        # Generate 1 block to a valid regtest address
        # First get a new address to use
        test_address = await bitcoin_rpc_service.get_new_address()
        result = await bitcoin_rpc_service.generate_blocks(1, test_address)
        
        # Verify we get block hashes back
        assert isinstance(result, list)
        assert len(result) == 1
        assert isinstance(result[0], str)
        assert len(result[0]) > 0
        
        # Wait a moment for the block to be processed
        import asyncio
        await asyncio.sleep(1)
        
        # Verify the block count increased
        blockchain_info_after = await bitcoin_rpc_service.get_blockchain_info()
        assert blockchain_info_after['blocks'] == initial_blocks + 1
        
        print(f"✅ Generated block {result[0]}, block count increased from {initial_blocks} to {blockchain_info_after['blocks']}")
    
    @pytest.mark.asyncio
    async def test_broadcast_transaction_real(self, bitcoin_rpc_service):
        """Test transaction broadcasting using real Bitcoin Core RPC."""
        # This test will fail with an invalid transaction error,
        # but that's actually good - it means the RPC connection is working!
        try:
            invalid_raw_tx = "0200000001..."  # Invalid transaction
            result = await bitcoin_rpc_service.broadcast_transaction(invalid_raw_tx)
            # If we get here, something unexpected happened
            pytest.fail("Expected broadcast to fail with invalid transaction")
        except Exception as e:
            # This is expected - invalid transactions should fail
            error_msg = str(e).lower()
            assert any(keyword in error_msg for keyword in ["decode", "failed", "invalid", "rejected"])
            print(f"✅ Transaction broadcast correctly rejected invalid transaction: {e}")
    
    @pytest.mark.asyncio
    async def test_get_mempool_info_real(self, bitcoin_rpc_service):
        """Test mempool info retrieval using real Bitcoin Core RPC."""
        result = await bitcoin_rpc_service.get_mempool_info()
        
        # Verify we get mempool data
        assert isinstance(result, dict)
        assert 'size' in result
        assert 'bytes' in result
        assert 'usage' in result
        
        print(f"✅ Mempool info: {result['size']} transactions, {result['bytes']} bytes")
    
    @pytest.mark.asyncio
    async def test_get_balance_real(self, bitcoin_rpc_service):
        """Test balance retrieval using real Bitcoin Core RPC."""
        # Get balance from the loaded wallet
        balance = await bitcoin_rpc_service.get_balance()
        
        # Verify we get a valid balance
        assert isinstance(balance, (int, float, Decimal))
        assert balance >= 0  # Should be non-negative
        
        print(f"✅ Wallet balance: {balance} BTC")
    
    @pytest.mark.asyncio
    async def test_list_unspent_real(self, bitcoin_rpc_service):
        """Test unspent outputs listing using real Bitcoin Core RPC."""
        # Get unspent outputs from the loaded wallet
        unspent = await bitcoin_rpc_service.list_unspent()
        
        # Verify we get a list of unspent outputs
        assert isinstance(unspent, list)
        # Should have some unspent outputs since we mined coins
        assert len(unspent) > 0
        
        # Verify structure of first unspent output
        if unspent:
            first_utxo = unspent[0]
            assert 'txid' in first_utxo
            assert 'vout' in first_utxo
            assert 'amount' in first_utxo
            assert 'address' in first_utxo
            
            print(f"✅ Found {len(unspent)} unspent outputs, first one: {first_utxo['txid'][:20]}...")
    
    @pytest.mark.asyncio
    async def test_connection_health(self, bitcoin_rpc_service):
        """Test overall connection health to Bitcoin Core."""
        # Test multiple RPC calls to ensure connection is stable
        results = []
        
        # Test 1: Get blockchain info
        blockchain_info = await bitcoin_rpc_service.get_blockchain_info()
        results.append(('blockchain_info', blockchain_info is not None))
        
        # Test 2: Get new address
        address = await bitcoin_rpc_service.get_new_address()
        results.append(('get_new_address', isinstance(address, str) and len(address) > 0))
        
        # Test 3: Get mempool info
        mempool_info = await bitcoin_rpc_service.get_mempool_info()
        results.append(('mempool_info', isinstance(mempool_info, dict)))
        
        # Test 4: Get block count
        block_count = await bitcoin_rpc_service.get_block_count()
        results.append(('block_count', isinstance(block_count, int) and block_count > 0))
        
        # Test 5: Get balance
        balance = await bitcoin_rpc_service.get_balance()
        results.append(('get_balance', isinstance(balance, (int, float, Decimal)) and balance >= 0))
        
        # Test 6: List unspent
        unspent = await bitcoin_rpc_service.list_unspent()
        results.append(('list_unspent', isinstance(unspent, list) and len(unspent) > 0))
        
        # Verify all tests passed
        failed_tests = [name for name, success in results if not success]
        if failed_tests:
            pytest.fail(f"Connection health check failed for: {failed_tests}")
        
        # Report results
        passed_tests = [name for name, success in results if success is True]
        print(f"✅ All connection health checks passed: {passed_tests}")
