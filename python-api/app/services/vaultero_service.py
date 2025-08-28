"""
Service layer that wraps btc-vaultero functionality for the Python API.
This service handles all Bitcoin transaction operations for the lender/platform operator.
"""

import sys
from pathlib import Path
import hashlib
import secrets
from typing import Dict, Any, Optional, Tuple
from decimal import Decimal
from datetime import datetime, timezone

# Add btc-vaultero to Python path: volume mapped into the container from btc-vaultero src dir at runtime
btc_vaultero_path = Path("/app/btc-vaultero/src")
if str(btc_vaultero_path) not in sys.path:
    sys.path.insert(0, str(btc_vaultero_path))

try:
    # Import btc-vaultero components
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
    VAULTERO_AVAILABLE = True
except ImportError as e:
    print(f"Warning: btc-vaultero imports failed: {e}")
    print("This service will use mock implementations for development")
    VAULTERO_AVAILABLE = False

from ..config import settings
from ..models import (
    CreateEscrowRequest, EscrowTransactionResponse,
    CreateCollateralRequest, CollateralTransactionResponse,
    SignTransactionRequest, SignatureResponse,
    BroadcastTransactionRequest, BroadcastTransactionResponse
)

# Import Bitcoin RPC service for blockchain operations
# NOTE: Importing here causes circular import, so we'll import inside methods
# from .bitcoin_rpc_service import bitcoin_rpc

