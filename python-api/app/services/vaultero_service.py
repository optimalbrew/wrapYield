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
    CreateCollateralRequest, CollateralTransactionResponse,
    BorrowerExitEscrowRequest, CollateralReleaseRequest, CollateralCaptureRequest,
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
        
    async def get_nums_p2tr_addr_0(self, borrower_pubkey: str, lender_pubkey: str, preimage_hash_borrower: str, borrower_timelock: int) -> str:
        """
        Get NUMS P2TR address for output_0.
        """
        try:
            # Check if vaultero is available
            self._check_vaultero_availability()
            
            # Convert string pubkeys to PublicKey objects
            from bitcoinutils.keys import PublicKey
            borrower_pub = PublicKey(borrower_pubkey)
            lender_pub = PublicKey(lender_pubkey)
            
            # Get the NUMS P2TR address from vaultero
            nums_p2tr_addr = get_nums_p2tr_addr_0(borrower_pub, lender_pub, preimage_hash_borrower, borrower_timelock)
            
            return nums_p2tr_addr.to_string()
            
        except Exception as e:
            raise Exception(f"Failed to get NUMS P2TR_0 address: {str(e)}")
        
    async def get_nums_p2tr_addr_1(self, borrower_pubkey: str, lender_pubkey: str, preimage_hash_lender: str, lender_timelock: int) -> str:
        """
        Get NUMS P2TR address for output_1.
        """
        try:
            # Check if vaultero is available
            self._check_vaultero_availability()
            
            # Convert string pubkeys to PublicKey objects
            from bitcoinutils.keys import PublicKey
            borrower_pub = PublicKey(borrower_pubkey)
            lender_pub = PublicKey(lender_pubkey)
            
            # Get the NUMS P2TR address from vaultero
            nums_p2tr_addr = get_nums_p2tr_addr_1(borrower_pub, lender_pub, preimage_hash_lender, lender_timelock)  
            
            return nums_p2tr_addr.to_string()
            
        except Exception as e:
            raise Exception(f"Failed to get NUMS P2TR_1 address: {str(e)}")
    

    async def _create_collateral_transaction_data(self, request: CreateCollateralRequest):
        """
        Private helper method to create collateral transaction data.
        This method contains the common logic used by both create_collateral_transaction 
        and generate_borrower_signature methods.
        
        Args:
            request: Collateral transaction request with escrow details
            
        Returns:
            Dictionary containing transaction data, addresses, scripts, and amounts
        """
        from bitcoinutils.keys import PublicKey
        from bitcoinutils.transactions import Transaction, TxInput, TxOutput
        from bitcoinutils.utils import to_satoshis
        from vaultero.utils import get_nums_p2tr_addr_0, get_nums_p2tr_addr_1, get_leaf_scripts_output_0
        
        # Convert keys
        borrower_pub = PublicKey(request.borrower_pubkey)
        lender_pub = PublicKey(request.lender_pubkey)
        
        # Get transaction info from Bitcoin RPC
        from .bitcoin_rpc_service import bitcoin_rpc
        tx_info = await bitcoin_rpc.get_transaction_info(request.escrow_txid)
        if not tx_info:
            raise Exception(f"Escrow transaction {request.escrow_txid} not found")
        
        # Handle different transaction formats
        input_amount = None
        if 'vout' in tx_info:
            if request.escrow_vout >= len(tx_info['vout']):
                raise Exception(f"Output index {request.escrow_vout} not found in transaction")
            input_amount = tx_info['vout'][request.escrow_vout]['value']
        elif 'details' in tx_info:
            for detail in tx_info['details']:
                if detail.get('vout') == request.escrow_vout:
                    input_amount = abs(detail['amount'])
                    break
            if input_amount is None:
                raise Exception(f"Output index {request.escrow_vout} not found in transaction details")
        else:
            raise Exception(f"Unknown transaction format: missing 'vout' or 'details'")
        
        # Create addresses
        escrow_address = get_nums_p2tr_addr_0(
            borrower_pub, lender_pub, request.preimage_hash_borrower, request.borrower_timelock
        )
        collateral_address = get_nums_p2tr_addr_1(
            borrower_pub, lender_pub, request.preimage_hash_lender, request.lender_timelock
        )
        
        # Get script information
        scripts = get_leaf_scripts_output_0(
            borrower_pub, lender_pub, request.preimage_hash_borrower, request.borrower_timelock
        )
        leaf_index = 1  # multisig + hashlock path
        tapleaf_script = scripts[leaf_index]
        
        # Create the transaction
        collateral_amount_float = float(request.collateral_amount)
        orig_fee_float = float(request.origination_fee or 0)
        
        txin = TxInput(request.escrow_txid, request.escrow_vout)
        txout1 = TxOutput(to_satoshis(orig_fee_float), lender_pub.get_address().to_script_pub_key())
        txout2 = TxOutput(to_satoshis(collateral_amount_float), collateral_address.to_script_pub_key())
        tx = Transaction([txin], [txout1, txout2], has_segwit=True)
        
        return {
            'transaction': tx,
            'escrow_address': escrow_address,
            'collateral_address': collateral_address,
            'scripts': scripts,
            'leaf_index': leaf_index,
            'tapleaf_script': tapleaf_script,
            'input_amount': input_amount,
            'collateral_amount_float': collateral_amount_float,
            'orig_fee_float': orig_fee_float,
            'borrower_pub': borrower_pub,
            'lender_pub': lender_pub
        }

    async def create_collateral_transaction(self, request: CreateCollateralRequest) -> CollateralTransactionResponse:
        """
        Create Bitcoin collateral transaction that moves funds from escrow to collateral lock.
        This transaction can be spent by lender after timelock or by borrower with preimage.
        """
        try:
            # Check if vaultero is available
            self._check_vaultero_availability()
            
            # Get transaction data using common helper method
            tx_data = await self._create_collateral_transaction_data(request)
            
            # Validate input amount
            if tx_data['input_amount'] <= tx_data['collateral_amount_float'] + tx_data['orig_fee_float']:
                raise Exception(f"Input amount {tx_data['input_amount']} is less than collateral amount {tx_data['collateral_amount_float']} + origination fee {tx_data['orig_fee_float']}")
            
            return CollateralTransactionResponse(
                transaction_id=f"collateral_{request.loan_id}",
                raw_tx=tx_data['transaction'].serialize(),
                collateral_address=tx_data['collateral_address'].to_string(),
                fee=request.origination_fee,
                script_details={
                    "escrow_txid": request.escrow_txid,
                    "escrow_vout": request.escrow_vout,
                    "input_amount": tx_data['input_amount'],
                    "lender_pubkey": request.lender_pubkey,
                    "preimage_hash_borrower": request.preimage_hash_borrower,
                    "preimage_hash_lender": request.preimage_hash_lender,
                    "borrower_timelock": request.borrower_timelock,
                    "lender_timelock": request.lender_timelock,
                    "collateral_amount": tx_data['collateral_amount_float'],
                    "origination_fee": tx_data['orig_fee_float']
                }
            )
            
        except Exception as e:
            raise Exception(f"Failed to create collateral transaction: {str(e)}")

    async def generate_borrower_signature(self, request: CreateCollateralRequest, borrower_private_key: str) -> str:
        """
        Generate borrower's signature for collateral transaction and save to JSON file.
        
        This method reuses the common transaction creation logic, then generates the borrower's 
        signature and saves all necessary data to a JSON file. It is unusual for an API to save a file
        but here we assume the borrower is running the python-api locally and saving the file to their machine.
        The lender can later use this file to complete the transaction witness.
        
        Args:
            request: Collateral transaction request with escrow details
            borrower_private_key: Borrower's private key in WIF format
            
        Returns:
            Path to the saved signature file
        """
        try:
            self._check_vaultero_availability()
            
            from bitcoinutils.keys import PrivateKey
            from bitcoinutils.utils import to_satoshis
            
            # Convert borrower private key
            borrower_priv = PrivateKey.from_wif(borrower_private_key)
            
            # Get transaction data using common helper method
            tx_data = await self._create_collateral_transaction_data(request)
            
            # Generate borrower's signature
            sig_borrower = borrower_priv.sign_taproot_input(
                tx_data['transaction'], 0,
                [tx_data['escrow_address'].to_script_pub_key()],
                [to_satoshis(tx_data['input_amount'])],
                script_path=True,
                tapleaf_script=tx_data['tapleaf_script'],
                tweak=False
            )
            
            # Prepare signature data for JSON file
            signature_data = {
                'sig_borrower': sig_borrower,
                'txid': request.escrow_txid,
                'vout': request.escrow_vout,
                'tx_hex': tx_data['transaction'].serialize(),
                'input_amount': float(tx_data['input_amount']),
                'leaf_index': tx_data['leaf_index'],
                'escrow_address_script': tx_data['escrow_address'].to_script_pub_key().to_hex(),
                'tapleaf_script_hex': tx_data['tapleaf_script'].to_hex(),
                'escrow_is_odd': tx_data['escrow_address'].is_odd(),
                'loan_id': request.loan_id,
                'borrower_pubkey': request.borrower_pubkey,
                'lender_pubkey': request.lender_pubkey,
                'preimage_hash_borrower': request.preimage_hash_borrower,
                'borrower_timelock': request.borrower_timelock,
                'collateral_amount': tx_data['collateral_amount_float'],
                'origination_fee': tx_data['orig_fee_float']
            }
            
            # Save to examples directory
            import json
            from pathlib import Path
            
            examples_dir = Path("/app/examples")
            examples_dir.mkdir(exist_ok=True)
            signature_file = examples_dir / f"borrower_signature_{request.loan_id}.json"
            
            with open(signature_file, 'w') as f:
                json.dump(signature_data, f, indent=2)
            
            return str(signature_file)
            
        except Exception as e:
            raise Exception(f"Failed to generate borrower signature: {str(e)}")

    async def complete_lender_witness(self, signature_file_path: str, lender_private_key: str, preimage: str, mine_block: bool = True) -> str:
        """
        Complete the transaction witness using borrower's signature and lender's signature + preimage.
        
        This method reads the borrower's signature from a JSON file, generated locally by the borrower and shared with the lender later 
        The Lender generates own signature, adds the preimage, and creates the complete witness for broadcasting.
        
        Args:
            signature_file_path: Path to the JSON file containing borrower's signature
            lender_private_key: Lender's private key in WIF format
            preimage: The preimage that satisfies the hashlock (hex string)
            mine_block: Whether to mine a block after broadcasting (default: True)
            
        Returns:
            Transaction ID of the broadcast transaction
        """
        try:
            self._check_vaultero_availability()
            
            # Import required classes
            from bitcoinutils.keys import PublicKey, PrivateKey
            from bitcoinutils.transactions import Transaction, TxWitnessInput
            from bitcoinutils.utils import ControlBlock, to_satoshis
            from vaultero.utils import get_nums_p2tr_addr_0, get_leaf_scripts_output_0, get_nums_key
            
            # Load borrower's signature data from file
            import json
            with open(signature_file_path, 'r') as f:
                signature_data = json.load(f)
            
            # Convert lender private key
            lender_priv = PrivateKey.from_wif(lender_private_key)
            
            # Recreate borrower and lender public keys
            borrower_pub = PublicKey(signature_data['borrower_pubkey'])
            lender_pub = PublicKey(signature_data['lender_pubkey'])
            
            # Recreate transaction from hex
            tx = Transaction.from_raw(signature_data['tx_hex'])
            
            # Recreate escrow address and scripts
            escrow_address = get_nums_p2tr_addr_0(
                borrower_pub, lender_pub, 
                signature_data['preimage_hash_borrower'], 
                signature_data['borrower_timelock']
            )
            
            scripts = get_leaf_scripts_output_0(
                borrower_pub, lender_pub, 
                signature_data['preimage_hash_borrower'], 
                signature_data['borrower_timelock']
            )
            
            leaf_index = signature_data['leaf_index']
            tapleaf_script = scripts[leaf_index]
            
            # Generate lender's signature
            sig_lender = lender_priv.sign_taproot_input(
                tx, 0,
                [escrow_address.to_script_pub_key()],
                [to_satoshis(signature_data['input_amount'])],
                script_path=True,
                tapleaf_script=tapleaf_script,
                tweak=False
            )
            
            # Create control block
            nums_key = get_nums_key()
            tree = [[scripts[0], scripts[1]]]
            ctrl_block = ControlBlock(nums_key, tree, leaf_index, is_odd=signature_data['escrow_is_odd'])
            
            # Convert preimage to hex if it's not already
            if not preimage.startswith('0x'):
                preimage_hex = preimage.encode('utf-8').hex()
            else:
                preimage_hex = preimage[2:]  # Remove 0x prefix
            
            # Create complete witness
            witness = TxWitnessInput([
                signature_data['sig_borrower'],  # From file (borrower's signature)
                sig_lender,                      # Generated by lender
                preimage_hex,                    # Lender adds preimage (borrower's preimage)
                signature_data['tapleaf_script_hex'],
                ctrl_block.to_hex()
            ])
            
            # Add witness to transaction
            tx.witnesses = []  # Clear any existing witnesses
            tx.witnesses.append(witness)
            
            # Broadcast transaction
            from .bitcoin_rpc_service import bitcoin_rpc
            txid = await bitcoin_rpc.broadcast_transaction(tx.serialize())
            
            # Optionally mine a block to confirm the transaction
            if mine_block:
                block_hashes = await bitcoin_rpc.generate_blocks(1)
                # Block mined successfully to confirm transaction
            
            return txid
            
        except Exception as e:
            raise Exception(f"Failed to complete lender witness: {str(e)}")

    async def borrower_exit_escrow(self, request: BorrowerExitEscrowRequest) -> str:
        """
        Create, sign, and broadcast Bitcoin transaction for borrower to exit escrow without revealing preimage.
        This allows the borrower to reclaim their funds if the loan is not offered or not claimed.
        Uses the CSV (CheckSequenceVerify) script path with borrower timelock.
        Returns the transaction ID of the broadcasted transaction.
        """
        try:
            # Check if vaultero is available
            self._check_vaultero_availability()
            
            # Import here to avoid circular imports
            from .bitcoin_rpc_service import bitcoin_rpc
            from bitcoinutils.keys import PublicKey, PrivateKey
            from bitcoinutils.transactions import TxWitnessInput, Sequence
            from bitcoinutils.utils import to_satoshis, ControlBlock
            from bitcoinutils.constants import TYPE_RELATIVE_TIMELOCK
            from vaultero.utils import get_nums_p2tr_addr_0, get_leaf_scripts_output_0, get_nums_key
            
            # Convert keys - use from_hex with proper prefix for x-only pubkeys
            borrower_pub = PublicKey.from_hex("02" + request.borrower_pubkey)  # Assume even y-coordinate
            lender_pub = PublicKey.from_hex("02" + request.lender_pubkey)  # Assume even y-coordinate
            borrower_priv = PrivateKey(request.borrower_private_key)
            
            # Get escrow address (nums_p2tr_addr_0)
            escrow_address = get_nums_p2tr_addr_0(borrower_pub, lender_pub, request.preimage_hash_borrower, request.borrower_timelock)
            
            # Get transaction info from Bitcoin RPC to get input amount
            tx_info = await bitcoin_rpc.get_transaction_info(request.escrow_txid)
            if not tx_info:
                raise Exception(f"Escrow transaction {request.escrow_txid} not found")
            
            # Handle different transaction formats
            input_amount = None
            if 'vout' in tx_info:
                if request.escrow_vout >= len(tx_info['vout']):
                    raise Exception(f"Output index {request.escrow_vout} not found in transaction")
                input_amount = tx_info['vout'][request.escrow_vout]['value']
            elif 'details' in tx_info:
                for detail in tx_info['details']:
                    if detail.get('vout') == request.escrow_vout:
                        input_amount = abs(detail['amount'])
                        break
                if input_amount is None:
                    raise Exception(f"Output index {request.escrow_vout} not found in transaction details")
            else:
                raise Exception(f"Unknown transaction format: missing 'vout' or 'details'")
            
            # Create transaction manually (following create_borrower_exit_tx logic)
            from bitcoinutils.transactions import Transaction, TxInput, TxOutput
            input_amount_float = float(input_amount)
            exit_fee_float = float(request.exit_fee)
            exit_amount_float = input_amount_float - exit_fee_float
            
            if exit_amount_float <= 0:
                raise Exception(f"Exit amount {exit_amount_float} must be positive after fee {exit_fee_float}")
            
            # Create transaction (same logic as create_borrower_exit_tx)
            tx_input = TxInput(request.escrow_txid, request.escrow_vout)
            tx_output = TxOutput(to_satoshis(exit_amount_float), borrower_pub.get_address().to_script_pub_key())
            tx = Transaction([tx_input], [tx_output], has_segwit=True)
            
            # Get leaf scripts for escrow (output_0)
            scripts = get_leaf_scripts_output_0(borrower_pub, lender_pub, request.preimage_hash_borrower, request.borrower_timelock)
            
            # Use CSV borrower path (leaf_index = 0)
            leaf_index = 0  # csv_borrower path
            tapleaf_script = scripts[leaf_index]
            
            # Create control block
            nums_key = get_nums_key()
            tree = [[scripts[0], scripts[1]]]
            ctrl_block = ControlBlock(nums_key, tree, leaf_index, is_odd=escrow_address.is_odd())
            
            # Set sequence for CSV timelock
            seq = Sequence(TYPE_RELATIVE_TIMELOCK, request.borrower_timelock)
            seq_for_n_seq = seq.for_input_sequence()
            if seq_for_n_seq is None:
                raise Exception("Failed to create sequence for CSV timelock")
            tx.inputs[0].sequence = seq_for_n_seq
            
            # Sign the transaction
            sig_borrower = borrower_priv.sign_taproot_input(
                tx, 0,
                [escrow_address.to_script_pub_key()],
                [to_satoshis(input_amount_float)],
                script_path=True,
                tapleaf_script=tapleaf_script,
                tweak=False
            )
            
            # Create witness
            witness = TxWitnessInput([
                sig_borrower,
                tapleaf_script.to_hex(),
                ctrl_block.to_hex()
            ])
            tx.witnesses.append(witness)
            
            # Broadcast transaction
            txid = await bitcoin_rpc.broadcast_transaction(tx.serialize())
            
            return txid
            
        except Exception as e:
            raise Exception(f"Failed to execute borrower exit escrow: {str(e)}")

    async def collateral_release(self, request: CollateralReleaseRequest) -> str:
        """
        Create, sign, and broadcast Bitcoin transaction to release collateral to borrower.
        This allows the borrower to retrieve their collateral when the lender accepts loan repayment
        and reveals their preimage on RSK.
        Uses the hashlock + siglock script path with lender's preimage.
        Returns the transaction ID of the broadcasted transaction.
        """
        try:
            # Check if vaultero is available
            self._check_vaultero_availability()
            
            # Import here to avoid circular imports
            from .bitcoin_rpc_service import bitcoin_rpc
            from bitcoinutils.keys import PublicKey, PrivateKey
            from bitcoinutils.transactions import TxWitnessInput
            from bitcoinutils.utils import to_satoshis, ControlBlock
            from vaultero.utils import get_nums_p2tr_addr_1, get_leaf_scripts_output_1, get_nums_key
            
            # Convert keys - use from_hex with proper prefix for x-only pubkeys
            borrower_pub = PublicKey.from_hex("02" + request.borrower_pubkey)  # Assume even y-coordinate
            lender_pub = PublicKey.from_hex("02" + request.lender_pubkey)  # Assume even y-coordinate
            borrower_priv = PrivateKey(request.borrower_private_key)
            
            # Get collateral address (nums_p2tr_addr_1)
            collateral_address = get_nums_p2tr_addr_1(borrower_pub, lender_pub, request.preimage_hash_lender, request.lender_timelock)
            
            # Get transaction info from Bitcoin RPC to get input amount
            tx_info = await bitcoin_rpc.get_transaction_info(request.collateral_txid)
            if not tx_info:
                raise Exception(f"Collateral transaction {request.collateral_txid} not found")
            
            # Handle different transaction formats
            input_amount = None
            if 'vout' in tx_info:
                if request.collateral_vout >= len(tx_info['vout']):
                    raise Exception(f"Output index {request.collateral_vout} not found in transaction")
                input_amount = tx_info['vout'][request.collateral_vout]['value']
            elif 'details' in tx_info:
                for detail in tx_info['details']:
                    if detail.get('vout') == request.collateral_vout:
                        input_amount = abs(detail['amount'])
                        break
                if input_amount is None:
                    raise Exception(f"Output index {request.collateral_vout} not found in transaction details")
            else:
                raise Exception(f"Unknown transaction format: missing 'vout' or 'details'")
            
            # Create transaction manually (following create_collateral_release_tx logic)
            from bitcoinutils.transactions import Transaction, TxInput, TxOutput
            input_amount_float = float(input_amount)
            release_fee_float = float(request.release_fee)
            release_amount_float = input_amount_float - release_fee_float
            
            if release_amount_float <= 0:
                raise Exception(f"Release amount {release_amount_float} must be positive after fee {release_fee_float}")
            
            # Create transaction (same logic as create_collateral_release_tx with release_to_borrower=True)
            tx_input = TxInput(request.collateral_txid, request.collateral_vout)
            tx_output = TxOutput(to_satoshis(release_amount_float), borrower_pub.get_address().to_script_pub_key())
            tx = Transaction([tx_input], [tx_output], has_segwit=True)
            
            # Get leaf scripts for collateral (output_1)
            scripts = get_leaf_scripts_output_1(borrower_pub, lender_pub, request.preimage_hash_lender, request.lender_timelock)
            
            # Use hashlock + siglock path (leaf_index = 1)
            leaf_index = 1  # hashlock + siglock path
            tapleaf_script = scripts[leaf_index]
            
            # Create control block
            nums_key = get_nums_key()
            tree = [[scripts[0], scripts[1]]]
            ctrl_block = ControlBlock(nums_key, tree, leaf_index, is_odd=collateral_address.is_odd())
            
            # Convert lender's preimage to hex
            preimage_hex = request.lender_preimage.encode('utf-8').hex()
            
            # Sign the transaction
            sig_borrower = borrower_priv.sign_taproot_input(
                tx, 0,
                [collateral_address.to_script_pub_key()],
                [to_satoshis(input_amount_float)],
                script_path=True,
                tapleaf_script=tapleaf_script,
                tweak=False
            )
            
            # Create witness (borrower signature + preimage + script + control block)
            witness = TxWitnessInput([
                sig_borrower,
                preimage_hex,
                tapleaf_script.to_hex(),
                ctrl_block.to_hex()
            ])
            tx.witnesses.append(witness)
            
            # Broadcast transaction
            txid = await bitcoin_rpc.broadcast_transaction(tx.serialize())
            
            return txid
            
        except Exception as e:
            raise Exception(f"Failed to execute collateral release: {str(e)}")

    async def collateral_capture(self, request: CollateralCaptureRequest) -> str:
        """
        Create, sign, and broadcast Bitcoin transaction for lender to capture collateral after timelock.
        This allows the lender to claim the collateral when the borrower defaults (does not repay loan on time)
        or when the lender does not accept loan repayment on RSK.
        Uses the CSV (CheckSequenceVerify) script path with lender timelock.
        Returns the transaction ID of the broadcasted transaction.
        """
        try:
            # Check if vaultero is available
            self._check_vaultero_availability()
            
            # Import here to avoid circular imports
            from .bitcoin_rpc_service import bitcoin_rpc
            from bitcoinutils.keys import PublicKey, PrivateKey
            from bitcoinutils.transactions import TxWitnessInput, Sequence
            from bitcoinutils.utils import to_satoshis, ControlBlock
            from bitcoinutils.constants import TYPE_RELATIVE_TIMELOCK
            from vaultero.utils import get_nums_p2tr_addr_1, get_leaf_scripts_output_1, get_nums_key
            
            # Convert keys - use from_hex with proper prefix for x-only pubkeys
            borrower_pub = PublicKey.from_hex("02" + request.borrower_pubkey)  # Assume even y-coordinate
            lender_pub = PublicKey.from_hex("02" + request.lender_pubkey)  # Assume even y-coordinate
            lender_priv = PrivateKey(request.lender_private_key)
            
            # Get collateral address (nums_p2tr_addr_1)
            collateral_address = get_nums_p2tr_addr_1(borrower_pub, lender_pub, request.preimage_hash_lender, request.lender_timelock)
            
            # Get transaction info from Bitcoin RPC to get input amount
            tx_info = await bitcoin_rpc.get_transaction_info(request.collateral_txid)
            if not tx_info:
                raise Exception(f"Collateral transaction {request.collateral_txid} not found")
            
            # Handle different transaction formats
            input_amount = None
            if 'vout' in tx_info:
                if request.collateral_vout >= len(tx_info['vout']):
                    raise Exception(f"Output index {request.collateral_vout} not found in transaction")
                input_amount = tx_info['vout'][request.collateral_vout]['value']
            elif 'details' in tx_info:
                for detail in tx_info['details']:
                    if detail.get('vout') == request.collateral_vout:
                        input_amount = abs(detail['amount'])
                        break
                if input_amount is None:
                    raise Exception(f"Output index {request.collateral_vout} not found in transaction details")
            else:
                raise Exception(f"Unknown transaction format: missing 'vout' or 'details'")
            
            # Create transaction manually (following create_collateral_release_tx logic with release_to_borrower=False)
            from bitcoinutils.transactions import Transaction, TxInput, TxOutput
            input_amount_float = float(input_amount)
            capture_fee_float = float(request.capture_fee)
            capture_amount_float = input_amount_float - capture_fee_float
            
            if capture_amount_float <= 0:
                raise Exception(f"Capture amount {capture_amount_float} must be positive after fee {capture_fee_float}")
            
            # Create transaction (same logic as create_collateral_release_tx with release_to_borrower=False)
            tx_input = TxInput(request.collateral_txid, request.collateral_vout)
            tx_output = TxOutput(to_satoshis(capture_amount_float), lender_pub.get_address().to_script_pub_key())
            tx = Transaction([tx_input], [tx_output], has_segwit=True)
            
            # Get leaf scripts for collateral (output_1)
            scripts = get_leaf_scripts_output_1(borrower_pub, lender_pub, request.preimage_hash_lender, request.lender_timelock)
            
            # Use CSV lender path (leaf_index = 0)
            leaf_index = 0  # csv_lender path
            tapleaf_script = scripts[leaf_index]
            
            # Create control block
            nums_key = get_nums_key()
            tree = [[scripts[0], scripts[1]]]
            ctrl_block = ControlBlock(nums_key, tree, leaf_index, is_odd=collateral_address.is_odd())
            
            # Set sequence for CSV timelock
            seq = Sequence(TYPE_RELATIVE_TIMELOCK, request.lender_timelock)
            seq_for_n_seq = seq.for_input_sequence()
            if seq_for_n_seq is None:
                raise Exception("Failed to create sequence for CSV timelock")
            tx.inputs[0].sequence = seq_for_n_seq
            
            # Sign the transaction
            sig_lender = lender_priv.sign_taproot_input(
                tx, 0,
                [collateral_address.to_script_pub_key()],
                [to_satoshis(input_amount_float)],
                script_path=True,
                tapleaf_script=tapleaf_script,
                tweak=False
            )
            
            # Create witness (lender signature + script + control block)
            witness = TxWitnessInput([
                sig_lender,
                tapleaf_script.to_hex(),
                ctrl_block.to_hex()
            ])
            tx.witnesses.append(witness)
            
            # Broadcast transaction
            txid = await bitcoin_rpc.broadcast_transaction(tx.serialize())
            
            return txid
            
        except Exception as e:
            raise Exception(f"Failed to execute collateral capture: {str(e)}")

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
    


# Global service instance
vaultero_service = VaulteroService()
