#!/usr/bin/env python3
"""
Quick test script to verify Python API service setup.
This script tests basic functionality without requiring full btc-vaultero integration.
"""

import asyncio
import json
import sys
from pathlib import Path

# Add app to path
app_dir = Path(__file__).parent / "app"
sys.path.insert(0, str(app_dir))

from app.services.vaultero_service import VaulteroService
from app.models import CreateEscrowRequest
from decimal import Decimal

async def test_basic_setup():
    """Test basic service setup and mock functionality"""
    print("🧪 Testing BTC Yield Python API Setup\n")
    
    # Initialize service
    print("1. Initializing VaulteroService...")
    service = VaulteroService()
    print("   ✅ Service initialized successfully")
    
    # Test preimage generation
    print("\n2. Testing preimage generation...")
    preimage, preimage_hash = await service.generate_preimage()
    print(f"   ✅ Generated preimage: {preimage[:16]}...")
    print(f"   ✅ Generated hash: {preimage_hash}")
    
    # Test mock escrow transaction creation
    print("\n3. Testing mock escrow transaction creation...")
    escrow_request = CreateEscrowRequest(
        loan_id="test-loan-123",
        borrower_pubkey="a" * 64,  # Mock pubkey
        preimage_hash_borrower="b" * 64,  # Mock hash
        borrower_timelock=144,  # ~24 hours
        amount=Decimal("0.001"),
        origination_fee=Decimal("0.0001")
    )
    
    escrow_result = await service.create_escrow_transaction(escrow_request)
    print(f"   ✅ Escrow transaction created")
    print(f"   ✅ Transaction ID: {escrow_result.transaction_id}")
    print(f"   ✅ Escrow address: {escrow_result.escrow_address}")
    print(f"   ✅ Raw TX length: {len(escrow_result.raw_tx)} chars")
    
    # Test transaction status checking
    print("\n4. Testing transaction status checking...")
    mock_txid = "a" * 64
    status_result = await service.get_transaction_status(mock_txid)
    print(f"   ✅ Status check completed: {status_result['status']}")
    
    print("\n✅ All basic tests passed!")
    print("\n📋 Next steps:")
    print("   1. Replace mock implementations with real btc-vaultero calls")
    print("   2. Configure lender private keys for signing")
    print("   3. Test with Node.js service integration")
    print("   4. Test complete signature workflow")

async def test_configuration():
    """Test configuration loading"""
    print("\n🔧 Testing Configuration...")
    
    from app.config import settings
    
    print(f"   Bitcoin Network: {settings.bitcoin_network}")
    print(f"   Service Port: {settings.port}")
    print(f"   Vaultero Path: {settings.vaultero_path}")
    print(f"   Lender Configured: {'Yes' if settings.lender_pubkey else 'No'}")
    print(f"   Log Level: {settings.log_level}")
    
    if settings.lender_private_key:
        print("   ⚠️  Lender private key is configured (ensure this is secure!)")
    else:
        print("   ℹ️  No lender private key configured (needed for actual operations)")

def main():
    """Main test function"""
    try:
        # Test configuration first
        asyncio.run(test_configuration())
        
        # Test basic service functionality
        asyncio.run(test_basic_setup())
        
        print(f"\n🎉 Python API service is ready!")
        print(f"💡 To start the service: python start.py")
        print(f"💡 To test with HTTP: curl http://localhost:8001/health")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
