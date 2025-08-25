#!/usr/bin/env python3
"""
Startup script for BTC Yield Python API Service.
This script can be used to run the service in development or production.
"""

import sys
import os
import uvicorn
from pathlib import Path

# Add the app directory to Python path
app_dir = Path(__file__).parent / "app"
sys.path.insert(0, str(app_dir))

from app.config import settings, validate_settings

def main():
    """Main entry point for the Python API service"""
    try:
        # Validate configuration
        validate_settings()
        print("✅ Configuration validated successfully")
        
        # Print startup information
        print(f"🐍 Starting BTC Yield Python API Service")
        print(f"🌐 Host: {settings.host}:{settings.port}")
        print(f"₿ Bitcoin Network: {settings.bitcoin_network}")
        print(f"📁 Vaultero Path: {settings.vaultero_path}")
        print(f"🔐 Lender Configured: {'Yes' if settings.lender_pubkey else 'No'}")
        print(f"📊 Log Level: {settings.log_level}")
        
        # Run the server
        uvicorn.run(
            "app.main:app",
            host=settings.host,
            port=settings.port,
            reload=settings.reload,
            log_level=settings.log_level.lower(),
            access_log=True,
            loop="uvloop" if os.name != "nt" else "asyncio"  # Use uvloop on Unix
        )
        
    except Exception as e:
        print(f"❌ Failed to start service: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
