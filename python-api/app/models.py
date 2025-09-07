from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any, List
from decimal import Decimal

class HealthResponse(BaseModel):
    status: str = "healthy"
    service: str = "btc-yield-python-api"
    version: str = "1.0.0"
    bitcoin_network: str
    vaultero_available: bool

class APIResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    message: Optional[str] = None

# Collateral Transaction Models  
class CreateCollateralRequest(BaseModel):
    loan_id: str = Field(..., description="UUID of the loan")
    escrow_txid: str = Field(..., min_length=64, max_length=64, description="Escrow transaction ID")
    escrow_vout: int = Field(default=0, ge=0, description="Escrow transaction output index")
    borrower_pubkey: str = Field(..., min_length=64, max_length=64, description="Borrower's x-only pubkey")
    lender_pubkey: str = Field(..., min_length=64, max_length=64, description="Lender's x-only pubkey")
    preimage_hash_borrower: str = Field(..., min_length=64, max_length=64, description="SHA256 hash of borrower's preimage")
    preimage_hash_lender: str = Field(..., min_length=64, max_length=64, description="SHA256 hash of lender's preimage")
    borrower_timelock: int = Field(..., gt=0, description="Borrower timelock in Bitcoin blocks")
    lender_timelock: int = Field(..., gt=0, description="Lender timelock in Bitcoin blocks")
    collateral_amount: Decimal = Field(..., gt=0, description="Collateral amount in BTC")
    origination_fee: Optional[Decimal] = Field(default=Decimal("0.001"), description="Origination fee in BTC")

class CollateralTransactionResponse(BaseModel):
    transaction_id: str
    raw_tx: str = Field(..., description="Raw transaction hex")
    collateral_address: str = Field(..., description="P2TR collateral address")
    fee: Optional[Decimal] = None
    script_details: Dict[str, Any] = Field(default_factory=dict)

# Separate Signature Models
class BorrowerSignatureRequest(BaseModel):
    """Request model for generating borrower signature"""
    loan_id: str = Field(..., description="UUID of the loan")
    escrow_txid: str = Field(..., min_length=64, max_length=64, description="Escrow transaction ID")
    escrow_vout: int = Field(default=0, ge=0, description="Escrow transaction output index")
    borrower_pubkey: str = Field(..., min_length=64, max_length=64, description="Borrower's x-only pubkey")
    lender_pubkey: str = Field(..., min_length=64, max_length=64, description="Lender's x-only pubkey")
    preimage_hash_borrower: str = Field(..., min_length=64, max_length=64, description="SHA256 hash of borrower's preimage")
    preimage_hash_lender: str = Field(..., min_length=64, max_length=64, description="SHA256 hash of lender's preimage")
    borrower_timelock: int = Field(..., gt=0, description="Borrower timelock in Bitcoin blocks")
    lender_timelock: int = Field(..., gt=0, description="Lender timelock in Bitcoin blocks")
    collateral_amount: str = Field(..., description="Collateral amount in BTC")
    origination_fee: Optional[str] = Field(default="0.001", description="Origination fee in BTC")
    borrower_private_key: str = Field(..., description="Borrower's private key in WIF format")

class LenderWitnessRequest(BaseModel):
    """Request model for completing lender witness"""
    signature_file_path: str = Field(..., description="Path to the JSON file containing borrower's signature")
    lender_private_key: str = Field(..., description="Lender's private key in WIF format")
    preimage: str = Field(..., description="The preimage that satisfies the hashlock")
    mine_block: bool = Field(default=True, description="Whether to mine a block after broadcasting")

# Borrower Exit Escrow Models
class BorrowerExitEscrowRequest(BaseModel):
    """Request model for borrower to exit escrow (spend escrow to exit without revealing preimage)"""
    loan_id: str = Field(..., description="UUID of the loan")
    escrow_txid: str = Field(..., min_length=64, max_length=64, description="Escrow transaction ID")
    escrow_vout: int = Field(default=0, ge=0, description="Escrow transaction output index")
    borrower_pubkey: str = Field(..., min_length=64, max_length=64, description="Borrower's x-only pubkey")
    lender_pubkey: str = Field(..., min_length=64, max_length=64, description="Lender's x-only pubkey")
    preimage_hash_borrower: str = Field(..., min_length=64, max_length=64, description="SHA256 hash of borrower's preimage")
    borrower_timelock: int = Field(..., gt=0, description="Borrower timelock in Bitcoin blocks")
    exit_address: str = Field(..., description="Address where borrower wants to receive the funds")
    exit_fee: Optional[str] = Field(default="0.001", description="Exit transaction fee in BTC")
    borrower_private_key: str = Field(..., description="Borrower's private key in WIF format")

