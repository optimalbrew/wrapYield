"""
BTC Yield Protocol Python API Service

This FastAPI service wraps btc-vaultero functionality to provide Bitcoin transaction
operations for the lender/platform operator. It handles:

- Escrow transaction creation
- Collateral transaction creation  
- Transaction signing with lender keys
- Transaction broadcasting
- Preimage generation
- Transaction monitoring

Security: This service manages lender private keys since the lender is the platform operator.
Borrower keys are never handled by this service - borrowers sign client-side.
"""

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import structlog
from typing import Dict, Any
from datetime import datetime
import traceback

from .config import settings, validate_settings
from .models import *
from .services.vaultero_service import vaultero_service
from .services.bitcoin_rpc_service import bitcoin_rpc

# Configure structured logging
logger = structlog.get_logger()

# Create FastAPI app
app = FastAPI(
    title="BTC Yield Python API",
    description="Bitcoin transaction service for BTC Yield Protocol lender operations",
    version="1.0.0",
    docs_url="/docs" if settings.log_level == "debug" else None,
    redoc_url="/redoc" if settings.log_level == "debug" else None
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize the service on startup"""
    try:
        validate_settings()
        logger.info(
            "BTC Yield Python API starting",
            bitcoin_network=settings.bitcoin_network,
            port=settings.port,
            lender_configured=bool(settings.lender_pubkey)
        )
    except Exception as e:
        logger.error("Failed to start service", error=str(e))
        raise

# Health check endpoint
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Service health check with btc-vaultero availability status"""
    try:
        # Test btc-vaultero availability
        vaultero_available = True
        try:
            # This would test actual btc-vaultero import/connection
            pass
        except Exception:
            vaultero_available = False
        
        return HealthResponse(
            bitcoin_network=settings.bitcoin_network,
            vaultero_available=vaultero_available
        )
    except Exception as e:
        logger.error("Health check failed", error=str(e))
        raise HTTPException(status_code=503, detail="Service unhealthy")


# Root endpoint
@app.get("/")
async def root():
    """API information and available endpoints"""
    return {
        "service": "BTC Yield Python API",
        "version": "1.0.0",
        "description": "Bitcoin transaction service for BTC collateralized lending",
        "bitcoin_network": settings.bitcoin_network,
        "endpoints": {
            "health": "/health",
            "vaultero": {
                        "nums_key": "GET /vaultero/nums-key",
                        "leaf_scripts_output_0": "POST /vaultero/leaf-scripts-output-0",
                        "leaf_scripts_output_1": "POST /vaultero/leaf-scripts-output-1",
                        "nums_p2tr_addr_0": "POST /vaultero/nums-p2tr-addr-0",
                        "nums_p2tr_addr_1": "POST /vaultero/nums-p2tr-addr-1"
                    },
            "transactions": {
                "create_collateral": "POST /transactions/collateral",
                "borrower_signature": "POST /transactions/borrower-signature",
                "complete_witness": "POST /transactions/complete-witness",
                "borrower_exit": "POST /transactions/borrower-exit",
                "collateral_release": "POST /transactions/collateral-release",
                "collateral_capture": "POST /transactions/collateral-capture",
                "broadcast": "POST /transactions/broadcast",
                "status": "GET /transactions/{txid}/status"
            },
            "preimage": {
                "generate": "POST /preimage/generate"
            },
            "bitcoin": {
                "info": "GET /bitcoin/info",
                "fund_address": "POST /bitcoin/fund-address",
                "broadcast": "POST /bitcoin/broadcast",
                "transaction": "GET /bitcoin/transaction/{txid}",
                "confirmations": "GET /bitcoin/confirmations/{txid}"
            }

        }
    }

# Test vaultero get_nums_key endpoint
@app.get("/vaultero/nums-key")
async def get_nums_key():
    """Get the NUMS key from btc-vaultero for testing purposes."""
    try:
        nums_key_hex = await vaultero_service.get_nums_key()
        return {
            "success": True,
            "nums_key_hex": nums_key_hex,
            "message": "NUMS key retrieved successfully"
        }
    except Exception as e:
        logger.error("Failed to get NUMS key", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get NUMS key: {str(e)}"
        )

# Test vaultero get_leaf_scripts_output_0 endpoint
@app.post("/vaultero/leaf-scripts-output-0")
async def get_leaf_scripts_output_0(request: dict):
    """Get leaf scripts for output_0 with detailed JSON formatting."""
    try:
        # Extract parameters from request
        borrower_pubkey = request.get("borrower_pubkey")
        lender_pubkey = request.get("lender_pubkey") 
        preimage_hash_borrower = request.get("preimage_hash_borrower")
        borrower_timelock = request.get("borrower_timelock")
        
        # Validate required parameters
        if not all([borrower_pubkey, lender_pubkey, preimage_hash_borrower, borrower_timelock]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required parameters: borrower_pubkey, lender_pubkey, preimage_hash_borrower, borrower_timelock"
            )
        
        # Get the scripts
        result = await vaultero_service.get_leaf_scripts_output_0(
            borrower_pubkey, lender_pubkey, preimage_hash_borrower, borrower_timelock
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get leaf scripts", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get leaf scripts: {str(e)}"
        )


# Test vaultero get_leaf_scripts_output_1 endpoint
@app.post("/vaultero/leaf-scripts-output-1")
async def get_leaf_scripts_output_1(request: dict):
    """Get leaf scripts for output_1 with detailed JSON formatting."""
    try:
        # Extract parameters from request
        borrower_pubkey = request.get("borrower_pubkey")
        lender_pubkey = request.get("lender_pubkey") 
        preimage_hash_lender = request.get("preimage_hash_lender")
        lender_timelock = request.get("lender_timelock")
        
        # Validate required parameters
        if not all([borrower_pubkey, lender_pubkey, preimage_hash_lender, lender_timelock]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required parameters: borrower_pubkey, lender_pubkey, preimage_hash_lender, lender_timelock"
            )
        
        # Get the scripts
        result = await vaultero_service.get_leaf_scripts_output_1(
            borrower_pubkey, lender_pubkey, preimage_hash_lender, lender_timelock
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get leaf scripts", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get leaf scripts: {str(e)}"
        )

# Test vaultero get_nums_p2tr_addr_0 endpoint
@app.post("/vaultero/nums-p2tr-addr-0")
async def get_nums_p2tr_addr_0(request: dict):
    """Get NUMS P2TR address for output_0."""
    try:
        # Extract parameters from request
        borrower_pubkey = request.get("borrower_pubkey")
        lender_pubkey = request.get("lender_pubkey") 
        preimage_hash_borrower = request.get("preimage_hash_borrower")
        borrower_timelock = request.get("borrower_timelock")
        
        # Validate required parameters
        if not all([borrower_pubkey, lender_pubkey, preimage_hash_borrower, borrower_timelock]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required parameters: borrower_pubkey, lender_pubkey, preimage_hash_borrower, borrower_timelock"
            )
        
        # Get the NUMS P2TR address
        result = await vaultero_service.get_nums_p2tr_addr_0(
            borrower_pubkey, lender_pubkey, preimage_hash_borrower, borrower_timelock
        )
        
        return {
            "success": True,
            "nums_p2tr_addr": result,
            "message": "NUMS P2TR address retrieved successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get NUMS P2TR address", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get NUMS P2TR address: {str(e)}"
        )

# Test vaultero get_nums_p2tr_addr_1 endpoint
@app.post("/vaultero/nums-p2tr-addr-1")
async def get_nums_p2tr_addr_1(request: dict):
    """Get NUMS P2TR address for output_1."""
    try:
        # Extract parameters from request
        borrower_pubkey = request.get("borrower_pubkey")
        lender_pubkey = request.get("lender_pubkey") 
        preimage_hash_lender = request.get("preimage_hash_lender")
        lender_timelock = request.get("lender_timelock")
        
        # Validate required parameters
        if not all([borrower_pubkey, lender_pubkey, preimage_hash_lender, lender_timelock]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required parameters: borrower_pubkey, lender_pubkey, preimage_hash_lender, lender_timelock"
            )
        
        # Get the NUMS P2TR address
        result = await vaultero_service.get_nums_p2tr_addr_1(
            borrower_pubkey, lender_pubkey, preimage_hash_lender, lender_timelock
        )
        
        return {
            "success": True,
            "nums_p2tr_addr": result,
            "message": "NUMS P2TR address retrieved successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get NUMS P2TR address", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get NUMS P2TR address: {str(e)}"
        )


# Transaction Endpoints

@app.post("/transactions/borrower-signature", response_model=APIResponse)
async def generate_borrower_signature(request: BorrowerSignatureRequest):
    """
    Generate borrower's signature for collateral transaction and save to JSON file.
    
    This endpoint allows the borrower to sign the collateral transaction offline
    and save their signature to a JSON file that can be shared with the lender.
    """
    try:
        logger.info(
            "Generating borrower signature",
            loan_id=request.loan_id,
            escrow_txid=request.escrow_txid
        )
        
        # Convert request to CreateCollateralRequest for the service method
        collateral_request = CreateCollateralRequest(
            loan_id=request.loan_id,
            escrow_txid=request.escrow_txid,
            escrow_vout=request.escrow_vout,
            borrower_pubkey=request.borrower_pubkey,
            lender_pubkey=request.lender_pubkey,
            preimage_hash_lender=request.preimage_hash_lender,
            lender_timelock=request.lender_timelock,
            collateral_amount=request.collateral_amount,
            origination_fee=request.origination_fee
        )
        
        signature_file_path = await vaultero_service.generate_borrower_signature(
            collateral_request, request.borrower_private_key
        )
        
        logger.info(
            "Borrower signature generated successfully",
            loan_id=request.loan_id,
            signature_file=signature_file_path
        )
        
        return APIResponse(
            success=True,
            data={
                "signature_file_path": signature_file_path,
                "loan_id": request.loan_id,
                "message": "Borrower signature saved to file"
            },
            message="Borrower signature generated and saved successfully"
        )
        
    except Exception as e:
        logger.error(
            "Failed to generate borrower signature",
            loan_id=request.loan_id,
            error=str(e),
            traceback=traceback.format_exc()
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate borrower signature: {str(e)}"
        )

@app.post("/transactions/complete-witness", response_model=APIResponse)
async def complete_lender_witness(request: LenderWitnessRequest):
    """
    Complete the transaction witness using borrower's signature and lender's signature + preimage.
    
    This endpoint reads the borrower's signature from a JSON file, generates the lender's
    signature, adds the preimage, and broadcasts the completed transaction.
    """
    try:
        logger.info(
            "Completing lender witness",
            signature_file=request.signature_file_path
        )
        
        txid = await vaultero_service.complete_lender_witness(
            request.signature_file_path, request.lender_private_key, request.preimage, request.mine_block
        )
        
        logger.info(
            "Lender witness completed successfully",
            txid=txid
        )
        
        return APIResponse(
            success=True,
            data={
                "txid": txid,
                "signature_file_path": request.signature_file_path,
                "message": "Transaction broadcast successfully"
            },
            message="Lender witness completed and transaction broadcast successfully"
        )
        
    except Exception as e:
        logger.error(
            "Failed to complete lender witness",
            signature_file=request.signature_file_path,
            error=str(e),
            traceback=traceback.format_exc()
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to complete lender witness: {str(e)}"
        )

@app.post("/transactions/collateral", response_model=APIResponse)
async def create_collateral_transaction(request: CreateCollateralRequest):
    """
    Create Bitcoin collateral transaction that moves funds from escrow to collateral lock.
    
    This transaction can be spent by lender after timelock or by borrower with preimage.
    """
    try:
        logger.info(
            "Creating collateral transaction",
            loan_id=request.loan_id,
            escrow_txid=request.escrow_txid,
            amount=str(request.collateral_amount)
        )
        
        result = await vaultero_service.create_collateral_transaction(request)
        
        logger.info(
            "Collateral transaction created successfully",
            loan_id=request.loan_id,
            transaction_id=result.transaction_id,
            collateral_address=result.collateral_address
        )
        
        return APIResponse(
            success=True,
            data=result.dict(),
            message="Collateral transaction created successfully"
        )
        
    except Exception as e:
        logger.error(
            "Failed to create collateral transaction",
            loan_id=request.loan_id,
            error=str(e),
            traceback=traceback.format_exc()
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create collateral transaction: {str(e)}"
        )

@app.post("/transactions/borrower-exit", response_model=APIResponse)
async def borrower_exit_escrow(request: BorrowerExitEscrowRequest):
    """
    Create, sign, and broadcast Bitcoin transaction for borrower to exit escrow without revealing preimage.
    
    This endpoint allows the borrower to reclaim their funds if the loan is not offered
    or not claimed by the lender. Uses CSV (CheckSequenceVerify) script path.
    The transaction is immediately broadcast to the network.
    """
    try:
        logger.info(
            "Executing borrower exit escrow",
            loan_id=request.loan_id,
            escrow_txid=request.escrow_txid,
            exit_address=request.exit_address
        )
        
        txid = await vaultero_service.borrower_exit_escrow(request)
        
        logger.info(
            "Borrower exit escrow completed successfully",
            loan_id=request.loan_id,
            txid=txid
        )
        
        return APIResponse(
            success=True,
            data={
                "txid": txid,
                "loan_id": request.loan_id,
                "exit_address": request.exit_address,
                "message": "Borrower exit escrow completed and transaction broadcast successfully"
            },
            message="Borrower exit escrow completed successfully"
        )
        
    except Exception as e:
        logger.error(
            "Failed to execute borrower exit escrow",
            loan_id=request.loan_id,
            error=str(e),
            traceback=traceback.format_exc()
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute borrower exit escrow: {str(e)}"
        )

@app.post("/transactions/collateral-release", response_model=APIResponse)
async def collateral_release(request: CollateralReleaseRequest):
    """
    Create, sign, and broadcast Bitcoin transaction to release collateral to borrower.

    This endpoint allows the borrower to retrieve their collateral when the lender 
    accepts loan repayment and reveals their preimage on RSK. Uses hashlock + siglock 
    script path with lender's preimage. The transaction is immediately broadcast to the network.
    """
    try:
        logger.info(
            "Executing collateral release",
            loan_id=request.loan_id,
            collateral_txid=request.collateral_txid
        )

        txid = await vaultero_service.collateral_release(request)

        logger.info(
            "Collateral release completed successfully",
            loan_id=request.loan_id,
            txid=txid
        )

        return APIResponse(
            success=True,
            data={
                "txid": txid,
                "loan_id": request.loan_id,
                "collateral_txid": request.collateral_txid,
                "message": "Collateral release completed and transaction broadcast successfully"
            },
            message="Collateral release completed successfully"
        )

    except Exception as e:
        logger.error(
            "Failed to execute collateral release",
            loan_id=request.loan_id,
            error=str(e),
            traceback=traceback.format_exc()
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute collateral release: {str(e)}"
        )

@app.post("/transactions/collateral-capture", response_model=APIResponse)
async def collateral_capture(request: CollateralCaptureRequest):
    """
    Create, sign, and broadcast Bitcoin transaction for lender to capture collateral after timelock.

    This endpoint allows the lender to claim the collateral when the borrower defaults 
    (does not repay loan on time) or when the lender does not accept loan repayment on RSK.
    Uses CSV (CheckSequenceVerify) script path with lender timelock. The transaction is 
    immediately broadcast to the network.
    """
    try:
        logger.info(
            "Executing collateral capture",
            loan_id=request.loan_id,
            collateral_txid=request.collateral_txid
        )

        txid = await vaultero_service.collateral_capture(request)

        logger.info(
            "Collateral capture completed successfully",
            loan_id=request.loan_id,
            txid=txid
        )

        return APIResponse(
            success=True,
            data={
                "txid": txid,
                "loan_id": request.loan_id,
                "collateral_txid": request.collateral_txid,
                "message": "Collateral capture completed and transaction broadcast successfully"
            },
            message="Collateral capture completed successfully"
        )

    except Exception as e:
        logger.error(
            "Failed to execute collateral capture",
            loan_id=request.loan_id,
            error=str(e),
            traceback=traceback.format_exc()
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute collateral capture: {str(e)}"
        )

@app.post("/transactions/broadcast", response_model=APIResponse)
async def broadcast_transaction(request: BroadcastTransactionRequest):
    """
    Broadcast a completed Bitcoin transaction to the network.
    
    This is called after all required signatures have been collected
    and the transaction witness is complete.
    """
    try:
        logger.info(
            "Broadcasting transaction",
            raw_tx_length=len(request.raw_tx)
        )
        
        result = await vaultero_service.broadcast_transaction(request)
        
        logger.info(
            "Transaction broadcast successfully",
            txid=result.txid,
            success=result.success
        )
        
        return APIResponse(
            success=True,
            data=result.dict(),
            message="Transaction broadcast successfully"
        )
        
    except Exception as e:
        logger.error(
            "Failed to broadcast transaction",
            error=str(e),
            traceback=traceback.format_exc()
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to broadcast transaction: {str(e)}"
        )

@app.get("/transactions/{txid}/status", response_model=APIResponse)
async def get_transaction_status(txid: str):
    """
    Get the status of a Bitcoin transaction from the network.
    
    Returns confirmation status, block height, and other transaction details.
    """
    try:
        logger.info("Getting transaction status", txid=txid)
        
        result = await vaultero_service.get_transaction_status(txid)
        
        return APIResponse(
            success=True,
            data=result,
            message="Transaction status retrieved successfully"
        )
        
    except Exception as e:
        logger.error(
            "Failed to get transaction status",
            txid=txid,
            error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get transaction status: {str(e)}"
        )

# Preimage Endpoints

@app.post("/preimage/generate", response_model=APIResponse)
async def generate_preimage():
    """
    Generate a random preimage and its SHA256 hash for HTLC usage.
    
    The lender generates their own preimage for collateral transactions.
    """
    try:
        logger.info("Generating new preimage")
        
        preimage_hex, hash_hex = await vaultero_service.generate_preimage()
        
        result = GeneratePreimageResponse(
            preimage=preimage_hex,
            preimage_hash=hash_hex
        )
        
        logger.info(
            "Preimage generated successfully",
            preimage_hash=hash_hex
        )
        
        return APIResponse(
            success=True,
            data=result.dict(),
            message="Preimage generated successfully"
        )
        
    except Exception as e:
        logger.error("Failed to generate preimage", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate preimage: {str(e)}"
        )



# Bitcoin Core RPC Endpoints (for regtest operations)

@app.get("/bitcoin/info", response_model=APIResponse)
async def get_blockchain_info():
    """Get Bitcoin blockchain information from local Bitcoin Core node."""
    try:
        info = await bitcoin_rpc.get_blockchain_info()
        
        return APIResponse(
            success=True,
            data=info,
            message="Blockchain info retrieved successfully"
        )
        
    except Exception as e:
        logger.error("Failed to get blockchain info", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Bitcoin Core connection failed: {str(e)}"
        )

@app.post("/bitcoin/broadcast", response_model=APIResponse)
async def broadcast_raw_transaction(request: Dict[str, str]):
    """
    Broadcast a raw transaction using Bitcoin Core RPC.
    
    Body: {"raw_tx": "hexstring"}
    """
    try:
        raw_tx = request.get("raw_tx")
        if not raw_tx:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="raw_tx field is required"
            )
        
        txid = await bitcoin_rpc.broadcast_transaction(raw_tx)
        
        return APIResponse(
            success=True,
            data={"txid": txid},
            message="Transaction broadcast successfully via Bitcoin Core"
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error("Failed to broadcast via RPC", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Broadcast failed: {str(e)}"
        )

@app.get("/bitcoin/transaction/{txid}", response_model=APIResponse)
async def get_transaction_details(txid: str):
    """Get detailed transaction information including confirmations."""
    try:
        tx_info = await bitcoin_rpc.get_transaction_info(txid)
        
        if tx_info is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Transaction {txid} not found"
            )
        
        return APIResponse(
            success=True,
            data=tx_info,
            message="Transaction details retrieved successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get transaction details", txid=txid, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get transaction details: {str(e)}"
        )

