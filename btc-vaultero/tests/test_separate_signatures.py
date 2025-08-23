"""
Tests for separate signature generation workflow.

This simulates the real-world scenario where borrower and lender generate
signatures separately, and borrower sends signature to lender to complete the witness.

Key security feature: Borrower's preimage is NOT included in transmitted data.
The lender adds the preimage when completing the final witness.
"""

import json
import os
from pathlib import Path

from bitcoinutils.keys import PublicKey
from bitcoinutils.transactions import TxWitnessInput
from bitcoinutils.utils import ControlBlock
from bitcoinutils.utils import to_satoshis

from vaultero.utils import (
    get_nums_p2tr_addr_0, 
    get_leaf_scripts_output_0,
    get_nums_key,
    create_collateral_lock_tx
)
from vaultero.setup_utils import fund_address


def _generate_borrower_signature(test_keys, test_data, bitcoin_setup):
    """
    Part 1: Borrower generates signature and saves it to file.
    This simulates borrower creating her signature offline.
    """
    # Setup escrow address and fund it
    escrow_address = get_nums_p2tr_addr_0(
        test_keys['borrower_pub'], 
        test_keys['lender_pub'], 
        test_data['preimage_hash_borrower'], 
        test_data['borrower_timelock']
    )
    proxy = bitcoin_setup['proxy']
    txid, vout = fund_address(escrow_address, .501, proxy, bitcoin_setup['addr'])

    # Create the transaction that will spend from escrow to collateral
    tx = create_collateral_lock_tx(
        proxy,
        borrower_pub=test_keys['borrower_pub'], 
        lender_pub=test_keys['lender_pub'], 
        preimage_hash_lender=test_data['preimage_hash_lender'], 
        lender_timelock=test_data['lender_timelock'], 
        txid=txid, vout=vout, orig_fee=0.01, collateral_amount=0.49
    )
    
    # Get script information needed for signing
    scripts = get_leaf_scripts_output_0(
        test_keys['borrower_pub'], 
        test_keys['lender_pub'], 
        test_data['preimage_hash_borrower'], 
        test_data['borrower_timelock']
    )
    leaf_index = 1  # multisig + hashlock path    
    tapleaf_script = scripts[leaf_index]
    input_amount = proxy.gettxout(txid, vout)['value']
    
    # BORROWER SIGNS: Generate borrower's signature
    sig_borrower = test_keys['borrower_priv'].sign_taproot_input(
        tx, 0,
        [escrow_address.to_script_pub_key()],
        [to_satoshis(input_amount)],
        script_path=True,
        tapleaf_script=tapleaf_script,
        tweak=False
    )
    
    # Save signature data to file (simulating sending to lender)
    # NOTE: Preimage is NOT included - lender will add it later
    signature_data = {
        'sig_borrower': sig_borrower,
        'txid': txid,
        'vout': vout,
        'tx_hex': tx.serialize(),
        'input_amount': float(input_amount),  # Convert Decimal to float for JSON serialization
        'leaf_index': leaf_index,
        'escrow_address_script': escrow_address.to_script_pub_key().to_hex(),
        'tapleaf_script_hex': tapleaf_script.to_hex(),
        'escrow_is_odd': escrow_address.is_odd()
    }
    
    # Save to misc directory (in real world, this would be sent via secure channel)
    misc_dir = Path("misc")
    misc_dir.mkdir(exist_ok=True)  # Create misc directory if it doesn't exist
    signature_file = misc_dir / "borrower_signature.json"
    
    with open(signature_file, 'w') as f:
        json.dump(signature_data, f, indent=2)
    
    print(f"✅ Borrower signature saved to: {signature_file}")
    print(f"📄 Signature data: {sig_borrower[:32]}...") # Show first part of signature
    print(f"📁 File will be preserved for inspection (overwrites previous runs)")
    
    # Verify file was created and contains expected data
    assert signature_file.exists()
    
    with open(signature_file, 'r') as f:
        loaded_data = json.load(f)
    
    assert loaded_data['sig_borrower'] == sig_borrower
    assert loaded_data['txid'] == txid
    assert loaded_data['vout'] == vout
    
    return str(signature_file)  # Helper functions can return values