class CollateralReleaseRequest(BaseModel):
    """Request model for releasing collateral to borrower (spend collateral using lender's preimage)"""
    loan_id: str = Field(..., description="UUID of the loan")
    collateral_txid: str = Field(..., min_length=64, max_length=64, description="Collateral transaction ID")
    collateral_vout: int = Field(default=0, ge=0, description="Collateral transaction output index")
    borrower_pubkey: str = Field(..., min_length=64, max_length=64, description="Borrower's x-only pubkey")
    lender_pubkey: str = Field(..., min_length=64, max_length=64, description="Lender's x-only pubkey")
    preimage_hash_lender: str = Field(..., min_length=64, max_length=64, description="SHA256 hash of lender's preimage")
    lender_timelock: int = Field(..., gt=0, description="Lender timelock in Bitcoin blocks")
    release_fee: Optional[str] = Field(default="0.001", description="Release transaction fee in BTC")
    borrower_private_key: str = Field(..., description="Borrower's private key in WIF format")
    lender_preimage: str = Field(..., description="Lender's preimage (revealed when accepting loan repayment)")

class CollateralCaptureRequest(BaseModel):
    """Request model for lender to capture collateral after timelock (spend collateral using CSV script path)"""
    loan_id: str = Field(..., description="UUID of the loan")
    collateral_txid: str = Field(..., min_length=64, max_length=64, description="Collateral transaction ID")
    collateral_vout: int = Field(default=0, ge=0, description="Collateral transaction output index")
    borrower_pubkey: str = Field(..., min_length=64, max_length=64, description="Borrower's x-only pubkey")
    lender_pubkey: str = Field(..., min_length=64, max_length=64, description="Lender's x-only pubkey")
    preimage_hash_lender: str = Field(..., min_length=64, max_length=64, description="SHA256 hash of lender's preimage")
    lender_timelock: int = Field(..., gt=0, description="Lender timelock in Bitcoin blocks")
    capture_fee: Optional[str] = Field(default="0.001", description="Capture transaction fee in BTC")
    lender_private_key: str = Field(..., description="Lender's private key in WIF format")





# Transaction Broadcasting
class BroadcastTransactionRequest(BaseModel):
    raw_tx: str = Field(..., min_length=1, description="Complete raw transaction hex")
    witness_data: Dict[str, Any] = Field(..., description="Witness data for transaction")

class BroadcastTransactionResponse(BaseModel):
    txid: str = Field(..., description="Broadcasted transaction ID")
    success: bool = Field(..., description="Whether broadcast was successful")
    confirmations: int = Field(default=0, description="Number of confirmations")



# Preimage Models
class GeneratePreimageResponse(BaseModel):
    preimage: str = Field(..., description="Generated preimage hex")
    preimage_hash: str = Field(..., description="SHA256 hash of preimage")

# Transaction Monitoring
class TransactionStatusRequest(BaseModel):
    txid: str = Field(..., min_length=64, max_length=64, description="Bitcoin transaction ID")

class TransactionStatusResponse(BaseModel):
    txid: str
    confirmed: bool
    confirmations: int
    block_height: Optional[int] = None
    fee: Optional[Decimal] = None
    status: str = Field(..., description="pending|confirmed|failed")

# Fund Address Models
class FundAddressRequest(BaseModel):
    """Request model for funding an address with BTC"""
    address: str = Field(..., description="Bitcoin address to fund")
    amount: float = Field(..., gt=0, description="Amount in BTC to send")
    label: Optional[str] = Field(default=None, description="Optional label for the address")

class FundAddressResponse(BaseModel):
    """Response model for fund address operation"""
    txid: str = Field(..., description="Transaction ID of the funding transaction")
    vout: int = Field(..., ge=0, description="Output index of the funding transaction")
    address: str = Field(..., description="Address that was funded")
    amount: float = Field(..., description="Amount sent in BTC")

# Error Models
class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    details: Optional[Dict[str, Any]] = None
    timestamp: str
