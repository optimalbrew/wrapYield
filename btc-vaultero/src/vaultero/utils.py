"""
Utility functions for the vaultero project.
Alice is borrower, Bob is lender (aka VMgr or vault manager). These references were used in the original code. 
Now trying to use the terms borrower and lender.
"""
from bitcoinutils.proxy import NodeProxy
from bitcoinutils.keys import PublicKey, PrivateKey
from bitcoinutils.script import Script
from bitcoinutils.transactions import Transaction, TxInput, TxOutput, TxWitnessInput, Sequence
from bitcoinutils.utils import to_satoshis, ControlBlock
from bitcoinutils.constants import TYPE_RELATIVE_TIMELOCK
import hashlib

############### Locking Script and P2TR address generation ###############

def get_nums_key():
    """
    Returns the NUMS (Nothing-Up-My-Sleeve) key.
    This is a well-known public key that has no known private key.
    Using this as the internal key ensures the P2TR can only be spent via script path.
    
    The NUMS key is: 0250929b74c1a04954b78b4b60c595c211f8b853e6e84bfa2be95712a7b0dd59e6
    """
    # This is the NUMS key from BIP-341
    nums_hex = "0250929b74c1a04954b78b4b60c595c211f8b853e6e84bfa2be95712a7b0dd59e6"
    return PublicKey.from_hex(nums_hex)


def get_leaf_scripts_output_0(borrower_pub: PublicKey, lender_pub: PublicKey, preimage_hash_borrower: str, borrower_timelock: int ):
    """
    Returns the leaf scripts for the output_0.
    This is the escrow output with two spending paths:
    - one is a multisig + hashlock
    - another is siglock + timelock
    """
    
    #assert that the preimage hash is a valid sha256 hash
    assert len(preimage_hash_borrower) == 64, "Preimage hash must be a 64-character SHA256 hash"
    assert all(c in '0123456789abcdef' for c in preimage_hash_borrower), "Preimage hash must contain only hexadecimal characters"

    # borrower's escape hatch: 144 blocks is 1 day
    seq = Sequence(TYPE_RELATIVE_TIMELOCK, borrower_timelock) #144 blocks is 1 day
    csv_script_borrower = Script([
        seq.for_script(),
        'OP_CHECKSEQUENCEVERIFY',
        'OP_DROP',
        borrower_pub.to_x_only_hex(),
        'OP_CHECKSIG'
    ])

    # Lender will use the preimage hash of the borrower (from EVM chain HTLC) to spend the escrow.
    # borrower will presign the transaction spending this output. Lender will add own sig and the 
    # borrower's preimage to the witness.
    hashlock_and_multisig_script = Script([
        'OP_SHA256',
        preimage_hash_borrower,
        'OP_EQUALVERIFY',
        lender_pub.to_x_only_hex(),
        'OP_CHECKSIG',
        borrower_pub.to_x_only_hex(),
        'OP_CHECKSIGADD',
        'OP_2',
        'OP_NUMEQUALVERIFY',
        'OP_TRUE'
    ])
    return [csv_script_borrower, hashlock_and_multisig_script]

def get_leaf_scripts_output_1(borrower_pub: PublicKey, lender_pub: PublicKey, preimage_hash_lender: str, lender_timelock: int):
    """
    Returns the leaf scripts for the output_1.
    This is the collateral output and it can be spent two ways depending on the loan status:
    1. On default, lender can spend it after a timelock
    2. On repayment, borrower can spend it using the preimage hash of the lender (from EVM chain repayment HTLC)
    """

    assert len(preimage_hash_lender) == 64, "Preimage hash must be a 64-character SHA256 hash"
    assert all(c in '0123456789abcdef' for c in preimage_hash_lender), "Preimage hash must contain only hexadecimal characters"

    # borrower's escape hatch: 144 blocks is 1 day
    seq = Sequence(TYPE_RELATIVE_TIMELOCK, lender_timelock)

    # on default, lender can spend it after a timelock
    csv_script_lender = Script([
        seq.for_script(),
        'OP_CHECKSEQUENCEVERIFY',
        'OP_DROP',
        lender_pub.to_x_only_hex(),
        'OP_CHECKSIG'
    ])

    # borrower can regain collateral if lender accepts repayment and reveals the preimage hash
    hashlock_and_borrower_siglock_script = Script([ 
        'OP_SHA256',
        preimage_hash_lender,
        'OP_EQUALVERIFY',
        borrower_pub.to_x_only_hex(),
        'OP_CHECKSIG'
    ])
    return [csv_script_lender, hashlock_and_borrower_siglock_script]