def _complete_lender_witness(test_keys, test_data, bitcoin_setup, signature_file_path):
    """
    Part 2: Lender reads borrower's signature from file and completes the witness.
    This simulates lender receiving borrower's signature and broadcasting transaction.
    """
    
    # LENDER RECEIVES: Load borrower's signature data from file
    with open(signature_file_path, 'r') as f:
        signature_data = json.load(f)
    
    print(f"✅ Lender loaded signature from: {signature_file_path}")
    
    # Reconstruct transaction and signing context from saved data
    from bitcoinutils.transactions import Transaction
    from bitcoinutils.script import Script
    
    proxy = bitcoin_setup['proxy']
    
    # Recreate transaction from hex
    tx = Transaction.from_raw(signature_data['tx_hex'])
    
    # Recreate escrow address and scripts
    escrow_address = get_nums_p2tr_addr_0(
        test_keys['borrower_pub'], 
        test_keys['lender_pub'], 
        test_data['preimage_hash_borrower'], 
        test_data['borrower_timelock']
    )
    
    scripts = get_leaf_scripts_output_0(
        test_keys['borrower_pub'], 
        test_keys['lender_pub'], 
        test_data['preimage_hash_borrower'], 
        test_data['borrower_timelock']
    )
    
    leaf_index = signature_data['leaf_index']
    tapleaf_script = scripts[leaf_index]
    
    # LENDER SIGNS: Generate lender's signature
    sig_lender = test_keys['lender_priv'].sign_taproot_input(
        tx, 0,
        [escrow_address.to_script_pub_key()],
        [to_satoshis(signature_data['input_amount'])],
        script_path=True,
        tapleaf_script=tapleaf_script,
        tweak=False
    )
    
    print(f"✅ Lender generated signature: {sig_lender[:32]}...")
    
    # Create control block
    nums_key = get_nums_key()
    tree = [[scripts[0], scripts[1]]]
    ctrl_block = ControlBlock(nums_key, tree, leaf_index, is_odd=signature_data['escrow_is_odd'])
    
    # LENDER ADDS PREIMAGE: Lender knows borrower's preimage from protocol context
    preimage_hex = test_data['preimage_borrower'].encode('utf-8').hex()
    
    # COMPLETE WITNESS: Combine both signatures with preimage and create final witness
    witness = TxWitnessInput([
        signature_data['sig_borrower'],  # From file (borrower's signature)
        sig_lender,                      # Generated by lender
        preimage_hex,                    # Lender adds preimage (not from file)
        signature_data['tapleaf_script_hex'],
        ctrl_block.to_hex()
    ])
    
    tx.witnesses = []  # Clear any existing witnesses
    tx.witnesses.append(witness)
    
    # Broadcast transaction
    txid = proxy.sendrawtransaction(tx.serialize())
    assert txid is not None
    
    print(f"✅ Transaction broadcast successfully: {txid}")
    print("🎉 Separate signature workflow completed!")
    
    return txid  # Helper functions can return values


def test_complete_separate_signature_workflow(test_keys, test_data, bitcoin_setup):
    """
    Complete workflow test that demonstrates the entire separate signature process.
    This combines both parts to show the full borrower -> lender signature flow.
    """
    print("\n" + "="*60)
    print("🔄 TESTING COMPLETE SEPARATE SIGNATURE WORKFLOW")
    print("="*60)
    
    print("\n👩‍💻 STEP 1: Borrower generates signature offline...")
    signature_file_path = _generate_borrower_signature(test_keys, test_data, bitcoin_setup)
    
    print("\n👨‍💼 STEP 2: Lender receives signature and completes transaction...")
    
    # Simulate some time passing (lender processing the signature)
    import time
    time.sleep(1)
    
    # Load and verify the signature file exists and is readable
    with open(signature_file_path, 'r') as f:
        data = json.load(f)
        print(f"📦 Signature file contains {len(data)} fields")
        print(f"📝 Transaction ID: {data['txid']}")
        print(f"💰 Amount: {data['input_amount']} BTC")
        print(f"🔒 Note: Preimage NOT included in transmission (added by lender)")
    
    # Complete the transaction
    final_txid = _complete_lender_witness(test_keys, test_data, bitcoin_setup, signature_file_path)
    
    print(f"\n✅ WORKFLOW COMPLETE!")
    print(f"📤 Final transaction: {final_txid}")
    print(f"🔗 Borrower signature was successfully transmitted and used")
    print(f"📁 Signature file preserved at: {signature_file_path}")
    
    # Verify the workflow completed successfully
    assert final_txid is not None
    assert len(final_txid) == 64  # Bitcoin transaction hash length
    assert signature_file_path is not None


def test_borrower_signature_generation(test_keys, test_data, bitcoin_setup):
    """Test that borrower can generate and save signature correctly."""
    signature_file_path = _generate_borrower_signature(test_keys, test_data, bitcoin_setup)
    
    # Verify file was created and is valid
    assert signature_file_path is not None
    from pathlib import Path
    assert Path(signature_file_path).exists()
    
    print(f"📁 Signature file preserved at: {signature_file_path}")


def test_lender_witness_completion(test_keys, test_data, bitcoin_setup):
    """Test that lender can complete witness using borrower's signature."""
    # First generate borrower signature
    signature_file_path = _generate_borrower_signature(test_keys, test_data, bitcoin_setup)
    
    # Then complete with lender
    txid = _complete_lender_witness(test_keys, test_data, bitcoin_setup, signature_file_path)
    
    # Verify transaction was broadcast successfully
    assert txid is not None
    assert len(txid) == 64