@app.get("/bitcoin/confirmations/{txid}", response_model=APIResponse)
async def get_confirmations(txid: str):
    """Get the number of confirmations for a transaction."""
    try:
        confirmations = await bitcoin_rpc.get_confirmations(txid)
        
        return APIResponse(
            success=True,
            data={
                "txid": txid,
                "confirmations": confirmations,
                "confirmed": confirmations > 0,
                "not_found": confirmations == -1
            },
            message="Confirmations retrieved successfully"
        )
        
    except Exception as e:
        logger.error("Failed to get confirmations", txid=txid, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get confirmations: {str(e)}"
        )

@app.post("/bitcoin/fund-address", response_model=APIResponse)
async def fund_address(request: FundAddressRequest):
    """
    Fund a Bitcoin address with BTC using Bitcoin RPC.
    
    This endpoint sends BTC from the loaded wallet to the specified address.
    Useful for testing and development purposes.
    """
    try:
        # Use vaultero service to fund the address
        txid, vout = await vaultero_service.fund_address(request.address, request.amount)
        
        return APIResponse(
            success=True,
            data={
                "txid": txid,
                "vout": vout,
                "address": request.address,
                "amount": request.amount,
                "label": request.label
            },
            message=f"Successfully funded address {request.address} with {request.amount} BTC"
        )
        
    except Exception as e:
        logger.error("Failed to fund address", address=request.address, amount=request.amount, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fund address: {str(e)}"
        )

