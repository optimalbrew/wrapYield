"""
Bitcoin Core RPC service for regtest operations.

Handles interaction with local Bitcoin Core node for:
- Broadcasting transactions
- Checking confirmations 
- Generating blocks (regtest)
- Querying blockchain state
- UTXO tracking and monitoring for loan lifecycle
"""

from bitcoinrpc.authproxy import AuthServiceProxy, JSONRPCException
from typing import Dict, List, Optional, Union, Tuple
import logging
from ..config import settings

logger = logging.getLogger(__name__)

class BitcoinRPCService:
    """Service for Bitcoin Core RPC operations in regtest environment."""
    
    def __init__(self):
        self.rpc_url = (
            f"http://{settings.bitcoin_rpc_user}:{settings.bitcoin_rpc_password}@"
            f"{settings.bitcoin_rpc_host}:{settings.bitcoin_rpc_port}/"
        )
        self._rpc_connection = None
        self._wallet_initialized = False
    
    @property
    def rpc(self) -> AuthServiceProxy:
        """Lazy-loaded RPC connection."""
        if self._rpc_connection is None:
            try:
                self._rpc_connection = AuthServiceProxy(
                    self.rpc_url,
                    timeout=settings.bitcoin_rpc_timeout
                )
                # Test connection
                self._rpc_connection.getblockchaininfo()
                logger.info(f"Connected to Bitcoin Core ({settings.bitcoin_network})")
                
                # Initialize wallet if not already done
                if not self._wallet_initialized:
                    self._initialize_wallet()
                    
            except Exception as e:
                logger.error(f"Failed to connect to Bitcoin Core: {e}")
                raise ConnectionError(f"Cannot connect to Bitcoin Core: {e}")
        
        return self._rpc_connection
    
    def _initialize_wallet(self):
        """Initialize wallet for testing if none exists."""
        try:
            wallet_name = settings.bitcoin_wallet_name
            # Check if any wallets exist
            wallets = self._rpc_connection.listwallets()
            
            if not wallets:
                # No wallets exist, create a new one
                logger.info(f"No wallets found, creating '{wallet_name}' wallet")
                self._rpc_connection.createwallet(wallet_name)
                self._wallet_initialized = True
                logger.info(f"Successfully created '{wallet_name}' wallet")
                
            elif wallet_name not in wallets:
                # wallet doesn't exist, create it
                logger.info(f"Creating '{wallet_name}' wallet")
                self._rpc_connection.createwallet(wallet_name)
                self._wallet_initialized = True
                logger.info(f"Successfully created '{wallet_name}' wallet")
                
            else:
                # wallet exists, load it
                logger.info(f"Loading existing '{wallet_name}' wallet")
                self._rpc_connection.loadwallet(wallet_name)
                self._wallet_initialized = True
                logger.info(f"Successfully loaded '{wallet_name}' wallet")
            
            # Update RPC URL to use wallet-specific endpoint
            self.rpc_url = (
                f"http://{settings.bitcoin_rpc_user}:{settings.bitcoin_rpc_password}@"
                f"{settings.bitcoin_rpc_host}:{settings.bitcoin_rpc_port}/wallet/{wallet_name}"
            )
            # Recreate RPC connection with wallet-specific URL
            self._rpc_connection = AuthServiceProxy(
                self.rpc_url,
                timeout=settings.bitcoin_rpc_timeout
            )
            
            # Generate some initial blocks if we're in regtest and have no blocks
            if settings.bitcoin_network == "regtest":
                self._ensure_initial_blocks()
                
        except JSONRPCException as e:
            wallet_name = settings.bitcoin_wallet_name
            if e.error['code'] == -4:  # Wallet already loaded
                logger.info(f"Wallet '{wallet_name}' is already loaded")
                self._wallet_initialized = True
                # Update RPC URL to use wallet-specific endpoint
                self.rpc_url = (
                    f"http://{settings.bitcoin_rpc_user}:{settings.bitcoin_rpc_password}@"
                    f"{settings.bitcoin_rpc_host}:{settings.bitcoin_rpc_port}/wallet/{wallet_name}"
                )
                # Recreate RPC connection with wallet-specific URL
                self._rpc_connection = AuthServiceProxy(
                    self.rpc_url,
                    timeout=settings.bitcoin_rpc_timeout
                )
            elif e.error['code'] == -35:  # Wallet already exists
                logger.info(f"Wallet '{wallet_name}' already exists, loading it")
                try:
                    self._rpc_connection.loadwallet(wallet_name)
                    self._wallet_initialized = True
                    logger.info(f"Successfully loaded existing '{wallet_name}' wallet")
                    # Update RPC URL to use wallet-specific endpoint
                    self.rpc_url = (
                        f"http://{settings.bitcoin_rpc_user}:{settings.bitcoin_rpc_password}@"
                        f"{settings.bitcoin_rpc_host}:{settings.bitcoin_rpc_port}/wallet/{wallet_name}"
                    )
                    # Recreate RPC connection with wallet-specific URL
                    self._rpc_connection = AuthServiceProxy(
                        self.rpc_url,
                        timeout=settings.bitcoin_rpc_timeout
                    )
                except JSONRPCException as load_error:
                    logger.error(f"Failed to load existing wallet: {load_error}")
                    raise
            elif e.error['code'] == -18:  # Wallet file verification failed (database doesn't exist)
                logger.info("Wallet database file doesn't exist, creating new wallet")
                try:
                    self._rpc_connection.createwallet(wallet_name)
                    self._wallet_initialized = True
                    logger.info(f"Successfully created new '{wallet_name}' wallet after database error")
                    # Update RPC URL to use wallet-specific endpoint
                    self.rpc_url = (
                        f"http://{settings.bitcoin_rpc_user}:{settings.bitcoin_rpc_password}@"
                        f"{settings.bitcoin_rpc_host}:{settings.bitcoin_rpc_port}/wallet/{wallet_name}"
                    )
                    # Recreate RPC connection with wallet-specific URL
                    self._rpc_connection = AuthServiceProxy(
                        self.rpc_url,
                        timeout=settings.bitcoin_rpc_timeout
                    )
                except JSONRPCException as create_error:
                    logger.error(f"Failed to create wallet after database error: {create_error}")
                    raise
            else:
                logger.error(f"Failed to initialize wallet: {e}")
                raise
        except Exception as e:
            logger.error(f"Unexpected error during wallet initialization: {e}")
            raise
    
    def _ensure_initial_blocks(self):
        """Ensure we have some initial blocks and coins for testing."""
        try:
            # Check current block count
            blockchain_info = self._rpc_connection.getblockchaininfo()
            current_blocks = blockchain_info.get('blocks', 0)
            
            if current_blocks == 0:
                logger.info("No blocks found, generating 101 initial blocks for testing")
                # Generate 101 blocks to ensure coinbase transactions are spendable
                # First get an address from our wallet
                test_address = self._rpc_connection.getnewaddress("test")
                block_hashes = self._rpc_connection.generatetoaddress(101, test_address)
                logger.info(f"Generated {len(block_hashes)} initial blocks")
                
                # Check balance
                balance = self._rpc_connection.getbalance()
                logger.info(f"Wallet balance after block generation: {balance} BTC")
                
            elif current_blocks < 101:
                logger.info(f"Only {current_blocks} blocks found, generating additional blocks for testing")
                test_address = self._rpc_connection.getnewaddress("test")
                blocks_needed = 101 - current_blocks
                block_hashes = self._rpc_connection.generatetoaddress(blocks_needed, test_address)
                logger.info(f"Generated {len(block_hashes)} additional blocks")
                
            else:
                logger.info(f"Sufficient blocks available: {current_blocks}")
                
        except Exception as e:
            logger.warning(f"Failed to ensure initial blocks: {e}")
            # Don't fail the entire initialization for this
    
    async def get_blockchain_info(self) -> Dict:
        """Get general blockchain information."""
        try:
            return self.rpc.getblockchaininfo()
        except JSONRPCException as e:
            logger.error(f"RPC error getting blockchain info: {e}")
            raise
    
    async def broadcast_transaction(self, raw_tx: str) -> str:
        """
        Broadcast a raw transaction to the network.
        
        Args:
            raw_tx: Raw transaction hex string
            
        Returns:
            Transaction ID (txid)
        """
        try:
            txid = self.rpc.sendrawtransaction(raw_tx)
            logger.info(f"Broadcasted transaction: {txid}")
            return txid
        except JSONRPCException as e:
            logger.error(f"Failed to broadcast transaction: {e}")
            raise ValueError(f"Broadcast failed: {e.error['message']}")
    
    async def get_transaction_info(self, txid: str) -> Dict:
        """
        Get detailed information about a transaction.
        
        Args:
            txid: Transaction ID
            
        Returns:
            Transaction information including confirmations
        """
        try:
            # Try to get transaction from wallet first
            try:
                return self.rpc.gettransaction(txid)
            except JSONRPCException:
                # If not in wallet, get raw transaction
                raw_tx = self.rpc.getrawtransaction(txid, True)  # True for verbose
                return raw_tx
        except JSONRPCException as e:
            if e.error['code'] == -5:  # Transaction not found
                return None
            logger.error(f"Error getting transaction {txid}: {e}")
            raise
    
    async def get_confirmations(self, txid: str) -> int:
        """
        Get number of confirmations for a transaction.
        
        Args:
            txid: Transaction ID
            
        Returns:
            Number of confirmations (0 if unconfirmed, -1 if not found)
        """
        tx_info = await self.get_transaction_info(txid)
        if tx_info is None:
            return -1
        
        return tx_info.get("confirmations", 0)
    
    async def generate_blocks(self, num_blocks: int, address: Optional[str] = None) -> List[str]:
        """
        Generate blocks in regtest mode.
        
        Args:
            num_blocks: Number of blocks to generate
            address: Address to send coinbase rewards (optional)
            
        Returns:
            List of generated block hashes
        """
        if settings.bitcoin_network != "regtest":
            raise ValueError("Block generation only available in regtest mode")
        
        try:
            if address:
                block_hashes = self.rpc.generatetoaddress(num_blocks, address)
            else:
                # Use generatetoaddress with a new address since generate is deprecated
                new_address = self.rpc.getnewaddress()
                block_hashes = self.rpc.generatetoaddress(num_blocks, new_address)
            
            logger.info(f"Generated {num_blocks} blocks")
            return block_hashes
        except JSONRPCException as e:
            logger.error(f"Failed to generate blocks: {e}")
            raise
    
    async def get_new_address(self, label: str = "") -> str:
        """
        Generate a new Bitcoin address.
        
        Args:
            label: Optional label for the address
            
        Returns:
            New Bitcoin address
        """
        try:
            return self.rpc.getnewaddress(label)
        except JSONRPCException as e:
            logger.error(f"Failed to generate new address: {e}")
            raise
    
    async def get_balance(self) -> float:
        """Get wallet balance."""
        try:
            return self.rpc.getbalance()
        except JSONRPCException as e:
            logger.error(f"Failed to get balance: {e}")
            raise
    
    async def list_unspent(self, min_conf: int = 1, max_conf: int = 9999999) -> List[Dict]:
        """
        List unspent transaction outputs.
        
        Args:
            min_conf: Minimum confirmations
            max_conf: Maximum confirmations
            
        Returns:
            List of unspent outputs
        """
        try:
            return self.rpc.listunspent(min_conf, max_conf)
        except JSONRPCException as e:
            logger.error(f"Failed to list unspent: {e}")
            raise
    
    async def get_block_count(self) -> int:
        """Get current block height."""
        try:
            return self.rpc.getblockcount()
        except JSONRPCException as e:
            logger.error(f"Failed to get block count: {e}")
            raise
    
    async def get_mempool_info(self) -> Dict:
        """Get mempool information."""
        try:
            return self.rpc.getmempoolinfo()
        except JSONRPCException as e:
            logger.error(f"Failed to get mempool info: {e}")
            raise
    
    async def estimate_fee(self, conf_target: int = 6) -> float:
        """
        Estimate fee rate for confirmation within target blocks.
        
        Args:
            conf_target: Target number of blocks for confirmation
            
        Returns:
            Fee rate in BTC/kB
        """
        try:
            result = self.rpc.estimatesmartfee(conf_target)
            return result.get("feerate", 0.00001)  # Default fee if estimation fails
        except JSONRPCException as e:
            logger.warning(f"Fee estimation failed: {e}")
            return 0.00001  # Default regtest fee

    async def fund_address(self, address: str, amount: float) -> Tuple[str, int]:
        """
        Send BTC to an address and return the transaction ID and output index.
        
        Args:
            address: Bitcoin address to send to
            amount: Amount in BTC to send
            
        Returns:
            Tuple of (txid, vout) where txid is the transaction ID and vout is the output index
        """
        try:
            # Send BTC to the address
            txid = self.rpc.sendtoaddress(address, amount)
            logger.info(f"Sent {amount} BTC to {address}, txid: {txid}")
            
            # Get transaction details to find the vout
            tx_details = self.rpc.gettransaction(txid)
            
            # Find the output that went to our target address
            vout = None
            for detail in tx_details.get('details', []):
                if detail.get('address') == address:
                    vout = detail.get('vout')
                    break
            
            if vout is None:
                raise ValueError(f"Could not find output for address {address} in transaction {txid}")
            
            logger.info(f"Found UTXO at vout: {vout}")
            return txid, vout
            
        except JSONRPCException as e:
            logger.error(f"RPC error funding address {address}: {e}")
            raise Exception(f"Failed to fund address: {e}")
        except Exception as e:
            logger.error(f"Error funding address {address}: {e}")
            raise Exception(f"Failed to fund address: {e}")

    def is_utxo_spent(self, txid: str, vout: int) -> bool:
        """
        Check if a specific UTXO is still unspent. This makes more sense assuming we know for 
        sure that such a UTXO exists or existed at some point in the past. If it exists, 
        then it is not spent.
        
        Args:
            txid: Transaction ID
            vout: Output index
            
        Returns:
            True if UTXO is spent (no longer exists), False if still unspent
        """
        try:
            result = self.rpc.gettxout(txid, vout)
            return result is None  # None means spent
        except JSONRPCException as e:
            logger.warning(f"Error checking UTXO {txid}:{vout}: {e}")
            return True  # Assume spent if we can't check
        except Exception as e:
            logger.error(f"Unexpected error checking UTXO {txid}:{vout}: {e}")
            return True

    def get_utxo_details(self, txid: str, vout: int) -> Optional[Dict]:
        """
        Get detailed information about a UTXO.
        
        Args:
            txid: Transaction ID
            vout: Output index
            
        Returns:
            Dictionary with UTXO details or None if not found/spent
        """
        try:
            result = self.rpc.gettxout(txid, vout)
            return result
        except JSONRPCException as e:
            logger.warning(f"Error getting UTXO details {txid}:{vout}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error getting UTXO details {txid}:{vout}: {e}")
            return None

    def get_all_utxos(self, min_confirmations: int = 0, max_confirmations: int = 9999999) -> List[Dict]:
        """
        Get all UTXOs in the wallet.
        
        Args:
            min_confirmations: Minimum confirmations required
            max_confirmations: Maximum confirmations allowed
            
        Returns:
            List of UTXO dictionaries
        """
        try:
            result = self.rpc.listunspent(min_confirmations, max_confirmations, [], True)
            return result
        except JSONRPCException as e:
            logger.error(f"Error getting UTXOs: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error getting UTXOs: {e}")
            return []

    def find_utxos_by_address(self, address: str) -> List[Dict]:
        """
        Find UTXOs for a specific address.
        
        Args:
            address: Bitcoin address to search for
            
        Returns:
            List of UTXOs for the given address
        """
        try:
            all_utxos = self.get_all_utxos()
            return [utxo for utxo in all_utxos if utxo.get("address") == address]
        except Exception as e:
            logger.error(f"Error finding UTXOs for address {address}: {e}")
            return []

    def get_utxo_confirmations(self, txid: str, vout: int) -> int:
        """
        Get the number of confirmations for a specific UTXO.
        
        Args:
            txid: Transaction ID
            vout: Output index
            
        Returns:
            Number of confirmations, 0 if not found/spent
        """
        try:
            utxo_info = self.get_utxo_details(txid, vout)
            if utxo_info:
                return utxo_info.get("confirmations", 0)
            return 0
        except Exception as e:
            logger.error(f"Error getting confirmations for UTXO {txid}:{vout}: {e}")
            return 0

    def monitor_utxo_status(self, txid: str, vout: int, callback=None) -> Dict:
        """
        Monitor a specific UTXO and return its current status.
        This is a one-time check, not continuous monitoring.
        
        Args:
            txid: Transaction ID
            vout: Output index
            callback: Optional callback function to call with status update
            
        Returns:
            Dictionary with UTXO status information
        """
        try:
            is_spent = self.is_utxo_spent(txid, vout)
            utxo_details = self.get_utxo_details(txid, vout)
            
            status = {
                "txid": txid,
                "vout": vout,
                "is_spent": is_spent,
                "confirmations": utxo_details.get("confirmations", 0) if utxo_details else 0,
                "value": utxo_details.get("value", 0) if utxo_details else 0,
                "address": utxo_details.get("scriptPubKey", {}).get("address") if utxo_details else None,
                "timestamp": utxo_details.get("time", 0) if utxo_details else 0
            }
            
            if callback:
                callback(status)
                
            return status
            
        except Exception as e:
            logger.error(f"Error monitoring UTXO {txid}:{vout}: {e}")
            return {
                "txid": txid,
                "vout": vout,
                "is_spent": True,  # Assume spent on error
                "confirmations": 0,
                "value": 0,
                "address": None,
                "timestamp": 0,
                "error": str(e)
            }

    def get_transaction_details(self, txid: str) -> Optional[Dict]:
        """
        Get detailed information about a transaction.
        
        Args:
            txid: Transaction ID
            
        Returns:
            Dictionary with transaction details or None if not found
        """
        try:
            result = self.rpc.gettransaction(txid)
            return result
        except JSONRPCException as e:
            logger.warning(f"Error getting transaction details {txid}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error getting transaction details {txid}: {e}")
            return None


# Global service instance
bitcoin_rpc = BitcoinRPCService()
