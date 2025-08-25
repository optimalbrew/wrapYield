from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    # Server configuration
    host: str = "0.0.0.0"
    port: int = 8001
    reload: bool = False
    log_level: str = "info"
    
    # Bitcoin network configuration
    bitcoin_network: str = "regtest"  # testnet, mainnet, regtest
    
    # BTC-Vaultero integration
    vaultero_path: str = "/app/btc-vaultero"  # Path to btc-vaultero package
    
    # Lender key management (for platform operator)
    # In production, these would be loaded from secure key management
    lender_private_key: Optional[str] = None  # WIF format or hex
    lender_pubkey: Optional[str] = None  # x-only pubkey hex
    
    # Bitcoin Core RPC settings for regtest
    bitcoin_rpc_host: str = "host.docker.internal"  # Access host from Docker container
    bitcoin_rpc_port: int = 18443  # regtest default port
    bitcoin_rpc_user: str = "bitcoin"  # Match Bitcoin Core container credentials
    bitcoin_rpc_password: str = "localtest"  # Match Bitcoin Core container credentials
    bitcoin_rpc_timeout: int = 30
    
    # External services (not needed for regtest, but kept for compatibility)
    mempool_api_url: str = "http://localhost:8080/api"  # Local mempool instance if any
    
    # Security
    api_key: Optional[str] = None  # For API authentication
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]
    
    # Timeouts and limits
    transaction_timeout: int = 30  # seconds
    max_concurrent_transactions: int = 10
    
    class Config:
        env_file = ".env"
        env_prefix = "PYTHON_API_"

# Global settings instance
settings = Settings()

# Validate critical settings
def validate_settings():
    """Validate that required settings are properly configured"""
    if settings.bitcoin_network not in ["testnet", "mainnet", "regtest"]:
        raise ValueError(f"Invalid bitcoin_network: {settings.bitcoin_network}")
    
    if settings.lender_private_key and len(settings.lender_private_key) not in [51, 52, 64]:
        raise ValueError("Invalid lender_private_key format")
    
    if not os.path.exists(settings.vaultero_path):
        print(f"Warning: btc-vaultero path does not exist: {settings.vaultero_path}")
    
    return True
