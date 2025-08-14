import pytest
from vaultero.utils import get_nums_key, get_leaf_scripts_output_0, get_leaf_scripts_output_1, get_nums_p2tr_addr_0, get_nums_p2tr_addr_1, create_collateral_lock_tx, create_collateral_release_tx
from vaultero.setup_utils import local_setup, fund_address

from bitcoinutils.setup import setup
from bitcoinutils.proxy import NodeProxy
from bitcoinutils.keys import PrivateKey, PublicKey
from bitcoinutils.script import Script
from bitcoinutils.transactions import Transaction, TxInput, TxOutput, TxWitnessInput, Sequence
from bitcoinutils.utils import to_satoshis, ControlBlock
from bitcoinutils.constants import TYPE_RELATIVE_TIMELOCK
import hashlib


def test_get_nums_key():
    key = get_nums_key()
    assert key.to_hex() == "0250929b74c1a04954b78b4b60c595c211f8b853e6e84bfa2be95712a7b0dd59e6"

def test_local_setup(bitcoin_setup):
    """Test that local setup works correctly."""
    assert bitcoin_setup['addr'] is not None
    assert bitcoin_setup['dest_address'] is not None
    assert bitcoin_setup['proxy'] is not None

def test_test_keys(test_keys):
    """Test that test keys are properly generated."""
    assert test_keys['borrower_pub'] is not None
    assert test_keys['lender_pub'] is not None
    assert test_keys['borrower_priv'] is not None
    assert test_keys['lender_priv'] is not None

def test_get_leaf_scripts_output_0(test_keys):
    """Test that get_leaf_scripts_output_0 fails with invalid preimage hash."""
    with pytest.raises(AssertionError):
        get_leaf_scripts_output_0(test_keys['borrower_pub'], test_keys['lender_pub'], "invalid_hash")

def test_get_leaf_scripts_output_1(test_keys):
    """Test that get_leaf_scripts_output_1 fails with invalid preimage hash."""
    with pytest.raises(AssertionError):
        get_leaf_scripts_output_1(test_keys['borrower_pub'], test_keys['lender_pub'], "invalid_hash")

def test_get_nums_p2tr_addr_0(test_keys, test_data):
    """Test that get_nums_p2tr_addr_0 works correctly by sending funds to the address and checking the balance."""
    #get_nums_p2tr_addr_0(test_keys['borrower_pub'], test_keys['lender_pub'], test_data['preimage_hash_borrower'], test_data['borrower_timelock'])
    #print(get_nums_p2tr_addr_0(test_keys['borrower_pub'], test_keys['lender_pub'], test_data['preimage_hash_borrower']).to_string())
    # 'bcrt1pxch49h4y35pl4zwwqazk0ak2jy2l7yhtcfe2c5kfas75fuajgcnslu0fgl'
    #assert test_data['preimage_hash_borrower'] == hashlib.sha256(test_data['preimage_borrower'].encode()).hexdigest()
    assert get_nums_p2tr_addr_0(test_keys['borrower_pub'], test_keys['lender_pub'], test_data['preimage_hash_borrower'], test_data['borrower_timelock']) is not None


def test_get_nums_p2tr_addr_1(test_keys, test_data):
    """Test that get_nums_p2tr_addr_1 works correctly by sending funds to the address and checking the balance."""
    get_nums_p2tr_addr_1(test_keys['borrower_pub'], test_keys['lender_pub'], test_data['preimage_hash_lender'], test_data['lender_timelock'])
    #print(get_nums_p2tr_addr_1(test_keys['borrower_pub'], test_keys['lender_pub'], test_data['preimage_hash_lender']).to_string())
    #'bcrt1pkasqflhh3yrkf770c0pet5uxsdespq8vvqsvymfu2w5fvlj3cg4s24v2ne'
    assert get_nums_p2tr_addr_1(test_keys['borrower_pub'], test_keys['lender_pub'], test_data['preimage_hash_lender']) is not None


def test_send_funds_to_addr_0(test_keys, test_data, bitcoin_setup):
    """Test that send_funds_to_address works correctly by sending funds to the address and checking the balance."""
    escrow_address = get_nums_p2tr_addr_0(test_keys['borrower_pub'], test_keys['lender_pub'], test_data['preimage_hash_borrower'], test_data['borrower_timelock'])
    proxy = bitcoin_setup['proxy']
    txid,vout = fund_address(escrow_address, 1, proxy, bitcoin_setup['addr'])
    txout = proxy.gettxout(txid, vout) 
    #can't check balance address directly since it is not in node's wallet (plus overall "balance" of external addresses is dynamic)
    #print(f"Transaction details: {txout}")
    assert txout['value'] == 1.0
    assert txout['scriptPubKey']['address'] == escrow_address.to_string()

