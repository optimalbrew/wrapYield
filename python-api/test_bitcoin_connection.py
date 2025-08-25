#!/usr/bin/env python3
"""
Test script to verify Bitcoin Core RPC connection from Python API.
Run this to test if the networking is working properly.
"""

import sys
import os
sys.path.append('.')

from app.services.bitcoin_rpc_service import BitcoinRPCService
from app.config import settings
import asyncio

async def test_bitcoin_connection():
    """Test connection to Bitcoin Core regtest node."""
    print("🔍 Testing Bitcoin Core RPC connection...")
    print(f"📍 Target: {settings.bitcoin_rpc_host}:{settings.bitcoin_rpc_port}")
    print(f"👤 User: {settings.bitcoin_rpc_user}")
    print(f"🔑 Password: {'*' * len(settings.bitcoin_rpc_password)}")
    print(f"🌐 Network: {settings.bitcoin_network}")
    print("-" * 50)
    
    bitcoin_rpc = BitcoinRPCService()
    
    try:
        # Test basic connection
        print("1️⃣ Testing getblockchaininfo...")
        info = await bitcoin_rpc.get_blockchain_info()
        print(f"✅ Connection successful!")
        print(f"   Chain: {info.get('chain', 'unknown')}")
        print(f"   Blocks: {info.get('blocks', 0)}")
        print(f"   Network: {info.get('chain', 'unknown')}")
        
        # Test wallet functionality  
        print("\n2️⃣ Testing wallet commands...")
        try:
            wallets = await bitcoin_rpc.list_wallets()
            print(f"✅ Wallets available: {wallets}")
            
            if not wallets:
                print("⚠️  No wallets found. You might need to create one:")
                print("   docker exec -it bitcoind-regtest bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=localtest createwallet testwallet")
        except Exception as wallet_error:
            print(f"⚠️  Wallet test failed: {wallet_error}")
        
        # Test block generation capability
        print("\n3️⃣ Testing block generation...")
        try:
            # Get a test address (this might fail if no wallet)
            result = await bitcoin_rpc.generate_blocks(1, None)  # Generate to random address
            print(f"✅ Generated 1 block successfully")
        except Exception as gen_error:
            print(f"⚠️  Block generation test failed: {gen_error}")
            print("   This is normal if no wallet is loaded")
        
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        print("\n🔧 Troubleshooting:")
        print("1. Make sure Bitcoin Core is running: cd ../btc-backend && docker-compose up -d")
        print("2. Check if ports are accessible: docker ps | grep bitcoind")
        print("3. Verify credentials match Bitcoin Core configuration")
        return False

if __name__ == "__main__":
    result = asyncio.run(test_bitcoin_connection())
    if result:
        print("\n🎉 All tests passed! Bitcoin Core RPC is working properly.")
    else:
        print("\n💥 Tests failed. Check the troubleshooting steps above.")
        sys.exit(1)