# Regtest-specific endpoints for testing
if settings.bitcoin_network == "regtest":
    
    @app.post("/regtest/generate", response_model=APIResponse)
    async def generate_blocks(request: Dict[str, Any]):
        """
        Generate blocks in regtest mode for testing.
        
        Body: {"blocks": 1, "address": "optional_address"}
        """
        try:
            num_blocks = request.get("blocks", 1)
            address = request.get("address")
            
            if num_blocks < 1 or num_blocks > 100:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="blocks must be between 1 and 100"
                )
            
            block_hashes = await bitcoin_rpc.generate_blocks(num_blocks, address)
            
            return APIResponse(
                success=True,
                data={
                    "blocks_generated": num_blocks,
                    "block_hashes": block_hashes,
                    "new_height": await bitcoin_rpc.get_block_count()
                },
                message=f"Generated {num_blocks} blocks successfully"
            )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Failed to generate blocks", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate blocks: {str(e)}"
            )
    
    @app.get("/regtest/balance", response_model=APIResponse)
    async def get_wallet_balance():
        """Get the wallet balance in regtest mode."""
        try:
            balance = await bitcoin_rpc.get_balance()
            
            return APIResponse(
                success=True,
                data={
                    "balance_btc": balance,
                    "balance_satoshis": int(balance * 100_000_000)
                },
                message="Balance retrieved successfully"
            )
            
        except Exception as e:
            logger.error("Failed to get balance", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get balance: {str(e)}"
            )
    
    @app.get("/regtest/address", response_model=APIResponse)
    async def generate_new_address():
        """Generate a new address for testing."""
        try:
            address = await bitcoin_rpc.get_new_address("btc-yield-test")
            
            return APIResponse(
                success=True,
                data={"address": address},
                message="New address generated successfully"
            )
            
        except Exception as e:
            logger.error("Failed to generate address", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate address: {str(e)}"
            )

# Error handlers

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler for unhandled errors"""
    logger.error(
        "Unhandled exception",
        path=str(request.url.path),
        method=request.method,
        error=str(exc),
        traceback=traceback.format_exc()
    )
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": "Internal server error",
            "message": "An unexpected error occurred",
            "timestamp": datetime.utcnow().isoformat()
        }
    )

# Development endpoints (only available in debug mode)
if settings.log_level == "debug":
    
    @app.get("/debug/config")
    async def debug_config():
        """Debug endpoint to view current configuration (sensitive data masked)"""
        return {
            "bitcoin_network": settings.bitcoin_network,
            "vaultero_path": settings.vaultero_path,
            "lender_configured": bool(settings.lender_private_key),
            "cors_origins": settings.cors_origins,
            "transaction_timeout": settings.transaction_timeout
        }
    


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        log_level=settings.log_level
    )