def test_create_collateral_lock_tx(test_keys, test_data, bitcoin_setup):
    """Test that create_collateral_lock_tx"""
    escrow_address = get_nums_p2tr_addr_0(test_keys['borrower_pub'], test_keys['lender_pub'], test_data['preimage_hash_borrower'], test_data['borrower_timelock'])
    proxy = bitcoin_setup['proxy']
    txid,vout = fund_address(escrow_address, .501, proxy, bitcoin_setup['addr'])

    tx = create_collateral_lock_tx(
        proxy,
        borrower_pub=test_keys['borrower_pub'], 
        lender_pub=test_keys['lender_pub'], 
        preimage_hash_lender=test_data['preimage_hash_lender'], 
        lender_timelock=test_data['lender_timelock'], 
        txid=txid, vout=vout, orig_fee=0.01, collateral_amount=0.49
        )
    #print(f"Transaction: {tx}")
    assert tx is not None
    
def test_spend_escrow_to_collateral(test_keys, test_data, bitcoin_setup):
    """Create witness constuction by spending from hashlock and multisig script path"""
    escrow_address = get_nums_p2tr_addr_0(test_keys['borrower_pub'], test_keys['lender_pub'], test_data['preimage_hash_borrower'], test_data['borrower_timelock'])
    proxy = bitcoin_setup['proxy']
    txid,vout = fund_address(escrow_address, .501, proxy, bitcoin_setup['addr'])

    tx = create_collateral_lock_tx(
        proxy,
        borrower_pub=test_keys['borrower_pub'], 
        lender_pub=test_keys['lender_pub'], 
        preimage_hash_lender=test_data['preimage_hash_lender'], 
        lender_timelock=test_data['lender_timelock'], 
        txid=txid, vout=vout, orig_fee=0.01, collateral_amount=0.49
        )
    
    """until here is same as test_create_collateral_tx"""
    scripts = get_leaf_scripts_output_0(test_keys['borrower_pub'], test_keys['lender_pub'], test_data['preimage_hash_borrower'], test_data['borrower_timelock'])
    tree = [[scripts[0], scripts[1]]]
         
    leaf_index = 1 # multisig + hashlock path    
    tapleaf_script = scripts[leaf_index]

    nums_key = get_nums_key()
    
    ctrl_block = ControlBlock(nums_key, tree,leaf_index, is_odd=escrow_address.is_odd())
    
    # borrower reveals this preimage on RSK when accepting loan offer
    preimage_hex = test_data['preimage_borrower'].encode('utf-8').hex()
    input_amount = proxy.gettxout(txid, vout)['value']
    
    # borrower will pre-sign this tx and share it with lender
    sig_lender = test_keys['lender_priv'].sign_taproot_input(
        tx, 0,
        [escrow_address.to_script_pub_key()],
        [to_satoshis(input_amount)],
        script_path=True,
        tapleaf_script=tapleaf_script,
        tweak=False
    )
    sig_borrower = test_keys['borrower_priv'].sign_taproot_input(
        tx, 0,
        [escrow_address.to_script_pub_key()],
        [to_satoshis(input_amount)],
        script_path=True,
        tapleaf_script=tapleaf_script,
        tweak=False
    )
    # lender adds preimage to witness along with sigs
    witness = TxWitnessInput([
        sig_borrower,
        sig_lender,
        preimage_hex,
        tapleaf_script.to_hex(),
        ctrl_block.to_hex()
    ])
    tx.witnesses.append(witness)
    
    txid = proxy.sendrawtransaction(tx.serialize())
    assert txid is not None

def test_spend_escrow_to_exit(test_keys, test_data, bitcoin_setup):
    """Witness constuction for borrower to spend from escrow to exit without 
    revealing preimage (loan not offerred, or not claimed by borrower)
    """
    escrow_address = get_nums_p2tr_addr_0(test_keys['borrower_pub'], test_keys['lender_pub'], test_data['preimage_hash_borrower'], test_data['borrower_timelock'])
    proxy = bitcoin_setup['proxy']
    txid,vout = fund_address(escrow_address, .501, proxy, bitcoin_setup['addr'])
    input_amount = proxy.gettxout(txid, vout)['value']

    tx = create_collateral_lock_tx(
        proxy,
        borrower_pub=test_keys['borrower_pub'], 
        lender_pub=test_keys['lender_pub'], 
        preimage_hash_lender=test_data['preimage_hash_lender'], 
        lender_timelock=144*180, 
        txid=txid, vout=vout, orig_fee=0.01, collateral_amount=0.49
        )
    
    #print(f"tx: {tx}")
    """until here is same as test_create_collateral_lock_tx"""
    scripts = get_leaf_scripts_output_0(test_keys['borrower_pub'], test_keys['lender_pub'], test_data['preimage_hash_borrower'], test_data['borrower_timelock'])
    tree = [[scripts[0], scripts[1]]]
    
    leaf_index = 0 # csv_borrower path
    tapleaf_script = scripts[leaf_index]

    nums_key = get_nums_key()
    
    
    ctrl_block = ControlBlock(nums_key, tree,leaf_index, is_odd=escrow_address.is_odd())
    
    seq = Sequence(TYPE_RELATIVE_TIMELOCK, test_data['borrower_timelock'])
    seq_for_n_seq = seq.for_input_sequence()
    assert seq_for_n_seq is not None
    tx.inputs[0].sequence = seq_for_n_seq
    
    # borrower will pre-sign this tx and share it with lender
    sig_borrower = test_keys['borrower_priv'].sign_taproot_input(
        tx, 0,
        [escrow_address.to_script_pub_key()],
        [to_satoshis(input_amount)],
        script_path=True,
        tapleaf_script=tapleaf_script,
        tweak=False
    )
    witness = TxWitnessInput([
        sig_borrower,
        tapleaf_script.to_hex(),
        ctrl_block.to_hex()
    ])
    tx.witnesses.append(witness)

    #advance the chain
    proxy.generatetoaddress(test_data['borrower_timelock'], bitcoin_setup['addr'])
    
    txid = proxy.sendrawtransaction(tx.serialize())
    assert txid is not None


