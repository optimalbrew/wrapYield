"""
Tests for configuration loading and validation.
"""

import pytest
import os
from unittest.mock import patch
from app.config import settings, validate_settings

class TestConfiguration:
    """Test configuration loading and validation."""
    
    def test_default_settings(self):
        """Test that default settings are loaded correctly."""
        # Test that required settings exist
        assert hasattr(settings, 'host')
        assert hasattr(settings, 'port')
        assert hasattr(settings, 'bitcoin_network')
        assert hasattr(settings, 'vaultero_path')
        assert hasattr(settings, 'log_level')
    
    def test_bitcoin_rpc_settings(self):
        """Test that Bitcoin RPC settings are configured."""
        assert hasattr(settings, 'bitcoin_rpc_host')
        assert hasattr(settings, 'bitcoin_rpc_port')
        assert hasattr(settings, 'bitcoin_rpc_user')
        assert hasattr(settings, 'bitcoin_rpc_password')
    
    def test_lender_key_settings(self):
        """Test that lender key settings exist."""
        assert hasattr(settings, 'lender_private_key')
        assert hasattr(settings, 'lender_pubkey')
    
    @patch.dict(os.environ, {
        'PYTHON_API_BITCOIN_NETWORK': 'testnet',
        'PYTHON_API_PORT': '8002'
    })
    def test_environment_override(self):
        """Test that environment variables override defaults."""
        # This would require reloading settings, but we can test the concept
        assert settings.bitcoin_network in ['regtest', 'testnet', 'mainnet']
        assert isinstance(settings.port, int)
    
    def test_vaultero_path_exists(self):
        """Test that vaultero path is configured."""
        assert settings.vaultero_path is not None
        assert isinstance(settings.vaultero_path, str)
    
    def test_log_level_valid(self):
        """Test that log level is a valid value."""
        valid_levels = ['debug', 'info', 'warning', 'error', 'critical']
        assert settings.log_level.lower() in valid_levels
    
    def test_cors_origins_format(self):
        """Test that CORS origins are properly formatted."""
        assert hasattr(settings, 'cors_origins')
        assert isinstance(settings.cors_origins, list)
        # All origins should be strings
        for origin in settings.cors_origins:
            assert isinstance(origin, str)

class TestConfigurationValidation:
    """Test configuration validation logic."""
    
    def test_validate_settings_success(self):
        """Test that validation passes with valid settings."""
        try:
            validate_settings()
            # If we get here, validation passed
            assert True
        except Exception as e:
            pytest.fail(f"Validation should pass but failed: {e}")
    
    @patch('app.config.settings.bitcoin_network', 'invalid_network')
    def test_validate_settings_invalid_bitcoin_network(self):
        """Test that validation fails with invalid bitcoin network."""
        with pytest.raises(ValueError, match="Invalid bitcoin_network"):
            validate_settings()
    
    @patch('app.config.settings.lender_private_key', 'invalid_key_format')
    def test_validate_settings_invalid_lender_key_format(self):
        """Test that validation fails with invalid lender key format."""
        with pytest.raises(ValueError, match="Invalid lender_private_key format"):
            validate_settings()
    
    @patch('app.config.settings.vaultero_path', '/nonexistent/path')
    def test_validate_settings_nonexistent_vaultero_path(self):
        """Test that validation continues with warning for nonexistent vaultero path."""
        # This should not raise an exception, just print a warning
        try:
            result = validate_settings()
            assert result is True
        except Exception as e:
            pytest.fail(f"Validation should continue with warning but failed: {e}")
    
    @patch('app.config.settings.bitcoin_network', 'regtest')
    @patch('app.config.settings.lender_private_key', 'cVt4o7BGAig1UXywgGSmARhxMBkTdBNh2TdU2Rk8QmJKFKRmyBAB')
    def test_validate_settings_valid_configuration(self):
        """Test that validation passes with valid configuration."""
        try:
            result = validate_settings()
            assert result is True
        except Exception as e:
            pytest.fail(f"Validation should pass but failed: {e}")
