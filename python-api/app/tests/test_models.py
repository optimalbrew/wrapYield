"""
Tests for Pydantic models used in the API.
"""

import pytest
from decimal import Decimal
from app.models import (
    CreateCollateralRequest,
    BroadcastTransactionRequest
)



class TestCreateCollateralRequest:
    """Test collateral request model validation."""
    
    def test_valid_collateral_request(self):
        """Test that a valid collateral request passes validation."""
        data = {
            "loan_id": "test-loan-123",
            "escrow_txid": "c" * 64,
            "escrow_vout": 0,
            "borrower_pubkey": "a" * 64,
            "lender_pubkey": "b" * 64,
            "preimage_hash_lender": "d" * 64,
            "lender_timelock": 144,
            "collateral_amount": "0.001",
            "origination_fee": "0.0001"
        }
        
        request = CreateCollateralRequest(**data)
        assert request.loan_id == "test-loan-123"
        assert request.escrow_txid == "c" * 64
        assert request.escrow_vout == 0
        assert request.borrower_pubkey == "a" * 64
        assert request.preimage_hash_lender == "d" * 64
        assert request.lender_timelock == 144
        assert request.collateral_amount == Decimal("0.001")
        assert request.origination_fee == Decimal("0.0001")
    
    def test_invalid_escrow_txid_length(self):
        """Test that invalid escrow txid length fails validation."""
        data = {
            "loan_id": "test-loan-123",
            "escrow_txid": "c" * 32,  # Too short
            "escrow_vout": 0,
            "borrower_pubkey": "a" * 64,
            "preimage_hash_lender": "d" * 64,
            "lender_timelock": 144,
            "collateral_amount": "0.001",
            "origination_fee": "0.0001"
        }
        
        with pytest.raises(ValueError):
            CreateCollateralRequest(**data)
    
    def test_negative_escrow_vout(self):
        """Test that negative escrow vout fails validation."""
        data = {
            "loan_id": "test-loan-123",
            "escrow_txid": "c" * 64,
            "escrow_vout": -1,  # Invalid
            "borrower_pubkey": "a" * 64,
            "preimage_hash_lender": "d" * 64,
            "lender_timelock": 144,
            "collateral_amount": "0.001",
            "origination_fee": "0.0001"
        }
        
        with pytest.raises(ValueError):
            CreateCollateralRequest(**data)