def test_return_collateral_to_borrower(test_keys, test_data, bitcoin_setup):
    """
    Witness constuction for borrower to retrieve collateral
    using hashlock and siglock script path, with lender's preimage
    revealed on RSK when lender accepts loan repayment
    """
    collateral_address = get_nums_p2tr_addr_1(test_keys['borrower_pub'], test_keys['lender_pub'], test_data['preimage_hash_lender'], test_data['lender_timelock'])
    proxy = bitcoin_setup['proxy']
    txid,vout = fund_address(collateral_address, .501, proxy, bitcoin_setup['addr'])
    input_amount = proxy.gettxout(txid, vout)['value']

    tx = create_collateral_release_tx(
        proxy,
        borrower_pub=test_keys['borrower_pub'], 
        lender_pub=test_keys['lender_pub'], 
        txid=txid, vout=vout, tx_fee=0.01, release_to_borrower=True
        )
    
    scripts = get_leaf_scripts_output_1(test_keys['borrower_pub'], test_keys['lender_pub'], test_data['preimage_hash_lender'], test_data['lender_timelock'])
    tree = [[scripts[0], scripts[1]]]
    
    leaf_index = 1 # hashlock + siglock path
    tapleaf_script = scripts[leaf_index]

    nums_key = get_nums_key()
    
    ctrl_block = ControlBlock(nums_key, tree,leaf_index, is_odd=collateral_address.is_odd())
    
    preimage_hex = test_data['preimage_lender'].encode('utf-8').hex()
    # borrower will pre-sign this tx and share it with lender
    sig_borrower = test_keys['borrower_priv'].sign_taproot_input(
        tx, 0,
        [collateral_address.to_script_pub_key()],
        [to_satoshis(input_amount)],
        script_path=True,
        tapleaf_script=tapleaf_script,
        tweak=False
    )
    witness = TxWitnessInput([
        sig_borrower,
        preimage_hex,
        tapleaf_script.to_hex(),
        ctrl_block.to_hex()
    ])
    tx.witnesses.append(witness)
    
    txid = proxy.sendrawtransaction(tx.serialize())
    assert txid is not None

def test_release_collateral_to_lender(test_keys, test_data, bitcoin_setup):
    """Witness constuction for lender to capture collateral after timelock"""
    collateral_address = get_nums_p2tr_addr_1(test_keys['borrower_pub'], test_keys['lender_pub'], test_data['preimage_hash_lender'], test_data['lender_timelock'])
    proxy = bitcoin_setup['proxy']
    txid,vout = fund_address(collateral_address, .501, proxy, bitcoin_setup['addr'])
    input_amount = proxy.gettxout(txid, vout)['value']

    tx = create_collateral_release_tx(
        proxy,
        borrower_pub=test_keys['borrower_pub'], 
        lender_pub=test_keys['lender_pub'], 
        txid=txid, vout=vout, tx_fee=0.01, release_to_borrower=False
        )
    
    scripts = get_leaf_scripts_output_1(test_keys['borrower_pub'], test_keys['lender_pub'], test_data['preimage_hash_lender'], test_data['lender_timelock'])
    tree = [[scripts[0], scripts[1]]]
    
    leaf_index = 0 # csv_lender path
    tapleaf_script = scripts[leaf_index]

    nums_key = get_nums_key()
    
    ctrl_block = ControlBlock(nums_key, tree,leaf_index, is_odd=collateral_address.is_odd())
    
    # lender can only capture collateral after timelock
    seq = Sequence(TYPE_RELATIVE_TIMELOCK, test_data['lender_timelock'])
    seq_for_n_seq = seq.for_input_sequence()
    assert seq_for_n_seq is not None
    tx.inputs[0].sequence = seq_for_n_seq
    
    sig_lender = test_keys['lender_priv'].sign_taproot_input(
        tx, 0,
        [collateral_address.to_script_pub_key()],
        [to_satoshis(input_amount)],
        script_path=True,
        tapleaf_script=tapleaf_script,
        tweak=False
    )
    witness = TxWitnessInput([
        sig_lender,
        tapleaf_script.to_hex(),
        ctrl_block.to_hex()
    ])
    tx.witnesses.append(witness)
    
    #advance the chain
    proxy.generatetoaddress(test_data['lender_timelock'], bitcoin_setup['addr'])
    
    txid = proxy.sendrawtransaction(tx.serialize())
    assert txid is not None