class VaulteroService:
    """
    Service class that wraps btc-vaultero functionality for lender operations.
    This service handles Bitcoin transaction creation, signing, and broadcasting.
    """
    
    def __init__(self):
        self.bitcoin_network = settings.bitcoin_network
        self.lender_private_key = settings.lender_private_key
        self.lender_pubkey = settings.lender_pubkey
        
        # Check if vaultero is available
        self.vaultero_available = VAULTERO_AVAILABLE
        
        # Initialize Bitcoin network settings
        if self.bitcoin_network == "mainnet":
            # Configure for mainnet
            pass
        elif self.bitcoin_network == "testnet":
            # Configure for testnet  
            pass
        else:   #regtest
            # Configure for regtest
            pass
    
    def is_vaultero_available(self) -> bool:
        """Check if vaultero library is available for use."""
        return self.vaultero_available
    
    def _check_vaultero_availability(self):
        """Raise an exception if vaultero is not available."""
        if not self.vaultero_available:
            raise ImportError("btc-vaultero library is not available. Please check the installation.")
    
    async def get_nums_key(self) -> str:
        """Get the nums key from btc-vaultero."""
        return get_nums_key().to_hex()
    
    async def get_leaf_scripts_output_0(self, borrower_pubkey: str, lender_pubkey: str, preimage_hash_borrower: str, borrower_timelock: int) -> dict:
        """
        Get leaf scripts for output_0 with detailed JSON formatting.
        
        Returns a structured response showing script construction, parameters, and hex encoding.
        """
        try:
            # Check if vaultero is available
            self._check_vaultero_availability()
            
            # Convert string pubkeys to PublicKey objects
            from bitcoinutils.keys import PublicKey
            borrower_pub = PublicKey(borrower_pubkey)
            lender_pub = PublicKey(lender_pubkey)
            
            # Get the scripts from vaultero
            scripts = get_leaf_scripts_output_0(borrower_pub, lender_pub, preimage_hash_borrower, borrower_timelock)
            
            # Format the response
            formatted_scripts = []
            for i, script in enumerate(scripts):
                script_data = {
                    "index": i,
                    "type": "csv_script_borrower" if i == 0 else "hashlock_and_multisig_script",
                    "description": "Borrower escape hatch with relative timelock" if i == 0 else "Lender spending path with preimage hash and 2-of-2 multisig",
                    "raw_script": script.script,
                    "parameters": {
                        "borrower_timelock": borrower_timelock,
                        "borrower_pubkey_x_only": borrower_pub.to_x_only_hex(),
                        "lender_pubkey_x_only": lender_pub.to_x_only_hex(),
                        "preimage_hash_borrower": preimage_hash_borrower
                    },
                    "hex": script.to_hex(),
                    "bytes_length": len(script.to_bytes()),
                    "op_count": len(script.script)
                }
                
                # Add template code based on script type
                if i == 0:
                    script_data["template"] = "Script([seq.for_script(), 'OP_CHECKSEQUENCEVERIFY', 'OP_DROP', borrower_pub.to_x_only_hex(), 'OP_CHECKSIG'])"
                else:
                    script_data["template"] = "Script(['OP_SHA256', preimage_hash_borrower, 'OP_EQUALVERIFY', lender_pub.to_x_only_hex(), 'OP_CHECKSIG', borrower_pub.to_x_only_hex(), 'OP_CHECKSIGADD', 'OP_2', 'OP_NUMEQUALVERIFY', 'OP_TRUE'])"
                
                formatted_scripts.append(script_data)
            
            return {
                "success": True,
                "scripts": formatted_scripts,
                "metadata": {
                    "total_scripts": len(scripts),
                    "script_types": ["csv_script_borrower", "hashlock_and_multisig_script"],
                    "function_call": f"get_leaf_scripts_output_0(borrower_pub, lender_pub, preimage_hash_borrower, borrower_timelock)",
                    "parameters_used": {
                        "borrower_pubkey": borrower_pubkey,
                        "lender_pubkey": lender_pubkey,
                        "preimage_hash_borrower": preimage_hash_borrower,
                        "borrower_timelock": borrower_timelock
                    },
                    "generated_at": datetime.now(timezone.utc).isoformat()
                }
            }
            
        except Exception as e:
            raise Exception(f"Failed to get leaf scripts: {str(e)}")
    
    async def get_leaf_scripts_output_1(self, borrower_pubkey: str, lender_pubkey: str, preimage_hash_lender: str, lender_timelock: int) -> dict:
        """
        Get leaf scripts for output_1 with detailed JSON formatting.
        
        Returns a structured response showing script construction, parameters, and hex encoding.
        """
        try:
            # Check if vaultero is available
            self._check_vaultero_availability()
            
            # Convert string pubkeys to PublicKey objects
            from bitcoinutils.keys import PublicKey
            borrower_pub = PublicKey(borrower_pubkey)
            lender_pub = PublicKey(lender_pubkey)
            
            # Get the scripts from vaultero
            scripts = get_leaf_scripts_output_1(borrower_pub, lender_pub, preimage_hash_lender, lender_timelock)
            
            # Format the response
            formatted_scripts = []
            for i, script in enumerate(scripts):
                script_data = {
                    "index": i,
                    "type": "csv_script_lender" if i == 0 else "hashlock_and_borrower_siglock_script",
                    "description": "Lender gets collateral after timelock" if i == 0 else "Borrower regains custody of collateral with preimage",
                    "raw_script": script.script,
                    "parameters": {
                        "lender_timelock": lender_timelock,
                        "borrower_pubkey_x_only": borrower_pub.to_x_only_hex(),
                        "lender_pubkey_x_only": lender_pub.to_x_only_hex(),
                        "preimage_hash_lender": preimage_hash_lender
                    },
                    "hex": script.to_hex(),
                    "bytes_length": len(script.to_bytes()),
                    "op_count": len(script.script)
                }
                
                # Add template code based on script type
                if i == 0:
                    script_data["template"] = "Script([seq.for_script(), 'OP_CHECKSEQUENCEVERIFY', 'OP_DROP', lender_pub.to_x_only_hex(), 'OP_CHECKSIG'])"
                else:
                    script_data["template"] = "Script(['OP_SHA256', preimage_hash_lender, 'OP_EQUALVERIFY', borrower_pub.to_x_only_hex(), 'OP_CHECKSIG'])"
                
                formatted_scripts.append(script_data)
            
            return {
                "success": True,
                "scripts": formatted_scripts,
                "metadata": {
                    "total_scripts": len(scripts),
                    "script_types": ["csv_script_lender", "hashlock_and_borrower_siglock_script"],
                    "function_call": f"get_leaf_scripts_output_1(borrower_pub, lender_pub, preimage_hash_lender, lender_timelock)",
                    "parameters_used": {
                        "borrower_pubkey": borrower_pubkey,
                        "lender_pubkey": lender_pubkey,
                        "preimage_hash_lender": preimage_hash_lender,
                        "lender_timelock": lender_timelock
                    },
                    "generated_at": datetime.now(timezone.utc).isoformat()
                }
            }
            
        except Exception as e:
            raise Exception(f"Failed to get leaf scripts: {str(e)}")

    async def create_escrow_transaction(self, request: CreateEscrowRequest) -> EscrowTransactionResponse:
        """
        Create Bitcoin escrow transaction where borrower deposits collateral.
        This creates the initial escrow that both parties can spend under different conditions.
        """
        try:
            # Check if vaultero is available
            self._check_vaultero_availability()
            
            # Use btc-vaultero to create escrow transaction
            # This is a placeholder - you'll need to adapt to your actual btc-vaultero API
            # For example:
            # escrow_address = get_nums_p2tr_addr_0(...)
            # raw_tx = create_collateral_lock_tx(...)
            
            # For now, using mock implementation
            transaction_result = await self._mock_create_escrow(
                borrower_pubkey=request.borrower_pubkey,
                lender_pubkey=self.lender_pubkey,
                preimage_hash=request.preimage_hash_borrower,
                timelock=request.borrower_timelock,
                amount=request.amount,
                fee=request.origination_fee
            )
            
            return EscrowTransactionResponse(
                transaction_id=f"escrow_{request.loan_id}",
                raw_tx=transaction_result["raw_tx"],
                escrow_address=transaction_result["escrow_address"],
                input_amount=transaction_result.get("input_amount"),
                fee=transaction_result.get("fee"),
                script_details=transaction_result.get("script_details", {})
            )
            
        except ImportError as e:
            # Vaultero not available, use mock
            print(f"Using mock implementation: {e}")
            transaction_result = await self._mock_create_escrow(
                borrower_pubkey=request.borrower_pubkey,
                lender_pubkey=self.lender_pubkey,
                preimage_hash=request.preimage_hash_borrower,
                timelock=request.borrower_timelock,
                amount=request.amount,
                fee=request.origination_fee
            )
            
            return EscrowTransactionResponse(
                transaction_id=f"escrow_{request.loan_id}",
                raw_tx=transaction_result["raw_tx"],
                escrow_address=transaction_result["escrow_address"],
                input_amount=transaction_result.get("input_amount"),
                fee=transaction_result.get("fee"),
                script_details=transaction_result.get("script_details", {})
            )
        except Exception as e:
            raise Exception(f"Failed to create escrow transaction: {str(e)}")
    
    async def create_collateral_transaction(self, request: CreateCollateralRequest) -> CollateralTransactionResponse:
        """
        Create Bitcoin collateral transaction that moves funds from escrow to collateral lock.
        This transaction can be spent by lender after timelock or by borrower with preimage.
        """
        try:
            # Use btc-vaultero to create collateral transaction
            transaction_result = await self._mock_create_collateral(
                escrow_txid=request.escrow_txid,
                escrow_vout=request.escrow_vout,
                borrower_pubkey=request.borrower_pubkey,
                lender_pubkey=self.lender_pubkey,
                preimage_hash=request.preimage_hash_lender,
                timelock=request.lender_timelock,
                amount=request.collateral_amount,
                fee=request.origination_fee
            )
            
            return CollateralTransactionResponse(
                transaction_id=f"collateral_{request.loan_id}",
                raw_tx=transaction_result["raw_tx"],
                collateral_address=transaction_result["collateral_address"],
                fee=transaction_result.get("fee"),
                script_details=transaction_result.get("script_details", {})
            )
            
        except Exception as e:
            raise Exception(f"Failed to create collateral transaction: {str(e)}")
    
    async def sign_transaction(self, request: SignTransactionRequest) -> SignatureResponse:
        """
        Sign a Bitcoin transaction using the lender's private key.
        This is called when the lender needs to provide their signature for a transaction.
        """
        if not self.lender_private_key:
            raise Exception("Lender private key not configured")
        
        try:
            # Use btc-vaultero to sign the transaction
            signature_result = await self._mock_sign_transaction(
                raw_tx=request.raw_tx,
                input_amount=request.input_amount,
                private_key=self.lender_private_key,
                transaction_type=request.transaction_type
            )
            
            return SignatureResponse(
                signature=signature_result["signature"],
                signature_hash_type=signature_result.get("hash_type", "SIGHASH_DEFAULT"),
                leaf_index=signature_result.get("leaf_index"),
                tapleaf_script=signature_result.get("tapleaf_script"),
                control_block=signature_result.get("control_block"),
                witness_context=signature_result.get("witness_context", {})
            )
            
        except Exception as e:
            raise Exception(f"Failed to sign transaction: {str(e)}")
    
    async def broadcast_transaction(self, request: BroadcastTransactionRequest) -> BroadcastTransactionResponse:
        """
        Broadcast a completed Bitcoin transaction to the network using Bitcoin Core RPC.
        This is called after all signatures have been collected and witness is complete.
        """
        try:
            # Import here to avoid circular imports
            from .bitcoin_rpc_service import bitcoin_rpc
            
            # Use Bitcoin Core RPC to broadcast transaction
            txid = await bitcoin_rpc.broadcast_transaction(request.raw_tx)
            
            return BroadcastTransactionResponse(
                txid=txid,
                success=True,
                confirmations=0  # Initially 0, will be updated by monitoring
            )
            
        except Exception as e:
            raise Exception(f"Failed to broadcast transaction: {str(e)}")
    
    async def generate_preimage(self) -> Tuple[str, str]:
        """
        Generate a random preimage and its SHA256 hash for HTLC usage.
        The lender generates their own preimage for the collateral transaction.
        """
        # Generate 32 random bytes for preimage
        preimage_bytes = secrets.token_bytes(32)
        preimage_hex = preimage_bytes.hex()
        
        # Calculate SHA256 hash
        hash_bytes = hashlib.sha256(preimage_bytes).digest()
        hash_hex = hash_bytes.hex()
        
        return preimage_hex, hash_hex
    
    async def get_transaction_status(self, txid: str) -> Dict[str, Any]:
        """
        Get the status of a Bitcoin transaction from Bitcoin Core RPC.
        """
        try:
            # Import here to avoid circular imports
            from .bitcoin_rpc_service import bitcoin_rpc
            
            # Get transaction details from Bitcoin Core
            tx_info = await bitcoin_rpc.get_transaction_info(txid)
            confirmations = await bitcoin_rpc.get_confirmations(txid)
            
            if tx_info is None:
                return {
                    "txid": txid,
                    "confirmed": False,
                    "confirmations": -1,
                    "block_height": None,
                    "status": "not_found"
                }
            
            return {
                "txid": txid,
                "confirmed": confirmations > 0,
                "confirmations": confirmations,
                "block_height": tx_info.get("blockheight"),
                "status": "confirmed" if confirmations > 0 else "pending",
                "fee": tx_info.get("fee", 0),
                "amount": tx_info.get("amount", 0)
            }
            
        except Exception as e:
            raise Exception(f"Failed to get transaction status: {str(e)}")
    
    # Mock implementations for development
    # In production, these would call actual btc-vaultero functions
    
    async def _mock_create_escrow(self, **kwargs) -> Dict[str, Any]:
        """Mock implementation of escrow transaction creation"""
        return {
            "raw_tx": "0200000001" + "00" * 100,  # Mock raw transaction
            "escrow_address": f"bc1p{'0' * 58}",  # Mock P2TR address
            "input_amount": kwargs["amount"],
            "fee": kwargs["fee"],
            "script_details": {
                "borrower_pubkey": kwargs["borrower_pubkey"],
                "lender_pubkey": kwargs["lender_pubkey"],
                "preimage_hash": kwargs["preimage_hash"],
                "timelock": kwargs["timelock"]
            }
        }
    
    async def _mock_create_collateral(self, **kwargs) -> Dict[str, Any]:
        """Mock implementation of collateral transaction creation"""
        return {
            "raw_tx": "0200000001" + "11" * 100,  # Mock raw transaction
            "collateral_address": f"bc1p{'1' * 58}",  # Mock P2TR address
            "fee": kwargs["fee"],
            "script_details": {
                "escrow_txid": kwargs["escrow_txid"],
                "lender_pubkey": kwargs["lender_pubkey"],
                "preimage_hash": kwargs["preimage_hash"],
                "timelock": kwargs["timelock"]
            }
        }
    
    async def _mock_sign_transaction(self, **kwargs) -> Dict[str, Any]:
        """Mock implementation of transaction signing"""
        return {
            "signature": "a0b1c2d3e4f5" + "00" * 26,  # Mock 64-byte signature
            "hash_type": "SIGHASH_DEFAULT",
            "leaf_index": 1,
            "tapleaf_script": "6382012088a914" + "00" * 20 + "87",
            "control_block": "c1" + "00" * 32,
            "witness_context": {
                "input_amount": float(kwargs["input_amount"]),
                "transaction_type": kwargs["transaction_type"]
            }
        }
    
    async def _mock_broadcast_transaction(self, **kwargs) -> Dict[str, Any]:
        """Mock implementation of transaction broadcasting"""
        # Generate a mock transaction ID
        mock_txid = hashlib.sha256(kwargs["raw_tx"].encode()).hexdigest()
        return {
            "txid": mock_txid,
            "success": True
        }

# Global service instance
vaultero_service = VaulteroService()
