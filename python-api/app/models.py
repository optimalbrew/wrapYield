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
    preimage_hash_lender: str = Field(..., min_length=64, max_length=64, description="SHA256 hash of lender's preimage")
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
    preimage_hash_lender: str = Field(..., min_length=64, max_length=64, description="SHA256 hash of lender's preimage")
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

# Signature Models
class SignTransactionRequest(BaseModel):
    loan_id: str = Field(..., description="UUID of the loan")
    raw_tx: str = Field(..., min_length=1, description="Raw transaction hex to sign")
    input_amount: Decimal = Field(..., gt=0, description="Input amount in BTC")
    signer_type: str = Field(..., pattern="^(lender)$", description="Must be 'lender' for this service")
    transaction_type: str = Field(..., pattern="^(escrow|collateral|refund|claim)$", description="Type of transaction being signed")
    
class SignatureResponse(BaseModel):
    signature: str = Field(..., description="Bitcoin signature hex")
    signature_hash_type: str = Field(default="SIGHASH_DEFAULT", description="Signature hash type")
    leaf_index: Optional[int] = Field(None, description="Taproot leaf index if using script path")
    tapleaf_script: Optional[str] = Field(None, description="Taproot script hex")
    control_block: Optional[str] = Field(None, description="Taproot control block hex")
    witness_context: Dict[str, Any] = Field(default_factory=dict, description="Additional witness data")

# Transaction Broadcasting
class BroadcastTransactionRequest(BaseModel):
    raw_tx: str = Field(..., min_length=1, description="Complete raw transaction hex")
    witness_data: Dict[str, Any] = Field(..., description="Witness data for transaction")

class BroadcastTransactionResponse(BaseModel):
    txid: str = Field(..., description="Broadcasted transaction ID")
    success: bool = Field(..., description="Whether broadcast was successful")
    confirmations: int = Field(default=0, description="Number of confirmations")

# Loan Management Models  
class LoanStatusRequest(BaseModel):
    loan_id: str = Field(..., description="UUID of the loan")
    
class LoanStatusResponse(BaseModel):
    loan_id: str
    status: str = Field(..., description="Current loan status")
    bitcoin_transactions: List[Dict[str, Any]] = Field(default_factory=list)
    pending_signatures: List[Dict[str, Any]] = Field(default_factory=list)
    next_action: Optional[str] = Field(None, description="Suggested next action")

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

# Error Models
class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    details: Optional[Dict[str, Any]] = None
    timestamp: str