def get_nums_p2tr_addr_0(borrower_pub: PublicKey, lender_pub: PublicKey, preimage_hash_borrower: str, borrower_timelock: int):
    """
    Returns the NUMS P2TR address for the output_0.
    This is the escrow output with two spending paths:
    - one is a multisig + hashlock
    - another is borrower with timelock
    """
    scripts = get_leaf_scripts_output_0(borrower_pub, lender_pub, preimage_hash_borrower, borrower_timelock)
    # csv_borrower, hashlock_and_multisig_script
    tree = [[scripts[0], scripts[1]]]

    nums_key = get_nums_key()

    taproot_address = nums_key.get_taproot_address(tree)
    return taproot_address


def get_nums_p2tr_addr_1(borrower_pub: PublicKey, lender_pub: PublicKey, preimage_hash_lender: str, lender_timelock: int):
    """
    Returns the NUMS P2TR address for the output_1.
    This is the collateral output and it can be spent two ways depending on loan status:
    1. On default, lender can spend it after a timelock
    2. On repayment, borrower can spend it using the preimage hash of the lender (from EVM chain repayment HTLC)
    """
    scripts = get_leaf_scripts_output_1(borrower_pub, lender_pub, preimage_hash_lender, lender_timelock)
    # csv_lender, hashlock_and_borrower_siglock_script
    tree = [[scripts[0], scripts[1]]]

    nums_key = get_nums_key()

    taproot_address = nums_key.get_taproot_address(tree)
    return taproot_address

############### Transaction generation ###############

def dummy_create_escrow_output(borrower_pub: PublicKey, lender_pub: PublicKey, preimage_hash_borrower: str, borrower_timelock: int):
    """
    Dummy method. Does NOT create the escrow output. The borrower (or anyone on their behalf)
    simply needs to compute the p2tr_0 address and send funds to it.
    
    """
    print(f"Send loan amount + any up front fees to P2TR address: {get_nums_p2tr_addr_0(borrower_pub, lender_pub, preimage_hash_borrower, borrower_timelock)}")
    
    pass


def create_collateral_lock_tx(
        proxy: NodeProxy,
        borrower_pub: PublicKey, lender_pub: PublicKey, 
        preimage_hash_lender: str, 
        lender_timelock: int, 
        txid: str='', vout: int=0,
        orig_fee: float = 0.01, #loan origination fee
        collateral_amount: float = 0.49
        ):
    """
    Borrower previously created the escrow output with (txId and vout).
    This method creates a tx for the lender to spend the escrow output 
        and create the collateral output.
    This uses the multisig + hashlock path. The sigs and preimage will be added
      to the witness later by the lender prior to broadcast.
    The borrower must sign this transaction and share it with the lender.
    The borrower must accept the loan offer on RSK to reveal their preimage.
    """

    input_amount = proxy.gettxout(txid, vout)['value'] #initial amount to fund to p2tr address
    assert input_amount > collateral_amount + orig_fee, "Input amount is less than collateral amount + output orig fee"
    
    #get collateral output address
    collateral_output_address = get_nums_p2tr_addr_1(borrower_pub, lender_pub, preimage_hash_lender, lender_timelock)

    # Create the transaction
    txin = TxInput(txid, vout)
    # Create Script objects for both outputs
    txout1 = TxOutput(to_satoshis(orig_fee), lender_pub.get_address().to_script_pub_key())
    txout2 = TxOutput(to_satoshis(collateral_amount), collateral_output_address.to_script_pub_key())
    tx = Transaction([txin], [txout1, txout2], has_segwit=True)
    
    return tx

def create_collateral_release_tx(
        proxy: NodeProxy,
        borrower_pub: PublicKey, lender_pub: PublicKey, 
        txid: str='', vout: int=0,
        tx_fee: float = 0.01,
        release_to_borrower: bool = True
        ):
    """
    The locked collateral can either be
    1. returned to borrower: using hashlock and siglock script path
     - This is when lender reveals preimage on RSK while accepting borrower's 
        loan repayment
    2. released to lender after timelock: 
        - When borrower defaults (does not repay loan on RSK on time).
        - or when lender does not accept loan repayment on RSK, in an attempt to
            claim the BTC collateral (potentially getting slashed on RSK as a result).
    """
    input_amount = proxy.gettxout(txid, vout)['value']
    assert input_amount > tx_fee, "Input amount is less than tx fee"

    print(f"input_amount: {input_amount}, tx_fee: {tx_fee}")
    print(f"input_amount: {to_satoshis(input_amount)} - tx_fee: {to_satoshis(tx_fee)}")

    # Create the transaction
    txin = TxInput(txid, vout)
    if release_to_borrower:
        txout = TxOutput(to_satoshis(input_amount) - to_satoshis(tx_fee), borrower_pub.get_address().to_script_pub_key())
    else:
        txout = TxOutput(to_satoshis(input_amount) - to_satoshis(tx_fee), lender_pub.get_address().to_script_pub_key())
        
    tx = Transaction([txin], [txout], has_segwit=True)

    return tx

    

